import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Card } from '../../../engine/core/cards';
import { evaluate } from '../../../engine/core/threeCard';
import { IllegalActionError } from '../../../engine/core/types';
import { bestSplit } from '../../../engine/games/kitti';
import type { KAction, KView } from '../../../engine/games/kitti';
import { useT } from '../../../i18n/t';
import { CardBack, CardFace } from '../../cards/CardFace';
import { useAnchor } from '../../anim/anchors';
import { useFly } from '../../anim/FlightLayer';
import { dur, wait } from '../../anim/queue';
import { useAnimatedView, type RunArgs } from '../../anim/useAnimatedView';
import { useViewport } from '../../anim/useViewport';
import { haptic } from '../../haptics';
import { sound } from '../../sound/SoundManager';
import { Button } from '../../components/Button';
import { useToast } from '../../components/Overlays';
import { ChipStack } from '../../table/ChipStack';
import { ResultPanel } from '../../table/ResultPanel';
import { Seat } from '../../table/Seat';
import { TableShell } from '../../table/TableShell';
import { sortBySuit } from '../../table/sortHand';
import type { TableProps } from '../types';
import { KittiRules } from './KittiRules';
import s from './Chips.module.css';
import k from './Kitti.module.css';

const fmt = (n: number) =>
  n >= 0 ? `+${n.toLocaleString('en-US')}` : `−${Math.abs(n).toLocaleString('en-US')}`;

function ChipDot() {
  return (
    <div
      style={{
        width: 26,
        height: 26,
        borderRadius: '50%',
        background: 'repeating-conic-gradient(#fbf8f1 0 14deg, #b8262c 14deg 45deg)',
        boxShadow: '0 1.5px 0 rgb(0 0 0 / 0.55)',
      }}
    />
  );
}

export default function KittiTable({
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
  const fly = useFly();
  const toast = useToast();
  const n = players.length;
  const cw = vp.landscape ? 46 : Math.min(60, Math.round((vp.w - 40) / 5));
  const potRef = useAnchor('potzone');
  const [slots, setSlots] = useState<(number | null)[]>(Array(9).fill(null));
  const [sel, setSel] = useState<number | null>(null);
  const [dealt, setDealt] = useState(false);
  const dealtRef = useRef(false);
  const [callout, setCallout] = useState<string | null>(null);
  const nameOf = (i: number) => players[i]?.name ?? '';
  const say = useCallback((text: string) => {
    setCallout(text);
    setTimeout(() => setCallout((c) => (c === text ? null : c)), 1500);
  }, []);

  const run = useCallback(
    async ({ events }: RunArgs<KView>) => {
      const pos = (seat: number) => `seat:${seat}`;
      if (events.some((e) => e.type === 'roundStart')) {
        dealtRef.current = false;
        setDealt(false);
        setSlots(Array(9).fill(null));
        setSel(null);
      }
      const deals = events.filter((e) => e.type === 'deal');
      if (deals.length > 0) {
        sound.play('chips');
        await Promise.all(
          deals.map((d, i) =>
            fly({
              front: <ChipDot />,
              from: pos(d.seat as number),
              to: 'potzone',
              duration: 240,
              delay: i * 25,
            }),
          ),
        );
        sound.play('shuffle');
        await wait(dur(300));
        let count = 0;
        let last: Promise<void> = Promise.resolve();
        for (let r = 0; r < 9; r++)
          for (const d of deals) {
            last = fly({
              front: <CardBack />,
              from: 'potzone',
              to: pos(d.seat as number),
              duration: 200,
              rotate: [0, ((count++ % 5) - 2) * 3],
            });
            if (count % 3 === 0) sound.play('deal');
            await wait(dur(18));
          }
        await last;
      }
      for (const e of events) {
        if (e.type === 'arranged' && e.seat !== undefined && e.seat !== mySeat) sound.play('tap');
        else if (e.type === 'pack' && e.seat !== undefined)
          say(t('tp.say.pack', { name: nameOf(e.seat) }));
        else if (e.type === 'showdown') {
          sound.play('flip');
          await wait(dur(700));
          const d = e.data as { winner: number | null };
          if (d.winner !== null && d.winner !== undefined) {
            sound.play('chips');
            await fly({ front: <ChipDot />, from: 'potzone', to: pos(d.winner), duration: 420 });
          }
        } else if (e.type === 'gameEnd') sound.play('win');
      }
      dealtRef.current = true;
      setDealt(true);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fly, mySeat, n, say],
  );

  const { shown: view, busy } = useAnimatedView<KView>(session, mySeat, run);

  const key = view ? `${view.phase}:${view.round}` : '';
  const prev = useRef('');
  useLayoutEffect(() => {
    if (!view || prev.current === key) return;
    prev.current = key;
    if (view.canArrange) haptic(10);
  }, [key, view]);

  const submit = (a: KAction) => {
    try {
      session.submit(mySeat, a);
    } catch (e) {
      if (e instanceof IllegalActionError) {
        haptic(20);
        toast.show(t('kt.illegal'));
      } else throw e;
    }
  };

  const hand = useMemo(() => (view ? sortBySuit(view.hand) : []), [view]);
  const byId = useMemo(() => new Map(hand.map((c) => [c.id, c])), [hand]);
  const placed = new Set(slots.filter((x): x is number => x !== null));
  const tray = hand.filter((c) => !placed.has(c.id));
  const groupCards = (g: number): Card[] =>
    slots
      .slice(g * 3, g * 3 + 3)
      .flatMap((id) => (id !== null && byId.has(id) ? [byId.get(id)!] : []));
  const full = slots.every((x) => x !== null);
  const scores = [0, 1, 2].map((g) => {
    const cs = groupCards(g);
    return cs.length === 3 && view
      ? evaluate(cs, { a23: view.config.a23, top235: view.config.top235 })
      : null;
  });
  const descendingOk =
    !view?.config.descending ||
    !full ||
    (scores[0]!.score >= scores[1]!.score && scores[1]!.score >= scores[2]!.score);

  const place = (slot: number) => {
    if (sel === null) {
      // tap a placed card to take it back
      if (slots[slot] !== null) {
        setSlots((x) => x.map((v, i) => (i === slot ? null : v)));
      }
      return;
    }
    setSlots((x) => x.map((v, i) => (i === slot ? sel : v === sel ? null : v)));
    setSel(null);
    sound.play('place');
  };

  const myTurnToArrange = !!view && !busy && view.canArrange && !handHidden;
  const result = view?.phase === 'over' ? session.result() : null;
  const others = Array.from({ length: n - 1 }, (_, i) => (mySeat + i + 1) % n);
  const sd = view?.showdown;

  const seatNode = (seat: number) => (
    <div key={seat} className={s.seatBox} data-out={!view?.inRound[seat] || !!view?.packed[seat]}>
      <Seat
        seat={seat}
        name={nameOf(seat)}
        avatar={players[seat].avatar}
        isBot={players[seat].isBot}
        value={view?.chips[seat] ?? 0}
        info={
          view?.packed[seat]
            ? t('tp.packed')
            : !view?.inRound[seat]
              ? t('tp.sitOut')
              : view?.submitted[seat]
                ? t('kt.ready')
                : view?.phase === 'arrange'
                  ? t('kt.arranging')
                  : undefined
        }
        isTurn={
          !!view &&
          !busy &&
          view.phase === 'arrange' &&
          view.inRound[seat] &&
          !view.packed[seat] &&
          !view.submitted[seat]
        }
        dealer={!!view && view.dealer === seat}
        auto={session.isAuto(seat)}
        conn={online ? session.getConn?.(seat) : undefined}
        you={seat === mySeat}
        row={vp.landscape}
      />
    </div>
  );

  const showdownPanel = sd && sd.groups.some((g) => g.length > 0) && view && (
    <div className={s.reveal}>
      {[0, 1, 2].map((g) => (
        <div key={g} className={k.showBlock}>
          <div className={k.showHead}>
            {t('kt.show', { n: g + 1 })}:{' '}
            <b>{sd.showWinners[g] === null ? t('kt.noWinner') : nameOf(sd.showWinners[g]!)}</b>
          </div>
          {sd.groups.map((groups, seat) =>
            groups.length === 0 ? null : (
              <div key={seat} className={k.showRow} data-win={sd.showWinners[g] === seat}>
                <span className={s.who}>{nameOf(seat)}</span>
                <div className={k.mini}>
                  {groups[g].map((c) => (
                    <div key={c.id} style={{ width: 30 }}>
                      <CardFace card={c} />
                    </div>
                  ))}
                </div>
              </div>
            ),
          )}
        </div>
      ))}
    </div>
  );
  const summary = sd && view && (
    <p className={s.stakeNote} style={{ textAlign: 'center' }}>
      {sd.winner === null
        ? t('kt.kitti')
        : sd.salami
          ? t('kt.salamiWin', { name: nameOf(sd.winner) })
          : t('kt.winner', { name: nameOf(sd.winner) })}
    </p>
  );

  return (
    <TableShell
      session={session}
      onLeave={onLeave}
      isHost={online && mySeat === 0}
      ledger={
        view ? (
          <div className={s.reveal}>
            {players.map((p, i) => (
              <div key={i} className={s.revealRow}>
                <span className={s.who}>{p.name}</span>
                <span
                  className={`${s.net} num`}
                  data-pos={view.chips[i] > view.start[i]}
                  data-neg={view.chips[i] < view.start[i]}
                >
                  {view.chips[i].toLocaleString('en-US')} ({fmt(view.chips[i] - view.start[i])})
                </span>
              </div>
            ))}
          </div>
        ) : null
      }
      rules={<KittiRules />}
      overlay={
        <>
          {view?.phase === 'roundEnd' && !busy && sd && (
            <ResultPanel
              title={
                sd.winner === null ? t('kt.kittiTitle') : t('cb.wins', { name: nameOf(sd.winner) })
              }
              subtitle={t('cb.roundOf', { n: view.round + 1, total: view.rounds })}
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
              {summary}
              {showdownPanel}
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
                    <span className={s.muted}>{t('room.waitRematch')}</span>
                  )}
                  <Button onClick={onLeave}>{t('common.home')}</Button>
                </>
              }
            >
              {summary}
              <div className={s.reveal}>
                {players.map((p, i) => (
                  <div key={i} className={s.revealRow} data-win={result.winners.includes(i)}>
                    <span className={s.who}>{p.name}</span>
                    <span
                      className={`${s.net} num`}
                      data-pos={(result.chipDelta?.[i] ?? 0) > 0}
                      data-neg={(result.chipDelta?.[i] ?? 0) < 0}
                    >
                      {view.chips[i].toLocaleString('en-US')} ({fmt(result.chipDelta?.[i] ?? 0)})
                    </span>
                  </div>
                ))}
              </div>
            </ResultPanel>
          )}
        </>
      }
    >
      <div className={s.board}>
        <div className={s.seats}>{others.map(seatNode)}</div>

        <div className={s.center} style={{ minHeight: 110 }}>
          <div ref={potRef}>
            <ChipStack amount={view?.pot ?? 0} size={38} anchorKey="pot" />
          </div>
          {callout && <div className={s.callout}>{callout}</div>}
        </div>

        <div className={s.controls}>
          <div className={s.statusRow} aria-live="polite">
            {view && (
              <span className={s.round}>
                {t('cb.roundOf', { n: view.round + 1, total: view.rounds })}
              </span>
            )}
            <span className={s.say}>
              {!view || view.phase !== 'arrange'
                ? ''
                : view.packed[mySeat] || !view.inRound[mySeat]
                  ? t('kt.watching')
                  : view.submitted[mySeat]
                    ? t('kt.waitOthers')
                    : t('kt.arrangeNow')}
            </span>
            {session.isAuto(mySeat) && (
              <Button size="small" tone="primary" onClick={() => session.setAuto(mySeat, false)}>
                {t('cb.imBack')}
              </Button>
            )}
          </div>

          {view &&
            view.inRound[mySeat] &&
            !view.packed[mySeat] &&
            view.phase === 'arrange' &&
            dealt && (
              <div className={k.arrange}>
                {[0, 1, 2].map((g) => (
                  <div key={g} className={k.row}>
                    <span className={k.rowLabel}>{t('kt.show', { n: g + 1 })}</span>
                    <div className={k.slots}>
                      {[0, 1, 2].map((i) => {
                        const id = view.mine ? view.mine[g][i] : slots[g * 3 + i];
                        const card = id !== null && id !== undefined ? byId.get(id) : undefined;
                        return (
                          <button
                            key={i}
                            type="button"
                            className={k.slot}
                            style={{ width: cw, height: cw / 0.7159 }}
                            data-empty={!card}
                            disabled={!myTurnToArrange}
                            onClick={() => place(g * 3 + i)}
                            aria-label={card ? t('kt.takeBack') : t('kt.place')}
                          >
                            {card && <CardFace card={card} />}
                          </button>
                        );
                      })}
                    </div>
                    <span className={k.cat}>
                      {scores[g] ? t(`tp.cat.${scores[g]!.category}`) : ''}
                    </span>
                  </div>
                ))}
                {myTurnToArrange && (
                  <div className={k.tray} role="group" aria-label={t('kt.yourCards')}>
                    {tray.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className={k.trayCard}
                        data-sel={sel === c.id}
                        style={{ width: cw * 0.78 }}
                        aria-pressed={sel === c.id}
                        onClick={() => setSel(sel === c.id ? null : c.id)}
                      >
                        <CardFace card={c} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

          {myTurnToArrange && view && (
            <>
              {!descendingOk && <p className={s.muted}>{t('kt.mustDescend')}</p>}
              <div className={s.btns}>
                <Button
                  onClick={() => {
                    const split = bestSplit(view.hand, view.config);
                    const ids = split.flatMap((g) => g.map((c) => c.id));
                    setSlots(ids);
                    setSel(null);
                  }}
                >
                  {t('kt.auto')}
                </Button>
                <Button
                  tone="primary"
                  disabled={!full || !descendingOk}
                  onClick={() =>
                    submit({
                      type: 'arrange',
                      groups: [0, 1, 2].map((g) => slots.slice(g * 3, g * 3 + 3) as number[]),
                    })
                  }
                >
                  {t('kt.confirm')}
                </Button>
                {view.canPack && (
                  <Button onClick={() => submit({ type: 'pack' })}>{t('tp.pack')}</Button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </TableShell>
  );
}
