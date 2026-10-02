import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { Card } from '../../../engine/core/cards';
import { IllegalActionError } from '../../../engine/core/types';
import type { TPAction, TPView } from '../../../engine/games/teenpatti';
import { useT } from '../../../i18n/t';
import { useAnchor } from '../../anim/anchors';
import { CardBack, CardFace } from '../../cards/CardFace';
import { useFly } from '../../anim/FlightLayer';
import { dur, wait } from '../../anim/queue';
import { useAnimatedView, type RunArgs } from '../../anim/useAnimatedView';
import { useViewport } from '../../anim/useViewport';
import { haptic } from '../../haptics';
import { sound } from '../../sound/SoundManager';
import { Button } from '../../components/Button';
import { Dialog, useToast } from '../../components/Overlays';
import { ChipStack } from '../../table/ChipStack';
import { Ledger } from '../../table/Ledger';
import { ResultPanel } from '../../table/ResultPanel';
import { Seat } from '../../table/Seat';
import { TableShell } from '../../table/TableShell';
import type { TableProps } from '../types';
import { TeenPattiRules } from './TeenPattiRules';
import s from './Chips.module.css';

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

export default function TeenPattiTable({
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
  const cw = vp.landscape ? 54 : Math.min(76, Math.round(vp.w * 0.2));
  const potRef = useAnchor('potzone');
  const [dealt, setDealt] = useState<number[]>(() => Array(n).fill(0));
  const dealtRef = useRef(dealt);
  const setDealtBoth = useCallback((fn: (d: number[]) => number[]) => {
    dealtRef.current = fn(dealtRef.current);
    setDealt(dealtRef.current);
  }, []);
  const [callout, setCallout] = useState<string | null>(null);
  const [peek, setPeek] = useState<{
    asker: number;
    target: number;
    loser: number;
    cards: Card[];
  } | null>(null);
  const [joker, setJoker] = useState<Card | null>(null);
  const nameOf = (i: number) => players[i]?.name ?? '';
  const say = useCallback((text: string) => {
    setCallout(text);
    setTimeout(() => setCallout((c) => (c === text ? null : c)), 1400);
  }, []);

  const run = useCallback(
    async ({ events, next }: RunArgs<TPView>) => {
      const pos = (seat: number) => `seat:${seat}`;
      if (events.some((e) => e.type === 'roundStart')) {
        setDealtBoth(() => Array(n).fill(0));
        setJoker(null);
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
              duration: 260,
              delay: i * 30,
            }),
          ),
        );
        sound.play('shuffle');
        await wait(dur(300));
        let k = 0;
        let last: Promise<void> = Promise.resolve();
        for (let r = 0; r < 3; r++)
          for (const d of deals) {
            const seat = d.seat as number;
            last = fly({
              front: <CardBack />,
              from: 'potzone',
              to: pos(seat),
              duration: 220,
              rotate: [0, ((k++ % 5) - 2) * 3],
            }).then(() => setDealtBoth((x) => x.map((c, i) => (i === seat ? c + 1 : c))));
            if (k % 2 === 0) sound.play('deal');
            await wait(dur(40));
          }
        await last;
      }
      for (const e of events) {
        if (e.type === 'joker' && e.cards) {
          sound.play('flip');
          setJoker(e.cards[0] as Card);
        } else if (
          (e.type === 'bet' ||
            e.type === 'raise' ||
            e.type === 'showCall' ||
            e.type === 'sideshowAsk') &&
          e.seat !== undefined
        ) {
          const d = e.data as { amount?: number } | undefined;
          sound.play('chips');
          await fly({ front: <ChipDot />, from: pos(e.seat), to: 'potzone', duration: 240 });
          say(
            `${nameOf(e.seat)} ${e.type === 'raise' ? t('tp.say.raise') : t('tp.say.bet')} ${d?.amount ?? ''}`,
          );
          await wait(dur(200));
        } else if (e.type === 'pack' && e.seat !== undefined) {
          sound.play('slide');
          say(t('tp.say.pack', { name: nameOf(e.seat) }));
          await wait(dur(350));
        } else if (e.type === 'look' && e.seat !== undefined && e.seat !== mySeat) {
          sound.play('flip');
        } else if (e.type === 'sideshowRefused') {
          say(t('tp.say.refused', { name: nameOf(e.seat ?? 0) }));
          await wait(dur(500));
        } else if (e.type === 'sideshowResult' && e.cards) {
          const d = e.data as { asker: number; target: number; loser: number };
          setPeek({ ...d, cards: e.cards as Card[] });
        } else if (e.type === 'show') {
          sound.play('flip');
          await wait(dur(900));
        } else if (e.type === 'roundEnd') {
          const d = e.data as { winners: number[] };
          sound.play('chips');
          await Promise.all(
            d.winners.map((w) =>
              fly({ front: <ChipDot />, from: 'potzone', to: pos(w), duration: 420 }),
            ),
          );
        } else if (e.type === 'gameEnd') sound.play('win');
      }
      void next;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fly, mySeat, n, say, setDealtBoth],
  );

  const { shown: view, busy } = useAnimatedView<TPView>(session, mySeat, run);

  const key = view ? `${view.phase}:${view.turn}:${view.round}` : '';
  const prev = useRef('');
  useLayoutEffect(() => {
    if (!view || prev.current === key) return;
    prev.current = key;
    if (view.turn === mySeat && view.phase === 'bet') haptic(10);
  }, [key, view, mySeat]);

  const submit = (a: TPAction) => {
    try {
      session.submit(mySeat, a);
    } catch (e) {
      if (e instanceof IllegalActionError) {
        haptic(20);
        toast.show(t('tp.illegal'));
      } else throw e;
    }
  };

  const myTurn = !!view && !busy && view.turn === mySeat && view.phase === 'bet' && !handHidden;
  const result = view?.phase === 'over' ? session.result() : null;
  const others = Array.from({ length: n - 1 }, (_, i) => (mySeat + i + 1) % n);

  const seatNode = (seat: number) => {
    const out = !view || !view.inRound[seat];
    const tm =
      view && !busy && view.turn === seat && view.phase === 'bet' ? session.getTimer(seat) : null;
    return (
      <div key={seat} className={s.seatBox} data-out={out || !!view?.packed[seat]}>
        <Seat
          seat={seat}
          name={nameOf(seat)}
          avatar={players[seat].avatar}
          isBot={players[seat].isBot}
          value={view?.chips[seat] ?? 0}
          info={
            view?.packed[seat]
              ? t('tp.packed')
              : out
                ? t('tp.sitOut')
                : view?.seen[seat]
                  ? t('tp.seen')
                  : t('tp.blind')
          }
          isTurn={!!view && !busy && view.turn === seat && view.phase === 'bet'}
          timerMs={tm?.remainingMs}
          timerTotalMs={tm?.totalMs}
          dealer={!!view && view.dealer === seat}
          auto={session.isAuto(seat)}
          conn={online ? session.getConn?.(seat) : undefined}
          you={seat === mySeat}
          row={vp.landscape}
        />
        {seat !== mySeat && dealt[seat] > 0 && !view?.packed[seat] && (
          <div className={s.backs}>
            {Array.from({ length: dealt[seat] }, (_, i) => (
              <div key={i} className={s.back} style={{ width: 24 }}>
                <CardBack />
              </div>
            ))}
          </div>
        )}
        {view && view.put[seat] > 0 && <span className={`${s.put} num`}>{view.put[seat]}</span>}
      </div>
    );
  };

  const status = (() => {
    if (!view || view.phase === 'roundEnd' || view.phase === 'over') return '';
    if (view.phase === 'sideshow' && view.sideShow)
      return view.sideShow.target === mySeat
        ? t('tp.sideAsk', { name: nameOf(view.sideShow.asker) })
        : t('tp.sideWait', { name: nameOf(view.sideShow.target) });
    if (view.turn === mySeat)
      return view.seen[mySeat] ? t('tp.yourTurnSeen') : t('tp.yourTurnBlind');
    return t('rangi.waitPlay', { name: nameOf(view.turn) });
  })();

  const revealPanel = view && view.reveal.length > 0 && (
    <div className={s.reveal}>
      {view.reveal.map((r) => (
        <div key={r.seat} className={s.revealRow} data-win={view.winners.includes(r.seat)}>
          <span className={s.who}>{nameOf(r.seat)}</span>
          <span
            className={`${s.net} num`}
            data-pos={view.lastGain[r.seat] > 0}
            data-neg={view.lastGain[r.seat] < 0}
          >
            {fmt(view.lastGain[r.seat])}
          </span>
          <div className={s.revealCards}>
            {r.cards.map((c) => (
              <div key={c.id} style={{ width: 42 }}>
                <CardFace card={c} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
  const standings = view && (
    <div className={s.reveal}>
      {players.map((p, i) => (
        <div key={i} className={s.revealRow} data-win={view.winners.includes(i)}>
          <span className={s.who}>{p.name}</span>
          <span
            className={`${s.net} num`}
            data-pos={view.lastGain[i] > 0}
            data-neg={view.lastGain[i] < 0}
          >
            {view.chips[i].toLocaleString('en-US')} ({fmt(view.lastGain[i])})
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
      rules={<TeenPattiRules />}
      overlay={
        <>
          {view?.phase === 'roundEnd' && !busy && (
            <ResultPanel
              title={
                view.winners.length === 1
                  ? t('cb.wins', { name: nameOf(view.winners[0]) })
                  : t('cb.tie', { names: view.winners.map(nameOf).join(', ') })
              }
              subtitle={t('cb.roundOf', { n: view.round + 1, total: view.rounds })}
              actions={
                view.can.next ? (
                  <Button tone="primary" onClick={() => submit({ type: 'next' })}>
                    {t('rangi.nextRound')}
                  </Button>
                ) : (
                  <span className={s.muted}>{t('lb.waitNext')}</span>
                )
              }
            >
              {revealPanel || standings}
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
              {standings}
              <Ledger
                players={players}
                rounds={[]}
                totals={result.chipDelta ?? []}
                highlight={result.winners}
              />
            </ResultPanel>
          )}
          <Dialog
            open={!!view && view.can.accept && !busy && view.sideShow?.target === mySeat}
            title={t('tp.sideTitle')}
            actions={
              <>
                <Button onClick={() => submit({ type: 'refuse' })}>{t('tp.refuse')}</Button>
                <Button tone="primary" onClick={() => submit({ type: 'accept' })}>
                  {t('tp.accept')}
                </Button>
              </>
            }
          >
            {view?.sideShow && t('tp.sideBody', { name: nameOf(view.sideShow.asker) })}
          </Dialog>
          <Dialog
            open={!!peek}
            title={t('tp.sideResult')}
            onClose={() => setPeek(null)}
            actions={
              <Button tone="primary" onClick={() => setPeek(null)}>
                {t('common.ok')}
              </Button>
            }
          >
            {peek && (
              <div className={s.reveal}>
                {[peek.asker, peek.target].map((seat, idx) => (
                  <div key={seat} className={s.revealRow} data-win={seat !== peek.loser}>
                    <span className={s.who}>
                      {nameOf(seat)} {seat === peek.loser ? `(${t('tp.packed')})` : ''}
                    </span>
                    <div className={s.revealCards}>
                      {peek.cards.slice(idx * 3, idx * 3 + 3).map((c) => (
                        <div key={c.id} style={{ width: 46 }}>
                          <CardFace card={c} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Dialog>
        </>
      }
    >
      <div className={s.board}>
        <div className={s.seats}>{others.map(seatNode)}</div>

        <div className={s.center}>
          <div className={s.potRow}>
            <div ref={potRef}>
              <ChipStack amount={view?.pot ?? 0} size={40} anchorKey="pot" />
            </div>
            {joker && (
              <div style={{ width: 44 }} title={t('tp.jokerCard')}>
                <CardFace card={joker} />
              </div>
            )}
          </div>
          {view && (
            <span className={s.stakeNote}>
              {t('tp.stake')} <b className="num">{view.stake}</b>
              {view.wildRank !== null && ` · ${t('tp.wildNote')}`}
              {view.config.variant === 'ak47' && ` · ${t('tp.ak47Note')}`}
              {view.config.variant === 'muflis' && ` · ${t('tp.muflisNote')}`}
            </span>
          )}
          {callout && <div className={s.callout}>{callout}</div>}
        </div>

        <div className={s.controls}>
          <div className={s.mine}>
            {seatNode(mySeat)}
            <div className={s.myCards}>
              {(view?.inRound[mySeat] ?? false) &&
                !view?.packed[mySeat] &&
                (view && view.seen[mySeat] && view.hand.length === 3 && !handHidden
                  ? view.hand.map((c) => (
                      <div key={c.id} style={{ width: cw }}>
                        <CardFace card={c} />
                      </div>
                    ))
                  : dealt[mySeat] > 0
                    ? Array.from({ length: dealt[mySeat] }, (_, i) => (
                        <div key={i} style={{ width: cw }}>
                          <CardBack />
                        </div>
                      ))
                    : null)}
            </div>
          </div>
          <div className={s.statusRow} aria-live="polite">
            {view && (
              <span className={s.round}>
                {t('cb.roundOf', { n: view.round + 1, total: view.rounds })}
              </span>
            )}
            <span className={s.say}>{status}</span>
            {view?.handLabel && !handHidden && (
              <span className={s.handName}>{t(`tp.cat.${view.handLabel}`)}</span>
            )}
            {session.isAuto(mySeat) && (
              <Button size="small" tone="primary" onClick={() => session.setAuto(mySeat, false)}>
                {t('cb.imBack')}
              </Button>
            )}
          </div>
          {myTurn && view && (
            <div className={s.btns}>
              {view.can.look && (
                <Button onClick={() => submit({ type: 'look' })}>{t('tp.look')}</Button>
              )}
              {view.can.bet && (
                <Button tone="primary" onClick={() => submit({ type: 'bet' })}>
                  {view.seen[mySeat] ? t('tp.chaal') : t('tp.blindBet')}{' '}
                  <span className={`${s.cost} num`}>{view.betCost}</span>
                </Button>
              )}
              {view.can.raise && (
                <Button onClick={() => submit({ type: 'raise' })}>
                  {t('tp.raise')} <span className={`${s.cost} num`}>{view.raiseCost}</span>
                </Button>
              )}
              {view.can.sideshow && (
                <Button onClick={() => submit({ type: 'sideshow' })}>{t('tp.sideShow')}</Button>
              )}
              {view.can.show && (
                <Button tone="primary" onClick={() => submit({ type: 'show' })}>
                  {t('tp.show')} <span className={`${s.cost} num`}>{view.showCost}</span>
                </Button>
              )}
              {view.can.pack && (
                <Button onClick={() => submit({ type: 'pack' })}>{t('tp.pack')}</Button>
              )}
            </div>
          )}
        </div>
      </div>
    </TableShell>
  );
}
