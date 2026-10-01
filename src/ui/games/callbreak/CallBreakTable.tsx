import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Card } from '../../../engine/core/cards';
import { createRng } from '../../../engine/core/rng';
import { IllegalActionError } from '../../../engine/core/types';
import { estimateBid } from '../../../engine/games/callbreak/bot';
import type { TrickPlay } from '../../../engine/games/callbreak/rules';
import { callBreak } from '../../../engine/games/callbreak';
import type { CallBreakAction, CallBreakView } from '../../../engine/games/callbreak';
import { nextSeat } from '../../../engine/core/seats';
import { useT } from '../../../i18n/t';
import { useSettings } from '../../../storage/settings';
import { CardBack, CardFace } from '../../cards/CardFace';
import { useFly } from '../../anim/FlightLayer';
import { dur, wait } from '../../anim/queue';
import { useAnimatedView, type RunArgs } from '../../anim/useAnimatedView';
import { handCardWidth, useViewport } from '../../anim/useViewport';
import { sound } from '../../sound/SoundManager';
import { haptic } from '../../haptics';
import { Button } from '../../components/Button';
import { Dialog, useToast } from '../../components/Overlays';
import { Hand } from '../../table/Hand';
import { BackStack, DrawPile } from '../../table/Piles';
import { Ledger } from '../../table/Ledger';
import { ResultPanel } from '../../table/ResultPanel';
import { Seat } from '../../table/Seat';
import { TableShell } from '../../table/TableShell';
import { sortBySuit } from '../../table/sortHand';
import { useAnchor } from '../../anim/anchors';
import type { TableProps } from '../types';
import { CallBreakRules } from './CallBreakRules';
import s from './CallBreakTable.module.css';

const jit = (seat: number, salt: number) => Math.sin(seat * 91.7 + salt * 17.3) * 4;

function Slot({ pos, seat, play, w }: { pos: number; seat: number; play?: TrickPlay; w: number }) {
  const ref = useAnchor(`trick:${seat}`);
  const h = w / 0.7159;
  const place: React.CSSProperties =
    pos === 0
      ? { left: '50%', bottom: 0, marginLeft: -w / 2 }
      : pos === 2
        ? { left: '50%', top: 0, marginLeft: -w / 2 }
        : pos === 1
          ? { left: 0, top: '50%', marginTop: -h / 2 }
          : { right: 0, top: '50%', marginTop: -h / 2 };
  return (
    <div ref={ref} className={s.slot} style={{ width: w, height: h, ...place }}>
      {play && (
        <div
          className={s.played}
          style={{
            transform: `rotate(${jit(seat, 1)}deg) translate(${jit(seat, 2) * 0.6}px, ${jit(seat, 3) * 0.6}px)`,
          }}
        >
          <CardFace card={play.card} />
        </div>
      )}
    </div>
  );
}

export default function CallBreakTable({
  session,
  mySeat,
  players,
  hints,
  onLeave,
  onRematch,
}: TableProps) {
  const t = useT();
  const vp = useViewport();
  const settings = useSettings();
  const fly = useFly();
  const toast = useToast();
  const cw = handCardWidth(vp);
  const tw = vp.landscape ? Math.round(vp.h * 0.13) : Math.round(Math.min(64, vp.w * 0.16));
  const pos = (seat: number) => (seat - mySeat + 4) % 4;

  const [deal, setDeal] = useState<{ mine: Card[]; counts: number[] } | null>(null);
  const [trick, setTrickState] = useState<TrickPlay[]>([]);
  const trickRef = useRef<TrickPlay[]>([]);
  const setTrick = useCallback((v: TrickPlay[]) => {
    trickRef.current = v;
    setTrickState(v);
  }, []);
  const [landed, setLanded] = useState<ReadonlySet<number>>(new Set());
  const [flying, setFlying] = useState<ReadonlySet<number>>(new Set());
  const [sel, setSel] = useState<number | null>(null);
  const [bidSel, setBidSel] = useState<number | null>(null);
  const [lastOpen, setLastOpen] = useState(false);

  const run = useCallback(
    async ({ events, next }: RunArgs<CallBreakView>) => {
      const deals = events.filter((e) => e.type === 'deal');
      if (deals.length > 0) {
        setTrick([]);
        setDeal({ mine: [], counts: [0, 0, 0, 0] });
        sound.play('shuffle');
        await wait(dur(500));
        const mine = deals.find((e) => e.seat === mySeat)?.cards ?? [];
        const per = 13;
        const order: number[] = [];
        for (let i = 0, sx = nextSeat(next.dealer, 4, next.config.direction); i < 4; i++) {
          order.push(sx);
          sx = nextSeat(sx, 4, next.config.direction);
        }
        let last: Promise<void> = Promise.resolve();
        let n = 0;
        for (let k = 0; k < per; k++) {
          for (const seat of order) {
            const idx = n++;
            last = fly({
              front: <CardBack />,
              from: 'deck',
              to: `seat:${seat}`,
              duration: 240,
              rotate: [0, ((idx % 5) - 2) * 3],
            }).then(() =>
              setDeal((d) =>
                d
                  ? {
                      mine: seat === mySeat ? mine.slice(0, d.mine.length + 1) : d.mine,
                      counts: d.counts.map((c, i) => (i === seat ? c + 1 : c)),
                    }
                  : d,
              ),
            );
            if (idx % 2 === 0) sound.play('deal');
            await wait(dur(40));
          }
        }
        await last;
        await wait(dur(120));
      }
      for (const e of events) {
        if (e.type === 'move' && e.to?.kind === 'trick' && e.cards && e.seat !== undefined) {
          const card = e.cards[0];
          const seat = e.seat;
          const mineCard = seat === mySeat;
          sound.play('slide');
          setFlying((f) => new Set(f).add(card.id));
          await fly({
            front: <CardFace card={card} />,
            back: mineCard ? undefined : <CardBack />,
            flip: !mineCard,
            from: mineCard ? `card:${card.id}` : `seat:${seat}`,
            to: `trick:${seat}`,
            duration: 220,
            rotate: [0, jit(seat, 1)],
          });
          sound.play('place');
          setLanded((l) => new Set(l).add(card.id));
          setTrick([...trickRef.current, { seat, card }]);
          setFlying((f) => {
            const n = new Set(f);
            n.delete(card.id);
            return n;
          });
        } else if (e.type === 'trickWon' && e.seat !== undefined) {
          const winner = e.seat;
          await wait(dur(450));
          const cards = trickRef.current;
          setTrick([]);
          sound.play('slide');
          await Promise.all(
            cards.map((p) =>
              fly({
                front: <CardFace card={p.card} />,
                from: `trick:${p.seat}`,
                to: `seat:${winner}`,
                duration: 300,
              }),
            ),
          );
        } else if (e.type === 'bid') {
          sound.play('chip');
          await wait(dur(260));
        } else if (e.type === 'gameEnd') {
          sound.play('win');
        }
      }
      setDeal(null);
      setTrick(next.trick);
    },
    [fly, mySeat, setTrick],
  );

  const { shown, busy } = useAnimatedView<CallBreakView>(session, mySeat, run);

  // once the new view is on screen, the "landed" bookkeeping is no longer needed
  useLayoutEffect(() => {
    setLanded(new Set());
    setSel(null);
    setBidSel(null);
  }, [shown]);

  const turnKey = shown ? `${shown.phase}:${shown.turn}:${shown.round}` : '';
  const prevTurn = useRef('');
  useLayoutEffect(() => {
    if (!shown || prevTurn.current === turnKey) return;
    prevTurn.current = turnKey;
    if (shown.turn === mySeat && (shown.phase === 'bidding' || shown.phase === 'playing')) {
      haptic(10);
    }
  }, [turnKey, shown, mySeat, settings.haptics]);

  const view = shown;
  const myTurn = !!view && !busy && view.turn === mySeat;
  const hand = useMemo(() => {
    if (deal) return sortBySuit(deal.mine);
    if (!view) return [];
    const cards = view.hand.filter((c) => !landed.has(c.id) && !flying.has(c.id));
    return settings.autoSort ? sortBySuit(cards) : cards;
  }, [deal, view, landed, flying, settings.autoSort]);

  const rng = useMemo(() => createRng(1), []);
  const hintId = useMemo(() => {
    if (!hints || !view || !myTurn || view.phase !== 'playing') return null;
    const legal = session.legalActions(mySeat) as CallBreakAction[];
    const a = callBreak.bot(view, legal, 'medium', rng);
    return a.type === 'play' ? a.cardId : null;
  }, [hints, view, myTurn, session, mySeat, rng]);
  const bidHint =
    hints && view && myTurn && view.phase === 'bidding'
      ? estimateBid(view.hand, view.config.maxBid)
      : null;

  const submit = (a: CallBreakAction) => {
    try {
      session.submit(mySeat, a);
    } catch (e) {
      if (e instanceof IllegalActionError) {
        haptic(20);
        toast.show(t('cb.illegal'));
      } else throw e;
    }
  };

  const playable =
    view && myTurn && view.phase === 'playing' && settings.showPlayable
      ? new Set(view.legalIds)
      : null;

  const counts = (seat: number) => {
    if (deal) return deal.counts[seat];
    if (!view) return 0;
    const gone = trick.filter((p) => p.seat === seat && landed.has(p.card.id)).length;
    return Math.max(0, view.handCounts[seat] - gone);
  };

  const result = view?.phase === 'over' ? session.result() : null;
  const bestOf = (xs: number[]) => Math.max(...xs);
  const seatInfo = (seat: number) => {
    if (!view || view.bids[seat] === null) return undefined;
    return `${view.tricksWon[seat]}/${view.bids[seat]}`;
  };

  const seatNode = (seat: number, row = false) => (
    <Seat
      seat={seat}
      name={players[seat].name}
      avatar={players[seat].avatar}
      isBot={players[seat].isBot}
      value={view ? view.totals[seat] : 0}
      info={seatInfo(seat)}
      isTurn={
        !!view &&
        !busy &&
        (view.phase === 'bidding' || view.phase === 'playing') &&
        view.turn === seat
      }
      dealer={!!view && view.dealer === seat}
      you={seat === mySeat}
      row={row}
    >
      {seat !== mySeat && <BackStack count={counts(seat)} cardWidth={vp.landscape ? 22 : 28} />}
    </Seat>
  );

  const ledgerNode = view ? (
    <Ledger
      players={players}
      rounds={view.roundScores}
      totals={view.totals}
      highlight={result?.winners}
    />
  ) : null;

  const status = (() => {
    if (!view) return '';
    if (view.phase === 'bidding')
      return view.turn === mySeat
        ? t('cb.yourBid')
        : t('cb.waitBid', { name: players[view.turn].name });
    if (view.phase === 'playing')
      return view.turn === mySeat
        ? t('cb.yourTurn')
        : t('cb.waitPlay', { name: players[view.turn].name });
    return '';
  })();

  const lastRound =
    view && view.roundScores.length > 0 ? view.roundScores[view.roundScores.length - 1] : null;

  return (
    <TableShell
      session={session}
      onLeave={onLeave}
      ledger={ledgerNode}
      rules={<CallBreakRules />}
      overlay={
        <>
          {view?.phase === 'roundEnd' && !busy && lastRound && (
            <ResultPanel
              title={t('cb.roundDone', { n: view.roundScores.length })}
              subtitle={t('cb.roundOf', { n: view.roundScores.length, total: view.rounds })}
              actions={
                <Button tone="primary" onClick={() => submit({ type: 'next' })}>
                  {t('cb.nextRound')}
                </Button>
              }
            >
              <Ledger players={players} rounds={view.roundScores} totals={view.totals} />
            </ResultPanel>
          )}
          {result && !busy && view && (
            <ResultPanel
              big
              celebrate
              title={
                result.winners.length === 1
                  ? t('cb.wins', { name: players[result.winners[0]].name })
                  : t('cb.tie', { names: result.winners.map((w) => players[w].name).join(', ') })
              }
              subtitle={t('cb.finalScore', { score: bestOf(result.scores) })}
              note={t('app.chipsNote')}
              actions={
                <>
                  <Button tone="primary" onClick={onRematch}>
                    {t('common.rematch')}
                  </Button>
                  <Button onClick={onLeave}>{t('common.home')}</Button>
                </>
              }
            >
              <Ledger
                players={players}
                rounds={view.roundScores}
                totals={view.totals}
                highlight={result.winners}
              />
            </ResultPanel>
          )}
          <Dialog
            open={lastOpen}
            title={t('cb.lastTrick')}
            onClose={() => setLastOpen(false)}
            actions={
              <Button tone="primary" onClick={() => setLastOpen(false)}>
                {t('common.close')}
              </Button>
            }
          >
            {view?.lastTrick ? (
              <div className={s.review}>
                {view.lastTrick.map((p) => (
                  <figure key={p.seat} data-win={p.seat === view.lastWinner}>
                    <div style={{ width: 52 }}>
                      <CardFace card={p.card} />
                    </div>
                    <figcaption>{players[p.seat].name}</figcaption>
                  </figure>
                ))}
              </div>
            ) : (
              t('cb.noLastTrick')
            )}
          </Dialog>
        </>
      }
    >
      <div className={s.board} data-landscape={vp.landscape}>
        <div className={s.top}>{seatNode((mySeat + 2) % 4, vp.landscape)}</div>
        <div className={s.left}>{seatNode((mySeat + 1) % 4)}</div>
        <div className={s.right}>{seatNode((mySeat + 3) % 4)}</div>
        <div
          className={s.center}
          onClick={() => view?.lastTrick && trick.length === 0 && setLastOpen(true)}
          role="button"
          aria-label={t('cb.lastTrick')}
        >
          <div className={s.trickBox} style={{ width: tw * 3, height: (tw / 0.7159) * 1.75 }}>
            {[0, 1, 2, 3].map((seat) => (
              <Slot
                key={seat}
                seat={seat}
                pos={pos(seat)}
                w={tw}
                play={trick.find((p) => p.seat === seat)}
              />
            ))}
            {deal && (
              <div className={s.deck}>
                <DrawPile count={52 - deal.counts.reduce((a, b) => a + b, 0)} cardWidth={tw} />
              </div>
            )}
          </div>
          {view && view.phase === 'bidding' && myTurn && (
            <div className={s.bidder}>
              <div className={s.chips} role="radiogroup" aria-label={t('cb.yourBid')}>
                {view.legalBids.map((b) => (
                  <button
                    key={b}
                    type="button"
                    role="radio"
                    aria-checked={bidSel === b}
                    data-on={bidSel === b}
                    data-hint={bidHint === b}
                    className={`${s.chip} num`}
                    onClick={() => {
                      sound.play('tap');
                      setBidSel(b);
                    }}
                  >
                    {b}
                  </button>
                ))}
              </div>
              <Button
                tone="primary"
                disabled={bidSel === null}
                onClick={() => bidSel !== null && submit({ type: 'bid', bid: bidSel })}
              >
                {t('cb.placeBid')}
              </Button>
            </div>
          )}
        </div>
        <div className={s.bottom}>
          <div className={s.mine}>
            {seatNode(mySeat)}
            <div className={s.status} aria-live="polite">
              {view && (
                <span className={s.round}>
                  {t('cb.roundOf', { n: view.round + 1, total: view.rounds })}
                </span>
              )}
              <span className={s.say}>{status}</span>
            </div>
          </div>
          <div className={s.handWrap}>
            <Hand
              seat={mySeat}
              cards={hand}
              cardWidth={cw}
              selectedId={sel}
              onSelect={setSel}
              onPlay={(id) => submit({ type: 'play', cardId: id })}
              playableIds={playable}
              hintId={hintId}
              disabled={!myTurn || view?.phase !== 'playing'}
            />
          </div>
        </div>
      </div>
    </TableShell>
  );
}
