import { EventEmitter } from './event-emitter';
import { MeshConfig } from './mesh-config';
import { MeshConnection } from './mesh-connection';
import { Message } from './message';

export class Mesh {
  private _connections: MeshConnection[] = [];
  private _connectionReadyEmitter: EventEmitter<boolean>;
  private _iceCandidateEmitter: EventEmitter<RTCIceCandidate>;
  private _messageEmitter: EventEmitter<Message>;

  constructor(private config: MeshConfig, private _uuid: string) {
    this._connectionReadyEmitter = new EventEmitter<boolean>();
    this._iceCandidateEmitter = new EventEmitter<RTCIceCandidate>();
    this._messageEmitter = new EventEmitter<Message>();
  }

  get uuid(): string {
    return this._uuid;
  }
  get connectionReadyEmitter(): EventEmitter<boolean> {
    return this._connectionReadyEmitter;
  }
  get iceCandidateEmitter(): EventEmitter<RTCIceCandidate> {
    return this._iceCandidateEmitter;
  }
  get messageEmitter(): EventEmitter<Message> {
    return this._messageEmitter;
  }

  public createConnection(uuid: string) {
    console.log('createConnection ' + uuid);
    const connection = new MeshConnection(this.config, uuid);
    connection.connectionReadyEmitter.addEventListener((uuid, ready) => {
      if (!ready) {
        const connIdx = this._connections.findIndex(conn => conn.uuid === uuid);
        if (connIdx >= 0) {
          this._connections[connIdx].close();
          this._connections.splice(connIdx, 1);
        }
      }
      this._connectionReadyEmitter.notify(uuid, ready);
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
    this._connections.push(connection);
  }

  public close() {
    this._connections.forEach((conn) => {
      conn.close();
    });
  }

  public connectionCount() {
    return this._connections.length;
  }

  public connectionsOpened() {
    return this._connections.reduce(
      (total, conn) => (conn.isOpen ? ++total : total),
      0
    );
  }

  private findConnection(uuid: string): MeshConnection | undefined {
    return this._connections.find((conn) => conn.uuid === uuid);
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

  public send(uuid: string, message: ArrayBuffer): boolean {
    const conn = this.findConnection(uuid);
    if (conn) return conn.send(message);
    else throw new Error(`meshConnection ${uuid} not found`);
  }

  public sendAndListen(uuid: string, message: ArrayBuffer): Promise<Message> {
    const conn = this.findConnection(uuid);
    if (conn) return conn.sendAndListen(message);
    else throw new Error(`meshConnection ${uuid} not found`);
  }

  public reply(uuid: string, originalMessage: Message, message: ArrayBuffer): boolean {
    const conn = this.findConnection(uuid);
    if (conn) return conn.reply(originalMessage, message);
    else throw new Error(`meshConnection ${uuid} not found`);
  }

  public replyAndListen(uuid: string, originalMessage: Message, message: ArrayBuffer): Promise<Message> {
    const conn = this.findConnection(uuid);
    if (conn) return conn.replyAndListen(originalMessage, message);
    else throw new Error(`meshConnection ${uuid} not found`);
  }

  public broadcast(message: ArrayBuffer) {
    return this._connections.reduce(
      (total, conn) => (conn.send(message) ? ++total : total),
      0
    );
  }

  private systemMessageArrived(uuid: string, event: Message) {
    // TO DO
    console.log(`systemMessageArrived(${uuid},${event})`);
  }
}
