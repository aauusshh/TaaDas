import { Suspense, lazy, useEffect, useMemo, useState, type ComponentType } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { loadGame } from '../engine/registry';
import type { AnyGame, GameId } from '../engine/core/types';
import { LocalSession } from '../session/LocalSession';
import type { Session } from '../session/types';
import type { TableProps } from '../ui/games/types';
import { quickStart, useLaunch, type Launch } from './launch';
import { useT } from '../i18n/t';

const tables: Partial<Record<GameId, ComponentType<TableProps>>> = {
  callbreak: lazy(() => import('../ui/games/callbreak/CallBreakTable')),
};

export function GameScreen() {
  const { gameId } = useParams();
  const nav = useNavigate();
  const t = useT();
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
  useEffect(() => {
    if (!game || !launch) return;
    const s = new LocalSession({
      game,
      players: launch.players,
      config: { ...game.defaultConfig, ...launch.config },
      seed: launch.seed,
    });
    setSession(s);
    return () => {
      s.dispose();
      setSession(null);
    };
  }, [game, launch, run]);

  const Table = tables[id];
  if (!game || !launch || !session || !Table) {
    return (
      <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}>
        {t('common.loading')}
      </main>
    );
  }
  return (
    <Suspense fallback={null}>
      <Table
        key={run}
        session={session}
        mySeat={0}
        players={launch.players}
        hints={launch.hints}
        onLeave={() => nav('/')}
        onRematch={() => setRun((r) => r + 1)}
      />
    </Suspense>
  );
}
