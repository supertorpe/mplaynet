import { EventEmitter } from './event-emitter';
import { MeshConfig } from './mesh-config';
import { Message, MESSAGE_REPLY, MESSAGE_REPLY_AND_LISTEN, MESSAGE_SEND, MESSAGE_SEND_AND_LISTEN } from './message';

export class MeshConnection {

  private static SYSTEM_CHANNEL_LABEL = 'system-channel';
  private static APP_CHANNEL_LABEL = 'app-channel';

  private _connection: RTCPeerConnection;
  private _channel: RTCDataChannel;
  private _systemChannel: RTCDataChannel;
  private _connectionReady = false;
  private _connectionReadyEmitter: EventEmitter<boolean>;
  private _iceCandidateEmitter: EventEmitter<RTCIceCandidate>;
  private _messageEmitter: EventEmitter<Message>;
  private _systemMessageEmitter: EventEmitter<Message>;
  private _messageSeq = 1;
  // cache with messages awaiting reply
  // TO DO: webworker to cleanup old messages
  // TO DO: config max cache size and/or max object age
  protected _messagesAwaitingReply: Map<string, (message: Message | PromiseLike<Message>) => void> = new Map();

  constructor(private config: MeshConfig, private _uuid: string) {
    this._connectionReadyEmitter = new EventEmitter<boolean>();
    this._iceCandidateEmitter = new EventEmitter<RTCIceCandidate>();
    this._messageEmitter = new EventEmitter<Message>();
    this._systemMessageEmitter = new EventEmitter<Message>();
    this._connection = new RTCPeerConnection(this.config.rtcConfig);
    this._connection.onicecandidate = (event) => {
      if (event.candidate)
        this.iceCandidateEmitter.notify(this._uuid, event.candidate);
    };
    //this._connection.onconnectionstatechange = () => {
    //  console.log(`connectionState?${this._connection.connectionState}`);
    //};
    this._systemChannel = this._connection.createDataChannel(MeshConnection.SYSTEM_CHANNEL_LABEL, { ordered: true } );
    this._channel = this._connection.createDataChannel(MeshConnection.APP_CHANNEL_LABEL, this.config.rtcDataChannelInit);
    this._channel.onopen = () => {
      if (!this._connectionReady) {
        this._connectionReady = true;
      } else {
        this._connectionReadyEmitter.notify(this._uuid, true);
      }
    };
    this._channel.onclose = () => {
      if (this._connectionReady) {
        this._connectionReady = false;
      } else {
        this._connectionReadyEmitter.notify(this._uuid, false);
      }
    };
    this._systemChannel.onopen = () => {
      if (!this._connectionReady) {
        this._connectionReady = true;
      } else {
        this._connectionReadyEmitter.notify(this._uuid, true);
      }
    };
    this._systemChannel.onclose = () => {
      if (this._connectionReady) {
        this._connectionReady = false;
      } else {
        this._connectionReadyEmitter.notify(this._uuid, false);
      }
    };
    this._connection.ondatachannel = (ev) => {
      switch(ev.channel.label) {
        case MeshConnection.SYSTEM_CHANNEL_LABEL:
          ev.channel.onmessage = (evm) => {
            this.processReceivedMessage(this._systemMessageEmitter, Message.parse(evm.data));
            this._systemMessageEmitter.notify(this._uuid, Message.parse(evm.data));
          }
          break;
        case MeshConnection.APP_CHANNEL_LABEL:
          ev.channel.onmessage = (evm) => {
            this.processReceivedMessage(this._messageEmitter, Message.parse(evm.data));
          }
          break;
        default:
      }
    };
  }

  public addIceCandidate(candidate: RTCIceCandidateInit) {
    this._connection.addIceCandidate(candidate);
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
  get systemMessageEmitter(): EventEmitter<Message> {
    return this._systemMessageEmitter;
  }

  get isOpen(): boolean {
    return this._channel && this._channel.readyState === 'open' &&
      this._systemChannel && this._systemChannel.readyState === 'open';
  }

  public close() {
    if (this._systemChannel) try { this._systemChannel.close(); } catch(err) { }
    if (this._channel) try { this._channel.close(); } catch(err) { }
    if (this._connection) try { this._connection.close(); } catch(err) { }
  }

  public createOffer() {
    return this._connection.createOffer().then((offer) => {
      //if (offer && offer.sdp) offer.sdp = offer.sdp.replace(/a=ice-options:trickle\s\n/g, '');
      return this._connection.setLocalDescription(offer).then(() => {
        return offer;
      });
    });
  }

  public createAnswer(offer: RTCSessionDescriptionInit) {
    return this._connection
      .setRemoteDescription(offer)
      .then(() => this._connection.createAnswer())
      .then((answer) => {
        //if (answer && answer.sdp) answer.sdp = answer.sdp.replace(/a=ice-options:trickle\s\n/g, '');
        return this._connection.setLocalDescription(answer).then(() => {
          return answer;
        });
      });
  }

  public verifyAnswer(answer: RTCSessionDescriptionInit) {
    return this._connection.setRemoteDescription(answer);
  }

  private getLocalTimestamp(): number {
    const sResult = new Date().valueOf().toString().substring(3);
    return +sResult;
  }

  private processReceivedMessage(emmiter: EventEmitter<Message>, message: Message) {
    // if it is a reply, look for the original message in the message cache
    if (message.type === MESSAGE_REPLY || message.type === MESSAGE_REPLY_AND_LISTEN) {
      const key = message.sourceKey;
      const sourceMessage = this._messagesAwaitingReply.get(key);
      if (sourceMessage) {
        this._messagesAwaitingReply.delete(key);
        sourceMessage(message);
        return;
      }
    }
    emmiter.notify(this._uuid, message);
  }

  private internalSend(channel: RTCDataChannel, message: ArrayBuffer) {
    if (channel.readyState !== 'open') {
      return false;
    }
    channel.send(message);
    return true;
  }

  private sendByChannel(channel: RTCDataChannel, message: ArrayBuffer): boolean {
    const timestamp = this.getLocalTimestamp();
    const theMessage = new Message(message, timestamp, this._messageSeq++, MESSAGE_SEND);
    return this.internalSend(channel, theMessage.fullMessage);
  }

  private sendAndListenBychannel(channel: RTCDataChannel, message: ArrayBuffer): Promise<Message> {
    return new Promise<Message>(resolve => {
      const timestamp = this.getLocalTimestamp();
      const theMessage = new Message(message, timestamp, this._messageSeq++, MESSAGE_SEND_AND_LISTEN);
      if (this.internalSend(channel, theMessage.fullMessage)) {
        // CAUTION: unlikely race condition if reply arrives before message is cached
        this._messagesAwaitingReply.set(theMessage.key, resolve);
      }
    });
  }

  private replyByChannel(channel: RTCDataChannel, originalMessage: Message, message: ArrayBuffer): boolean {
    const timestamp = this.getLocalTimestamp();
    const theMessage = new Message(message, timestamp, this._messageSeq++, MESSAGE_REPLY, originalMessage.timestamp, originalMessage.sequence);
    return this.internalSend(channel, theMessage.fullMessage);
  }

  private replyAndListenByChannel(channel: RTCDataChannel, originalMessage: Message, message: ArrayBuffer): Promise<Message> {
    return new Promise<Message>(resolve => {
      const timestamp = this.getLocalTimestamp();
      const theMessage = new Message(message, timestamp, this._messageSeq++, MESSAGE_REPLY_AND_LISTEN, originalMessage.timestamp, originalMessage.sequence);
      if (this.internalSend(channel, theMessage.fullMessage)) {
        // CAUTION: unlikely race condition if reply arrives before message is cached
        this._messagesAwaitingReply.set(theMessage.key, resolve);
      }
    });
  }

  public send(message: ArrayBuffer): boolean {
    return this.sendByChannel(this._channel, message);
  }

  public sendSys(message: ArrayBuffer): boolean {
    return this.sendByChannel(this._systemChannel, message);
  }

  public sendAndListen(message: ArrayBuffer): Promise<Message> {
    return this.sendAndListenBychannel(this._channel, message);
  }

  public sendAndListenSys(message: ArrayBuffer): Promise<Message> {
    return this.sendAndListenBychannel(this._systemChannel, message);
  }

  public reply(originalMessage: Message, message: ArrayBuffer): boolean {
    return this.replyByChannel(this._channel, originalMessage, message);
  }

  public replySys(originalMessage: Message, message: ArrayBuffer): boolean {
    return this.replyByChannel(this._systemChannel, originalMessage, message);
  }

  public replyAndListen(originalMessage: Message, message: ArrayBuffer): Promise<Message> {
    return this.replyAndListenByChannel(this._channel, originalMessage, message);
  }

  public replyAndListenSys(originalMessage: Message, message: ArrayBuffer): Promise<Message> {
    return this.replyAndListenByChannel(this._systemChannel, originalMessage, message);
  }

}
