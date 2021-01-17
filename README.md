# mplaynet

Typescript library to manage a mesh WebRTC network (pre-alpha)

## Features

Features:

- Encapsulates the management of multiple WebRTC connections
- Provides multiple signaling mechanisms so you don't have to worry about the offer / answers / iceCandidates racking:
- Signaling using Deepstream.io
- Signaling using firebase
- [TO DO] Automatically calculates latency and differences in internal clock timestamp between each pair of nodes
- [TO DO] Stores a buffer of messages, ordered by timestamp, in case the client application needs to reproduce them
- [TO DO] Implement the Raft consensus algorithm in order to establish a distributed authority

## Install and usage

You can either import mplaynet via NPM or directly use it via script tag.

### NPM:

First, run: `npm i mplaynet`

```js module
import { Mesh } from 'mplaynet';

const myMesh = new Mesh();
```

### Directly in the browser

Add this script tag: `<script src="https://unpkg.com/mplaynet@latest/dist/mplaynet.umd.js"></script>`

```js
const { Mesh } = mplaynet;
```
### Establish connections, send and receive messages

see demo folder for details

```js
const meshConfig = new MeshConfig(...);
const mesh = new Mesh(meshConfig, myUUID);
const signaller =
  // deepstream
  new DeepstreamSignaling(DEEPSTREAM_URL);
  // OR firebase
  new FirebaseSignaling({
      apiKey: FIREBASE_API_KEY,
      authDomain: FIREBASE_AUTH_DOMAIN,
      projectId: FIREBASE_PROJECT_ID
    });
// create a new room...
signaller.hostRoom(roomId, username, myUUID);
// ...or join an existin room
signaller.joinRoom(roomId, username, myUUID)
 // Triggered when a player joins the room or when he is ready to play.
signaller.roomRecordEmitter.addEventListener((uuid, event) => { 
  // when all players are ready, start pairing:
  if (....al players ready...)
    signaller.startPairings(mesh).then((ok) => {
      if (ok) {
        // start game
      }
    });
});
// send message to the peers
mesh.broadcastMessage(message);
// receive messages from the peers
mesh.messageEmitter.addEventListener((uuid, message) => {
  // uuid of the remote peer
  // i.e.  info = new Int16Array(message.data);
});
```
### Demos

- [Simple game in which you create or enter a room with other players.](https://0khp9.csb.app)
