export class MeshConfig {
  constructor(
/*
The RTCConfiguration defines a set of parameters to configure how the peer-to-peer communication
established via RTCPeerConnection is established or re-established.

interface RTCConfiguration {
    iceServers?: RTCIceServer[];
    iceTransportPolicy?: RTCIceTransportPolicy; // default = 'all'
    bundlePolicy?: RTCBundlePolicy; // default = 'balanced'
    rtcpMuxPolicy?: RTCRtcpMuxPolicy; // default = 'require'
    peerIdentity?: string; // default = null
    certificates?: RTCCertificate[];
    iceCandidatePoolSize?: number; // default = 0
}
*/
    private _rtcConfig: RTCConfiguration,
/*
An RTCDataChannel can be configured to operate in different reliability modes.
A reliable channel ensures that the data is delivered at the other peer through retransmissions.
An unreliable channel is configured to either limit the number of retransmissions
( maxRetransmits ) or set a time during which transmissions (including retransmissions)
are allowed ( maxPacketLifeTime ).
These properties can not be used simultaneously and an attempt to do so will result in an error.
Not setting any of these properties results in a reliable channel.

interface RTCDataChannelInit {
    ordered?: boolean; // default = true
    maxPacketLifeTime?: number;
    maxRetransmits?: number;
    protocol?: string; // default = ''
    negotiated?: boolean; // default = false
    id?: number;
}
*/
    private _rtcDataChannelInit: RTCDataChannelInit

  ) {}

  get rtcConfig(): RTCConfiguration {
    return this._rtcConfig;
  }
  get rtcDataChannelInit(): RTCDataChannelInit {
    return this._rtcDataChannelInit;
  }
}
