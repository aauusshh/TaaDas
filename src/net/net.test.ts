import { afterEach, describe, expect, it } from 'vitest';
import { callBreak } from '../engine/games/callbreak';
import { langurBurja } from '../engine/games/langurburja';
import type { CallBreakView } from '../engine/games/callbreak';
import { ClientSession } from './client';
import { HostSession } from './host';
import { memoryConnections, memoryTransport, resetMemoryTransport } from './memoryTransport';
import { isValidCode, makeRoomCode, normalizeCode } from './roomCode';
import { parseClientMsg, parseHostMsg, MAX_MESSAGE_BYTES } from './protocol';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function waitFor(cond: () => boolean, ms = 4000) {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error('waitFor timed out');
    await sleep(5);
  }
}

const sessions: { dispose(): void }[] = [];
afterEach(() => {
  sessions.splice(0).forEach((s) => s.dispose());
  resetMemoryTransport();
});

async function makeHost(
  code = 'K7M2Q',
  extra: Partial<ConstructorParameters<typeof HostSession>[0]> = {},
) {
  const host = new HostSession({
    transport: memoryTransport.host(),
    game: callBreak,
    code,
    config: { rounds: 1 },
    seatCount: 4,
    host: { name: 'Host', avatar: 'yak' },
    thinkMs: () => 0,
    spectators: false,
    ...extra,
  });
  sessions.push(host);
  await host.open();
  return host;
}
/** bots are off until the host switches them on: fill every free seat with one */
function fillBots(host: HostSession) {
  host.setBotsEnabled(true);
  while (host.getLobby().seats.some((x) => x.kind === 'empty')) host.addBotNext();
}
async function makeClient(code: string, name: string, extra = {}) {
  const c = new ClientSession({
    transport: memoryTransport.client(),
    code,
    name,
    avatar: 'tiger',
    retryMs: 20,
    pingMs: 50,
    ...extra,
  });
  sessions.push(c);
  await c.join();
  return c;
}

describe('room code and protocol', () => {
  it('codes use the safe alphabet and normalize pasted text', () => {
    for (let i = 0; i < 200; i++) expect(isValidCode(makeRoomCode())).toBe(true);
    expect(normalizeCode(' k7m-2q ')).toBe('K7M2Q');
    expect(isValidCode('K7M2O')).toBe(false); // O is not allowed
  });
  it('rejects malformed and oversized messages', () => {
    expect(parseClientMsg('{"t":"hello","v":1,"name":"","avatar":"yak"}')).toBeNull();
    expect(parseClientMsg('{"t":"hello","v":1,"name":"Asha","avatar":"yak"}')).not.toBeNull();
    expect(parseClientMsg('not json')).toBeNull();
    expect(parseClientMsg('x'.repeat(MAX_MESSAGE_BYTES + 1))).toBeNull();
    expect(parseClientMsg('{"t":"react","id":"nope"}')).toBeNull();
    expect(parseHostMsg('{"t":"pong"}')).not.toBeNull();
    expect(parseHostMsg('{"t":"mystery"}')).toBeNull();
  });
});

describe('lobby', () => {
  it('seats joiners, tracks ready, and starts with bots filling empty seats', async () => {
    const host = await makeHost();
    const a = await makeClient('K7M2Q', 'Asha');
    expect(a.seat).toBe(1);
    expect(a.lobby?.seats[1].name).toBe('Asha');
    expect(host.canStart()).toBe(false); // Asha is not ready, and nobody fills the free seats
    fillBots(host);
    a.setReady(true);
    await waitFor(() => host.canStart());
    expect(host.startGame()).toBe(true);
    await waitFor(() => a.state === 'playing');
    expect(host.getLobby().seats.filter((s) => s.kind === 'bot')).toHaveLength(2);
  });

  it('refuses a full or locked room, and spectators only when allowed', async () => {
    const host = await makeHost('AAAAA', { seatCount: 2 });
    await makeClient('AAAAA', 'One');
    await expect(makeClient('AAAAA', 'Two')).rejects.toThrow('full');
    host.setSpectators(true);
    const w = await makeClient('AAAAA', 'Watcher');
    expect(w.seat).toBe('spectator');
    host.setSpectators(false);
    host.setLocked(true);
    await expect(makeClient('AAAAA', 'Late')).rejects.toThrow(/locked|full/);
  });

  it('kick frees the seat and tells the client', async () => {
    const host = await makeHost();
    const a = await makeClient('K7M2Q', 'Asha');
    host.kick(1);
    await waitFor(() => a.state === 'kicked');
    expect(host.getLobby().seats[1].kind).toBe('empty');
  });

  it('host can swap seats and add or remove bots', async () => {
    const host = await makeHost();
    host.addBot(2); // bots are off by default
    expect(host.getLobby().seats[2].kind).toBe('empty');
    host.setBotsEnabled(true);
    host.addBot(2);
    expect(host.getLobby().seats[2].kind).toBe('bot');
    host.swapSeats(0, 2);
    expect(host.getLobby().hostSeat).toBe(2);
    host.removeBot(0);
    expect(host.getLobby().seats[0].kind).toBe('empty');
  });

  it('a room code in use is rejected', async () => {
    await makeHost('ZZZZZ');
    const second = new HostSession({
      transport: memoryTransport.host(),
      game: callBreak,
      code: 'ZZZZZ',
      config: {},
      seatCount: 4,
      host: { name: 'x', avatar: 'yak' },
    });
    await expect(second.open()).rejects.toThrow('code-taken');
  });
});

describe('open rooms, optional bots, max players', () => {
  const langurHost = (extra = {}) =>
    makeHost('LANGU', { game: langurBurja as never, config: {}, seatCount: 10, ...extra });

  it('Langur Burja: players join as they arrive, no bots, starts with the people who came', async () => {
    const host = await langurHost();
    const lobby = host.getLobby();
    expect(lobby.botsEnabled).toBe(false);
    expect(lobby.maxPlayers).toBe(10);
    const a = await makeClient('LANGU', 'Asha');
    const b = await makeClient('LANGU', 'Bimal');
    a.setReady(true);
    b.setReady(true);
    await waitFor(() => host.canStart());
    host.startGame();
    await waitFor(() => a.state === 'playing');
    const seats = host.getLobby().seats;
    expect(seats).toHaveLength(3); // the host and two players, free seats dropped
    expect(seats.some((x) => x.kind === 'bot')).toBe(false);
    expect(b.mySeat).toBe(2);
  });

  it('max players can change while people join, and only blocks new joins when full', async () => {
    const host = await langurHost();
    await makeClient('LANGU', 'One');
    host.setSeatCount(2); // the host and One fill it
    await expect(makeClient('LANGU', 'Two')).rejects.toThrow('full');
    host.setSeatCount(3);
    const two = await makeClient('LANGU', 'Two');
    expect(two.seat).toBe(2);
    host.setSeatCount(2); // cannot drop a seated player
    expect(host.getLobby().maxPlayers).toBe(3);
  });

  it('bots only appear when the host turns them on and adds them one by one', async () => {
    const host = await langurHost();
    host.addBotNext();
    expect(host.getLobby().seats.filter((x) => x.kind === 'bot')).toHaveLength(0);
    host.setBotsEnabled(true);
    host.addBotNext();
    host.addBotNext();
    expect(host.getLobby().seats.filter((x) => x.kind === 'bot')).toHaveLength(2);
    host.removeBotLast();
    expect(host.getLobby().seats.filter((x) => x.kind === 'bot')).toHaveLength(1);
    host.setBotsEnabled(false);
    expect(host.getLobby().seats.filter((x) => x.kind === 'bot')).toHaveLength(0);
  });

  it('a card game needs its minimum players, filled by people or bots', async () => {
    const host = await makeHost(); // Call Break: 4 seats
    const a = await makeClient('K7M2Q', 'Asha');
    a.setReady(true);
    await waitFor(() => host.getLobby().seats[1].ready);
    expect(host.canStart()).toBe(false); // 2 of 4 and bots are off
    host.setSeatCount(6); // clamped to the game's range
    expect(host.getLobby().seats.length).toBe(4);
    host.setBotsEnabled(true);
    host.addBotNext();
    host.addBotNext();
    expect(host.canStart()).toBe(true);
  });
});

describe('a game over the wire', () => {
  async function playThrough(host: HostSession, clients: ClientSession[]) {
    const humans = [host, ...clients];
    host.start();
    const t0 = Date.now();
    while (!host.result()) {
      if (Date.now() - t0 > 20000) throw new Error('game did not finish');
      for (const h of humans) {
        const seat = h === host ? host.hostSeat : (h as ClientSession).mySeat;
        if (!host.currentActors().includes(seat) || host.isAuto(seat)) continue;
        const legal = host.legalActions(seat) as { type: string }[];
        if (legal.length) h.submit(seat, legal[0]);
      }
      await sleep(2);
    }
  }

  it('two clients finish a game and never receive another player’s cards', async () => {
    const host = await makeHost();
    const a = await makeClient('K7M2Q', 'Asha');
    const b = await makeClient('K7M2Q', 'Bimal');
    fillBots(host);
    a.setReady(true);
    b.setReady(true);
    await waitFor(() => host.canStart());
    // at the moment each message reaches a client, no card from another seat's hand may be in it
    const cardIds = (x: string) => [...x.matchAll(/"id":(\d+),"suit"/g)].map((m) => Number(m[1]));
    let checked = 0;
    const leaks: string[] = [];
    memoryConnections.forEach((c, k) => {
      const seat = k + 1;
      c.onMessage((raw) => {
        if (!raw.includes('"t":"view"')) return;
        checked++;
        const others = new Set<number>();
        for (let s2 = 0; s2 < 4; s2++) {
          if (s2 === seat) continue;
          for (const card of (host.getView(s2) as CallBreakView).hand) others.add(card.id);
        }
        // a card that was just played is public even though it left the hand, so only unplayed cards count
        for (const id of cardIds(raw))
          if (others.has(id)) leaks.push(`seat ${seat} saw card ${id}`);
      });
    });
    host.startGame();
    await playThrough(host, [a, b]);
    await waitFor(() => a.result() !== null && b.result() !== null);
    expect(a.result()!.winners).toEqual(host.result()!.winners);
    expect(checked).toBeGreaterThan(20);
    expect(leaks).toEqual([]);
  });

  it('a dropped player gets Auto while away and the same seat back on return', async () => {
    const host = await makeHost();
    const a = await makeClient('K7M2Q', 'Asha');
    a.setReady(true);
    fillBots(host);
    await waitFor(() => host.canStart());
    host.startGame();
    await waitFor(() => a.state === 'playing');
    host.start();
    const seat = a.mySeat;
    memoryConnections[0].close(); // the line drops
    await waitFor(() => host.isAuto(seat));
    expect(host.getLobby().seats[seat].conn).toBe('away');
    await waitFor(() => a.state === 'playing' && !host.isAuto(seat), 5000);
    expect(a.mySeat).toBe(seat);
  });

  it('illegal and malformed input gets an error and cannot change the game', async () => {
    const host = await makeHost();
    const a = await makeClient('K7M2Q', 'Asha');
    a.setReady(true);
    fillBots(host);
    await waitFor(() => host.canStart());
    host.startGame();
    await waitFor(() => a.state === 'playing');
    const errors: string[] = [];
    a.onError((c) => errors.push(c));
    a.submit(a.mySeat, { type: 'play', cardId: 99999 });
    a.submit(a.mySeat, 'garbage');
    await waitFor(() => errors.length >= 1);
    expect(errors[0]).toMatch(/illegal|not_playing/);
    expect(host.result()).toBeNull();
  });
});
