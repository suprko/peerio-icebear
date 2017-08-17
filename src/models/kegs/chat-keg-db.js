const ChatBootKeg = require('./chat-boot-keg');
const socket = require('../../network/socket');
const User = require('../user/user');
const contactStore = require('../contacts/contact-store');
const _ = require('lodash');
const { retryUntilSuccess } = require('../../helpers/retry');
const Contact = require('../contacts/contact');
const { observable, computed } = require('mobx');
/**
 * Class for shared keg databases.
 * Chat is not really created until boot keg is updated for the first time.
 * Multiple people might try to create boot keg for the same chat at the same time.
 * We have a special logic to resolve this kind of situations.
 *
 * ChatKegDb is similar to {@link KegDb} in a sense that it has same `id`, `boot` and `key`
 * properties, but the logic is too different to extract a base class. Although when saving and loading Kegs,
 * you can use both databases, the properties mentioned is all Kegs can care about.
 *
 * Chat loading logic // todo: update this with channels logic modifications
 * ```
 * retryUntilSuccess(
 * 1. Do we have ID for the chat?
 * - 1.1 NO:
 *      - create-chat
 *      - if resolved: now we have chat meta data, GOTO (2.)
 *      - if rejected: retry is triggered
 * - 1.2 YES:
 *      - get metadata
 *      - if resolved: now we have chat meta data, GOTO (2.)
 *      - if rejected: retry is triggered
 * 2. Parse chat metadata
 * 3. Does boot keg exist? (load it and check if keg version > 1)
 * - 3.1 YES:
 *      - load boot keg
 *      - resolved: is it valid ?
 *          - YES: FINISH. Promise.resolve(true)
 *          - NO: FINISH. Promise.resolve(false) for retry to not trigger
 *      - rejected: retry is triggered
 * - 3.2 NO:
 *      - create boot keg.
 *          - resolved: FINISH. Promise.resolve(true)
 *          - rejected: retry is triggered
 * - 3.3 load failed: retry is triggered
 * , 'Unique retry id')
 * ```
 * At least one of 2 parameters should be passed
 * @param {string} [id] - or specific id for shared databases
 * @param {Array<Contact>} [participants] - participants list, EXCLUDING own username
 * @param {bool} [isChannel=false] - does this db belong to a DM or Channel
 * @public
 */
class ChatKegDb {
    constructor(id, participants = [], isChannel = false) {
        this.id = id;
        const usernames = _.uniq(participants.map(p => p.username));
        if (usernames.length !== participants.length) {
            console.warn('ChatKegDb constructor received participant list containing duplicates.');
        }
        const ind = usernames.indexOf(User.current.username);
        if (ind >= 0) {
            usernames.splice(ind, 1);
            console.warn('ChatKegDb constructor received participant list containing current user.');
        }
        this.participantsToCreateWith = usernames.map(p => contactStore.getContact(p));

        this.isChannel = isChannel;
        // Just to prevent parallel load routines. We can't use chat id because we don't always have it.
        this._retryId = Math.random();
    }
    /**
     * System-wide unique database id generated by server
     * @member {string}
     * @public
     */
    id;
    /**
     * Database key to use for keg encryption.
     * @member {?Uint8Array}
     * @readonly
     * @public
     */
    get key() {
        return this.boot ? this.boot.kegKey : null;
    }

    /**
     * Current key id for the database
     * @member {?string}
     * @readonly
     * @public
     */
    get keyId() {
        return this.boot ? this.boot.kegKeyId : null;
    }

    /**
     * @member {BootKeg} boot
     * @memberof ChatKegDb
     * @instance
     * @public
     */
    @observable boot;

    /**
     * Just a mirror of this.boot.participants
     * @member {ObservableArray<Contact>} participants
     * @memberof ChatKegDb
     * @instance
     * @public
     */
    @computed get participants() {
        return this.boot && this.boot.participants || [];
    }

    /**
     * Just a mirror of this.boot.admins
     * @member {ObservableArray<Contact>} admins
     * @memberof ChatKegDb
     * @instance
     * @public
     */
    @computed get admins() {
        return this.boot && this.boot.admins || [];
    }

    /**
     * All participants except current user.
     * This will be used to create chat, if passed.
     * For DMs create operation will return existing chat.
     * @member {Array<Contact>}
     * @public
     */
    participantsToCreateWith;

    /**
     * if true - something is wrong with boot keg, most likely it was maliciously created and can't be used
     * @member {boolean}
     * @public
     */
    dbIsBroken = false;

    /**
     * Is this a channel or DM db.
     * @member {boolean}
     * @public
     */
    isChannel;

    /**
     * Performs initial load of the keg database data based on id or participants list.
     * Will create kegDb and boot keg if needed.
     * @returns {Promise}
     * @protected
     */
    loadMeta() {
        return retryUntilSuccess(() => {
            if (this.id) {
                return this._loadExistingChatMeta();
            }
            return this._createChatMeta();
        }, this._retryId);
    }

    _loadExistingChatMeta() {
        return socket.send('/auth/kegs/db/meta', { kegDbId: this.id })
            .then(this._parseMeta)
            .then(this._resolveBootKeg);
    }

    _createChatMeta() {
        if (this.isChannel) {
            return socket.send('/auth/kegs/db/create-channel')
                .then(this._parseMeta)
                .then(this._resolveBootKeg);
        }
        const arg = { participants: this.participantsToCreateWith.map(p => p.username) };
        arg.participants.push(User.current.username);
        // server will return existing chat if it does already exist
        // the logic below takes care of rare collision cases, like when users create chat or boot keg at the same time
        return socket.send('/auth/kegs/db/create-chat', arg)
            .then(this._parseMeta)
            .then(this._resolveBootKeg);
    }


    // fills current object properties from raw keg metadata
    _parseMeta = (meta) => {
        this.id = meta.id;
        if (!this.isChannel && meta.permissions && meta.permissions.users) {
            this._metaParticipants = Object.keys(meta.permissions.users).map(username => contactStore.getContact(username));
        }
    }

    // figures out if we need to load/create boot keg and does it
    _resolveBootKeg = () => {
        return this.loadBootKeg()
            .then(boot => {
                if (boot.version > 1) {
                    if (!boot.format) {
                        boot.participants = this._metaParticipants;
                        // prevent spamming server on bootkeg migration
                        return Promise.delay(Math.round(Math.random() * 2000 + 1000))
                            .then(() => boot.saveToServer())
                            .catch(err => {
                                console.error('Failed to migrate boot keg.', this.id, err);
                            })
                            .return([boot, false]);
                    }
                    return [boot, false];
                }
                return this.createBootKeg();
            })
            .spread((boot, justCreated) => {
                this.boot = boot;
                if (!this.key && !justCreated) this.dbIsBroken = true;
                return justCreated;
            })
            .tapCatch(err => console.error(err));
    }

    /**
     * Create boot keg for this database
     * @private
     */
    createBootKeg() {
        console.log(`Creating chat boot keg for ${this.id}, isChannel:${this.isChannel}`);
        const participants = this.participantsToCreateWith.slice();
        const selfContact = contactStore.getContact(User.current.username);
        participants.push(selfContact);
        return Contact.ensureAllLoaded(participants)
            .then(() => {
                // keg key for this db
                const boot = new ChatBootKeg(this, User.current, this.isChannel);
                boot.addKey();
                participants.forEach(p => {
                    boot.addParticipant(p);
                });
                if (this.isChannel) {
                    boot.assignRole(selfContact, 'admin');
                }

                // saving bootkeg
                return boot.saveToServer().return([boot, true]);
            });
    }

    /**
     * Retrieves boot keg for the db and initializes this KegDb instance with required data.
     * @private
     */
    loadBootKeg() {
        // console.log(`Loading chat boot keg for ${this.id}`);
        const boot = new ChatBootKeg(this, User.current);
        return boot._enqueueLoad().return(boot);
    }
}

module.exports = ChatKegDb;
