// ZapShare signaling server
// Only relays tiny WebRTC handshake messages (offer/answer/ICE candidates)
// through an 8-digit room code. The actual file NEVER passes through this
// server — once the two browsers are connected, data flows directly
// peer-to-peer over WebRTC.

const path = require('path');
const express = require('express');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const app = express();
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const server = app.listen(PORT, () => {
  console.log(`ZapShare signaling server running on http://localhost:${PORT}`);
});

const wss = new WebSocketServer({ server });

// code -> { creator: ws|null, joiner: ws|null, offer: object|null, meta: object|null }
const rooms = new Map();

function makeCode() {
  let code;
  do {
    code = String(Math.floor(10000000 + Math.random() * 90000000)); // 8 digits, no leading zero
  } while (rooms.has(code));
  return code;
}

function send(ws, msg) {
  if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

function cleanupRoom(code) {
  rooms.delete(code);
}

wss.on('connection', (ws) => {
  ws.role = null;
  ws.code = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {
      case 'create': {
        const code = makeCode();
        rooms.set(code, { creator: ws, joiner: null, offer: null, meta: null });
        ws.role = 'creator';
        ws.code = code;
        send(ws, { type: 'created', code });
        break;
      }

      case 'offer': {
        const room = rooms.get(msg.code);
        if (!room || room.creator !== ws) return;
        room.offer = msg.sdp;
        room.meta = msg.meta || null;
        break;
      }

      case 'join': {
        const room = rooms.get(msg.code);
        if (!room) {
          send(ws, { type: 'error', message: 'That code doesn\u2019t match an active transfer.' });
          return;
        }
        if (room.joiner) {
          send(ws, { type: 'error', message: 'Someone already connected with that code.' });
          return;
        }
        if (!room.offer) {
          send(ws, { type: 'error', message: 'The sender isn\u2019t ready yet \u2014 try again in a moment.' });
          return;
        }
        room.joiner = ws;
        ws.role = 'joiner';
        ws.code = msg.code;
        send(ws, { type: 'offer', sdp: room.offer, meta: room.meta });
        break;
      }

      case 'answer': {
        const room = rooms.get(msg.code);
        if (!room || room.joiner !== ws) return;
        send(room.creator, { type: 'answer', sdp: msg.sdp });
        break;
      }

      case 'candidate': {
        const room = rooms.get(msg.code);
        if (!room) return;
        const target = ws === room.creator ? room.joiner : room.creator;
        send(target, { type: 'candidate', candidate: msg.candidate });
        break;
      }

      case 'done': {
        // Sender signals transfer finished; free the room.
        if (ws.code) cleanupRoom(ws.code);
        break;
      }

      default:
        break;
    }
  });

  ws.on('close', () => {
    if (!ws.code) return;
    const room = rooms.get(ws.code);
    if (!room) return;
    const other = ws === room.creator ? room.joiner : room.creator;
    send(other, { type: 'peer-left' });
    cleanupRoom(ws.code);
  });
});
