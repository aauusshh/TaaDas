import { useCallback, useLayoutEffect, useState } from 'react';
import { IllegalActionError } from '../../../engine/core/types';
import {
  returnsFor,
  stakeProblem,
  type LBAction,
  type LBView,
} from '../../../engine/games/langurburja';
import { translate, useT } from '../../../i18n/t';
import { dur, wait } from '../../anim/queue';
import { useAnimatedView, type RunArgs } from '../../anim/useAnimatedView';
import { useViewport } from '../../anim/useViewport';
import { haptic } from '../../haptics';
import { sound } from '../../sound/SoundManager';
import { Button } from '../../components/Button';
import { useToast } from '../../components/Overlays';
import { ResultPanel } from '../../table/ResultPanel';
import { Seat } from '../../table/Seat';
import { TableShell } from '../../table/TableShell';
import { StakeField } from '../../components/StakeField';
import type { TableProps } from '../types';
import { Bowl, type BowlState } from './Bowl';
import { Die3D } from './Dice';
import { LangurRules } from './LangurRules';
import { LBSymbol, SYMBOL_NAMES } from './Symbols';
import s from './LangurTable.module.css';

/** one color per seat so a shared screen can tell whose chips are whose */
const SEAT_COLORS = [
  '#c93a22',
  '#2d58a8',
  '#2e7d4b',
  '#e39b12',
  '#7b3fa0',
  '#1f8f8f',
  '#b0507a',
  '#6b6b6b',
  '#8a5a2b',
  '#4a6fd0',
  '#3a9a5a',
];

const fmt = (n: number) =>
  n >= 0 ? `+${n.toLocaleString('en-US')}` : `−${Math.abs(n).toLocaleString('en-US')}`;

interface Ui {
  bowl: BowlState;
  dice: number[] | null;
  pulse: number[];
  nets: number[] | null;
}
const FRESH: Ui = { bowl: 'covered', dice: null, pulse: [], nets: null };

export default function LangurTable({
  session,
  mySeat,
  players,
  canRematch,
  online,
  onLeave,
  onRematch,
}: TableProps) {
  const t = useT();
  const vp = useViewport();
  const toast = useToast();
  const n = players.length;
  const [ui, setUi] = useState<Ui>(FRESH);
  const [pick, setPick] = useState(0);
  const [active, setActive] = useState(mySeat);

  const run = useCallback(async ({ events }: RunArgs<LBView>) => {
    for (const e of events) {
      if (e.type === 'roundStart') setUi(FRESH);
      else if (e.type === 'bet') sound.play('chip');
      else if (e.type === 'ready' || e.type === 'close') sound.play('tap');
      else if (e.type === 'roll') {
        const d = e.data as { dice: number[]; counts: number[] };
        setUi((u) => ({ ...u, bowl: 'shaking', dice: null, pulse: [], nets: null }));
        sound.play('rattle');
        await wait(dur(1200));
        sound.play('bowl');
        setUi((u) => ({ ...u, bowl: 'lifted' }));
        await wait(dur(300));
        setUi((u) => ({ ...u, dice: d.dice }));
        await wait(dur(950));
        setUi((u) => ({ ...u, pulse: d.counts.flatMap((c, i) => (c > 0 ? [i] : [])) }));
        sound.play('chips');
        await wait(dur(700));
      } else if (e.type === 'payout') {
        const d = e.data as { net: number[] };
        setUi((u) => ({ ...u, nets: d.net }));
        await wait(dur(500));
      } else if (e.type === 'gameEnd') sound.play('win');
    }
  }, []);

  const { shown: view, busy } = useAnimatedView<LBView>(session, mySeat, run);

  useLayoutEffect(() => {
    // reset the shared-screen picker to someone who can still bet
    if (view && view.ready[active] && !view.ready.every(Boolean)) {
      const next = Array.from({ length: n }, (_, i) => i).find(
        (i) => i !== view.banker && !view.ready[i] && !players[i].isBot,
      );
      if (next !== undefined) setActive(next);
    }
  }, [view, active, n, players]);

  const humans = players.map((p, i) => (p.isBot ? -1 : i)).filter((i) => i >= 0);
  const shared = !online && humans.length > 1;
  const betSeat = shared ? active : mySeat;
  const isBanker = !!view && view.banker === mySeat;
  const bettingOpen = !!view && view.phase === 'betting' && !busy;
  const myBets = view?.bets[betSeat] ?? Array(6).fill(0);
  const myChips = view?.chips[betSeat] ?? 0;
  const left = myChips - myBets.reduce((a, b) => a + b, 0);
  const legalFor = (seat: number) => (session.legalActions(seat) as LBAction[]) ?? [];

  const submit = (seat: number, a: LBAction) => {
    try {
      session.submit(seat, a);
    } catch (e) {
      if (e instanceof IllegalActionError) {
        haptic(20);
        toast.show(t('lb.illegal'));
      } else throw e;
    }
  };

  const canActFor = (seat: number) =>
    bettingOpen &&
    seat !== view!.banker &&
    !view!.ready[seat] &&
    (shared ? !players[seat].isBot : seat === mySeat);

  const total = myBets.reduce((a, b) => a + b, 0);
  const setStake = (sym: number, amount: number) => {
    if (!view || !canActFor(betSeat)) return;
    submit(betSeat, { type: 'setBet', symbol: sym, amount });
  };
  /** the reason a stake cannot be set, in words, or null */
  const checkStake = (sym: number) => (n: number) => {
    if (!view) return null;
    const why = stakeProblem(view, betSeat, sym, n);
    if (!why) return null;
    const { step, minBet, maxBet } = view.config;
    if (why === 'whole') return t('lb.err.whole');
    if (why === 'step') return t('lb.err.step', { n: step });
    if (why === 'min') return t('lb.err.min', { n: minBet });
    if (why === 'max') return t('lb.err.max', { n: maxBet });
    return t('lb.err.chips', { n: myChips.toLocaleString('en-US') });
  };
  const symLabel = (sym: number) => t(`lb.sym.${SYMBOL_NAMES[sym]}`);

  const result = view?.phase === 'over' ? session.result() : null;
  const nameOf = (i: number) => players[i]?.name ?? '';
  const sceneW = Math.min(vp.w - 24, 420);
  void sceneW;
  const size = vp.landscape ? 34 : 40;

  const tm = (seat: number) =>
    view && !busy && view.phase === 'betting' && !view.ready[seat] ? session.getTimer(seat) : null;

  const seatNode = (seat: number) => {
    const bank = !!view && view.banker === seat;
    const t0 = tm(seat);
    return (
      <Seat
        key={seat}
        seat={seat}
        name={nameOf(seat)}
        avatar={players[seat].avatar}
        isBot={players[seat].isBot}
        value={view?.chips[seat] ?? 0}
        info={
          bank
            ? t('lb.banker')
            : view && view.ready[seat] && view.phase === 'betting'
              ? t('lb.locked')
              : view && view.staked[seat] > 0
                ? String(view.staked[seat])
                : undefined
        }
        isTurn={!!view && !busy && view.phase === 'betting' && !view.ready[seat] && !bank}
        timerMs={t0?.remainingMs}
        timerTotalMs={t0?.totalMs}
        auto={session.isAuto(seat)}
        conn={online ? session.getConn?.(seat) : undefined}
        you={seat === mySeat}
        row={vp.landscape}
      />
    );
  };

  const status = (() => {
    if (!view) return '';
    if (view.phase === 'betting') {
      if (isBanker) return t('lb.bankerWait');
      if (view.ready[betSeat]) return t('lb.waitOthers');
      return t('lb.placeBets');
    }
    if (view.phase === 'rolling')
      return isBanker ? t('lb.yourRoll') : t('lb.bankerRolls', { name: nameOf(view.banker) });
    return '';
  })();

  const tray = view && !isBanker && view.phase === 'betting';

  return (
    <TableShell
      session={session}
      onLeave={onLeave}
      isHost={online && mySeat === view?.banker}
      ledger={
        view ? (
          <div className={s.standings}>
            {players.map((p, i) => (
              <div key={i} className={s.stand}>
                <span>{p.name}</span>
                <b className="num">{view.chips[i].toLocaleString('en-US')}</b>
                <i className="num" data-neg={view.chips[i] - view.start[i] < 0}>
                  {fmt(view.chips[i] - view.start[i])}
                </i>
              </div>
            ))}
          </div>
        ) : null
      }
      rules={<LangurRules />}
      overlay={
        <>
          {view?.phase === 'summary' && !busy && (
            <ResultPanel
              title={t('lb.roundDone', { n: view.round + 1 })}
              subtitle={
                view.counts
                  ? view.counts
                      .map((c, i) => (c > 0 ? `${t(`lb.sym.${SYMBOL_NAMES[i]}`)} ${c}` : null))
                      .filter(Boolean)
                      .join(', ')
                  : undefined
              }
              actions={
                view.canNext ? (
                  <Button tone="primary" onClick={() => submit(mySeat, { type: 'next' })}>
                    {t('lb.nextRound')}
                  </Button>
                ) : (
                  <span className={s.muted}>{t('lb.waitNext')}</span>
                )
              }
            >
              {view.counts && !isBanker && (
                <ul className={s.outcomes}>
                  {view.bets[betSeat].map((stake, sym) => {
                    if (stake <= 0) return null;
                    const c = view.counts![sym];
                    const m = returnsFor(c, view.config);
                    const text =
                      c === 0
                        ? t('lb.result.zero', { sym: symLabel(sym) })
                        : m === 0
                          ? t('lb.result.one', { sym: symLabel(sym) })
                          : t('lb.result.pays', { sym: symLabel(sym), c, m });
                    return (
                      <li key={sym} data-lost={m === 0}>
                        {text} <b className="num">{fmt(stake * (m - 1))}</b>
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className={s.standings}>
                {players.map((p, i) => (
                  <div key={i} className={s.stand}>
                    <span>
                      {p.name}
                      {i === view.banker && <em> {t('lb.banker')}</em>}
                    </span>
                    <b className="num">{view.chips[i].toLocaleString('en-US')}</b>
                    <i className="num" data-neg={view.net[i] < 0}>
                      {fmt(view.net[i])}
                    </i>
                  </div>
                ))}
              </div>
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
              <div className={s.standings}>
                {players.map((p, i) => (
                  <div key={i} className={s.stand} data-win={result.winners.includes(i)}>
                    <span>{p.name}</span>
                    <b className="num">{view.chips[i].toLocaleString('en-US')}</b>
                    <i className="num" data-neg={(result.chipDelta?.[i] ?? 0) < 0}>
                      {fmt(result.chipDelta?.[i] ?? 0)}
                    </i>
                  </div>
                ))}
              </div>
            </ResultPanel>
          )}
        </>
      }
    >
      <div className={s.board} data-landscape={vp.landscape}>
        <div className={s.seats}>{players.map((_, i) => seatNode(i))}</div>

        <div className={s.stage}>
          <div className={s.bowlArea}>
            <Bowl state={ui.bowl} size={vp.landscape ? 92 : 84} />
            <div className={s.dice} data-hidden={ui.dice === null} aria-live="polite">
              {Array.from({ length: 6 }, (_, i) => (
                <Die3D
                  key={`${view?.round}-${i}`}
                  value={ui.dice ? ui.dice[i] : null}
                  size={size}
                  index={i}
                />
              ))}
            </div>
          </div>

          <div className={s.mat}>
            {SYMBOL_NAMES.map((name, sym) => {
              const pulse = ui.pulse.includes(sym);
              const count = view?.counts?.[sym] ?? 0;
              return (
                <div
                  key={name}
                  className={s.square}
                  data-pulse={pulse}
                  data-picked={tray && pick === sym}
                  data-dim={ui.dice !== null && !pulse}
                >
                  <button
                    type="button"
                    className={s.squareBtn}
                    onClick={() => setPick(sym)}
                    aria-label={symLabel(sym)}
                    disabled={!canActFor(betSeat)}
                  >
                    <LBSymbol idx={sym} size={vp.landscape ? 36 : 38} />
                    <span className={s.symName} lang="ne">
                      {translate('ne', `lb.sym.${name}`)}
                      <small lang="en">{t(`lb.symLatin.${name}`)}</small>
                    </span>
                  </button>
                  <div className={s.stakes}>
                    {view &&
                      view.bets.map((row, seat) =>
                        row[sym] > 0 ? (
                          <span
                            key={seat}
                            className={`${s.tag} num`}
                            style={{ background: SEAT_COLORS[seat] }}
                            title={nameOf(seat)}
                          >
                            {row[sym]}
                          </span>
                        ) : null,
                      )}
                  </div>
                  {ui.dice && count > 0 && <span className={`${s.count} num`}>{count}</span>}
                </div>
              );
            })}
          </div>
        </div>

        <div className={s.history} aria-label={t('lb.history')}>
          {(view?.history ?? [])
            .slice(-20)
            .reverse()
            .map((h, k) => (
              <div key={k} className={s.hRoll} title={h.counts.join(' ')}>
                {h.dice.map((d, i) => (
                  <LBSymbol key={i} idx={d} size={11} />
                ))}
              </div>
            ))}
        </div>

        <div className={s.controls}>
          <div className={s.statusRow} aria-live="polite">
            {view && (
              <span className={s.round}>
                {t('cb.roundOf', { n: view.round + 1, total: view.rounds })}
              </span>
            )}
            <span className={s.say}>{status}</span>
            {session.isAuto(mySeat) && (
              <Button size="small" tone="primary" onClick={() => session.setAuto(mySeat, false)}>
                {t('cb.imBack')}
              </Button>
            )}
          </div>

          {shared && view && view.phase === 'betting' && (
            <div className={s.pickers} role="radiogroup" aria-label={t('lb.whoBets')}>
              {players.map((p, i) =>
                i === view.banker || p.isBot ? null : (
                  <button
                    key={i}
                    type="button"
                    role="radio"
                    aria-checked={active === i}
                    data-on={active === i}
                    data-done={view.ready[i]}
                    className={s.picker}
                    style={{ ['--c' as string]: SEAT_COLORS[i] }}
                    onClick={() => setActive(i)}
                  >
                    {p.name}
                  </button>
                ),
              )}
            </div>
          )}

          {tray && (
            <div className={s.tray}>
              <StakeField
                label={t('lb.stakeFor', { sym: symLabel(pick) })}
                value={myBets[pick]}
                step={view!.config.step}
                min={view!.config.minBet}
                max={Math.min(view!.config.maxBet, left + myBets[pick])}
                check={checkStake(pick)}
                disabled={!canActFor(betSeat)}
                onChange={(n) => setStake(pick, n)}
              />
              <div className={s.totalRow}>
                <span className="num">{t('lb.total', { n: total.toLocaleString('en-US') })}</span>
                <span className="num">
                  {t('lb.chipsLeft', { n: left.toLocaleString('en-US') })}
                </span>
              </div>
              {view?.canReady || (shared && legalFor(betSeat).some((a) => a.type === 'ready')) ? (
                <Button
                  tone="primary"
                  disabled={!canActFor(betSeat)}
                  onClick={() => submit(betSeat, { type: 'ready' })}
                >
                  {t('lb.lockBets')}
                </Button>
              ) : (
                <Button disabled>{t('lb.lockBets')}</Button>
              )}
            </div>
          )}

          {isBanker && view && (
            <div className={s.bankerBtns}>
              {view.canClose && !busy && (
                <Button tone="primary" onClick={() => submit(mySeat, { type: 'close' })}>
                  {t('lb.closeBets')}
                </Button>
              )}
              {view.canRoll && !busy && (
                <Button tone="primary" onClick={() => submit(mySeat, { type: 'roll' })}>
                  {t('lb.shake')}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </TableShell>
  );
}
