# ZapShare — 8-digit code file transfer

Peer-to-peer file transfer over WebRTC. The file itself goes straight from
one browser to the other — this server only relays the small handshake
messages (offer / answer / ICE candidates) needed to set up that connection,
matched by an 8-digit numeric code.

## Run it locally

```bash
npm install
npm start
```

Open `http://localhost:3000` in two different browser tabs (or two devices
on the same network, using your machine's local IP instead of `localhost`)
to test a transfer between them.

## How it works

1. Sender picks a file → server hands back an 8-digit code.
2. Sender shares that code with the receiver (chat, call, in person — however).
3. Receiver types the code in → server relays the WebRTC offer/answer between
   the two browsers.
4. Once connected, the file streams directly between the two browsers in
   16 KB chunks with a live progress bar. The server is no longer involved.

## Deploying so it works for real users

`localhost` only works between tabs on your own machine. For two different
people on different networks to use this, you need to deploy the server
somewhere public, over **HTTPS**, because:

- Browsers only allow camera/mic/WebRTC-adjacent APIs, and most browsers
  require file downloads and WebSocket connections to run over a secure
  origin outside of `localhost`.
- The client auto-detects `wss://` vs `ws://` based on whether the page is
  loaded over HTTPS, so once your host gives you an HTTPS URL, nothing else
  needs to change.

Any Node-friendly host works, for example:

- **Render.com** / **Railway.app** — connect your GitHub repo, it detects
  `npm start` automatically, gives you a free HTTPS URL.
- **A VPS** (DigitalOcean, Hetzner, etc.) — run behind Nginx as a reverse
  proxy with a Let's Encrypt certificate, keep the process alive with `pm2`.
- **Fly.io** / **Glitch** — similar auto-deploy flow.

Static hosts like GitHub Pages or Netlify will **not** work on their own —
they can't run the Node/WebSocket server, only the static front end.

## Notes on the ad placeholders

The page has a dashed "Advertisement" slot at the top. Real ad-network
scripts (AdSense etc.) aren't included — drop your ad network's own script
tag and unit code into `public/index.html` wherever that placeholder div is,
once this is running on your own domain.

## Limits worth knowing

- Very large files (multi-GB) are held in memory on both ends before/after
  transfer in this simple version — fine for typical use, but for huge files
  you'd want to stream to disk instead of buffering the whole file in an
  `ArrayBuffer`.
- One sender ↔ one receiver per code; a code is freed once the transfer
  finishes or either side disconnects.
- If both people are behind restrictive NATs/firewalls, a plain STUN server
  (used here) sometimes isn't enough to connect — a TURN server (e.g. via
  Twilio or coturn) fixes that but isn't included here.
