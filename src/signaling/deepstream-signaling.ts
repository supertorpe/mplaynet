import { DeepstreamClient } from '@deepstream/client';
import { Record } from '@deepstream/client/dist/src/record/record';
import { BaseSignaling } from './base-signaling';
import { Mesh } from '../mesh';
import { RoomRecord, PeerRecord, PairingRecord } from './records';

export class DeepstreamSignaling extends BaseSignaling {

  private deepstreamClient: DeepstreamClient;
  private room: Record | null = null;
  private subscriptions: Record[] = [];
  private pairRecordMap: Map<string, Record> = new Map();

  constructor(deepstreamUrl: string) {
    super();
    this.deepstreamClient = new DeepstreamClient(deepstreamUrl);
    this.deepstreamClient.login();
  }

  protected cleanup() {
      // HACK: remove timer when where are sure all peers are connected
      // and can safely delete the info
      setTimeout(() => {
        this.subscriptions.forEach((record) => {
          record.unsubscribe(() => { });
          record.delete();
        });
    }, 5000);
  }
  
  private bindRoom(roomId: string, username: string) {
    this.room = this.deepstreamClient.record.getRecord(`room_${roomId}`);
    this.subscriptions.push(this.room);
    this.room.subscribe((info: RoomRecord) => {
      this.roomRecordChanged(info, roomId, username, this._uuid);
    });
  }

  protected internalHostRoom(roomId: string, username: string): Promise<boolean> {
    this.bindRoom(roomId, username);
    return new Promise<boolean>((resolve) => { resolve(true); });
  }

  protected internalJoinRoom(roomId: string, username: string): Promise<boolean> {
    return this.deepstreamClient.record.has(`room_${roomId}`).then((value) => {
      if (value) {
        this.bindRoom(roomId, username);
      }
      return value;
    });
  }

  protected saveRoomInfo() {
    if (this.room) this.room.set(JSON.parse(JSON.stringify(this.roomRecord)));
  }

  protected saveIceCandidate(uuid: string, candidate: string): void {
    const pairRecord = this.pairRecordMap.get(uuid);
    if (pairRecord) {
      const pairingRecord: PairingRecord = pairRecord.get();
      if (uuid === pairingRecord.uuid1) {
        pairingRecord.iceCandidates2.push(candidate);
      } else {
        pairingRecord.iceCandidates1.push(candidate);
      }
      pairRecord.set(JSON.parse(JSON.stringify(pairingRecord)));
    }
  }

  protected savePairing(mesh: Mesh, myIndex: number, index: number, peer: PeerRecord): void {
    if (this.roomRecord) {
      const pairRecordName = `pair_${this.roomRecord.roomId}_${Math.min(index, myIndex)}_${Math.max(index, myIndex)}`;
      const pairRecord = this.deepstreamClient.record.getRecord(pairRecordName);
      pairRecord.setMergeStrategy(
        (
          localValue: any,
          _localVersion: any,
          remoteValue: any,
          _remoteVersion: any,
          callback: (arg0: null, arg1: any) => void
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
        this.pairingRecordChanged(mesh, info, peer, myIndex, index);
      });
    }
  }

  protected savePairingRecord(info: PairingRecord, uuid: string): void {
    const pairRecord = this.pairRecordMap.get(uuid);
    if (pairRecord)
      pairRecord.set(JSON.parse(JSON.stringify(info)));
  }

}
