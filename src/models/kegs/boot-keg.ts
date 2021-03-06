import Keg from './keg';
import KegDb from './keg-db';

import { observable, when, Lambda } from 'mobx';

import * as util from '../../crypto/util';
import { KeyPair, IBootKeg, IKegDb } from '../../defs/interfaces';

export interface BootKegPayload {
    kegKey: string;
    signKeys: {
        publicKey: string;
        secretKey: string;
    };
    encryptionKeys: {
        publicKey: string;
        secretKey: string;
    };
}

/**
 * Named plaintext Boot keg for 'SELF' databases.
 */
export default class BootKeg extends Keg<BootKegPayload> implements IBootKeg {
    constructor(db: KegDb, bootKey: Uint8Array) {
        // named kegs are pre-created, so we know the id already and only going to update boot keg
        super('boot', 'boot', db as IKegDb);
        this.overrideKey = bootKey;
        this.version = 1; // pre-created named keg
    }

    @observable.shallow keys = {};
    kegKey: Uint8Array | null = null;
    kegKeyId = '0';

    signKeys: KeyPair | null = null;
    encryptionKeys: KeyPair | null = null;

    /**
     * Waits until keyId is available and resolves with it.
     * If the key will not appear in the timeout time, resolves to undefined.
     */
    async getKey(keyId: string, timeout = 120000): Promise<Uint8Array> {
        if (this.keys[keyId]) {
            // quick path
            return this.keys[keyId].key;
        }
        let resolve: Lambda;
        const promise = new Promise(_resolve => {
            resolve = _resolve;
        });
        const disposeReaction = when(() => !!this.keys[keyId], resolve);
        await promise.timeout(timeout).catch(() => {
            disposeReaction();
        });
        return this.keys[keyId] ? this.keys[keyId].key : null;
    }

    deserializeKegPayload(data: BootKegPayload) {
        this.signKeys = {} as KeyPair;
        this.signKeys.publicKey = util.b64ToBytes(data.signKeys.publicKey);
        this.signKeys.secretKey = util.b64ToBytes(data.signKeys.secretKey);

        this.encryptionKeys = {} as KeyPair;
        this.encryptionKeys.publicKey = util.b64ToBytes(data.encryptionKeys.publicKey);
        this.encryptionKeys.secretKey = util.b64ToBytes(data.encryptionKeys.secretKey);

        this.kegKey = util.b64ToBytes(data.kegKey);
        this.keys[this.kegKeyId] = { key: this.kegKey, createdAt: Date.now() };
    }

    serializeKegPayload(): BootKegPayload {
        return {
            signKeys: {
                publicKey: util.bytesToB64(this.signKeys.publicKey),
                secretKey: util.bytesToB64(this.signKeys.secretKey)
            },
            encryptionKeys: {
                publicKey: util.bytesToB64(this.encryptionKeys.publicKey),
                secretKey: util.bytesToB64(this.encryptionKeys.secretKey)
            },
            kegKey: util.bytesToB64(this.kegKey)
        };
    }
}
