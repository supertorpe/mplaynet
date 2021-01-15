import { DeepstreamClient } from '@deepstream/client';
import { Record } from '@deepstream/client/dist/src/record/record';
import { EventEmitter } from './event-emitter';
import { Mesh } from './mesh';
import { RoomRecord, PeerRecord, PairingRecord, PairingItem } from './records';

export class DeepstreamSignaling {
  private deepstreamClient: DeepstreamClient;
  private room: Record | null = null;
  private subscriptions: Record[] = [];
  private roomRecord: RoomRecord | null = null;
  private _uuid: string = '';
  private pairRecordMap: Map<string, Record> = new Map();
  private pairingMap: Map<string, PairingItem> = new Map();
  private _roomRecordEmitter: EventEmitter<RoomRecord>;

  constructor(deepstreamUrl: string) {
    this._roomRecordEmitter = new EventEmitter<RoomRecord>();
    this.deepstreamClient = new DeepstreamClient(deepstreamUrl);
    this.deepstreamClient.login();
  }

  get roomRecordEmitter(): EventEmitter<RoomRecord> {
    return this._roomRecordEmitter;
  }

  private bindRoom(roomId: string, username: string, uuid: string) {
    this._uuid = uuid;
    this.room = this.deepstreamClient.record.getRecord(`room_${roomId}`);
    this.subscriptions.push(this.room);
    this.room.subscribe((info: RoomRecord) => {
      if (!info || !info.peers) {
        this.roomRecord = new RoomRecord(roomId, []);
      } else {
        this.roomRecord = info;
      }
      if (!this.roomRecord.peers.some((peer) => peer.uuid === uuid)) {
        this.roomRecord.peers.push(new PeerRecord(username, uuid, false));
        this.saveRoomRecord();
      } else {
        this._roomRecordEmitter.notify(uuid, info);
      }
    });
  }

  public hostRoom(roomId: string, username: string, uuid: string) {
    this.bindRoom(roomId, username, uuid);
  }

  public joinRoom(roomId: string, username: string, uuid: string) {
    return this.deepstreamClient.record.has(`room_${roomId}`).then((value) => {
      if (value) {
        this.bindRoom(roomId, username, uuid);
      }
      return value;
    });
  }

  public close() {
    this.subscriptions.forEach((record) => record.unsubscribe(() => {}));
  }

  public upatePlayerStatus(ready: boolean) {
    if (this.roomRecord) {
      const peer = this.roomRecord.peers.find(
        (peer) => peer.uuid === this._uuid
      );
      if (peer) {
        peer.ready = ready;
        this.saveRoomRecord();
      }
    }
  }

  private saveRoomRecord() {
    if (this.room) this.room.set(JSON.parse(JSON.stringify(this.roomRecord)));
  }

  public startPairings(mesh: Mesh) {
    return new Promise<boolean>((resolve) => {
      mesh.channelOpenEmitter.addEventListener((_uuid, _event) => {
        console.log('mesh opened');
        resolve(true);
      });
      mesh.iceCandidateEmitter.addEventListener((uuid, candidate) => {
        let sCandidate = JSON.stringify(candidate);
        if (!candidate.candidate) return;
        console.log('candidate: ' + sCandidate);
        const pairRecord = this.pairRecordMap.get(uuid);
        if (pairRecord) {
          const pairingRecord: PairingRecord = pairRecord.get();
          if (uuid === pairingRecord.uuid1) {
            pairingRecord.iceCandidates2.push(sCandidate);
          } else {
            pairingRecord.iceCandidates1.push(sCandidate);
          }
          pairRecord.set(JSON.parse(JSON.stringify(pairingRecord)));
        }
      });
      if (this.roomRecord) {
        const myIndex = this.roomRecord.peers.findIndex(
          (peer) => peer.uuid === this._uuid
        );
        for (let [index, peer] of this.roomRecord.peers.entries()) {
          if (index === myIndex) {
            continue;
          }
          const pairRecordName = `pair_${this.roomRecord.roomId}_${Math.min(
            index,
            myIndex
          )}_${Math.max(index, myIndex)}`;
          const pairRecord = this.deepstreamClient.record.getRecord(
            pairRecordName
          );

          pairRecord.setMergeStrategy(
            (
              localValue: any,
              _localVersion,
              remoteValue: any,
              _remoteVersion,
              callback
            ) => {
              if (remoteValue.status > localValue.status)
                localValue.status = remoteValue.status;
              if (!localValue.uuid1 && remoteValue.uuid1)
                localValue.uuid1 = remoteValue.uuid1;
              if (!localValue.uuid2 && remoteValue.uuid2)
                localValue.uuid2 = remoteValue.uuid2;
              if (!localValue.answer && remoteValue.answer)
                localValue.answer = remoteValue.answer;
              remoteValue.iceCandidates1.forEach((candidate: any) => {
                if (!localValue.iceCandidates1.includes(candidate)) {
                  localValue.iceCandidates1.push(candidate);
                }
              });
              remoteValue.iceCandidates2.forEach((candidate: any) => {
                if (!localValue.iceCandidates2.includes(candidate)) {
                  localValue.iceCandidates2.push(candidate);
                }
              });
              if (!localValue.offer && remoteValue.offer)
                localValue.offer = remoteValue.offer;
              if (!localValue.answer && remoteValue.answer)
                localValue.answer = remoteValue.answer;
              callback(null, localValue);
            }
          );
          this.pairRecordMap.set(peer.uuid, pairRecord);
          this.subscriptions.push(pairRecord);
          pairRecord.subscribe((info: PairingRecord) => {
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
                  pairRecord.set(JSON.parse(JSON.stringify(info)));
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
                    pairRecord.set(JSON.parse(JSON.stringify(info)));
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
          });
        }
      }
    });
  }
}
