import { z } from 'zod';

export const PROTOCOL_VERSION = 1;
export const MAX_MESSAGE_BYTES = 64 * 1024;
export const MAX_ACTIONS_PER_SECOND = 20;
export const AWAY_GRACE_MS = 3 * 60 * 1000;

export const REACTIONS = [
  'phrase.ramro',
  'phrase.chito',
  'phrase.sorry',
  'phrase.haha',
  'phrase.lucky',
  'phrase.feri',
  'emoji.clap',
  'emoji.laugh',
  'emoji.wow',
  'emoji.cry',
  'emoji.fire',
  'emoji.thumbs',
] as const;
export type ReactionId = (typeof REACTIONS)[number];

const Name = z.string().trim().min(1).max(16);
const Avatar = z.string().max(24);

/** What a client may send to the host. */
export const ClientMsg = z.discriminatedUnion('t', [
  z.object({
    t: z.literal('hello'),
    v: z.number(),
    name: Name,
    avatar: Avatar,
    token: z.string().max(64).optional(),
    spectate: z.boolean().optional(),
  }),
  z.object({ t: z.literal('action'), seq: z.number().int(), action: z.unknown() }),
  z.object({ t: z.literal('react'), id: z.enum(REACTIONS) }),
  z.object({ t: z.literal('ready'), on: z.boolean() }),
  z.object({ t: z.literal('profile'), name: Name, avatar: Avatar }),
  z.object({ t: z.literal('back') }),
  z.object({ t: z.literal('ping') }),
]);
export type ClientMsg = z.infer<typeof ClientMsg>;

export const SeatKind = z.enum(['empty', 'host', 'human', 'bot']);
export const Conn = z.enum(['good', 'slow', 'away']);
export type ConnState = z.infer<typeof Conn>;

export const LobbySeat = z.object({
  kind: SeatKind,
  name: z.string(),
  avatar: z.string(),
  ready: z.boolean(),
  conn: Conn,
  difficulty: z.enum(['easy', 'medium', 'hard']),
});
export type LobbySeat = z.infer<typeof LobbySeat>;

export const Lobby = z.object({
  code: z.string(),
  gameId: z.string(),
  config: z.record(z.string(), z.union([z.boolean(), z.number(), z.string()])),
  seats: z.array(LobbySeat),
  hostSeat: z.number().int(),
  timerSec: z.number(),
  locked: z.boolean(),
  spectators: z.boolean(),
  spectatorCount: z.number().int(),
  started: z.boolean(),
  gen: z.number().int(),
  relay: z.boolean(),
});
export type Lobby = z.infer<typeof Lobby>;

const Events = z.array(z.looseObject({ type: z.string() }));

/** What the host sends to a client. `view` and `result` are game-specific, so they stay loose. */
export const HostMsg = z.discriminatedUnion('t', [
  z.object({
    t: z.literal('welcome'),
    v: z.number(),
    seat: z.union([z.number().int(), z.literal('spectator')]),
    token: z.string(),
    lobby: Lobby,
  }),
  z.object({ t: z.literal('lobby'), lobby: Lobby }),
  z.object({
    t: z.literal('view'),
    gen: z.number().int(),
    seq: z.number().int(),
    seat: z.union([z.number().int(), z.literal('spectator')]),
    view: z.unknown(),
    events: Events,
    actors: z.array(z.number().int()),
    playPhase: z.boolean(),
    auto: z.array(z.number().int()),
    timers: z.array(
      z.object({ seat: z.number().int(), remainingMs: z.number(), totalMs: z.number() }),
    ),
    conn: z.array(Conn),
    result: z.unknown(),
  }),
  z.object({ t: z.literal('error'), code: z.string(), message: z.string().optional() }),
  z.object({ t: z.literal('pong') }),
  z.object({ t: z.literal('kicked') }),
  z.object({ t: z.literal('hostPaused') }),
  z.object({ t: z.literal('closed'), results: z.unknown() }),
  z.object({
    t: z.literal('reaction'),
    seat: z.union([z.number().int(), z.literal('spectator')]),
    id: z.string(),
  }),
]);
export type HostMsg = z.infer<typeof HostMsg>;

export function encode(msg: ClientMsg | HostMsg): string {
  const s = JSON.stringify(msg);
  if (s.length > MAX_MESSAGE_BYTES) throw new Error('message too large');
  return s;
}

export function parseClientMsg(raw: string): ClientMsg | null {
  if (raw.length > MAX_MESSAGE_BYTES) return null;
  try {
    const r = ClientMsg.safeParse(JSON.parse(raw));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

export function parseHostMsg(raw: string): HostMsg | null {
  try {
    const r = HostMsg.safeParse(JSON.parse(raw));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}
