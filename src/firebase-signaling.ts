import firebase from "firebase/app";
import { BaseSignaling } from "./base-signaling";
import { Mesh } from "./mesh";
import { PairingRecord, PeerRecord, RoomRecord } from "./records";

export class FirebaseSignaling extends BaseSignaling {

    private db: firebase.firestore.Firestore;
    private roomsCollectionRef: firebase.firestore.CollectionReference;
    private roomRef: firebase.firestore.DocumentReference | null = null;
    private pairRecordMap: Map<string, firebase.firestore.DocumentReference> = new Map();

    constructor(config: any) {
        super();
        firebase.initializeApp(config);
        this.db = firebase.firestore();
        this.roomsCollectionRef = this.db.collection('rooms');
    }

    private bindRoom(roomId: string, username: string, uuid: string): Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            this.roomRef = this.roomsCollectionRef.doc(roomId);
            this.roomRef.onSnapshot((doc) => {
                const data = doc.data();
                if (data) {
                    this.roomRecordChanged(JSON.parse(data.info), roomId, username, uuid);
                    resolve(true);
                } else {
                    resolve(false);
                }
            });
        });
    }

    public hostRoom(roomId: string, username: string, uuid: string): Promise<boolean> {
        this._uuid = uuid;
        return new Promise<boolean>((resolve) => {
            const roomRecord = new RoomRecord(roomId, []);
            this.roomRef = this.roomsCollectionRef.doc(roomId);
            this.roomRef.set({ info: JSON.stringify(roomRecord) })
                .then(() => {
                    this.bindRoom(roomId, username, uuid).then(ok => resolve(ok));
                })
                .catch((error) => {
                    console.log(error);
                    resolve(false);
                });
        });
    }

    public joinRoom(roomId: string, username: string, uuid: string): Promise<boolean> {
        this._uuid = uuid;
        return this.bindRoom(roomId, username, uuid);
    }

    protected saveRoomInfo(): void {
        if (this.roomRef) this.roomRef.set({ info: JSON.stringify(this.roomRecord) });
    }

    protected saveIceCandidate(uuid: string, candidate: string): void {
        const pairRecord = this.pairRecordMap.get(uuid);
        if (pairRecord) {
            pairRecord.get().then(doc => {
                const data = doc.data();
                if (data) {
                    const pairingRecord: PairingRecord = JSON.parse(data.info);
                    if (uuid === pairingRecord.uuid1) {
                        pairingRecord.iceCandidates2.push(candidate);
                    } else {
                        pairingRecord.iceCandidates1.push(candidate);
                    }
                    pairRecord.set({ info: JSON.stringify(pairingRecord)});
                }
            });
        }
    }

    protected savePairing(mesh: Mesh, myIndex: number, index: number, peer: PeerRecord): void {
        if (this.roomRecord) {
            const pairRecordName = `pair_${this.roomRecord.roomId}_${Math.min(index, myIndex)}_${Math.max(index, myIndex)}`;
            const pairRecord = this.roomsCollectionRef.doc(pairRecordName);
            this.pairRecordMap.set(peer.uuid, pairRecord);
            pairRecord.onSnapshot((doc) => {
                const data = doc.data();
                if (data) {
                    this.pairingRecordChanged(mesh, JSON.parse(data.info), peer, myIndex, index);
                } else if (myIndex < index) {
                    const pairingRecord = new PairingRecord(0,'','',[],[],'','');
                    pairRecord.set({info: JSON.stringify(pairingRecord)});
                }
            });
        }
    }

    protected savePairingRecord(info: PairingRecord, uuid: string): void {
        const pairRecord = this.pairRecordMap.get(uuid);
        if (pairRecord)
            pairRecord.set({ info: JSON.stringify(info) });
    }

}