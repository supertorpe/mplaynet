const {
  MeshConfig,
  Mesh
} = mplaynet;


const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

generateRandomLetters = (length) => {
  let code = '';
  for (let i = 0; i < length; i++) {
    const ndx = Math.floor(Math.random() * LETTERS.length);
    code += LETTERS[ndx];
  }
  return code;
}

const myUUID = generateRandomLetters(10);
console.log(myUUID);

/*************
 * MESH      *
 *************/

const meshConfig = new MeshConfig(
  {
    iceServers: [
      // TO DO: fill iceServers
    ]
  },
  {
    ordered: false, maxRetransmits: 1
  }
);

const mesh = new Mesh(meshConfig, myUUID);

/*************
 * SIGNALING *
 *************/

signaller.roomRecordEmitter.addEventListener((uuid, event) => {
  console.log('room info changed: ' + JSON.stringify(event));
  hostGame.style.display = 'none';
  joinGame.style.display = 'none';
  waiting.style.display = 'flex';
  roomCodeLabel.innerHTML = event.roomId;
  numPlayersLabel.innerHTML = event.peers.length;
  numPlayersReadyLabel.innerHTML = event.peers.reduce(
    (total, peer) => (peer.ready ? ++total : total),
    0
  );
  // all (n > 1) players ready ?
  if (event.peers.length > 1 && event.peers.every((peer) => peer.ready)) {
    signaller.startPairings(mesh).then((ok) => {
      if (ok) {
        waiting.style.display = 'none';
        gameArea.style.display = 'flex';
        startGame(event.peers);
      } else {
        alert('Error while paring players');
      }
    });
  }
});

/*******************************
 * BIND HTML ELEMENTS & EVENTS *
 *******************************/

const btnHostGame = document.querySelector('#btnHostGame');
const btnJoinGame = document.querySelector('#btnJoinGame');
const firstStep = document.querySelector('.firstStep');
const hostGame = document.querySelector('.hostGame');
const joinGame = document.querySelector('.joinGame');
const inputHostUsername = document.querySelector('#inputHostUsername');
const btnHost = document.querySelector('#btnHost');
const inputRoomCode = document.querySelector('#inputRoomCode');
const inputJoinUsername = document.querySelector('#inputJoinUsername');
const btnJoin = document.querySelector('#btnJoin');
const roomCodeLabel = document.querySelector('#roomCodeLabel');
const numPlayersLabel = document.querySelector('#numPlayersLabel');
const numPlayersReadyLabel = document.querySelector('#numPlayersReadyLabel');
const btnReady = document.querySelector('#btnReady');
const waiting = document.querySelector('.waiting');
const gameArea = document.querySelector('.gameArea');

btnHostGame.addEventListener('click', () => {
  firstStep.style.display = 'none';
  hostGame.style.display = 'flex';
});
btnJoinGame.addEventListener('click', () => {
  firstStep.style.display = 'none';
  joinGame.style.display = 'flex';
});
btnHost.addEventListener('click', () => {
  inputHostUsername.style.borderColor = 'black';
  if (!inputHostUsername.value) {
    inputHostUsername.style.borderColor = 'red';
    return;
  }
    btnHost.disabled = true;
  const roomId = generateRandomLetters(4);
  const username = inputHostUsername.value;
  signaller.hostRoom(roomId, username, myUUID);
});
btnJoin.addEventListener('click', () => {
  inputRoomCode.style.borderColor = 'black';
  inputJoinUsername.style.borderColor = 'black';
  let error = false;
  if (!inputRoomCode.value) {
    inputRoomCode.style.borderColor = 'red';
    error = true;
  }
  if (!inputJoinUsername.value) {
    inputJoinUsername.style.borderColor = 'red';
    error = true;
  }
  if (error) return;
  btnJoin.disabled = true;
  const roomId = inputRoomCode.value;
  const username = inputJoinUsername.value;
  signaller.joinRoom(roomId, username, myUUID).then((ok) => {
    if (!ok) {
      alert('Room does not exists');
      btnJoin.disabled = false;
    }
  });
});
btnReady.addEventListener('click', () => {
  signaller.upatePlayerStatus(true);
  btnReady.style.display = 'none';
});

/**************
 * GAME LOGIC *
 **************/

const LAG = 0;
const WIDTH = 400;
const HEIGHT = 300;
const STEPSIZE = 5;
const SIZE = 50;
const NETLAPSE = 50;

let players = [];
let myPlayer;
const startGame = (peers) => {
  for (let [index, peer] of peers.entries()) {
    gameArea.innerHTML += `<div id="player_${index}" class="player">${peer.username}</div>`;
    const player = {
      index: index,
      uuid: peer.uuid,
      selector: `#player_${index}`,
      top: 10,
      left: 10 + (SIZE + 5) * index,
      disconnected: false
    };
    players.push(player);
    if (peer.uuid == myUUID) {
      myPlayer = player;

      const message = `broadcast greeting: hello, I am ${myUUID}!`;
      const greeting = new TextEncoder().encode(message).buffer;
      mesh.broadcastAndListen(greeting).forEach(promise => promise.then(reply => {
        console.log(`received "${new TextDecoder().decode(reply.body)}" as reply to my broadcast message "${message}"`);
      }));
    } else {
      // send welcome message and wait for response
      const message = `unicast greeting: hello, I am ${myUUID}!`;
      const greeting = new TextEncoder().encode(message).buffer;
      mesh.sendAndListen(peer.uuid, greeting).then(reply => {
        console.log(`received "${new TextDecoder().decode(reply.body)}" as reply to my unicast message "${message}"`);
      });
    }
    drawPlayer(player);
  }

  mesh.connectionReadyEmitter.addEventListener((uuid, ready) => {
    if (!ready) { // player disconnected
      const player = players.find(player => player && player.uuid === uuid);
      if (player) {
        player.disconnected = true;
        const object = document.querySelector(player.selector);
        object.classList.add("disconnected");
      }
    }
  });

  mesh.messageEmitter.addEventListener((uuid, message) => {
    // handle welcome message
    if (message.awaitReply) {
      const messageReceived = new TextDecoder().decode(message.body);
      console.log(`received: ${messageReceived}`);
      const response = new TextEncoder().encode('Nice to meet you').buffer;
      mesh.reply(uuid, message, response);
      return;
    }
    // handle 'move' message
    const move = new Int16Array(message.body);
    const player = players.find(player => !player.disconnected && player.uuid === uuid);
    if (player) {
      player.realTop = move[0];
      player.realLeft = move[1];
    }
  });

  window.requestAnimationFrame(gameLoop);
};

const drawPlayer = (player) => {
  const topPx = player.top + 'px';
  const leftPx = player.left + 'px';
  const object = document.querySelector(player.selector);
  if (object.style.top != topPx || object.style.left != leftPx) {
    object.style.top = topPx;
    object.style.left = leftPx;
    //console.log(`${player.uuid} top=${player.top} left=${player.left}`);
  }
};

const draw = () => {
  players.forEach((player) => !player.disconnected && drawPlayer(player));
};

const pressedKeys = {};

document.onkeydown = document.onkeyup = function (event) {
  pressedKeys[event.keyCode] = event.type === 'keydown';
};

let latestTimestamp;
let latestSend;

const gameLoop = (timestamp) => {
  if (!latestTimestamp) latestTimestamp = timestamp;
  const elapsed = timestamp - latestTimestamp;
  latestTimestamp = timestamp;
  window.requestAnimationFrame(gameLoop);
  update();
  draw();
  if (!latestSend || timestamp >= latestSend + NETLAPSE) {
    latestSend = timestamp;
    sendMove();
  }
};

const checkCollision = (x1, y1, x2, y2, size) => {
  return (
    ((x1 <= x2 && x2 <= x1 + size - 1) ||
      (x1 <= x2 + size - 1 && x2 + size - 1 <= x1 + size - 1)) &&
    ((y1 <= y2 && y2 <= y1 + size - 1) ||
      (y1 <= y2 + size - 1 && y2 + size - 1 <= y1 + size - 1))
  );
};

const update = () => {
  players.forEach((player) => {
    if (player.disconnected) {
      return;
    }
    let vertical;
    let horizontal;
    if (player.uuid == myPlayer.uuid) {
      // calculate vertical and horizontal displacement based on keystrokes
      vertical = pressedKeys[38] ? -STEPSIZE : pressedKeys[40] ? STEPSIZE : 0;
      horizontal = pressedKeys[37] ? -STEPSIZE : pressedKeys[39] ? STEPSIZE : 0;
    } else {
      // gently bring the other players closer to their actual position
      vertical =
        player.realTop < player.top
          ? Math.max(-STEPSIZE, player.realTop - player.top)
          : player.realTop > player.top
          ? Math.min(STEPSIZE, player.realTop - player.top)
          : 0;
      horizontal =
        player.realLeft < player.left
          ? Math.max(-STEPSIZE, player.realLeft - player.left)
          : player.realLeft > player.left
          ? Math.min(STEPSIZE, player.realLeft - player.left)
          : 0;
    }
    if (vertical != 0 || horizontal != 0)
      makeMove(player, vertical, horizontal);
  });
};

const makeMove = (playerToMove, vertical, horizontal) => {
  // check that we do not leave the playing area
  if (vertical < 0 && playerToMove.top + vertical < 0) {
    vertical = -playerToMove.top;
  }
  if (horizontal < 0 && playerToMove.left + horizontal < 0) {
    horizontal = -playerToMove.left;
  }
  if (
    vertical > 0 &&
    playerToMove.top + vertical + SIZE > HEIGHT /*document.body.clientHeight*/
  ) {
    vertical =
      HEIGHT /*document.body.clientHeight*/ - (playerToMove.top + SIZE);
  }
  if (
    horizontal > 0 &&
    playerToMove.left + horizontal + SIZE > WIDTH /*document.body.clientWidth*/
  ) {
    horizontal =
      WIDTH /*document.body.clientWidth*/ - (playerToMove.left + SIZE);
  }
  // if there is going to be a collision, correct the displacement to avoid it
  players.forEach((playerNotToMove) => {
    if (!playerNotToMove.disconnected && playerNotToMove.uuid != playerToMove.uuid) {
      if (
        checkCollision(
          playerToMove.left + horizontal,
          playerToMove.top + vertical,
          playerNotToMove.left,
          playerNotToMove.top,
          SIZE
        )
      ) {
        if (
          horizontal !== 0 &&
          playerNotToMove.left <= playerToMove.left + horizontal &&
          playerToMove.left + horizontal <= playerNotToMove.left + SIZE
        ) {
          horizontal = playerNotToMove.left + SIZE - playerToMove.left;
        } else if (
          horizontal !== 0 &&
          playerNotToMove.left <= playerToMove.left + SIZE + horizontal &&
          playerToMove.left + SIZE + horizontal <= playerNotToMove.left + SIZE
        ) {
          horizontal = playerNotToMove.left - (playerToMove.left + SIZE);
        } else if (
          vertical !== 0 &&
          playerNotToMove.top <= playerToMove.top + vertical &&
          playerToMove.top + vertical <= playerNotToMove.top + SIZE
        ) {
          vertical = playerNotToMove.top + SIZE - playerToMove.top;
        } else if (
          vertical !== 0 &&
          playerNotToMove.top <= playerToMove.top + SIZE + vertical &&
          playerToMove.top + SIZE + vertical <= playerNotToMove.top + SIZE
        ) {
          vertical = playerNotToMove.top - (playerToMove.top + SIZE);
        }
      }
    }
  });
  if (vertical !== 0 || horizontal !== 0) {
    playerToMove.top += vertical;
    playerToMove.left += horizontal;
    //console.log(`${playerToMove.uuid} top=${playerToMove.top} left=${playerToMove.left}`);
  }
};

const move = new Uint16Array(2);

const sendMove = () => {
  if (move[0] == myPlayer.top && move[1] == myPlayer.left) return;
  move[0] = myPlayer.top;
  move[1] = myPlayer.left;
  if (LAG === 0) {
    mesh.broadcast(move.buffer);
  } else {
    setTimeout(function () {
      mesh.broadcast(move.buffer);
    }, LAG);
  }
};
