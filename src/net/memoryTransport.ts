import type { ClientTransport, Connection, HostTransport, TransportFactory } from './transport';

// In-process transport: used by tests and for developing without a network.

class MemConn implements Connection {
  peer: MemConn | null = null;
  private msg: ((d: string) => void)[] = [];
  private cls: (() => void)[] = [];
  closed = false;
  constructor(readonly id: string) {}
  send(data: string) {
    if (this.closed || !this.peer || this.peer.closed) return;
    const p = this.peer;
    queueMicrotask(() => p.msg.forEach((f) => f(data)));
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    const p = this.peer;
    queueMicrotask(() => {
      this.cls.forEach((f) => f());
      if (p && !p.closed) p.close();
    });
  }
  onMessage(fn: (d: string) => void) {
    this.msg.push(fn);
  }
  onClose(fn: () => void) {
    this.cls.push(fn);
  }
}

const rooms = new Map<string, (c: Connection) => void>();
let counter = 0;
/** connections created by the latest connect() calls, so tests can cut the line */
export const memoryConnections: MemConn[] = [];

class MemHost implements HostTransport {
  private code: string | null = null;
  private cb: (c: Connection) => void = () => undefined;
  async listen(code: string) {
    if (rooms.has(code)) throw new Error('code-taken');
    this.code = code;
    rooms.set(code, (c) => this.cb(c));
  }
  onConnection(fn: (c: Connection) => void) {
    this.cb = fn;
  }
  close() {
    if (this.code) rooms.delete(this.code);
    this.code = null;
  }
}

class MemClient implements ClientTransport {
  async connect(code: string) {
    const accept = rooms.get(code);
    if (!accept) throw new Error('not-found');
    const a = new MemConn(`c${++counter}`);
    const b = new MemConn(`h${counter}`);
    a.peer = b;
    b.peer = a;
    memoryConnections.push(a);
    queueMicrotask(() => accept(b));
    return a;
  }
}

export const memoryTransport: TransportFactory = {
  host: () => new MemHost(),
  client: () => new MemClient(),
};

export const resetMemoryTransport = () => {
  rooms.clear();
  memoryConnections.length = 0;
};
