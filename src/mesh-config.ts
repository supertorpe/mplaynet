export class MeshConfig {
  constructor(
    private _rtcConfig: RTCConfiguration,
    private _rtcDataChannelInit: RTCDataChannelInit
  ) {}

  get rtcConfig(): RTCConfiguration {
    return this._rtcConfig;
  }
  get rtcDataChannelInit(): RTCDataChannelInit {
    return this._rtcDataChannelInit;
  }
}
