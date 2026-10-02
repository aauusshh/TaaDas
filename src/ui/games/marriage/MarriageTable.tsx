import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { isJoker, type Card } from '../../../engine/core/cards';
import { IllegalActionError } from '../../../engine/core/types';
import { finishingDiscards } from '../../../engine/games/marriage';
import type { MAction, MView } from '../../../engine/games/marriage';
import { roleOf, solve, validateShow, type Ctx } from '../../../engine/games/marriage/rules';
import { useT } from '../../../i18n/t';
import { useSettings } from '../../../storage/settings';
import { CardBack, CardFace } from '../../cards/CardFace';
import { useFly } from '../../anim/FlightLayer';
import { dur, wait } from '../../anim/queue';
import { useAnimatedView, type RunArgs } from '../../anim/useAnimatedView';
import { handCardWidth, useViewport } from '../../anim/useViewport';
import { haptic } from '../../haptics';
import { sound } from '../../sound/SoundManager';
import { Button } from '../../components/Button';
import { useToast } from '../../components/Overlays';
import { Hand } from '../../table/Hand';
import { DiscardPile, DrawPile } from '../../table/Piles';
import { ResultPanel } from '../../table/ResultPanel';
import { Seat } from '../../table/Seat';
import { TableShell } from '../../table/TableShell';
import { sortBySuit } from '../../table/sortHand';
import type { TableProps } from '../types';
import { MarriageRules } from './MarriageRules';
import d from '../drawdiscard/DrawDiscard.module.css';
import m from './Marriage.module.css';

interface Ui {
  hand: Card[];
  counts: number[];
  tail: Card[];
  stock: number;
}

const fmt = (n: number) =>
  n >= 0 ? `+${n.toLocaleString('en-US')}` : `−${Math.abs(n).toLocaleString('en-US')}`;

export default function MarriageTable({
  session,
  mySeat,
  players,
  handHidden,
  canRematch,
  online,
  onLeave,
  onRematch,
}: TableProps) {
  const t = useT();
  const vp = useViewport();
  const settings = useSettings();
  const fly = useFly();
  const toast = useToast();
  const n = players.length;
  const cw = Math.min(handCardWidth(vp), vp.landscape ? 56 : 56);
  const pw = vp.landscape ? 50 : 56;
  const blank = (): Ui => ({ hand: [], counts: Array(n).fill(0), tail: [], stock: 156 });
  const [ui, setUi] = useState<Ui>(blank);
  const uiRef = useRef(ui);
  const patch = useCallback((fn: (u: Ui) => Ui) => {
    uiRef.current = fn(uiRef.current);
    setUi(uiRef.current);
  }, []);
  const [sel, setSel] = useState<ReadonlySet<number>>(new Set());
  const [order, setOrder] = useState<number[]>([]);
  const [gaps, setGaps] = useState<ReadonlySet<number>>(new Set());
  const [flying, setFlying] = useState<ReadonlySet<number>>(new Set());
  const [callout, setCallout] = useState<string | null>(null);
  const nameOf = (i: number) => players[i]?.name ?? '';
  const say = useCallback((text: string) => {
    setCallout(text);
    setTimeout(() => setCallout((c) => (c === text ? null : c)), 1600);
  }, []);

  const run = useCallback(
    async ({ events, next }: RunArgs<MView>) => {
      const pos = (seat: number) => `seat:${seat}`;
      const deals = events.filter((e) => e.type === 'deal');
      if (events.some((e) => e.type === 'roundStart')) {
        patch(blank);
        setOrder([]);
        setGaps(new Set());
      }
      if (deals.length > 0) {
        sound.play('shuffle');
        await wait(dur(400));
        const mine = ((deals.find((x) => x.seat === mySeat)?.cards ?? []) as Card[]).slice();
        let last: Promise<void> = Promise.resolve();
        let k = 0;
        for (let i = 0; i < 21; i++)
          for (const dl of deals) {
            const seat = dl.seat as number;
            const idx = k++;
            last = fly({
              front: <CardBack />,
              from: 'deck',
              to: pos(seat),
              duration: 190,
              rotate: [0, ((idx % 5) - 2) * 3],
            }).then(() =>
              patch((u) => ({
                ...u,
                hand: seat === mySeat ? mine.slice(0, u.hand.length + 1) : u.hand,
                counts: u.counts.map((c, j) => (j === seat ? c + 1 : c)),
                stock: u.stock - 1,
              })),
            );
            if (idx % 3 === 0) sound.play('deal');
            await wait(dur(14));
          }
        await last;
        await wait(dur(100));
      }
      for (const e of events) {
        if (e.type === 'flip' && e.cards) {
          const card = e.cards[0] as Card;
          sound.play('flip');
          await fly({
            front: <CardFace card={card} />,
            back: <CardBack />,
            flip: true,
            from: 'deck',
            to: 'discard',
            duration: 300,
          });
          patch((u) => ({ ...u, tail: [...u.tail, card].slice(-3), stock: u.stock - 1 }));
        } else if (e.type === 'draw' && e.seat !== undefined) {
          const seat = e.seat;
          const card = (e.cards?.[0] ?? null) as Card | null;
          sound.play('deal');
          await fly({ front: <CardBack />, from: 'deck', to: pos(seat), duration: 220 });
          patch((u) => ({
            ...u,
            hand: seat === mySeat && card ? [...u.hand, card] : u.hand,
            counts: u.counts.map((c, j) => (j === seat ? c + 1 : c)),
            stock: Math.max(0, u.stock - 1),
          }));
        } else if (e.type === 'move' && e.cards && e.seat !== undefined) {
          const card = e.cards[0] as Card;
          const seat = e.seat;
          const mine = seat === mySeat;
          sound.play('slide');
          if (e.to?.kind === 'hand') {
            await fly({
              front: <CardFace card={card} />,
              from: 'discard',
              to: pos(seat),
              duration: 230,
            });
            patch((u) => ({
              ...u,
              tail: u.tail.filter((c) => c.id !== card.id),
              hand: mine ? [...u.hand, card] : u.hand,
              counts: u.counts.map((c, j) => (j === seat ? c + 1 : c)),
            }));
          } else {
            setFlying((f) => new Set(f).add(card.id));
            await fly({
              front: <CardFace card={card} />,
              back: mine ? undefined : <CardBack />,
              flip: !mine,
              from: mine ? `card:${card.id}` : pos(seat),
              to: 'discard',
              duration: 230,
              rotate: [0, ((card.id % 7) - 3) * 2],
            });
            sound.play('place');
            patch((u) => ({
              ...u,
              tail: [...u.tail, card].slice(-3),
              hand: mine ? u.hand.filter((c) => c.id !== card.id) : u.hand,
              counts: u.counts.map((c, j) => (j === seat ? Math.max(0, c - 1) : c)),
            }));
            setFlying((f) => {
              const nx = new Set(f);
              nx.delete(card.id);
              return nx;
            });
          }
        } else if (e.type === 'show' && e.seat !== undefined) {
          sound.play('chips');
          const cards = (e.cards ?? []) as Card[];
          patch((u) => ({
            ...u,
            hand:
              e.seat === mySeat ? u.hand.filter((c) => !cards.some((x) => x.id === c.id)) : u.hand,
            counts: u.counts.map((c, j) => (j === e.seat ? Math.max(0, c - cards.length) : c)),
          }));
          say(t('mg.say.show', { name: nameOf(e.seat) }));
          await wait(dur(700));
        } else if (e.type === 'declare' && e.seat !== undefined) {
          sound.play('win');
          say(t('mg.say.declare', { name: nameOf(e.seat) }));
          await wait(dur(900));
        } else if (e.type === 'reshuffle') sound.play('shuffle');
        else if (e.type === 'stalled') say(t('mg.say.stalled'));
        else if (e.type === 'gameEnd') sound.play('win');
      }
      patch(() => ({
        hand: next.hand,
        counts: next.handCounts,
        tail: next.tail,
        stock: next.stockCount,
      }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fly, mySeat, n, patch, say],
  );

  const { shown: view, busy } = useAnimatedView<MView>(session, mySeat, run);
  useLayoutEffect(() => setSel(new Set()), [view]);

  const key = view ? `${view.phase}:${view.turn}:${view.round}` : '';
  const prev = useRef('');
  useLayoutEffect(() => {
    if (!view || prev.current === key) return;
    prev.current = key;
    if (view.turn === mySeat && view.phase === 'draw') haptic(10);
  }, [key, view, mySeat]);

  const myTurn = !!view && !busy && view.turn === mySeat && !handHidden;
  const ctx: Ctx = useMemo(
    () => ({ joker: view?.joker ?? null, supermanId: view?.supermanId ?? null }),
    [view?.joker, view?.supermanId],
  );
  const seen = !!view?.seen[mySeat];

  // hand order: what the player arranged, new cards at the end
  const hand = useMemo(() => {
    const cards = ui.hand.filter((c) => !flying.has(c.id));
    const byId = new Map(cards.map((c) => [c.id, c]));
    const known = order.filter((id) => byId.has(id));
    const rest = settings.autoSort
      ? sortBySuit(cards.filter((c) => !known.includes(c.id)))
      : cards.filter((c) => !known.includes(c.id));
    return [...known.map((id) => byId.get(id)!), ...rest];
  }, [ui.hand, flying, order, settings.autoSort]);

  const submit = (a: MAction) => {
    try {
      session.submit(mySeat, a);
    } catch (e) {
      if (e instanceof IllegalActionError) {
        haptic(20);
        toast.show(t('mg.illegal'));
      } else throw e;
    }
  };

  const chosen = hand.filter((c) => sel.has(c.id));
  // what the current selection would show (before seeing): pure sets or pairs
  const showSets = useMemo(() => {
    if (!view || seen || chosen.length === 0) return null;
    const noJoker: Ctx = { joker: null, supermanId: view.supermanId };
    const pairs = new Map<string, Card[]>();
    for (const c of chosen)
      pairs.set(`${c.suit}${c.rank}`, [...(pairs.get(`${c.suit}${c.rank}`) ?? []), c]);
    if ([...pairs.values()].every((g) => g.length === 2 && !isJoker(g[0]))) {
      const sets = [...pairs.values()];
      const ok = validateShow(
        sets,
        noJoker,
        { sequences: view.config.showSets, dublees: view.config.showDublees },
        view.config.jokerDublee,
      );
      if (ok) return sets;
    }
    const melds = solve(chosen, noJoker, { allowWild: false, pureOnly: true });
    if (!melds) return null;
    const sets = melds.map((x) => x.cards);
    return validateShow(
      sets,
      noJoker,
      { sequences: view.config.showSets, dublees: view.config.showDublees },
      view.config.jokerDublee,
    )
      ? sets
      : null;
  }, [view, seen, chosen]);
  const mustShowOk =
    !view?.mustShow || (showSets?.flat().some((c) => c.id === view.mustShow) ?? false);

  const finishing = useMemo(() => {
    if (!view || !seen || view.phase !== 'discard' || view.turn !== mySeat) return [];
    return finishingDiscards(ui.hand, view.shown[mySeat], view.route[mySeat], ctx, view.config);
  }, [view, seen, ui.hand, ctx, mySeat]);

  const arrange = () => {
    if (!view) return;
    const all = [...hand, ...view.shown[mySeat].flat()];
    const melds = seen
      ? solve(all, ctx, { allowWild: true, pureOnly: false })
      : solve(
          hand,
          { joker: null, supermanId: view.supermanId },
          { allowWild: false, pureOnly: true },
        );
    const ordered: number[] = [];
    const g = new Set<number>();
    const inHand = new Set(hand.map((c) => c.id));
    if (melds) {
      for (const meld of melds) {
        const cs = meld.cards.filter((c) => inHand.has(c.id));
        cs.forEach((c) => ordered.push(c.id));
        if (cs.length) g.add(cs[cs.length - 1].id);
      }
    } else {
      // no full split: put each suit in order and leave a gap between suits
      const sorted = sortBySuit(hand);
      sorted.forEach((c, i) => {
        ordered.push(c.id);
        if (i < sorted.length - 1 && sorted[i + 1].suit !== c.suit) g.add(c.id);
      });
    }
    const left = hand.filter((c) => !ordered.includes(c.id));
    left.forEach((c) => ordered.push(c.id));
    setOrder(ordered);
    setGaps(g);
    sound.play('shuffle');
  };

  const marked = useMemo(
    () =>
      new Set(
        view?.joker ? hand.filter((c) => roleOf(c, view.joker!) !== null).map((c) => c.id) : [],
      ),
    [hand, view?.joker],
  );
  const roleNames = view?.joker
    ? (['tiplu', 'poplu', 'jhiplu', 'alter'] as const)
        .map((r) => `${t(`mg.role.${r}`)}`)
        .join(' · ')
    : '';

  const result = view?.phase === 'over' ? session.result() : null;
  const last = view?.last;

  const seatRow = (seat: number) => {
    const tm =
      view && !busy && view.turn === seat && view.phase !== 'roundEnd'
        ? session.getTimer(seat)
        : null;
    return (
      <Seat
        key={seat}
        seat={seat}
        name={nameOf(seat)}
        avatar={players[seat].avatar}
        isBot={players[seat].isBot}
        value={view?.chips[seat] ?? 0}
        info={
          view?.seen[seat]
            ? view.route[seat] === 'dublee'
              ? t('mg.dublee')
              : t('mg.seen')
            : undefined
        }
        isTurn={
          !!view &&
          !busy &&
          view.turn === seat &&
          (view.phase === 'draw' || view.phase === 'discard')
        }
        timerMs={tm?.remainingMs}
        timerTotalMs={tm?.totalMs}
        dealer={!!view && view.dealer === seat}
        auto={session.isAuto(seat)}
        conn={online ? session.getConn?.(seat) : undefined}
        you={seat === mySeat}
        row={vp.landscape}
      >
        {seat !== mySeat && <span className={`${d.count} num`}>{ui.counts[seat]}</span>}
        {view && view.shown[seat].length > 0 && (
          <div className={m.shown}>
            {view.shown[seat].map((set, i) => (
              <div key={i} className={m.shownSet}>
                {set.map((c) => (
                  <div key={c.id} style={{ width: 18 }}>
                    <CardFace card={c} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </Seat>
    );
  };
  const others = Array.from({ length: n - 1 }, (_, i) => (mySeat + i + 1) % n);

  const status = (() => {
    if (!view || view.phase === 'roundEnd' || view.phase === 'over') return '';
    if (view.turn !== mySeat) return t('rangi.waitPlay', { name: nameOf(view.turn) });
    if (view.phase === 'draw') return t('mg.draw');
    if (view.mustShow !== null) return t('mg.mustShow');
    return seen
      ? finishing.length
        ? t('mg.canDeclare')
        : t('mg.discardOne')
      : t('mg.discardOrShow');
  })();

  const half = Math.ceil(hand.length / 2);
  const rows = [hand.slice(0, half), hand.slice(half)];

  const settlement = last && (
    <div className={m.settle}>
      {last.breakdown.map((b) => (
        <div key={b.seat} className={m.settleRow} data-win={last.winner === b.seat}>
          <span className={m.who}>
            {nameOf(b.seat)}
            {!b.seen ? ` (${t('mg.unseen')})` : ''}
          </span>
          <span className={`${m.pts} num`} data-neg={last.chips[b.seat] < 0}>
            {fmt(last.chips[b.seat])}
          </span>
          <span className={m.lines}>
            {b.lines.length ? b.lines.map((l) => `${l.label} ${l.pts}`).join(', ') : t('mg.noMaal')}
          </span>
        </div>
      ))}
    </div>
  );

  return (
    <TableShell
      session={session}
      onLeave={onLeave}
      isHost={online && mySeat === 0}
      ledger={
        view ? (
          <div className={m.settle}>
            {players.map((p, i) => (
              <div key={i} className={m.settleRow}>
                <span className={m.who}>{p.name}</span>
                <span className={`${m.pts} num`} data-neg={view.chips[i] < view.start[i]}>
                  {view.chips[i].toLocaleString('en-US')} ({fmt(view.chips[i] - view.start[i])})
                </span>
              </div>
            ))}
          </div>
        ) : null
      }
      rules={<MarriageRules />}
      overlay={
        <>
          {view?.phase === 'roundEnd' && !busy && last && (
            <ResultPanel
              title={
                last.winner === null ? t('mg.stalled') : t('cb.wins', { name: nameOf(last.winner) })
              }
              subtitle={
                view.joker
                  ? t('mg.jokerWas', { card: `${view.joker.rank}${view.joker.suit}` })
                  : undefined
              }
              actions={
                view.canNext ? (
                  <Button tone="primary" onClick={() => submit({ type: 'next' })}>
                    {t('rangi.nextRound')}
                  </Button>
                ) : (
                  <span className={d.muted}>{t('lb.waitNext')}</span>
                )
              }
            >
              {settlement}
            </ResultPanel>
          )}
          {result && view && !busy && (
            <ResultPanel
              big
              celebrate
              title={
                result.winners.length === 1
                  ? t('cb.wins', { name: nameOf(result.winners[0]) })
                  : t('cb.tie', { names: result.winners.map(nameOf).join(', ') })
              }
              subtitle={t('lb.afterRounds', { n: view.rounds })}
              note={t('app.chipsNote')}
              actions={
                <>
                  {canRematch ? (
                    <Button tone="primary" onClick={onRematch}>
                      {t('common.rematch')}
                    </Button>
                  ) : (
                    <span className={d.muted}>{t('room.waitRematch')}</span>
                  )}
                  <Button onClick={onLeave}>{t('common.home')}</Button>
                </>
              }
            >
              {settlement}
            </ResultPanel>
          )}
        </>
      }
    >
      <div className={d.board} data-landscape={vp.landscape} style={{ overflowY: 'auto' }}>
        <div className={d.others}>{others.map(seatRow)}</div>

        <div className={d.center} style={{ minHeight: 120 }}>
          <div className={d.piles}>
            <div className={d.stockWrap}>
              {view && (
                <div className={m.joker} style={{ width: pw }} aria-label={t('mg.jokerCard')}>
                  {view.joker ? <CardFace card={view.joker} /> : <CardBack />}
                </div>
              )}
              <button
                type="button"
                className={d.stockBtn}
                disabled={!view?.canDrawStock || busy || !myTurn}
                onClick={() => submit({ type: 'draw', from: 'stock' })}
                aria-label={t('jp.drawStock')}
              >
                <DrawPile count={ui.stock} cardWidth={pw} />
                {view?.canDrawStock && myTurn && <span className={d.tag}>{t('jp.drawStock')}</span>}
              </button>
            </div>
            <div className={d.stockWrap}>
              <button
                type="button"
                className={d.stockBtn}
                disabled={!view?.canDrawDiscard || busy || !myTurn}
                onClick={() => submit({ type: 'draw', from: 'discard' })}
                aria-label={t('jp.takeDiscard')}
              >
                <DiscardPile cards={ui.tail} cardWidth={pw} />
                {view?.canDrawDiscard && myTurn && (
                  <span className={d.tag}>{t('jp.takeDiscard')}</span>
                )}
              </button>
            </div>
          </div>
          {callout && <div className={d.callout}>{callout}</div>}
        </div>

        {view && view.shown[mySeat].length > 0 && (
          <div className={m.mineShown} aria-label={t('mg.yourShown')}>
            {view.shown[mySeat].map((set, i) => (
              <div key={i} className={m.shownSet}>
                {set.map((c) => (
                  <div key={c.id} style={{ width: 26 }}>
                    <CardFace card={c} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        <div className={d.bottom}>
          <div className={d.mine}>
            {seatRow(mySeat)}
            <div className={d.status} aria-live="polite">
              {view && (
                <span className={d.round}>
                  {t('cb.roundOf', { n: view.round + 1, total: view.rounds })}
                </span>
              )}
              <span className={d.say}>{status}</span>
              {view?.joker && !handHidden && <span className={d.total}>{roleNames}</span>}
              {session.isAuto(mySeat) && (
                <Button size="small" tone="primary" onClick={() => session.setAuto(mySeat, false)}>
                  {t('cb.imBack')}
                </Button>
              )}
            </div>
            <div className={d.actions}>
              {!handHidden && hand.length > 0 && (
                <Button size="small" onClick={arrange}>
                  {t('mg.arrange')}
                </Button>
              )}
              {myTurn && view?.phase === 'discard' && !seen && (
                <Button
                  tone="primary"
                  disabled={!showSets || !mustShowOk}
                  onClick={() =>
                    submit({ type: 'show', sets: showSets!.map((st) => st.map((c) => c.id)) })
                  }
                >
                  {t('mg.show')}
                </Button>
              )}
              {myTurn && view?.phase === 'discard' && view.mustShow === null && (
                <Button
                  disabled={chosen.length !== 1}
                  onClick={() => submit({ type: 'discard', cardId: chosen[0].id })}
                >
                  {t('jp.discard')}
                </Button>
              )}
              {myTurn && view?.phase === 'discard' && finishing.length > 0 && (
                <Button
                  tone="primary"
                  onClick={() =>
                    submit({
                      type: 'declare',
                      cardId:
                        chosen.length === 1 && finishing.includes(chosen[0].id)
                          ? chosen[0].id
                          : finishing[0],
                    })
                  }
                >
                  {t('mg.declare')}
                </Button>
              )}
            </div>
          </div>
          <div className={m.rows}>
            {rows.map((r, i) =>
              r.length === 0 ? null : (
                <Hand
                  key={i}
                  seat={i === 0 ? mySeat : mySeat + 100}
                  cards={r}
                  cardWidth={cw}
                  selectedIds={sel}
                  onToggle={(id) =>
                    setSel((cur) => {
                      const nx = new Set(cur);
                      if (nx.has(id)) nx.delete(id);
                      else nx.add(id);
                      return nx;
                    })
                  }
                  marked={marked}
                  gapAfter={gaps}
                  faceDown={handHidden}
                  disabled={!myTurn || view?.phase !== 'discard'}
                />
              ),
            )}
          </div>
        </div>
      </div>
    </TableShell>
  );
}
