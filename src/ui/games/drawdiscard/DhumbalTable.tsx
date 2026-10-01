import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Card } from '../../../engine/core/cards';
import { createRng } from '../../../engine/core/rng';
import { IllegalActionError } from '../../../engine/core/types';
import { dhumbal } from '../../../engine/games/dhumbal';
import type { DAction, DView } from '../../../engine/games/dhumbal';
import { classifyThrow } from '../../../engine/games/dhumbal/rules';
import { useT } from '../../../i18n/t';
import { useSettings } from '../../../storage/settings';
import { useAnchor } from '../../anim/anchors';
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
import { DrawPile } from '../../table/Piles';
import { ResultPanel } from '../../table/ResultPanel';
import { Seat } from '../../table/Seat';
import { TableShell } from '../../table/TableShell';
import { sortByRank, sortBySuit } from '../../table/sortHand';
import type { TableProps } from '../types';
import { DhumbalRules } from './DhumbalRules';
import s from './DrawDiscard.module.css';

interface Ui {
  hand: Card[];
  counts: number[];
  stock: number;
}

function Row({
  cards,
  w,
  pickIds,
  onPick,
  anchor,
}: {
  cards: Card[];
  w: number;
  pickIds?: number[];
  onPick?: (id: number) => void;
  anchor: string;
}) {
  const ref = useAnchor(anchor);
  const overlap = cards.length > 4 ? w * 0.55 : w * 0.25;
  return (
    <div ref={ref} className={s.pile} style={{ minWidth: w, height: w / 0.7159 + 8 }}>
      {cards.map((c, i) => {
        const pick = pickIds?.includes(c.id);
        return (
          <button
            key={c.id}
            type="button"
            className={s.pileCard}
            data-pick={!!pick}
            data-dim={!!pickIds && pickIds.length > 0 && !pick}
            style={{ width: w, marginLeft: i === 0 ? 0 : -overlap }}
            disabled={!pick}
            onClick={() => onPick?.(c.id)}
            aria-label={pick ? 'Pick this card' : undefined}
          >
            <CardFace card={c} />
          </button>
        );
      })}
    </div>
  );
}

export default function DhumbalTable({
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
    ? Math.round(Math.min(58, vp.h * 0.14))
    : Math.round(Math.min(58, vp.w * 0.16));
  const blank = (): Ui => ({ hand: [], counts: Array(n).fill(0), stock: 52 });
  const [ui, setUi] = useState<Ui>(blank);
  const uiRef = useRef(ui);
  const patch = useCallback((fn: (u: Ui) => Ui) => {
    uiRef.current = fn(uiRef.current);
    setUi(uiRef.current);
  }, []);
  const [sel, setSel] = useState<ReadonlySet<number>>(new Set());
  const [flying, setFlying] = useState<ReadonlySet<number>>(new Set());
  const [callout, setCallout] = useState<string | null>(null);
  const nameOf = (i: number) => players[i]?.name ?? '';
  const say = useCallback((text: string) => {
    setCallout(text);
    setTimeout(() => setCallout((c) => (c === text ? null : c)), 1500);
  }, []);

  const run = useCallback(
    async ({ events, next }: RunArgs<DView>) => {
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
            await wait(dur(34));
          }
        await last;
        await wait(dur(120));
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
            to: 'pile',
            duration: 320,
          });
          patch((u) => ({ ...u, stock: u.stock - 1 }));
        } else if (e.type === 'throw' && e.cards && e.seat !== undefined) {
          const cards = e.cards as Card[];
          const seat = e.seat;
          const mine = seat === mySeat;
          sound.play('slide');
          setFlying((f) => new Set([...f, ...cards.map((c) => c.id)]));
          await Promise.all(
            cards.map((card, i) =>
              fly({
                front: <CardFace card={card} />,
                back: mine ? undefined : <CardBack />,
                flip: !mine,
                from: mine ? `card:${card.id}` : pos(seat),
                to: 'throw',
                duration: 240,
                delay: i * 40,
                rotate: [0, ((card.id % 5) - 2) * 2],
              }),
            ),
          );
          sound.play('place');
          patch((u) => ({
            ...u,
            hand: mine ? u.hand.filter((c) => !cards.some((x) => x.id === c.id)) : u.hand,
            counts: u.counts.map((c, j) => (j === seat ? Math.max(0, c - cards.length) : c)),
          }));
          setFlying((f) => {
            const nx = new Set(f);
            cards.forEach((c) => nx.delete(c.id));
            return nx;
          });
        } else if (e.type === 'pick' && e.seat !== undefined) {
          const seat = e.seat;
          const card = (e.cards?.[0] ?? null) as Card | null;
          const fromStock = (e.data as { from?: string } | undefined)?.from === 'stock';
          sound.play(fromStock ? 'deal' : 'slide');
          await fly({
            front: fromStock || !card ? <CardBack /> : <CardFace card={card} />,
            from: fromStock ? 'deck' : 'pile',
            to: pos(seat),
            duration: 230,
          });
          patch((u) => ({
            ...u,
            hand: seat === mySeat && card ? [...u.hand, card] : u.hand,
            counts: u.counts.map((c, j) => (j === seat ? c + 1 : c)),
            stock: fromStock ? Math.max(0, u.stock - 1) : u.stock,
          }));
        } else if (e.type === 'jhyap') {
          sound.play('chips');
          say(t('dh.say.jhyap', { name: nameOf(e.seat ?? 0) }));
          await wait(dur(800));
        } else if (e.type === 'reshuffle') sound.play('shuffle');
        else if (e.type === 'gameEnd') sound.play('win');
      }
      patch(() => ({ hand: next.hand, counts: next.handCounts, stock: next.stockCount }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fly, mySeat, n, patch, say],
  );

  const { shown: view, busy } = useAnimatedView<DView>(session, mySeat, run);
  useLayoutEffect(() => setSel(new Set()), [view]);

  const key = view ? `${view.phase}:${view.turn}:${view.round}` : '';
  const prev = useRef('');
  useLayoutEffect(() => {
    if (!view || prev.current === key) return;
    prev.current = key;
    if (view.turn === mySeat && view.phase === 'turn') haptic(10);
  }, [key, view, mySeat]);

  const myTurn = !!view && !busy && view.turn === mySeat && !handHidden;
  const hand = useMemo(() => {
    const cards = ui.hand.filter((c) => !flying.has(c.id));
    return settings.autoSort ? sortBySuit(cards) : cards;
  }, [ui.hand, flying, settings.autoSort]);

  const submit = (a: DAction) => {
    try {
      session.submit(mySeat, a);
    } catch (e) {
      if (e instanceof IllegalActionError) {
        haptic(20);
        toast.show(t('dh.illegal'));
      } else throw e;
    }
  };

  const toggle = (id: number) =>
    setSel((cur) => {
      const nx = new Set(cur);
      if (nx.has(id)) nx.delete(id);
      else nx.add(id);
      return nx;
    });
  const chosen = hand.filter((c) => sel.has(c.id));
  const cls = view && chosen.length > 0 ? classifyThrow(chosen, view.config) : null;

  const rng = useMemo(() => createRng(1), []);
  const hintIds = useMemo(() => {
    if (!hints || handHidden || !view || !myTurn || view.phase !== 'turn') return null;
    const legal = session.legalActions(mySeat) as DAction[];
    const a = dhumbal.bot(view, legal, 'medium', rng);
    return a.type === 'throw' ? new Set(a.cardIds) : null;
  }, [hints, handHidden, view, myTurn, session, mySeat, rng]);
  const hintId = hintIds ? [...hintIds][0] : null;
  const result = view?.phase === 'over' ? session.result() : null;

  const seatRow = (seat: number) => {
    const tm =
      view && !busy && view.turn === seat && (view.phase === 'turn' || view.phase === 'pick')
        ? session.getTimer(seat)
        : null;
    return (
      <Seat
        key={seat}
        seat={seat}
        name={nameOf(seat)}
        avatar={players[seat].avatar}
        isBot={players[seat].isBot}
        value={view ? view.scores[seat] : 0}
        info={view?.eliminated[seat] ? t('dh.out') : undefined}
        isTurn={
          !!view &&
          !busy &&
          view.turn === seat &&
          (view.phase === 'turn' || view.phase === 'pick' || view.phase === 'bonus')
        }
        timerMs={tm?.remainingMs}
        timerTotalMs={tm?.totalMs}
        dealer={!!view && view.dealer === seat}
        auto={session.isAuto(seat)}
        conn={online ? session.getConn?.(seat) : undefined}
        you={seat === mySeat}
        row={vp.landscape}
      >
        {seat !== mySeat && !view?.eliminated[seat] && (
          <span className={`${s.count} num`}>{ui.counts[seat]}</span>
        )}
      </Seat>
    );
  };
  const others = Array.from({ length: n - 1 }, (_, i) => (mySeat + i + 1) % n);

  const status = (() => {
    if (!view || view.phase === 'roundEnd' || view.phase === 'over') return '';
    if (view.turn !== mySeat) return t('rangi.waitPlay', { name: nameOf(view.turn) });
    if (view.phase === 'turn') return t('dh.yourThrow');
    if (view.phase === 'pick') return t('dh.yourPick');
    return t('dh.bonus');
  })();

  const reveal = view?.reveal;
  const revealPanel = reveal && (
    <div className={s.reveal}>
      {reveal.hands.map((h, i) =>
        view!.eliminated[i] && h.length === 0 ? null : (
          <div key={i} className={s.revealRow} data-caller={i === reveal.caller}>
            <span className={s.who}>
              {nameOf(i)}
              {i === reveal.caller ? ` — ${t('dh.caller')}` : ''}
            </span>
            <span
              className={`${s.pts} num`}
              data-zero={reveal.added[i] === 0}
              data-bad={reveal.added[i] > reveal.totals[i]}
            >
              {reveal.totals[i]} {'→'} {reveal.added[i] > 0 ? `+${reveal.added[i]}` : '0'}
            </span>
            <div className={s.revealCards}>
              {sortByRank(h).map((c) => (
                <div key={c.id} style={{ width: 28 }}>
                  <CardFace card={c} />
                </div>
              ))}
            </div>
          </div>
        ),
      )}
    </div>
  );

  return (
    <TableShell
      session={session}
      onLeave={onLeave}
      ledger={
        view ? (
          <Ledger
            players={players}
            rounds={view.roundScores}
            totals={view.scores}
            highlight={result?.winners}
          />
        ) : null
      }
      rules={<DhumbalRules />}
      overlay={
        <>
          {view?.phase === 'roundEnd' && !busy && reveal && (
            <ResultPanel
              title={
                reveal.counter
                  ? t('dh.counter')
                  : t('dh.callerWins', { name: nameOf(reveal.caller) })
              }
              subtitle={t('cb.roundOf', {
                n: view.round + 1,
                total: view.config.fixedRounds || '∞',
              })}
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
              {revealPanel}
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
              subtitle={t('dh.lowest', {
                n: Math.min(...result.winners.map((w) => result.scores[w])),
              })}
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
              {revealPanel}
              <Ledger
                players={players}
                rounds={view.roundScores}
                totals={view.scores}
                highlight={result.winners}
              />
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
              <button
                type="button"
                className={s.stockBtn}
                disabled={!view?.canPickStock || busy || !myTurn}
                onClick={() => submit({ type: 'pick', from: 'stock' })}
                aria-label={t('dh.pickStock')}
              >
                <DrawPile count={ui.stock} cardWidth={pw} />
                {view?.canPickStock && myTurn && <span className={s.tag}>{t('dh.pickStock')}</span>}
              </button>
            </div>
            <div>
              <div className={s.pileLabel}>
                {view?.phase === 'pick' && view.turn === mySeat
                  ? t('dh.pickFrom')
                  : t('dh.lastThrow')}
              </div>
              <Row
                cards={view?.pickable?.cards ?? []}
                w={pw}
                pickIds={myTurn && view?.phase === 'pick' ? view.pickable?.pickIds : undefined}
                onPick={(id) => submit({ type: 'pick', from: 'discard', cardId: id })}
                anchor="pile"
              />
            </div>
          </div>
          {view?.thrown && view.thrown.length > 0 && (
            <div>
              <div className={s.pileLabel}>{t('dh.thisThrow')}</div>
              <Row cards={view.thrown} w={Math.round(pw * 0.85)} anchor="throw" />
            </div>
          )}
          {!(view?.thrown && view.thrown.length > 0) && (
            <Row cards={[]} w={Math.round(pw * 0.85)} anchor="throw" />
          )}
          {callout && <div className={s.callout}>{callout}</div>}
        </div>

        <div className={s.bottom}>
          <div className={s.mine}>
            {seatRow(mySeat)}
            <div className={s.status} aria-live="polite">
              {view && (
                <span className={s.round}>
                  {t('cb.roundOf', { n: view.round + 1, total: view.config.fixedRounds || '∞' })}
                </span>
              )}
              <span className={s.say}>{status}</span>
              {view && !handHidden && view.phase !== 'roundEnd' && view.phase !== 'over' && (
                <span className={s.total}>
                  {t('dh.total')} <b className="num">{view.total}</b> / {view.config.jhyapLimit}
                </span>
              )}
              {session.isAuto(mySeat) && (
                <Button size="small" tone="primary" onClick={() => session.setAuto(mySeat, false)}>
                  {t('cb.imBack')}
                </Button>
              )}
            </div>
            <div className={s.actions}>
              {myTurn && view?.phase === 'turn' && (
                <>
                  <Button
                    tone="primary"
                    disabled={!cls}
                    onClick={() => submit({ type: 'throw', cardIds: chosen.map((c) => c.id) })}
                  >
                    {t('dh.throw')}
                  </Button>
                  {view.canJhyap && (
                    <Button onClick={() => submit({ type: 'jhyap' })}>{t('dh.jhyap')}</Button>
                  )}
                </>
              )}
              {myTurn && view?.canBonus && (
                <>
                  <Button tone="primary" onClick={() => submit({ type: 'bonus', throw: true })}>
                    {t('dh.throwIt')}
                  </Button>
                  <Button onClick={() => submit({ type: 'bonus', throw: false })}>
                    {t('dh.keepIt')}
                  </Button>
                </>
              )}
            </div>
          </div>
          {myTurn && view?.phase === 'turn' && view.jhyapBlocked === 'first' && (
            <p className={s.muted} style={{ margin: '0 8px' }}>
              {t('dh.noFirstHint')}
            </p>
          )}
          <div className={s.handWrap}>
            <Hand
              seat={mySeat}
              cards={hand}
              cardWidth={cw}
              selectedIds={sel}
              onToggle={toggle}
              hintId={hintId}
              faceDown={handHidden}
              disabled={!myTurn || view?.phase !== 'turn'}
            />
          </div>
        </div>
      </div>
    </TableShell>
  );
}
