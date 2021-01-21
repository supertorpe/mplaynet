import { EventEmitter } from './event-emitter';
import { MeshConfig } from './mesh-config';
import { MeshConnection } from './mesh-connection';

export class Mesh {
  private connections: MeshConnection[] = [];
  private _channelOpenEmitter: EventEmitter<boolean>;
  private _iceCandidateEmitter: EventEmitter<RTCIceCandidate>;
  private _messageEmitter: EventEmitter<MessageEvent>;

  constructor(private config: MeshConfig, private _uuid: string) {
    this._channelOpenEmitter = new EventEmitter<any>();
    this._iceCandidateEmitter = new EventEmitter<RTCIceCandidate>();
    this._messageEmitter = new EventEmitter<MessageEvent>();
  }

  get uuid(): string {
    return this._uuid;
  }
  get channelOpenEmitter(): EventEmitter<boolean> {
    return this._channelOpenEmitter;
  }
  get iceCandidateEmitter(): EventEmitter<RTCIceCandidate> {
    return this._iceCandidateEmitter;
  }
  get messageEmitter(): EventEmitter<MessageEvent> {
    return this._messageEmitter;
  }

  public createConnection(uuid: string) {
    console.log('createConnection ' + uuid);
    const connection = new MeshConnection(this.config, uuid);
    connection.channelOpenEmitter.addEventListener((uuid, event) => {
      this._channelOpenEmitter.notify(uuid, event);
    });
    connection.systemChannelOpenEmitter.addEventListener((uuid, opened) => {
      if (opened) this.systemChannelOpened(uuid);
    });
    connection.iceCandidateEmitter.addEventListener((uuid, event) => {
      this._iceCandidateEmitter.notify(uuid, event);
    });
    connection.messageEmitter.addEventListener((uuid, event) => {
      this._messageEmitter.notify(uuid, event);
    });
    connection.systemMessageEmitter.addEventListener((uuid, event) => {
      this.systemMessageArrived(uuid, event);
    });
    this.connections.push(connection);
  }

  public close() {
    this.connections.forEach((conn) => {
      conn.close();
    });
  }

  private findConnection(uuid: string): MeshConnection | undefined {
    return this.connections.find((conn) => conn.uuid === uuid);
  }

  public addIceCandidate(uuid: string, candidate: RTCIceCandidateInit) {
    const conn = this.findConnection(uuid);
    if (conn) return conn.addIceCandidate(candidate);
    else throw new Error(`meshConnection ${uuid} not found`);
  }

  public createOffer(uuid: string) {
    const conn = this.findConnection(uuid);
    if (conn) return conn.createOffer();
    else throw new Error(`meshConnection ${uuid} not found`);
  }

  public createAnswer(uuid: string, offer: RTCSessionDescriptionInit) {
    const conn = this.findConnection(uuid);
    if (conn) return conn.createAnswer(offer);
    else throw new Error(`meshConnection ${uuid} not found`);
  }

  public verifyAnswer(uuid: string, answer: RTCSessionDescriptionInit) {
    const conn = this.findConnection(uuid);
    if (conn) return conn.verifyAnswer(answer);
    else throw new Error(`meshConnection ${uuid} not found`);
  }

  public sendMessage(uuid: string, message: string | Blob | ArrayBuffer | ArrayBufferView) {
    const conn = this.findConnection(uuid);
    if (conn) return conn.send(message);
    else throw new Error(`meshConnection ${uuid} not found`);
  }

  private sendSysMessage(uuid: string, message: string | Blob | ArrayBuffer | ArrayBufferView) {
    const conn = this.findConnection(uuid);
    if (conn) return conn.sendSys(message);
    else throw new Error(`meshConnection ${uuid} not found`);
  }

  public broadcastMessage(message: string | Blob | ArrayBuffer | ArrayBufferView) {
    this.connections.forEach((conn) => {
      conn.send(message);
    });
  }

  private broadcastSysMessage(message: string | Blob | ArrayBuffer | ArrayBufferView) {
    this.connections.forEach((conn) => {
      conn.sendSys(message);
    });
  }

  private systemChannelOpened(uuid: string) {

  }

  private systemMessageArrived(uuid: string, event: MessageEvent) {
    
  }
}
