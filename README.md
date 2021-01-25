# mplaynet

Typescript library to manage a mesh WebRTC network (pre-alpha)

## Features

Features:

- Manage multiple WebRTC connections
- Provides multiple signaling mechanisms so you don't have to worry about the offer / answers / iceCandidates racking:
    - Signaling using Deepstream.io into a separate bundle
    - Signaling using firebase into a separate bundle
    - Signaling using localStorage for development purposes
- Add header with timestamp and sequence to messages
- Handle disconnections gracefully
- Communication primitives
    - send(uuid: string, message: ArrayBuffer): boolean
    - sendAndListen(uuid: string, message: ArrayBuffer): Promise<Message>
    - reply(uuid: string, originalMessage: Message, message: ArrayBuffer): boolean
    - replyAndListen(uuid: string, originalMessage: Message, message: ArrayBuffer): Promise<Message>
    - broadcast(message: ArrayBuffer)
    - broadcastAndListen(message: ArrayBuffer): Promise<Message>[]
- Calculate latency between peers at regular intervals
- Clock synchronization by [Cristian's algorithm](https://en.wikipedia.org/wiki/Cristian%27s_algorithm)
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

Add this script tag:
```js
<script src="https://unpkg.com/mplaynet@latest/dist/mplaynet.umd.min.js"></script>
```

For Deepstream signaling add these tags:

```js
<script src="//cdn.jsdelivr.net/npm/@deepstream/client@5.1.10/dist/bundle/ds.min.js"></script>
<script src="https://unpkg.com/mplaynet@latest/dist/mplaynet-deepstream.umd.min.js"></script>
```

For Firebase signaling add these tags:

```js
<script src="https://www.gstatic.com/firebasejs/8.2.3/firebase-app.js"></script>
<script src="https://www.gstatic.com/firebasejs/8.2.3/firebase-firestore.js"></script>
<script src="https://unpkg.com/mplaynet@latest/dist/mplaynet-firebase.umd.min.js"></script>
```

### Establish connections, send and receive messages

see demo folder for details

```js
const meshConfig = new MeshConfig(...);
const mesh = new Mesh(meshConfig, myUUID);

// deepstream signaling
const { DeepstreamSignaling } = mplaynetDeepstream;
const signaller = new DeepstreamSignaling(DEEPSTREAM_URL);
// OR firebase signaling
const { FirebaseSignaling } = mplaynetFirebase;
const signaller = new FirebaseSignaling({
  apiKey: FIREBASE_API_KEY,
  authDomain: FIREBASE_AUTH_DOMAIN,
  projectId: FIREBASE_PROJECT_ID
});
// OR localStorage signaling
const { LocalSignaling } = mplaynet;
const signaller = new LocalSignaling();

// create a new room...
signaller.hostRoom(roomId, username, myUUID);
// ...or join an existin room
signaller.joinRoom(roomId, username, myUUID)
 // Triggered when a player joins the room or when he is ready to play.
signaller.roomRecordEmitter.addEventListener((uuid, event) => { 
  // when all players are ready, start pairing:
  if (....all players ready...)
    signaller.startPairings(mesh).then((ok) => {
      if (ok) {
        // start game
      }
    });
});

// broadcast a message to all peers
const message = new ArrayBuffer(size);
mesh.broadcast(message);

// broadcast a message to all peers an listen for replies
const greeting = new TextEncoder().encode('hello all!, I am Peter!').buffer;
mesh.broadcastAndListen(greeting).forEach(promise => promise.then(reply => {
  console.log(new TextDecoder().decode(reply.body));
}));

// send a message to a peer
mesh.send(remotePeer.uuid, message);

// send a message to a peer and listen for reply
const greeting = new TextEncoder().encode('hello, I am Peter!').buffer;
mesh.sendAndListen(remotePeer.uuid, greeting).then(reply => {
  console.log(new TextDecoder().decode(reply.body));
});

// receive messages from remote peers
mesh.messageEmitter.addEventListener((uuid, message) => {
  // uuid of the remote peer
  // message.timestamp : remote timestamp
  // message.sequence: message sequence
  // message.body: ArrayBuffer
  // message.type (1 - send ; 2 - sendAndListen ; 3 - reply ; 4 - replyAndListen)
  // i.e. info = new Int16Array(message.body);

  // if the message was sent via 'sendAndListen' or 'replyAndListen',
  // the peer is waiting for a reply
  if (message.awaitReply) {
      const response = new TextEncoder().encode('nice to meet you').buffer;
      // send the reply
      mesh.reply(uuid, message, response);
      // OR send the reply and wait for a counter reply
      mesh.replyAndListen(uuid, message, response).then(counterReply => {
        console.log(new TextDecoder().decode(counterReply.body));
      });
      return;
  }
});

// disconnection management
mesh.connectionReadyEmitter.addEventListener((uuid, ready) => {
    if (!ready) { // player disconnected
      // ...remove player from screen
    }
});
```
### Demos

- [Simple game in which you create or enter a room with other players.](https://0khp9.csb.app)
