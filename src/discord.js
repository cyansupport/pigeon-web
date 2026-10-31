// Minimal Discord Rich Presence client over Discord's local IPC pipe.
// Uses the "Pigeon Web" application on the Discord developer portal, which
// needs art assets named "pigeon" and "goose".
const net = require('net');
const path = require('path');

const CLIENT_ID = process.env.PIGEON_DISCORD_CLIENT_ID || '1565727619025211462';
const OP = { HANDSHAKE: 0, FRAME: 1, CLOSE: 2, PING: 3, PONG: 4 };
const RETRY_MS = 15000;
const MIN_UPDATE_MS = 4000; // Discord allows ~5 activity updates per 20s

function pipePath(i) {
  if (process.platform === 'win32') return `\\\\?\\pipe\\discord-ipc-${i}`;
  const dir = process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || process.env.TMP || '/tmp';
  return path.join(dir, `discord-ipc-${i}`);
}

class DiscordPresence {
  constructor(onStatus = () => {}) {
    this.onStatus = onStatus;
    this.status = 'off';
    this.enabled = false;
    this.sock = null;
    this.ready = false;
    this.buf = Buffer.alloc(0);
    this.activity = null;
    this.retryTimer = null;
    this.flushTimer = null;
    this.lastSent = 0;
  }

  get configured() { return /^\d{15,25}$/.test(CLIENT_ID); }

  // `code` lets the UI show its own translated text; `message` is the English fallback.
  setStatus(status, message = '', { code = '', user = '' } = {}) {
    Object.assign(this, { status, message, code, user });
    this.onStatus(this.snapshot());
  }

  snapshot() {
    return { status: this.status, message: this.message || '', code: this.code || '', user: this.user || '' };
  }

  setEnabled(on) {
    if (on === this.enabled) return;
    this.enabled = on;
    if (!on) return this.disconnect();
    if (!this.configured) return this.setStatus('error', 'Discord application ID is not set', { code: 'no-id' });
    this.connect();
  }

  setActivity(activity) {
    this.activity = activity;
    this.scheduleFlush();
  }

  connect(i = 0) {
    if (!this.enabled || this.sock) return;
    if (i === 0) this.setStatus('connecting');
    const s = net.createConnection(pipePath(i));
    s.once('connect', () => {
      this.sock = s;
      this.write(OP.HANDSHAKE, { v: 1, client_id: CLIENT_ID });
    });
    s.on('data', (d) => this.onData(d));
    s.once('error', () => {
      s.destroy();
      if (this.sock === s) return;
      if (i < 9) this.connect(i + 1);
      else { this.setStatus('waiting', 'Discord is not running', { code: 'not-running' }); this.scheduleRetry(); }
    });
    s.once('close', () => {
      if (this.sock !== s) return;
      this.sock = null;
      this.ready = false;
      this.buf = Buffer.alloc(0);
      if (this.enabled) {
        if (this.status !== 'error') this.setStatus('waiting', 'Lost connection to Discord', { code: 'lost' });
        this.scheduleRetry();
      }
    });
  }

  disconnect() {
    clearTimeout(this.retryTimer);
    clearTimeout(this.flushTimer);
    const s = this.sock;
    this.sock = null;
    this.ready = false;
    if (s) s.destroy(); // Discord clears the presence when the pipe closes
    this.setStatus('off');
  }

  scheduleRetry() {
    clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => this.connect(), RETRY_MS);
  }

  scheduleFlush() {
    if (!this.ready) return;
    clearTimeout(this.flushTimer);
    const wait = Math.max(500, MIN_UPDATE_MS - (Date.now() - this.lastSent));
    this.flushTimer = setTimeout(() => this.flush(), wait);
  }

  flush() {
    if (!this.ready) return;
    this.lastSent = Date.now();
    this.write(OP.FRAME, {
      cmd: 'SET_ACTIVITY',
      args: { pid: process.pid, activity: this.activity },
      nonce: Math.random().toString(36).slice(2)
    });
  }

  write(op, payload) {
    if (!this.sock) return;
    const body = Buffer.from(JSON.stringify(payload));
    const header = Buffer.alloc(8);
    header.writeInt32LE(op, 0);
    header.writeInt32LE(body.length, 4);
    this.sock.write(Buffer.concat([header, body]));
  }

  onData(chunk) {
    this.buf = Buffer.concat([this.buf, chunk]);
    while (this.buf.length >= 8) {
      const op = this.buf.readInt32LE(0);
      const len = this.buf.readInt32LE(4);
      if (this.buf.length < 8 + len) break;
      let msg = {};
      try { msg = JSON.parse(this.buf.subarray(8, 8 + len).toString()); } catch { /* ignore bad frame */ }
      this.buf = this.buf.subarray(8 + len);
      this.handle(op, msg);
    }
  }

  handle(op, msg) {
    if (op === OP.PING) return this.write(OP.PONG, msg);
    if (op === OP.CLOSE) return this.setStatus('error', msg.message || 'Discord closed the connection');
    if (msg.evt === 'READY') {
      this.ready = true;
      const user = msg.data?.user?.username || '';
      this.setStatus('connected', user ? `Connected as ${user}` : 'Connected', { code: 'connected', user });
      this.lastSent = 0;
      if (this.activity) this.flush();
    } else if (msg.evt === 'ERROR') {
      this.setStatus('error', msg.data?.message || 'Discord rejected the status update');
    }
  }
}

module.exports = { DiscordPresence };
