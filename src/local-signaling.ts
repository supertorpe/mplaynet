import { Mesh } from "./mesh";
import { BaseSignaling } from "./base-signaling";
import { RoomRecord, PeerRecord, PairingRecord } from "./records";

export class LocalSignaling extends BaseSignaling {

    private roomId: string = '';
    private username : string = '';
    private pairRecordMap: Map<string, string> = new Map();
    private timers: number[] = [];

    constructor() {
        super();
    }

    protected cleanup(): void {
        this.timers.forEach(timer => {
            if (timer) window.clearInterval(timer);
        });
        // HACK: remove timer when where are sure all peers are connected
        // and can safely delete the info
        setTimeout(() => {
            localStorage.removeItem(this.roomId);
            for (const value of this.pairRecordMap.values()) {
                localStorage.removeItem(value);
            }
        }, 5000);
    }

    /* Listen for changes produced by another document */
    private listenRoomRecordChanges(roomId: string, username: string) {
        onstorage = event => {
            if (event.key === roomId && event.newValue) {
                this.roomRecordChanged(JSON.parse(event.newValue), roomId, username, this._uuid);
            }
        }
    }

    protected internalHostRoom(roomId: string, username: string): Promise<boolean> {
        this.roomId = roomId;
        this.username = username;
        this.listenRoomRecordChanges(roomId, username);
        return new Promise<boolean>((resolve) => {
            const roomRecord = new RoomRecord(roomId, []);
            const sRoomRecord = JSON.stringify(roomRecord);
            localStorage.setItem(roomId, sRoomRecord);
            this.roomRecordChanged(roomRecord, roomId, username, this._uuid);
            resolve(true);
        });
    }

    protected internalJoinRoom(roomId: string, username: string): Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            const sRoomRecord = localStorage.getItem(roomId);
            if (!sRoomRecord) {
                resolve(false);
            } else {
                this.roomId = roomId;
                this.username = username;
                this.listenRoomRecordChanges(roomId, username);
                this.roomRecordChanged(JSON.parse(sRoomRecord), roomId, username, this._uuid);
                resolve(true);
            }
        });
    }

    protected saveRoomInfo(): void {
        if (this.roomRecord) {
            localStorage.setItem(this.roomId, JSON.stringify(this.roomRecord));
            this.roomRecordChanged(this.roomRecord, this.roomId, this.username, this._uuid);
        }
    }

    protected saveIceCandidate(uuid: string, candidate: string): void {
        const pairRecordName = this.pairRecordMap.get(uuid);
        if (pairRecordName) {
            const sPairingRecord = localStorage.getItem(pairRecordName);
            if (sPairingRecord) {
                const pairingRecord : PairingRecord = JSON.parse(sPairingRecord);
                if (uuid === pairingRecord.uuid1) {
                    pairingRecord.iceCandidates2.push(candidate);
                } else {
                    pairingRecord.iceCandidates1.push(candidate);
                }
                localStorage.setItem(pairRecordName,JSON.stringify(pairingRecord));
            }
        }
    }
    protected savePairing(mesh: Mesh, myIndex: number, index: number, peer: PeerRecord): void {
        if (this.roomRecord) {
            const pairRecordName = `pair_${this.roomRecord.roomId}_${Math.min(index, myIndex)}_${Math.max(index, myIndex)}`;
            this.pairRecordMap.set(peer.uuid, pairRecordName);
            const pairRecord = localStorage.getItem(pairRecordName);
            if (!pairRecord && myIndex < index) {
                const pairingRecord = new PairingRecord(0,'','',[],[],'','');
                this.pairingRecordChanged(mesh, pairingRecord, peer, myIndex, index);
            }
            // race condition: if the other peer saves the change before we register the event handler, it doesn't fire.
            /*
            onstorage = event => {
                if (event.key === pairRecordName && event.newValue) {
                    this.pairingRecordChanged(mesh, JSON.parse(event.newValue), peer, myIndex, index);
                }
            }*/
            // Hack: poll the data
            let latestValue = localStorage.getItem(pairRecordName);
            const timer = window.setInterval(() => {
                const currentValue = localStorage.getItem(pairRecordName);
                if (currentValue && currentValue !== latestValue) {
                    latestValue = currentValue;
                    this.pairingRecordChanged(mesh, JSON.parse(currentValue), peer, myIndex, index);
                }
            }, 1000);
            this.timers.push(timer);
        }
    }
    protected savePairingRecord(info: PairingRecord, uuid: string): void {
        const pairRecordName = this.pairRecordMap.get(uuid);
        if (pairRecordName) {
            localStorage.setItem(pairRecordName, JSON.stringify(info));
        }
    }

}