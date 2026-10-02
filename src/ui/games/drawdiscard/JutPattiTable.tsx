import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Card } from '../../../engine/core/cards';
import { createRng } from '../../../engine/core/rng';
import { IllegalActionError } from '../../../engine/core/types';
import { jutPatti } from '../../../engine/games/jutpatti';
import type { JPAction, JPView } from '../../../engine/games/jutpatti';
import { rankLabel, type Rank } from '../../../engine/core/cards';
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
import { Ledger } from '../../table/Ledger';
import { DiscardPile, DrawPile } from '../../table/Piles';
import { ResultPanel } from '../../table/ResultPanel';
import { Seat } from '../../table/Seat';
import { TableShell } from '../../table/TableShell';
import { sortBySuit } from '../../table/sortHand';
import type { TableProps } from '../types';
import { JutPattiRules } from './JutPattiRules';
import s from './DrawDiscard.module.css';

interface Ui {
  hand: Card[];
  counts: number[];
  tail: Card[];
  stock: number;
}

export default function JutPattiTable({
  session,
  mySeat,
  players,
  hints,
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
  const cw = handCardWidth(vp);
  const pw = vp.landscape
    ? Math.round(Math.min(70, vp.h * 0.17))
    : Math.round(Math.min(68, vp.w * 0.19));
  const blank = (): Ui => ({ hand: [], counts: Array(n).fill(0), tail: [], stock: 52 });
  const [ui, setUi] = useState<Ui>(blank);
  const uiRef = useRef(ui);
  const patch = useCallback((fn: (u: Ui) => Ui) => {
    uiRef.current = fn(uiRef.current);
    setUi(uiRef.current);
  }, []);
  const [sel, setSel] = useState<number | null>(null);
  const [flying, setFlying] = useState<ReadonlySet<number>>(new Set());
  const [callout, setCallout] = useState<string | null>(null);
  const nameOf = (i: number) => players[i]?.name ?? '';

  const say = useCallback((text: string) => {
    setCallout(text);
    setTimeout(() => setCallout((c) => (c === text ? null : c)), 1500);
  }, []);

  const run = useCallback(
    async ({ events, next }: RunArgs<JPView>) => {
      const pos = (seat: number) => `seat:${seat}`;
      const deals = events.filter((e) => e.type === 'deal');
      if (events.some((e) => e.type === 'roundStart')) patch(blank);
      if (deals.length > 0) {
        sound.play('shuffle');
        await wait(dur(450));
        const per = Math.max(...deals.map((d) => d.cards?.length ?? d.count ?? 0));
        const mine = ((deals.find((d) => d.seat === mySeat)?.cards ?? []) as Card[]).slice();
        let last: Promise<void> = Promise.resolve();
        let k = 0;
        for (let i = 0; i < per; i++)
          for (const d of deals) {
            const seat = d.seat as number;
            const idx = k++;
            last = fly({
              front: <CardBack />,
              from: 'deck',
              to: pos(seat),
              duration: 220,
              rotate: [0, ((idx % 5) - 2) * 3],
            }).then(() =>
              patch((u) => ({
                ...u,
                hand: seat === mySeat ? mine.slice(0, u.hand.length + 1) : u.hand,
                counts: u.counts.map((c, j) => (j === seat ? c + 1 : c)),
                stock: u.stock - 1,
              })),
            );
            if (idx % 2 === 0) sound.play('deal');
            await wait(dur(36));
          }
        await last;
        await wait(dur(120));
      }
      for (const e of events) {
        if (e.type === 'draw' && e.seat !== undefined) {
          const seat = e.seat;
          const card = (e.cards?.[0] ?? null) as Card | null;
          sound.play('deal');
          await fly({ front: <CardBack />, from: 'deck', to: pos(seat), duration: 230 });
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
          if (e.to?.kind === 'hand') {
            // taking the top of the discard
            sound.play('slide');
            await fly({
              front: <CardFace card={card} />,
              from: 'discard',
              to: mine ? 'hand:' + mySeat : pos(seat),
              duration: 230,
            });
            patch((u) => ({
              ...u,
              tail: u.tail.filter((c) => c.id !== card.id),
              hand: mine ? [...u.hand, card] : u.hand,
              counts: u.counts.map((c, j) => (j === seat ? c + 1 : c)),
            }));
          } else {
            sound.play('slide');
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
        } else if (e.type === 'declare') {
          sound.play('chips');
          say(t('jp.say.declare', { name: nameOf(e.seat ?? 0) }));
          await wait(dur(700));
        } else if (e.type === 'reshuffle') sound.play('shuffle');
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

  const { shown: view, busy } = useAnimatedView<JPView>(session, mySeat, run);
  useLayoutEffect(() => setSel(null), [view]);

  const key = view ? `${view.phase}:${view.turn}:${view.round}` : '';
  const prev = useRef('');
  useLayoutEffect(() => {
    if (!view || prev.current === key) return;
    prev.current = key;
    if (view.turn === mySeat && view.phase !== 'roundEnd') haptic(10);
  }, [key, view, mySeat]);

  const myTurn = !!view && !busy && view.turn === mySeat && !handHidden;
  const hand = useMemo(() => {
    const cards = ui.hand.filter((c) => !flying.has(c.id));
    return settings.autoSort ? sortBySuit(cards) : cards;
  }, [ui.hand, flying, settings.autoSort]);

  const submit = (a: JPAction) => {
    try {
      session.submit(mySeat, a);
    } catch (e) {
      if (e instanceof IllegalActionError) {
        haptic(20);
        toast.show(t('jp.illegal'));
      } else throw e;
    }
  };

  const rng = useMemo(() => createRng(1), []);
  const hintId = useMemo(() => {
    if (!hints || handHidden || !view || !myTurn || view.phase !== 'discard') return null;
    const legal = session.legalActions(mySeat) as JPAction[];
    const a = jutPatti.bot(view, legal, 'medium', rng);
    return a.type === 'discard' ? a.cardId : null;
  }, [hints, handHidden, view, myTurn, session, mySeat, rng]);

  const jokers = useMemo(
    () => new Set(hand.filter((c) => view && c.rank === view.jokerRank).map((c) => c.id)),
    [hand, view],
  );
  const result = view?.phase === 'over' ? session.result() : null;

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
        value={view ? view.wins[seat] : 0}
        info={view && view.config.stake > 0 ? String(view.chips[seat]) : undefined}
        isTurn={
          !!view &&
          !busy &&
          view.turn === seat &&
          view.phase !== 'roundEnd' &&
          view.phase !== 'over'
        }
        timerMs={tm?.remainingMs}
        timerTotalMs={tm?.totalMs}
        dealer={!!view && view.dealer === seat}
        auto={session.isAuto(seat)}
        conn={online ? session.getConn?.(seat) : undefined}
        you={seat === mySeat}
        row={vp.landscape}
      >
        {seat !== mySeat && <span className={`${s.count} num`}>{ui.counts[seat]}</span>}
      </Seat>
    );
  };
  const others = Array.from({ length: n - 1 }, (_, i) => (mySeat + i + 1) % n);

  const status = (() => {
    if (!view || view.phase === 'roundEnd' || view.phase === 'over') return '';
    if (view.turn !== mySeat) return t('rangi.waitPlay', { name: nameOf(view.turn) });
    if (view.phase === 'draw') return t('jp.draw');
    return view.canDeclare ? t('jp.declareHint') : t('jp.discardOne');
  })();
  const jokerText = view ? rankLabel(view.jokerRank as Rank) : '';

  return (
    <TableShell
      session={session}
      onLeave={onLeave}
      ledger={
        view ? (
          <Ledger players={players} rounds={[]} totals={view.wins} highlight={result?.winners} />
        ) : null
      }
      rules={<JutPattiRules />}
      overlay={
        <>
          {view?.phase === 'roundEnd' && !busy && (
            <ResultPanel
              title={t('jp.roundWon', { name: nameOf(view.lastWinner ?? 0) })}
              subtitle={t('jp.matchTo', { n: view.config.target })}
              actions={
                view.canNext ? (
                  <Button tone="primary" onClick={() => submit({ type: 'next' })}>
                    {t('rangi.nextRound')}
                  </Button>
                ) : (
                  <span className={s.muted}>{t('lb.waitNext')}</span>
                )
              }
            >
              <Ledger
                players={players}
                rounds={[]}
                totals={view.wins}
                highlight={view.lastWinner !== null ? [view.lastWinner] : []}
              />
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
              subtitle={t('jp.finalWins', { n: Math.max(...result.scores) })}
              note={t('app.chipsNote')}
              actions={
                <>
                  {canRematch ? (
                    <Button tone="primary" onClick={onRematch}>
                      {t('common.rematch')}
                    </Button>
                  ) : (
                    <span className={s.muted}>{t('room.waitRematch')}</span>
                  )}
                  <Button onClick={onLeave}>{t('common.home')}</Button>
                </>
              }
            >
              <Ledger players={players} rounds={[]} totals={view.wins} highlight={result.winners} />
            </ResultPanel>
          )}
        </>
      }
    >
      <div className={s.board} data-landscape={vp.landscape}>
        <div className={s.others}>{others.map(seatRow)}</div>

        <div className={s.center}>
          <div className={s.piles}>
            <div className={s.stockWrap}>
              {view && (
                <div className={s.indicator} style={{ width: pw }} aria-label={t('jp.indicator')}>
                  <CardFace card={view.indicator} />
                </div>
              )}
              <button
                type="button"
                className={s.stockBtn}
                disabled={!view?.canDrawStock || busy}
                onClick={() => submit({ type: 'draw', from: 'stock' })}
                aria-label={t('jp.drawStock')}
              >
                <DrawPile count={ui.stock} cardWidth={pw} />
                {view?.canDrawStock && !busy && <span className={s.tag}>{t('jp.drawStock')}</span>}
              </button>
            </div>
            <div className={s.stockWrap}>
              <button
                type="button"
                className={s.stockBtn}
                disabled={!view?.canDrawDiscard || busy}
                onClick={() => submit({ type: 'draw', from: 'discard' })}
                aria-label={t('jp.takeDiscard')}
              >
                <DiscardPile cards={ui.tail} cardWidth={pw} />
                {view?.canDrawDiscard && !busy && (
                  <span className={s.tag}>{t('jp.takeDiscard')}</span>
                )}
              </button>
            </div>
          </div>
          {view && <p className={s.jokerNote}>{t('jp.jokerNote', { rank: jokerText })}</p>}
          {callout && <div className={s.callout}>{callout}</div>}
        </div>

        <div className={s.bottom}>
          <div className={s.mine}>
            {seatRow(mySeat)}
            <div className={s.status} aria-live="polite">
              {view && <span className={s.round}>{t('jp.round', { n: view.round + 1 })}</span>}
              <span className={s.say}>{status}</span>
              {session.isAuto(mySeat) && (
                <Button size="small" tone="primary" onClick={() => session.setAuto(mySeat, false)}>
                  {t('cb.imBack')}
                </Button>
              )}
            </div>
            <div className={s.actions}>
              {view?.canDeclare && !busy && !handHidden && (
                <Button tone="primary" onClick={() => submit({ type: 'declare' })}>
                  {t('jp.declare')}
                </Button>
              )}
              {myTurn && view?.phase === 'discard' && sel !== null && (
                <Button onClick={() => submit({ type: 'discard', cardId: sel })}>
                  {t('jp.discard')}
                </Button>
              )}
            </div>
          </div>
          <div className={s.handWrap}>
            <Hand
              seat={mySeat}
              cards={hand}
              cardWidth={cw}
              selectedId={sel}
              onSelect={setSel}
              onPlay={(id) => submit({ type: 'discard', cardId: id })}
              hintId={hintId}
              marked={jokers}
              faceDown={handHidden}
              disabled={!myTurn || view?.phase !== 'discard'}
            />
          </div>
        </div>
      </div>
    </TableShell>
  );
}
