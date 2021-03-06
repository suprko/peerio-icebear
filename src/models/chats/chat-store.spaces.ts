import { computed, observable } from 'mobx';
import config from '../../config';
import { ChatStore } from './chat-store';
import Chat from './chat';

class Space {
    constructor(store: ChatStore) {
        this.store = store;
    }

    spaceId = '';
    spaceName = '';
    spaceDescription = '';
    store: ChatStore;

    @computed
    get allRooms(): Chat[] {
        return this.store.allRooms
            .filter(c => c.isInSpace)
            .filter(c => c.chatHead.spaceId === this.spaceId);
    }

    @computed
    get internalRooms() {
        return this.allRooms.filter(c => c.chatHead.spaceRoomType === 'internal');
    }

    @computed
    get patientRooms() {
        return this.allRooms.filter(c => c.chatHead.spaceRoomType === 'patient');
    }

    @observable isNew = false;

    countUnread = (count, room) => count + room.unreadCount;
    @computed
    get unreadCount() {
        const internalRoomsUnread = this.internalRooms.reduce(this.countUnread, 0);
        const patientRoomsUnread = this.patientRooms.reduce(this.countUnread, 0);

        return internalRoomsUnread + patientRoomsUnread;
    }
}

class ChatStoreSpaces {
    constructor(store: ChatStore) {
        this.store = store;
    }
    store: ChatStore;

    @computed
    get roomsWithinSpaces() {
        return this.store.allRooms.filter(chat => chat.isInSpace);
    }

    /**
     * Subset of ChatStore#chats, contains all spaces
     */
    @computed
    get spacesList(): Space[] {
        if (config.whiteLabel.name !== 'medcryptor') {
            return [];
        }
        const mapData = this.roomsWithinSpaces.map(
            chat =>
                [
                    chat.chatHead.spaceId, // key: the space's id
                    this.getSpaceFrom(chat) // value: the space object
                ] as [string, Space]
        );
        // aggregate all spaces by id
        const spacesMap = new Map<string, Space>(mapData);

        // return all unique spaces as array
        const spaces = [...spacesMap.values()].sort((a, b) => {
            return a.spaceName.localeCompare(b.spaceName);
        });

        return spaces;
    }

    getSpaceFrom = chat => {
        const space = new Space(this.store);
        space.spaceId = chat.chatHead.spaceId;
        space.spaceName = chat.chatHead.spaceName;
        space.spaceDescription = chat.chatHead.spaceDescription;

        return space;
    };

    createRoomInSpace = async (space, roomName, roomType, participants) => {
        space.nameInSpace = roomName;
        space.spaceRoomType = roomType;
        const name = `${space.spaceName} - ${roomName}`;
        const chat = await this.store.startChat(participants, true, name, '', true, space);

        return chat;
    };

    @observable activeSpaceId: string = null;

    @computed
    get currentSpace(): Space {
        if (!this.spacesList || !this.activeSpaceId) return null;
        return this.spacesList.find(x => x.spaceId === this.activeSpaceId);
    }

    @computed
    get currentSpaceName() {
        if (!this.currentSpace) return '';
        return this.currentSpace.spaceName;
    }

    @computed
    get isPatientRoomOpen() {
        if (!this.store.activeChat || !this.currentSpace || !this.currentSpace.patientRooms)
            return null;
        return this.currentSpace.patientRooms.some(r => r.id === this.store.activeChat.id);
    }

    @computed
    get isInternalRoomOpen() {
        if (!this.store.activeChat || !this.currentSpace || !this.currentSpace.internalRooms)
            return null;
        return this.currentSpace.internalRooms.some(r => r.id === this.store.activeChat.id);
    }

    @computed
    get currentRoomType() {
        if (this.isPatientRoomOpen) return 'patientroom';
        if (this.isInternalRoomOpen) return 'internalroom';
        return null;
    }
}

export default ChatStoreSpaces;
