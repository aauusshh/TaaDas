/** A message pipe to one peer. Text only: JSON strings. */
export interface Connection {
  readonly id: string;
  send(data: string): void;
  close(): void;
  onMessage(fn: (data: string) => void): void;
  onClose(fn: () => void): void;
}

/** Host side: listen under a room code and accept connections. */
export interface HostTransport {
  /** rejects with an Error whose message is 'code-taken' when the room code is in use */
  listen(code: string): Promise<void>;
  onConnection(fn: (c: Connection) => void): void;
  close(): void;
}

/** Client side: open one connection to a room. */
export interface ClientTransport {
  /** rejects with 'timeout' or 'not-found' */
  connect(code: string, timeoutMs?: number): Promise<Connection>;
}

/**
 * Swap this module's implementations (PeerJS today, a WebSocket server later)
 * without touching the host, client, UI or engine.
 */
export interface TransportFactory {
  host(): HostTransport;
  client(): ClientTransport;
}
