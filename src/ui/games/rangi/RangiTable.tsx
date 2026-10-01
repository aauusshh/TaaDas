import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createRng } from '../../../engine/core/rng';
import { IllegalActionError } from '../../../engine/core/types';
import { rangi } from '../../../engine/games/rangi';
import type { RangiAction, RangiView } from '../../../engine/games/rangi';
import { COLORS, type RCard, type RColor } from '../../../engine/games/rangi/rules';
import { useT } from '../../../i18n/t';
import { useSettings } from '../../../storage/settings';
import { RangiBack, RangiCard, RangiSymbol, RANGI_HEX } from '../../cards/RangiCard';
import { useAnchor } from '../../anim/anchors';
import { useFly } from '../../anim/FlightLayer';
import { dur, wait } from '../../anim/queue';
import { useAnimatedView, type RunArgs } from '../../anim/useAnimatedView';
import { handCardWidth, useViewport } from '../../anim/useViewport';
import { haptic } from '../../haptics';
import { sound } from '../../sound/SoundManager';
import { Button } from '../../components/Button';
import { Dialog, useToast } from '../../components/Overlays';
import { Hand } from '../../table/Hand';
import { Ledger } from '../../table/Ledger';
import { ResultPanel } from '../../table/ResultPanel';
import { Seat } from '../../table/Seat';
import { TableShell } from '../../table/TableShell';
import type { TableProps } from '../types';
import { RangiRules } from './RangiRules';
import s from './RangiTable.module.css';

const COLOR_ORDER: Record<string, number> = { sindoor: 0, marigold: 1, sky: 2, leaf: 3, wild: 4 };
const valueRank = (v: RCard['value']) =>
  typeof v === 'number' ? v : 10 + ['skip', 'reverse', 'draw2', 'wild', 'wild4'].indexOf(v);
const sortHand = (cards: RCard[]) =>
  cards
    .slice()
    .sort(
      (a, b) =>
        COLOR_ORDER[a.color] - COLOR_ORDER[b.color] || valueRank(a.value) - valueRank(b.value),
    );

interface Ui {
  hand: RCard[];
  counts: number[];
  tail: RCard[];
  drawCount: number;
}
const blank = (n: number): Ui => ({ hand: [], counts: Array(n).fill(0), tail: [], drawCount: 108 });

function ColorChip({ color, size = 28 }: { color: RColor; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-label={color} role="img">
      <circle cx="14" cy="14" r="13" fill={RANGI_HEX[color]} stroke="#fbf8f1" strokeWidth="1.5" />
      <RangiSymbol color={color} x={14} y={14} s={14} fill="#fbf8f1" />
    </svg>
  );
}

function CardView({ card }: { card: RCard }) {
  return <RangiCard color={card.color === 'wild' ? undefined : card.color} value={card.value} />;
}

export default function RangiTable({
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
    ? Math.round(Math.min(78, vp.h * 0.19))
    : Math.round(Math.min(74, vp.w * 0.2));
  const deckRef = useAnchor('deck');
  const discardRef = useAnchor('discard');

  const [ui, setUi] = useState<Ui>(() => blank(n));
  const uiRef = useRef(ui);
  const patch = useCallback((fn: (u: Ui) => Ui) => {
    uiRef.current = fn(uiRef.current);
    setUi(uiRef.current);
  }, []);
  const [flying, setFlying] = useState<ReadonlySet<number>>(new Set());
  const [sel, setSel] = useState<number | null>(null);
  const [picker, setPicker] = useState<{
    cardId: number;
    stage: 'color' | 'swap';
    color?: RColor;
  } | null>(null);
  const [callout, setCallout] = useState<{ key: number; text: string; color?: RColor } | null>(
    null,
  );
  const [rulesTick, setRulesTick] = useState(0);
  void rulesTick;

  const say = useCallback((text: string, color?: RColor) => {
    const key = Date.now() + Math.random();
    setCallout({ key, text, color });
    setTimeout(() => setCallout((c) => (c && c.key === key ? null : c)), 1400);
  }, []);

  const nameOf = (seat: number) => players[seat]?.name ?? '';

  const run = useCallback(
    async ({ events, next }: RunArgs<RangiView>) => {
      const pos = (seat: number) => `seat:${seat}`;
      const deals = events.filter((e) => e.type === 'deal');
      if (events.some((e) => e.type === 'roundStart')) patch(() => blank(n));
      if (deals.length > 0) {
        sound.play('shuffle');
        await wait(dur(450));
        const order = deals.map((d) => d.seat as number);
        const per = Math.max(...deals.map((d) => d.cards?.length ?? d.count ?? 0));
        let last: Promise<void> = Promise.resolve();
        let k = 0;
        const myCards = ((deals.find((d) => d.seat === mySeat)?.cards ?? []) as RCard[]).slice();
        for (let i = 0; i < per; i++)
          for (const seat of order) {
            const idx = k++;
            last = fly({
              front: <RangiBack />,
              from: 'deck',
              to: pos(seat),
              duration: 220,
              rotate: [0, ((idx % 5) - 2) * 3],
            }).then(() =>
              patch((u) => ({
                ...u,
                hand: seat === mySeat ? myCards.slice(0, u.hand.length + 1) : u.hand,
                counts: u.counts.map((c, j) => (j === seat ? c + 1 : c)),
                drawCount: u.drawCount - 1,
              })),
            );
            if (idx % 2 === 0) sound.play('deal');
            await wait(dur(38));
          }
        await last;
        await wait(dur(120));
      }
      for (const e of events) {
        if (e.type === 'flip' && e.cards) {
          const card = e.cards[0] as RCard;
          sound.play('flip');
          await fly({
            front: <CardView card={card} />,
            back: <RangiBack />,
            flip: true,
            from: 'deck',
            to: 'discard',
            duration: 320,
          });
          patch((u) => ({ ...u, tail: [...u.tail, card].slice(-3), drawCount: u.drawCount - 1 }));
        } else if (e.type === 'play' && e.cards && e.seat !== undefined) {
          const card = e.cards[0] as RCard;
          const seat = e.seat;
          const mine = seat === mySeat;
          sound.play('slide');
          setFlying((f) => new Set(f).add(card.id));
          await fly({
            front: <CardView card={card} />,
            back: mine ? undefined : <RangiBack />,
            flip: !mine,
            from: mine ? `card:${card.id}` : pos(seat),
            to: 'discard',
            duration: 240,
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
          const data = e.data as { color?: RColor } | undefined;
          if (card.value === 'skip') say(t('rangi.say.skip'));
          else if (card.value === 'reverse') say(t('rangi.say.reverse'));
          else if (card.value === 'draw2') say('+2');
          else if (card.value === 'wild4') say('+4', data?.color);
          else if (card.value === 'wild') say(t('rangi.say.color'), data?.color);
        } else if (e.type === 'draw' && e.seat !== undefined) {
          const seat = e.seat;
          const cards = (e.cards ?? []) as RCard[];
          const count = cards.length || e.count || 0;
          for (let i = 0; i < count; i++) {
            const card = cards[i];
            sound.play('deal');
            await fly({
              front: <RangiBack />,
              from: 'deck',
              to: pos(seat),
              duration: 220,
              rotate: [0, (i % 3) * 3 - 3],
            });
            patch((u) => ({
              ...u,
              hand: seat === mySeat && card ? [...u.hand, card] : u.hand,
              counts: u.counts.map((c, j) => (j === seat ? c + 1 : c)),
              drawCount: Math.max(0, u.drawCount - 1),
            }));
            await wait(dur(50));
          }
        } else if (e.type === 'ek') {
          sound.play('chip');
          say(t('rangi.say.ek', { name: nameOf(e.seat ?? 0) }));
          await wait(dur(500));
        } else if (e.type === 'caught') {
          sound.play('chips');
          say(t('rangi.say.caught', { name: nameOf(e.seat ?? 0) }));
          await wait(dur(500));
        } else if (e.type === 'challenge') {
          const d = e.data as { legal: boolean } | undefined;
          say(d?.legal ? t('rangi.say.challengeFail') : t('rangi.say.challengeWin'));
          await wait(dur(600));
        } else if (e.type === 'jumpIn') {
          say(t('rangi.say.jumpIn', { name: nameOf(e.seat ?? 0) }));
        } else if (e.type === 'reshuffle') {
          sound.play('shuffle');
        } else if (e.type === 'swap' || e.type === 'rotateHands') {
          sound.play('slide');
          say(e.type === 'swap' ? t('rangi.say.swap') : t('rangi.say.rotate'));
          await wait(dur(500));
        } else if (e.type === 'gameEnd') {
          sound.play('win');
        }
      }
      patch(() => ({
        hand: next.hand,
        counts: next.handCounts,
        tail: next.tail,
        drawCount: next.drawCount,
      }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fly, mySeat, n, patch, say],
  );

  const { shown: view, busy } = useAnimatedView<RangiView>(session, mySeat, run);

  useLayoutEffect(() => {
    setSel(null);
    setPicker(null);
  }, [view]);

  const turnKey = view ? `${view.phase}:${view.turn}:${view.round}` : '';
  const prevTurn = useRef('');
  useLayoutEffect(() => {
    if (!view || prevTurn.current === turnKey) return;
    prevTurn.current = turnKey;
    if (view.turn === mySeat && view.phase === 'play') haptic(10);
  }, [turnKey, view, mySeat]);

  const myTurn = !!view && !busy && view.turn === mySeat && view.phase === 'play';
  const hand = useMemo(() => {
    const cards = ui.hand.filter((c) => !flying.has(c.id));
    return settings.autoSort ? sortHand(cards) : cards;
  }, [ui.hand, flying, settings.autoSort]);

  const submit = (a: RangiAction) => {
    try {
      session.submit(mySeat, a);
    } catch (e) {
      if (e instanceof IllegalActionError) {
        haptic(20);
        toast.show(t('rangi.illegal'));
      } else throw e;
    }
  };

  const rng = useMemo(() => createRng(1), []);
  const hintId = useMemo(() => {
    if (!hints || handHidden || !view || busy) return null;
    const legal = session.legalActions(mySeat) as RangiAction[];
    if (legal.length === 0) return null;
    const a = rangi.bot(view, legal, 'medium', rng);
    return a.type === 'play' ? a.cardId : null;
  }, [hints, handHidden, view, busy, session, mySeat, rng]);

  const playableIds = useMemo(() => {
    if (!view || busy || handHidden || !settings.showPlayable) return null;
    if (view.phase !== 'play') return null;
    if (view.plays.length === 0 && !myTurn) return null;
    return new Set(view.plays.map((p) => p.cardId));
  }, [view, busy, handHidden, settings.showPlayable, myTurn]);

  const tryPlay = (id: number) => {
    if (!view || busy) return;
    const opt = view.plays.find((p) => p.cardId === id);
    if (!opt) return;
    if (opt.needsColor) setPicker({ cardId: id, stage: 'color' });
    else if (opt.swapTargets.length > 0) setPicker({ cardId: id, stage: 'swap' });
    else submit({ type: 'play', cardId: id });
  };

  const chooseColor = (color: RColor) => {
    if (!picker) return;
    if (view?.mustChooseColor && picker.cardId < 0) return submit({ type: 'color', color });
    const opt = view?.plays.find((p) => p.cardId === picker.cardId);
    if (opt && opt.swapTargets.length > 0) setPicker({ ...picker, stage: 'swap', color });
    else submit({ type: 'play', cardId: picker.cardId, color });
  };

  const result = view?.phase === 'over' ? session.result() : null;
  const seatRow = (seat: number) => {
    const tm =
      view && !busy && view.turn === seat && view.phase === 'play' ? session.getTimer(seat) : null;
    return (
      <Seat
        key={seat}
        seat={seat}
        name={nameOf(seat)}
        avatar={players[seat].avatar}
        isBot={players[seat].isBot}
        value={view ? view.totals[seat] : 0}
        info={ui.counts[seat] === 1 && view?.config.callEk ? 'Ek' : undefined}
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
        {seat !== mySeat && (
          <span
            className={`${s.count} num`}
            aria-label={t('rangi.cardsLeft', { n: ui.counts[seat] })}
          >
            {ui.counts[seat]}
          </span>
        )}
      </Seat>
    );
  };

  const others = Array.from({ length: n - 1 }, (_, i) => (mySeat + i + 1) % n);
  const dirArrow = view?.dir === -1;
  const status = (() => {
    if (!view) return '';
    if (view.phase === 'color')
      return view.turn === mySeat
        ? t('rangi.pickColor')
        : t('rangi.waitColor', { name: nameOf(view.turn) });
    if (view.phase === 'challenge' && view.challenge)
      return view.challenge.target === mySeat
        ? t('rangi.challengeYou', { name: nameOf(view.challenge.offender) })
        : t('rangi.waitChallenge', { name: nameOf(view.challenge.target) });
    if (view.phase !== 'play') return '';
    if (view.turn === mySeat) {
      if (view.drawnId !== null) return t('rangi.playOrKeep');
      if (view.pending > 0) return t('rangi.stackOrTake', { n: view.pending });
      return t('rangi.yourTurn');
    }
    return t('rangi.waitPlay', { name: nameOf(view.turn) });
  })();
  const jumpAvailable =
    !!view && view.turn !== mySeat && view.plays.length > 0 && view.phase === 'play';

  return (
    <TableShell
      session={session}
      onLeave={onLeave}
      ledger={
        view ? (
          <Ledger
            players={players}
            rounds={view.roundScores}
            totals={view.totals}
            highlight={result?.winners}
          />
        ) : null
      }
      rules={<RangiRules />}
      overlay={
        <>
          {view?.phase === 'roundEnd' && !busy && (
            <ResultPanel
              title={t('rangi.roundWon', { name: nameOf(view.lastWinner ?? 0) })}
              subtitle={t('rangi.roundPoints', {
                n: view.roundScores[view.roundScores.length - 1]?.[view.lastWinner ?? 0] ?? 0,
              })}
              actions={
                <Button tone="primary" onClick={() => submit({ type: 'next' })}>
                  {t('rangi.nextRound')}
                </Button>
              }
            >
              <Ledger players={players} rounds={view.roundScores} totals={view.totals} />
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
              subtitle={
                view.config.target === 0
                  ? undefined
                  : t('cb.finalScore', { score: Math.max(...result.scores) })
              }
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
              <Ledger
                players={players}
                rounds={view.roundScores}
                totals={view.totals}
                highlight={result.winners}
              />
            </ResultPanel>
          )}
          <Dialog
            open={!!view && view.canChallenge && !busy}
            title={t('rangi.challengeTitle')}
            actions={
              <>
                <Button onClick={() => submit({ type: 'accept' })}>
                  {view?.config.stacking ? t('rangi.accept') : t('rangi.take4')}
                </Button>
                <Button tone="primary" onClick={() => submit({ type: 'challenge' })}>
                  {t('rangi.challenge')}
                </Button>
              </>
            }
          >
            {view?.challenge && t('rangi.challengeBody', { name: nameOf(view.challenge.offender) })}
          </Dialog>
          <Dialog
            open={!!picker || (!!view && view.mustChooseColor && !busy)}
            title={picker?.stage === 'swap' ? t('rangi.swapWith') : t('rangi.pickColor')}
            onClose={() => setPicker(null)}
            actions={
              picker ? (
                <Button tone="quiet" onClick={() => setPicker(null)}>
                  {t('common.cancel')}
                </Button>
              ) : (
                <span />
              )
            }
          >
            {(!picker || picker.stage === 'color') && (
              <div className={s.colors}>
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={s.colorBtn}
                    style={{ background: RANGI_HEX[c] }}
                    onClick={() => (picker ? chooseColor(c) : submit({ type: 'color', color: c }))}
                    aria-label={t(`rangi.color.${c}`)}
                  >
                    <ColorChip color={c} size={34} />
                    <span>{t(`rangi.color.${c}`)}</span>
                  </button>
                ))}
              </div>
            )}
            {picker?.stage === 'swap' && view && (
              <div className={s.swapList}>
                {view.plays
                  .find((p) => p.cardId === picker.cardId)
                  ?.swapTargets.map((target) => (
                    <button
                      key={target}
                      type="button"
                      className={s.swapBtn}
                      onClick={() =>
                        submit({
                          type: 'play',
                          cardId: picker.cardId,
                          color: picker.color,
                          swapWith: target,
                        })
                      }
                    >
                      {nameOf(target)} <span className="num">({view.handCounts[target]})</span>
                    </button>
                  ))}
              </div>
            )}
          </Dialog>
        </>
      }
    >
      <div className={s.board} data-landscape={vp.landscape}>
        <div className={s.others} data-many={n > 5}>
          {others.map(seatRow)}
        </div>

        <div className={s.center}>
          <button
            type="button"
            ref={deckRef as never}
            className={s.deck}
            style={{ width: pw }}
            disabled={!view?.canDraw || busy}
            onClick={() => submit({ type: 'draw' })}
            aria-label={t('rangi.draw')}
          >
            <RangiBack />
            <span className={`${s.pileCount} num`}>{ui.drawCount}</span>
            {view?.canDraw && !busy && <span className={s.drawTag}>{t('rangi.draw')}</span>}
          </button>
          <div className={s.discardWrap}>
            <div
              ref={discardRef as never}
              className={s.discard}
              style={{ width: pw, ['--ring' as string]: view ? RANGI_HEX[view.color] : '#999' }}
            >
              {ui.tail.map((c, i) => {
                const top = i === ui.tail.length - 1;
                const rot = top ? ((c.id % 5) - 2) * 1.5 : ((c.id % 9) - 4) * 2.2;
                return (
                  <div
                    key={c.id}
                    className={s.discardCard}
                    style={{
                      transform: `rotate(${rot}deg) translate(${top ? 0 : ((c.id % 5) - 2) * 2}px, ${top ? 0 : ((c.id % 3) - 1) * 2}px)`,
                    }}
                  >
                    <CardView card={c} />
                  </div>
                );
              })}
            </div>
            {view && (
              <div className={s.colorBadge}>
                <ColorChip color={view.color} />
                <span
                  className={s.dir}
                  data-ccw={dirArrow}
                  aria-label={dirArrow ? t('common.ccw') : t('common.cw')}
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="22"
                    height="22"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4 12a8 8 0 0 1 14-5.3" />
                    <path d="M19 3v4h-4" />
                  </svg>
                </span>
              </div>
            )}
            {view && view.pending > 0 && <div className={s.pending}>+{view.pending}</div>}
          </div>
          {callout && (
            <div className={s.callout} key={callout.key} role="status">
              {callout.color && <ColorChip color={callout.color} size={22} />}
              {callout.text}
            </div>
          )}
        </div>

        <div className={s.bottom}>
          <div className={s.mine}>
            {seatRow(mySeat)}
            <div className={s.status} aria-live="polite">
              {view && (
                <span className={s.round}>
                  {t('cb.roundOf', {
                    n: view.round + 1,
                    total: view.config.target === 0 ? 1 : '…',
                  }).replace(' of …', '')}
                </span>
              )}
              <span className={s.say}>{jumpAvailable ? t('rangi.jumpAvailable') : status}</span>
              {session.isAuto(mySeat) && (
                <Button
                  size="small"
                  tone="primary"
                  onClick={() => {
                    session.setAuto(mySeat, false);
                    setRulesTick((x) => x + 1);
                  }}
                >
                  {t('cb.imBack')}
                </Button>
              )}
            </div>
            <div className={s.actions}>
              {view?.canEk && !busy && (
                <Button tone="primary" onClick={() => submit({ type: 'ek' })}>
                  {t('rangi.ek')}
                </Button>
              )}
              {view?.canCatch && !busy && view.ek && (
                <Button tone="primary" onClick={() => submit({ type: 'caught' })}>
                  {t('rangi.caught')}
                </Button>
              )}
              {view?.canPass && !busy && view.drawnId !== null && (
                <Button onClick={() => submit({ type: 'pass' })}>{t('rangi.keep')}</Button>
              )}
              {view?.canPass && !busy && view.drawnId === null && (
                <Button onClick={() => submit({ type: 'pass' })}>{t('rangi.pass')}</Button>
              )}
            </div>
          </div>
          <div className={s.handWrap}>
            <Hand
              seat={mySeat}
              cards={hand}
              render={(c) => <CardView card={c as RCard} />}
              back={<RangiBack />}
              cardWidth={cw}
              selectedId={sel}
              onSelect={setSel}
              onPlay={tryPlay}
              playableIds={playableIds}
              hintId={hintId}
              faceDown={handHidden}
              disabled={busy || handHidden || !view || view.plays.length === 0}
            />
          </div>
        </div>
      </div>
    </TableShell>
  );
}
