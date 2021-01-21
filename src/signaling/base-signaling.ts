import { EventEmitter } from "../event-emitter";
import { Mesh } from "../mesh";
import { uuidv4 } from "../utils";
import { PairingItem, PairingRecord, PeerRecord, RoomRecord } from "./records";

export abstract class BaseSignaling {

    protected _uuid: string = '';
    protected roomRecord: RoomRecord | null = null;
    protected _roomRecordEmitter: EventEmitter<RoomRecord>;
    protected pairingMap: Map<string, PairingItem> = new Map();

    get roomRecordEmitter(): EventEmitter<RoomRecord> {
        return this._roomRecordEmitter;
    }

    get uuid(): string {
        return this._uuid;
    }

    constructor() {
        this._roomRecordEmitter = new EventEmitter<RoomRecord>();
    }

    public hostRoom(roomId: string, username: string, uuid: string): Promise<boolean> {
        if (!uuid)
            uuid = uuidv4();
        this._uuid = uuid;
        return this.internalHostRoom(roomId, username);
    }
    public joinRoom(roomId: string, username: string, uuid: string): Promise<boolean> {
        if (!uuid)
            uuid = uuidv4();
        this._uuid = uuid;
        return this.internalJoinRoom(roomId, username);
    }
    protected abstract internalHostRoom(roomId: string, username: string): Promise<boolean>;
    protected abstract internalJoinRoom(roomId: string, username: string): Promise<boolean>;
    protected abstract saveRoomInfo(): void;
    protected abstract saveIceCandidate(uuid: string, candidate: string): void;
    protected abstract savePairing(mesh: Mesh, myIndex: number, index: number, peer: PeerRecord): void;
    protected abstract savePairingRecord(info: PairingRecord, uuid: string): void;

    public upatePlayerStatus(ready: boolean) {
        if (this.roomRecord) {
            const peer = this.roomRecord.peers.find(
                (peer) => peer.uuid === this._uuid
            );
            if (peer) {
                peer.ready = ready;
                this.saveRoomInfo();
            }
        }
    }

    protected roomRecordChanged(info: RoomRecord, roomId: string, username: string, uuid: string) {
        if (!info || !info.peers) {
            this.roomRecord = new RoomRecord(roomId, []);
          } else {
            this.roomRecord = info;
          }
          if (!this.roomRecord.peers.some((peer) => peer.uuid === uuid)) {
            this.roomRecord.peers.push(new PeerRecord(username, uuid, false));
            this.saveRoomInfo();
          } else {
            this._roomRecordEmitter.notify(uuid, info);
          }
    }

    public startPairings(mesh: Mesh) {
        return new Promise<boolean>((resolve) => {
            mesh.channelOpenEmitter.addEventListener((_uuid, opened) => {
                const connectionCount = mesh.connectionCount();
                const connectionsOpened = mesh.connectionsOpened();
                console.log(`opened ${connectionsOpened} of ${connectionCount} connections`);
                if (connectionsOpened === connectionCount)
                    resolve(opened);
            });
            mesh.iceCandidateEmitter.addEventListener((uuid, candidate) => {
                let sCandidate = JSON.stringify(candidate);
                if (!candidate.candidate) return;
                console.log('candidate: ' + sCandidate);
                this.saveIceCandidate(uuid, sCandidate);
            });
            if (this.roomRecord) {
                const myIndex = this.roomRecord.peers.findIndex((peer) => peer.uuid === this._uuid);
                for (let [index, peer] of this.roomRecord.peers.entries()) {
                    if (index === myIndex) {
                        continue;
                    }
                    this.savePairing(mesh, myIndex, index, peer);
                }
            }
        });
    }

    protected pairingRecordChanged(mesh: Mesh, info: PairingRecord, peer: PeerRecord, myIndex: number, index: number) {
        if (!info || !info.status) {
            if (myIndex < index) {
                mesh.createConnection(peer.uuid);
                mesh.createOffer(peer.uuid).then((offer) => {
                    console.log('create offer');
                    info = new PairingRecord(
                        1,
                        this._uuid,
                        peer.uuid,
                        [],
                        [],
                        JSON.stringify(offer),
                        ''
                    );
                    this.pairingMap.set(
                        peer.uuid,
                        new PairingItem([], false, false)
                    );
                    this.savePairingRecord(info, peer.uuid);
                });
            }
        } else {
            let pairingItem = this.pairingMap.get(peer.uuid);
            if (!pairingItem) {
                pairingItem = new PairingItem([], false, false);
                this.pairingMap.set(peer.uuid, pairingItem);
            }
            if (myIndex > index && info.offer && !pairingItem.answered) {
                pairingItem.answered = true;
                mesh.createConnection(peer.uuid);
                mesh
                    .createAnswer(peer.uuid, JSON.parse(info.offer))
                    .then((answer) => {
                        console.log('create answer');
                        info.answer = JSON.stringify(answer);
                        this.savePairingRecord(info, peer.uuid);
                    });
            }
            if (
                myIndex < index &&
                info.answer &&
                !pairingItem.answerVerified
            ) {
                console.log('verify answer');
                pairingItem.answerVerified = true;
                mesh.verifyAnswer(peer.uuid, JSON.parse(info.answer));
            }
            let candidates: string[];
            if (myIndex < index) {
                candidates = info.iceCandidates2;
            } else {
                candidates = info.iceCandidates1;
            }
            candidates.forEach((candidate) => {
                if (
                    pairingItem &&
                    !pairingItem.iceCandidatesDone.includes(candidate)
                ) {
                    pairingItem.iceCandidatesDone.push(candidate);
                    console.log('add candidate: ' + JSON.stringify(candidate));
                    mesh.addIceCandidate(peer.uuid, JSON.parse(candidate));
                }
            });
        }
    }

}