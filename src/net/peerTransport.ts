import Peer, { type DataConnection } from 'peerjs';
import { env, hasTurn } from '../config/env';
import { peerIdFor } from './roomCode';
import type { ClientTransport, Connection, HostTransport, TransportFactory } from './transport';

export function iceConfig(relayOnly: boolean): RTCConfiguration {
  const iceServers: RTCIceServer[] = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  ];
  if (hasTurn) {
    iceServers.push({
      urls: env.turnUrls,
      username: env.turnUsername,
      credential: env.turnCredential,
    });
  }
  return { iceServers, iceTransportPolicy: relayOnly && hasTurn ? 'relay' : 'all' };
}

function wrap(conn: DataConnection): Connection {
  const msg: ((d: string) => void)[] = [];
  const cls: (() => void)[] = [];
  conn.on('data', (d) => msg.forEach((f) => f(typeof d === 'string' ? d : String(d))));
  let closed = false;
  const fire = () => {
    if (closed) return;
    closed = true;
    cls.forEach((f) => f());
  };
  conn.on('close', fire);
  conn.on('error', fire);
  return {
    id: conn.connectionId,
    send: (d) => {
      try {
        if (conn.open) conn.send(d);
      } catch {
        /* the close handler will fire */
      }
    },
    close: () => {
      try {
        conn.close();
      } catch {
        /* ignore */
      }
      fire();
    },
    onMessage: (f) => msg.push(f),
    onClose: (f) => cls.push(f),
  };
}

class PeerHost implements HostTransport {
  private peer: Peer | null = null;
  private cb: (c: Connection) => void = () => undefined;
  constructor(private relay: boolean) {}

  listen(code: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const peer = new Peer(peerIdFor(code), { config: iceConfig(this.relay), debug: 0 });
      this.peer = peer;
      const timer = setTimeout(() => reject(new Error('timeout')), 15000);
      peer.on('open', () => {
        clearTimeout(timer);
        resolve();
      });
      peer.on('error', (e: { type?: string }) => {
        clearTimeout(timer);
        reject(new Error(e.type === 'unavailable-id' ? 'code-taken' : (e.type ?? 'error')));
      });
      peer.on('connection', (conn) => {
        conn.on('open', () => this.cb(wrap(conn)));
      });
    });
  }
  onConnection(fn: (c: Connection) => void) {
    this.cb = fn;
  }
  close() {
    this.peer?.destroy();
    this.peer = null;
  }
}

class PeerClient implements ClientTransport {
  constructor(private relay: boolean) {}
  connect(code: string, timeoutMs = 15000): Promise<Connection> {
    return new Promise((resolve, reject) => {
      const peer = new Peer({ config: iceConfig(this.relay), debug: 0 });
      let done = false;
      const fail = (m: string) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        peer.destroy();
        reject(new Error(m));
      };
      const timer = setTimeout(() => fail('timeout'), timeoutMs);
      peer.on('error', (e: { type?: string }) =>
        fail(e.type === 'peer-unavailable' ? 'not-found' : (e.type ?? 'error')),
      );
      peer.on('open', () => {
        const conn = peer.connect(peerIdFor(code), { reliable: true });
        conn.on('open', () => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          const c = wrap(conn);
          const origClose = c.close;
          c.close = () => {
            origClose();
            peer.destroy();
          };
          c.onClose(() => peer.destroy());
          resolve(c);
        });
        conn.on('error', () => fail('error'));
      });
    });
  }
}

export const peerTransport = (relay = false): TransportFactory => ({
  host: () => new PeerHost(relay),
  client: () => new PeerClient(relay),
});
