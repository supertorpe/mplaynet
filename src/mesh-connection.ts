import { EventEmitter } from './event-emitter';
import { MeshConfig } from './mesh-config';

export class MeshConnection {
  private _connection: RTCPeerConnection;
  private _channel: RTCDataChannel;
  private _channelOpenEmitter: EventEmitter<boolean>;
  private _iceCandidateEmitter: EventEmitter<RTCIceCandidate>;
  private _messageEmitter: EventEmitter<MessageEvent>;

  constructor(private config: MeshConfig, private _uuid: string) {
    this._channelOpenEmitter = new EventEmitter<any>();
    this._iceCandidateEmitter = new EventEmitter<RTCIceCandidate>();
    this._messageEmitter = new EventEmitter<MessageEvent>();
    this._connection = new RTCPeerConnection(this.config.rtcConfig);
    this._connection.onicecandidate = (event) => {
      if (event.candidate)
        this.iceCandidateEmitter.notify(this._uuid, event.candidate);
    };
    this._channel = this._connection.createDataChannel(
      'channel',
      this.config.rtcDataChannelInit
    );
    this._channel.onopen = () => {
      this._channelOpenEmitter.notify(this._uuid, true);
    };
    this._connection.ondatachannel = (ev) => {
      ev.channel.onmessage = (evm) =>
        this._messageEmitter.notify(this._uuid, evm);
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
  get iceCandidateEmitter(): EventEmitter<RTCIceCandidate> {
    return this._iceCandidateEmitter;
  }
  get messageEmitter(): EventEmitter<MessageEvent> {
    return this._messageEmitter;
  }

  public close() {
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

  public send(message: string) {
    this._channel.send(message);
  }
}
