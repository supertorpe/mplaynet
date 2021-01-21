import { EventEmitter } from './event-emitter';
import { MeshConfig } from './mesh-config';

export class MeshConnection {

  private static SYSTEM_CHANNEL_LABEL = 'system-channel';
  private static APP_CHANNEL_LABEL = 'app-channel';

  private _connection: RTCPeerConnection;
  private _channel: RTCDataChannel;
  private _systemChannel: RTCDataChannel;
  private _channelOpenEmitter: EventEmitter<boolean>;
  private _systemChannelOpenEmitter: EventEmitter<boolean>;
  private _iceCandidateEmitter: EventEmitter<RTCIceCandidate>;
  private _messageEmitter: EventEmitter<MessageEvent>;
  private _systemMessageEmitter: EventEmitter<MessageEvent>;

  constructor(private config: MeshConfig, private _uuid: string) {
    this._channelOpenEmitter = new EventEmitter<any>();
    this._systemChannelOpenEmitter = new EventEmitter<any>();
    this._iceCandidateEmitter = new EventEmitter<RTCIceCandidate>();
    this._messageEmitter = new EventEmitter<MessageEvent>();
    this._systemMessageEmitter = new EventEmitter<MessageEvent>();
    this._connection = new RTCPeerConnection(this.config.rtcConfig);
    this._connection.onicecandidate = (event) => {
      if (event.candidate)
        this.iceCandidateEmitter.notify(this._uuid, event.candidate);
    };
    this._systemChannel = this._connection.createDataChannel(MeshConnection.SYSTEM_CHANNEL_LABEL, { ordered: true } );
    this._channel = this._connection.createDataChannel(MeshConnection.APP_CHANNEL_LABEL, this.config.rtcDataChannelInit);
    this._channel.onopen = () => {
      this._channelOpenEmitter.notify(this._uuid, true);
    };
    this._systemChannel.onopen = () => {
      this._systemChannelOpenEmitter.notify(this._uuid, true);
    };
    this._connection.ondatachannel = (ev) => {
      switch(ev.channel.label) {
        case MeshConnection.SYSTEM_CHANNEL_LABEL:
          ev.channel.onmessage = (evm) => this._systemMessageEmitter.notify(this._uuid, evm);
          break;
        case MeshConnection.APP_CHANNEL_LABEL:
          ev.channel.onmessage = (evm) => this._messageEmitter.notify(this._uuid, evm);
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
  get channelOpenEmitter(): EventEmitter<boolean> {
    return this._channelOpenEmitter;
  }
  get systemChannelOpenEmitter(): EventEmitter<boolean> {
    return this._systemChannelOpenEmitter;
  }
  get iceCandidateEmitter(): EventEmitter<RTCIceCandidate> {
    return this._iceCandidateEmitter;
  }
  get messageEmitter(): EventEmitter<MessageEvent> {
    return this._messageEmitter;
  }
  get systemMessageEmitter(): EventEmitter<MessageEvent> {
    return this._systemMessageEmitter;
  }

  get isOpen(): boolean {
    return this._channel && this._channel.readyState === 'open' &&
      this._systemChannel && this._systemChannel.readyState === 'open';
  }

  public close() {
    if (this._systemChannel) this._systemChannel.close();
    if (this._channel) this._channel.close();
    if (this._connection) this._connection.close();
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

  public send(message: string | Blob | ArrayBuffer | ArrayBufferView) {
    this._channel.send(message);
  }

  public sendSys(message: string | Blob | ArrayBuffer | ArrayBufferView) {
    this._systemChannel.send(message);
  }

}
