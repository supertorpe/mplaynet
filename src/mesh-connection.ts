import { EventEmitter } from './event-emitter';
import { MeshConfig } from './mesh-config';
import { Message, MESSAGE_REPLY, MESSAGE_REPLY_AND_LISTEN, MESSAGE_SEND, MESSAGE_SEND_AND_LISTEN,
  SYSTEM_MESSAGE_PING } from './message';

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
  private _messagesAwaitingReply: Map<string, (message: Message | PromiseLike<Message>) => void> = new Map();
  private _messagesAwaitingReplyCount: number = 0;
  private _messagesAwaitingReplyCleanerTimer: number | null = null;

  private _latency: number | undefined;
  private _minLatency: number | undefined;
  private _clockDiff: number | undefined;
  private _checkLatencyIntervalTimer: number | null = null;

  constructor(private config: MeshConfig, private _uuid: string) {
    const fakeTimestamp = this.getLocalTimestamp();
    console.log(`FAKE TIME: ${this.FAKE_TIME}, fake timestamp=${fakeTimestamp}, time=${fakeTimestamp - this.FAKE_TIME}`);
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
        this.connectionReadyTasks();
      }
    };
    this._channel.onclose = () => {
      if (this._connectionReady) {
        this._connectionReady = false;
      } else {
        this.emitConnectionIsNotReady();
      }
    };
    this._systemChannel.onopen = () => {
      if (!this._connectionReady) {
        this._connectionReady = true;
      } else {
        this.connectionReadyTasks();
      }
    };
    this._systemChannel.onclose = () => {
      if (this._connectionReady) {
        this._connectionReady = false;
      } else {
        this.emitConnectionIsNotReady();
      }
    };
    this._connection.ondatachannel = (ev) => {
      switch(ev.channel.label) {
        case MeshConnection.SYSTEM_CHANNEL_LABEL:
          ev.channel.onmessage = (evm) => {
            this.processReceivedMessage(this._systemMessageEmitter, Message.parse(evm.data), true);
          }
          break;
        case MeshConnection.APP_CHANNEL_LABEL:
          ev.channel.onmessage = (evm) => {
            this.processReceivedMessage(this._messageEmitter, Message.parse(evm.data), false);
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
  get latency(): number | undefined {
    return this._latency;
  }
  get clockDiff(): number | undefined {
    return this._clockDiff;
  }

  public close() {
    if (this._checkLatencyIntervalTimer) window.clearInterval(this._checkLatencyIntervalTimer);
    if (this._messagesAwaitingReplyCleanerTimer) window.clearInterval(this._messagesAwaitingReplyCleanerTimer);
    this._messagesAwaitingReply.clear();
    this._messagesAwaitingReplyCount = 0;
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

  private FAKE_TIME = // for local debugging
    0;
/*
    10000 * (1 + Math.floor(Math.random() * 9)) + 
     1000 * (1 + Math.floor(Math.random() * 9)) + 
      100 * (1 + Math.floor(Math.random() * 9));
//*/

  private getLocalTimestamp(): number {
    const sResult = new Date().valueOf().toString().substring(3);
    return +sResult + this.FAKE_TIME;
  }

  // Cristian's algorithm (https://en.wikipedia.org/wiki/Cristian%27s_algorithm)
  private updateLatencyAndClockDiff(currentLocalTimestamp: number, previousLocalTimestamp: number, remoteTimestamp: number) {
    this._latency = currentLocalTimestamp - previousLocalTimestamp;
    const updateClock = (!this._minLatency || this._latency <= this._minLatency);
    if (updateClock) {
      this._minLatency = this._latency;
      const lag = Math.round(this._latency / 2);
      this._clockDiff = currentLocalTimestamp - lag - remoteTimestamp;
    }
    console.log(`latency: ${this._latency}, clock diff=${this._clockDiff}`);
  }

  private connectionReadyTasks() {
    // ping at regular intervals to update latency and clock differences
    this.sendPing();
    // TO DO: check if this can be done in a webworker
    this._checkLatencyIntervalTimer = window.setInterval(() => { this.sendPing() }, this.config.checkLatencyInterval);

    // launch timer to clean messages awaiting reply // TO DO: check if this can be done in a webworker
    if (this.config.messagesAwaitingReplyMaxAge > 0) {
      this._messagesAwaitingReplyCleanerTimer = window.setInterval(() => { this.cleanMessagesAwaitingReply(); }, this.config.messagesAwaitingReplyCleanerInterval);
    }
    
    // notify connection is ready
    this._connectionReadyEmitter.notify(this._uuid, true);
  }

  private sendPing() {
    const packet = new Uint8Array(1);
    packet[0] = SYSTEM_MESSAGE_PING;
    this.sendAndListenSys(packet.buffer).then(reply => {
      if (reply.sourceTimestamp) this.updateLatencyAndClockDiff(this.getLocalTimestamp(), reply.sourceTimestamp, reply.timestamp);
    });
  }

  private emitConnectionIsNotReady() {
    this._connectionReadyEmitter.notify(this._uuid, false);
  }

  private cleanMessagesAwaitingReply() {
    const time = this.getLocalTimestamp() - this.config.messagesAwaitingReplyMaxAge;
    for (let key of this._messagesAwaitingReply.keys()) {
      if (+key.split(':')[0] < time) {
        this._messagesAwaitingReply.delete(key);
        this._messagesAwaitingReplyCount--;
      } else {
        break;
      }
    }
  }

  private storeMessagesAwaitingReply(key: string, value: (message: Message | PromiseLike<Message>) => void) {
    this._messagesAwaitingReply.set(key, value);
    if (this.config.messagesAwaitingReplyMaxSize > 0 && this._messagesAwaitingReplyCount >= this.config.messagesAwaitingReplyMaxSize) {
      // remove first element
      this._messagesAwaitingReply.delete(this._messagesAwaitingReply.entries().next().value[0]);
    } else {
      this._messagesAwaitingReplyCount++;
    }
  }

  private processReceivedMessage(emmiter: EventEmitter<Message>, message: Message, isSystemMessage: boolean) {
    const now = this.getLocalTimestamp();
    // if it is a system message, process it accordingly
    if (isSystemMessage) {
      // check if the message requires reply
      if (message.type === MESSAGE_SEND_AND_LISTEN) {
        const data = new Int8Array(message.body);
        // if PING, send reply
        if (data[0] === SYSTEM_MESSAGE_PING) {
          this.replySys(message, data.buffer);
          return; // do not want to bubble up the ping event
        }
      }
    }
    message.clockDiff = this._clockDiff;
    // if it is a reply, look for the original message in the message cache
    if (message.type === MESSAGE_REPLY || message.type === MESSAGE_REPLY_AND_LISTEN) {
      console.log(`message received at localTimestamp ${now}: timestamp=${message.timestamp} (toLocalTime=${message.timestampToLocalTime}), sequence=${message.sequence}, sourceTimestamp=${message.sourceTimestamp}, sourceSequence=${message.sourceSequence}`);
      
      const key = message.sourceKey;
      const sourceMessage = this._messagesAwaitingReply.get(key);
      if (sourceMessage) {
        this._messagesAwaitingReply.delete(key);
        this._messagesAwaitingReplyCount--;
        sourceMessage(message);
        return;
      }
    } else {
      console.log(`message received at localTimestamp ${now}: timestamp=${message.timestamp} (toLocalTime=${message.timestampToLocalTime}), sequence=${message.sequence}`);
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
    console.log(`sending timestamp=${theMessage.timestamp}, sequence=${theMessage.sequence}`);
    return this.internalSend(channel, theMessage.fullMessage);
  }

  private sendAndListenBychannel(channel: RTCDataChannel, message: ArrayBuffer): Promise<Message> {
    return new Promise<Message>(resolve => {
      const timestamp = this.getLocalTimestamp();
      const theMessage = new Message(message, timestamp, this._messageSeq++, MESSAGE_SEND_AND_LISTEN);
      console.log(`sending timestamp=${theMessage.timestamp}, sequence=${theMessage.sequence}`);
      if (this.internalSend(channel, theMessage.fullMessage)) {
        // CAUTION: unlikely race condition if reply arrives before message is cached
        this.storeMessagesAwaitingReply(theMessage.key, resolve);
      }
    });
  }

  private replyByChannel(channel: RTCDataChannel, originalMessage: Message, message: ArrayBuffer): boolean {
    const timestamp = this.getLocalTimestamp();
    const theMessage = new Message(message, timestamp, this._messageSeq++, MESSAGE_REPLY, originalMessage.timestamp, originalMessage.sequence);
    console.log(`sending timestamp=${theMessage.timestamp}, sequence=${theMessage.sequence}, sourceTimestamp=${originalMessage.timestamp}, sourceSequence=${originalMessage.sequence}`);
    return this.internalSend(channel, theMessage.fullMessage);
  }

  private replyAndListenByChannel(channel: RTCDataChannel, originalMessage: Message, message: ArrayBuffer): Promise<Message> {
    return new Promise<Message>(resolve => {
      const timestamp = this.getLocalTimestamp();
      const theMessage = new Message(message, timestamp, this._messageSeq++, MESSAGE_REPLY_AND_LISTEN, originalMessage.timestamp, originalMessage.sequence);
      console.log(`sending timestamp=${theMessage.timestamp}, sequence=${theMessage.sequence}, sourceTimestamp=${originalMessage.timestamp}, sourceSequence=${originalMessage.sequence}`);
      if (this.internalSend(channel, theMessage.fullMessage)) {
        // CAUTION: unlikely race condition if reply arrives before message is cached
        this.storeMessagesAwaitingReply(theMessage.key, resolve);
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
