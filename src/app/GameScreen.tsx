import { Suspense, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { loadGame } from '../engine/registry';
import type { AnyGame, GameId } from '../engine/core/types';
import { LocalSession } from '../session/LocalSession';
import type { Session } from '../session/types';
import { PassCover } from '../ui/table/PassCover';
import { clearSave, loadSave, writeSave } from '../storage/saves';
import { useStats } from '../storage/stats';
import { useProfile } from '../storage/profile';
import { quickStart, useLaunch, type Launch } from './launch';
import { Loading, tables } from './tables';

export function GameScreen() {
  const { gameId } = useParams();
  const nav = useNavigate();
  const stored = useLaunch((s) => s.launch);
  const [game, setGame] = useState<AnyGame | null>(null);
  const [run, setRun] = useState(0);
  const id = gameId as GameId;

  useEffect(() => {
    let live = true;
    loadGame(id)
      .then((g) => live && setGame(g))
      .catch(() => live && nav('/', { replace: true }));
    return () => {
      live = false;
    };
  }, [id, nav]);

  const launch: Launch | null = useMemo(() => {
    if (!game) return null;
    if (stored && stored.gameId === id) return stored;
    return quickStart(
      id,
      game.maxPlayers === game.minPlayers ? game.maxPlayers : 4,
      game.defaultConfig,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, id]);

  const [session, setSession] = useState<Session | null>(null);
  const [players, setPlayers] = useState(launch?.players ?? []);

  useEffect(() => {
    if (!game || !launch) return;
    const saved = launch.resume && run === 0 ? loadSave() : null;
    const meta = saved ? saved.meta : { hints: launch.hints, timerSec: launch.timerSec ?? 0 };
    const onSave = (snapshot: Parameters<typeof writeSave>[0]) => writeSave(snapshot, meta);
    const s = saved
      ? LocalSession.restore({ game, timerSec: meta.timerSec, onSave }, saved.snapshot)
      : new LocalSession({
          game,
          players: launch.players,
          config: { ...game.defaultConfig, ...launch.config },
          seed: launch.seed,
          timerSec: meta.timerSec,
          onSave,
        });
    setPlayers(s.players);
    let recorded = false;
    const check = () => {
      const r = s.result();
      if (!r || recorded) return;
      recorded = true;
      clearSave();
      if (r.chipDelta && launch.mode === 'bots') {
        const you = s.players.findIndex((p) => !p.isBot);
        if (you >= 0) useProfile.getState().addChips(r.chipDelta[you]);
      }
      for (let seat = 0; seat < s.players.length; seat++) {
        if (!s.players[seat].isBot) useStats.getState().record(id, r.winners.includes(seat));
      }
    };
    const unsub = s.subscribe(check);
    check();
    setSession(s);
    return () => {
      unsub();
      s.dispose();
      setSession(null);
    };
  }, [game, launch, run, id]);

  const hints = launch?.hints ?? false;
  const humans = useMemo(
    () => players.map((p, i) => (p.isBot ? -1 : i)).filter((i) => i >= 0),
    [players],
  );
  const multi = humans.length > 1 && !game?.sharedScreen;
  const [viewSeat, setViewSeat] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [tick, bump] = useState(0);

  useEffect(() => {
    if (!session) return;
    setViewSeat(humans[0] ?? 0);
    setRevealed(!multi);
    return session.subscribe(() => bump((n) => n + 1));
  }, [session, humans, multi]);

  useEffect(() => {
    if (!multi) return;
    const onHide = () => document.hidden && setRevealed(false);
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [multi]);

  const actors = session ? session.currentActors() : [];
  const play = session ? session.isPlayPhase() : false;
  const humanActor = session
    ? actors.find((a) => humans.includes(a) && !session.isAuto(a))
    : undefined;
  const needCover =
    multi && play && humanActor !== undefined && !(humanActor === viewSeat && revealed);
  const canSee = !multi || (play && actors.includes(viewSeat) && revealed);

  useEffect(() => {
    if (multi && revealed && session && !session.currentActors().includes(viewSeat))
      setRevealed(false);
  }, [multi, revealed, session, viewSeat, tick]);

  const Table = tables[id];
  if (!game || !launch || !session || !Table) return <Loading />;
  return (
    <Suspense fallback={null}>
      <Table
        key={`${run}-${viewSeat}`}
        session={session}
        mySeat={viewSeat}
        players={players}
        hints={hints && !multi}
        handHidden={!canSee}
        canRematch
        online={false}
        onLeave={() => nav('/')}
        onRematch={() => {
          clearSave();
          setRun((r) => r + 1);
        }}
      />
      {needCover && humanActor !== undefined && (
        <PassCover
          player={players[humanActor]}
          onReveal={() => {
            setViewSeat(humanActor);
            setRevealed(true);
          }}
        />
      )}
    </Suspense>
  );
}
