import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { Card } from '../../../engine/core/cards';
import { IllegalActionError } from '../../../engine/core/types';
import type { IBAction, IBView } from '../../../engine/games/inbetween';
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
import { StakeField } from '../../components/StakeField';
import { useToast } from '../../components/Overlays';
import { ChipStack } from '../../table/ChipStack';
import { ResultPanel } from '../../table/ResultPanel';
import { Seat } from '../../table/Seat';
import { TableShell } from '../../table/TableShell';
import type { TableProps } from '../types';
import { InBetweenRules } from './InBetweenRules';
import s from './Chips.module.css';
import b from './InBetween.module.css';

const fmt = (n: number) =>
  n >= 0 ? `+${n.toLocaleString('en-US')}` : `−${Math.abs(n).toLocaleString('en-US')}`;

interface Ui {
  posts: [Card, Card] | null;
  third: Card | null;
}

function PostSlot({ i, card, w }: { i: number; card?: Card; w: number }) {
  const ref = useAnchor(`post:${i}`);
  return (
    <div ref={ref} className={b.slot} style={{ width: w, height: w / 0.7159 }}>
      {card && <CardFace card={card} />}
    </div>
  );
}

function ThirdSlot({ card, w }: { card: Card | null; w: number }) {
  const ref = useAnchor('third');
  return (
    <div ref={ref} className={b.slot} data-third style={{ width: w, height: w / 0.7159 }}>
      {card && <CardFace card={card} />}
    </div>
  );
}

export default function InBetweenTable({
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
  const cw = vp.landscape ? 60 : Math.min(76, Math.round((vp.w - 64) / 5));
  const deckRef = useAnchor('deck');
  const [ui, setUi] = useState<Ui>({ posts: null, third: null });
  const uiRef = useRef(ui);
  const patch = useCallback((fn: (u: Ui) => Ui) => {
    uiRef.current = fn(uiRef.current);
    setUi(uiRef.current);
  }, []);
  const [callout, setCallout] = useState<string | null>(null);
  const [amount, setAmount] = useState(0);
  const nameOf = (i: number) => players[i]?.name ?? '';
  const say = useCallback((text: string) => {
    setCallout(text);
    setTimeout(() => setCallout((c) => (c === text ? null : c)), 1700);
  }, []);

  const run = useCallback(
    async ({ events, next }: RunArgs<IBView>) => {
      for (const e of events) {
        if (e.type === 'ante') {
          sound.play('chips');
          await wait(dur(300));
        } else if (e.type === 'posts' && e.cards) {
          const cards = e.cards as [Card, Card];
          patch(() => ({ posts: null, third: null }));
          sound.play('deal');
          await Promise.all(
            cards.map((c, i) =>
              fly({
                front: <CardFace card={c} />,
                back: <CardBack />,
                flip: true,
                from: 'deck',
                to: `post:${i}`,
                duration: 300,
                delay: i * 120,
              }),
            ),
          );
          patch(() => ({ posts: cards, third: null }));
        } else if (e.type === 'third' && e.cards) {
          const card = e.cards[0] as Card;
          sound.play('flip');
          await fly({
            front: <CardFace card={card} />,
            back: <CardBack />,
            flip: true,
            from: 'deck',
            to: 'third',
            duration: 380,
          });
          patch((u) => ({ ...u, third: card }));
          await wait(dur(300));
        } else if (e.type === 'result' && e.seat !== undefined) {
          const d = e.data as { outcome: string; net: number };
          sound.play(d.net > 0 ? 'chips' : 'slide');
          say(
            d.outcome === 'win'
              ? t('ib.say.win', { name: nameOf(e.seat), n: fmt(d.net) })
              : d.outcome === 'double'
                ? t('ib.say.double', { name: nameOf(e.seat), n: fmt(d.net) })
                : t('ib.say.lose', { name: nameOf(e.seat), n: fmt(d.net) }),
          );
          await wait(dur(900));
        } else if (e.type === 'noGap' && e.seat !== undefined) {
          say(t('ib.say.noGap', { name: nameOf(e.seat) }));
          await wait(dur(700));
        } else if (e.type === 'pass' && e.seat !== undefined) {
          say(t('ib.say.pass', { name: nameOf(e.seat) }));
          await wait(dur(400));
        } else if (e.type === 'aceChoice') {
          sound.play('tap');
        } else if (e.type === 'reshuffle') sound.play('shuffle');
        else if (e.type === 'gameEnd') sound.play('win');
      }
      patch((u) => ({ posts: next.posts ?? u.posts, third: events.length === 0 ? null : u.third }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fly, patch, say],
  );

  const { shown: view, busy } = useAnimatedView<IBView>(session, mySeat, run);
  const myTurn = !!view && !busy && view.turn === mySeat && !handHidden;

  useLayoutEffect(() => {
    if (view && view.maxBet > 0)
      setAmount((a) => Math.min(Math.max(a || view.minBet, view.minBet), view.maxBet));
  }, [view]);

  const key = view ? `${view.phase}:${view.turn}:${view.turns}` : '';
  const prev = useRef('');
  useLayoutEffect(() => {
    if (!view || prev.current === key) return;
    prev.current = key;
    if (view.turn === mySeat) haptic(10);
  }, [key, view, mySeat]);

  const submit = (a: IBAction) => {
    try {
      session.submit(mySeat, a);
    } catch (e) {
      if (e instanceof IllegalActionError) {
        haptic(20);
        toast.show(t('ib.illegal'));
      } else throw e;
    }
  };

  const result = view?.phase === 'over' ? session.result() : null;
  const step = (view?.config.minBet ?? 10) % 5 === 0 ? 5 : 1;

  const seatNode = (seat: number) => (
    <div key={seat} className={s.seatBox}>
      <Seat
        seat={seat}
        name={nameOf(seat)}
        avatar={players[seat].avatar}
        isBot={players[seat].isBot}
        value={view?.chips[seat] ?? 0}
        isTurn={!!view && !busy && view.turn === seat && view.phase !== 'over'}
        timerMs={
          view && !busy && view.turn === seat ? session.getTimer(seat)?.remainingMs : undefined
        }
        timerTotalMs={
          view && !busy && view.turn === seat ? session.getTimer(seat)?.totalMs : undefined
        }
        auto={session.isAuto(seat)}
        conn={online ? session.getConn?.(seat) : undefined}
        you={seat === mySeat}
        row={vp.landscape}
      />
    </div>
  );
  const others = Array.from({ length: n - 1 }, (_, i) => (mySeat + i + 1) % n);

  const status = (() => {
    if (!view || view.phase === 'over') return '';
    if (view.turn !== mySeat) return t('rangi.waitPlay', { name: nameOf(view.turn) });
    if (view.phase === 'ace') return t('ib.aceChoice');
    if (view.phase === 'guess') return t('ib.guess');
    return t('ib.yourBet');
  })();

  const standings = view && (
    <div className={s.reveal}>
      {players.map((p, i) => (
        <div key={i} className={s.revealRow} data-win={result?.winners.includes(i)}>
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
  );

  return (
    <TableShell
      session={session}
      onLeave={onLeave}
      isHost={online && mySeat === 0}
      ledger={standings}
      rules={<InBetweenRules />}
      overlay={
        result &&
        view &&
        !busy && (
          <ResultPanel
            big
            celebrate
            title={
              result.winners.length === 1
                ? t('cb.wins', { name: nameOf(result.winners[0]) })
                : t('cb.tie', { names: result.winners.map(nameOf).join(', ') })
            }
            subtitle={t('ib.afterTurns', { n: view.turns })}
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
          </ResultPanel>
        )
      }
    >
      <div className={s.board}>
        <div className={s.seats}>{others.map(seatNode)}</div>

        <div className={s.center}>
          <div className={b.table}>
            <div ref={deckRef as never} className={b.deck} style={{ width: cw * 0.8 }}>
              <CardBack />
              <span className={`${s.put} ${b.deckCount} num`}>{view?.deckCount ?? 52}</span>
            </div>
            <PostSlot i={0} card={ui.posts?.[0]} w={cw} />
            <ThirdSlot card={ui.third} w={cw} />
            <PostSlot i={1} card={ui.posts?.[1]} w={cw} />
            <ChipStack amount={view?.pot ?? 0} size={36} anchorKey="pot" />
          </div>
          {view?.values && (
            <span className={s.stakeNote}>
              {t('ib.gap', { n: Math.max(0, Math.abs(view.values[0] - view.values[1]) - 1) })}
            </span>
          )}
          {callout && <div className={s.callout}>{callout}</div>}
        </div>

        <div className={s.controls}>
          <div className={s.mine}>
            {seatNode(mySeat)}
            <div
              className={s.statusRow}
              aria-live="polite"
              style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}
            >
              {view && (
                <span className={s.round}>
                  {t('ib.turnOf', {
                    n: Math.min(view.turns + 1, view.totalTurns),
                    total: view.totalTurns,
                  })}
                </span>
              )}
              <span className={s.say}>{status}</span>
              {session.isAuto(mySeat) && (
                <Button size="small" tone="primary" onClick={() => session.setAuto(mySeat, false)}>
                  {t('cb.imBack')}
                </Button>
              )}
            </div>
          </div>

          {myTurn && view?.canAce && (
            <div className={s.btns}>
              <Button tone="primary" onClick={() => submit({ type: 'ace', high: false })}>
                {t('ib.aceLow')}
              </Button>
              <Button tone="primary" onClick={() => submit({ type: 'ace', high: true })}>
                {t('ib.aceHigh')}
              </Button>
            </div>
          )}

          {myTurn && view && (view.canBet || view.canGuess) && (
            <>
              <StakeField
                label={t('ib.amount')}
                value={amount}
                step={step}
                min={view.minBet}
                max={view.maxBet}
                check={(n) => {
                  if (n < view.minBet) return t('lb.err.min', { n: view.minBet });
                  if (n > view.maxBet)
                    return t('lb.err.chips', {
                      n: (view.chips[mySeat] ?? 0).toLocaleString('en-US'),
                    });
                  return null;
                }}
                onChange={setAmount}
              />
              <div className={s.btns}>
                {view.canBet && (
                  <Button tone="primary" onClick={() => submit({ type: 'bet', amount })}>
                    {t('ib.bet')} <span className={`${s.cost} num`}>{amount}</span>
                  </Button>
                )}
                {view.canGuess && (
                  <>
                    <Button
                      tone="primary"
                      onClick={() => submit({ type: 'guess', high: true, amount })}
                    >
                      {t('ib.higher')} <span className={`${s.cost} num`}>{amount}</span>
                    </Button>
                    <Button
                      tone="primary"
                      onClick={() => submit({ type: 'guess', high: false, amount })}
                    >
                      {t('ib.lower')} <span className={`${s.cost} num`}>{amount}</span>
                    </Button>
                  </>
                )}
                {view.canPass && (
                  <Button onClick={() => submit({ type: 'pass' })}>{t('ib.pass')}</Button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </TableShell>
  );
}
