import { Suspense, useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useT } from '../i18n/t';
import type { GameId } from '../engine/core/types';
import type { HostSession } from '../net/host';
import type { ClientSession } from '../net/client';
import type { Lobby } from '../net/protocol';
import type { Session } from '../session/types';
import { clearToken } from '../storage/rooms';
import { saveHostRoom } from '../storage/rooms';
import { Button } from '../ui/components/Button';
import { ResultPanel } from '../ui/table/ResultPanel';
import { LobbyView } from './LobbyView';
import { useRoom } from './roomStore';
import { Loading, tables } from './tables';
import s from './RoomScreen.module.css';

function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let live = true;
    const request = async () => {
      try {
        lock = await navigator.wakeLock.request('screen');
      } catch {
        /* not allowed right now (battery saver, hidden tab) */
      }
    };
    void request();
    const onVis = () => document.visibilityState === 'visible' && live && void request();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      live = false;
      document.removeEventListener('visibilitychange', onVis);
      void lock?.release().catch(() => undefined);
    };
  }, [active]);
}

function OnlineTable({
  session,
  host,
  onLeave,
  banner,
}: {
  session: Session;
  host: HostSession | null;
  onLeave: () => void;
  banner?: React.ReactNode;
}) {
  const t = useT();
  const gameId = (session as { gameId: GameId }).gameId;
  const Table = tables[gameId];
  const [, bump] = useState(0);
  useEffect(() => {
    const c = session as unknown as ClientSession;
    return c.subscribeState ? c.subscribeState(() => bump((n) => n + 1)) : undefined;
  }, [session]);
  useWakeLock(!!host);
  useEffect(() => {
    if (!host) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [host]);
  if (!Table) return <Loading />;
  const seat = typeof session.mySeat === 'number' ? session.mySeat : 0;
  return (
    <Suspense fallback={null}>
      <Table
        key={session.generation ?? 0}
        session={session}
        mySeat={seat}
        players={session.players}
        hints={false}
        handHidden={false}
        canRematch={!!host}
        online
        onLeave={onLeave}
        onRematch={() => host?.rematch()}
      />
      {host && <p className={s.hostNote}>{t('room.hostNote')}</p>}
      {banner}
    </Suspense>
  );
}

function HostRoom({ host }: { host: HostSession }) {
  const nav = useNavigate();
  const [lobby, setLobby] = useState<Lobby>(host.getLobby());
  useEffect(() => host.subscribeLobby(setLobby), [host]);
  const leave = () => {
    host.close();
    saveHostRoom(null);
    useRoom.getState().setHost(null);
    nav('/', { replace: true });
  };
  if (!lobby.started) return <LobbyView lobby={lobby} host={host} onLeave={leave} />;
  return <OnlineTable session={host} host={host} onLeave={leave} />;
}

function Countdown({ until }: { until: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const left = Math.max(0, Math.ceil((until - now) / 1000));
  return (
    <span className="num">
      {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
    </span>
  );
}

function ClientRoom({ client }: { client: ClientSession }) {
  const t = useT();
  const nav = useNavigate();
  const [, bump] = useState(0);
  useEffect(() => client.subscribeState(() => bump((n) => n + 1)), [client]);
  const leave = () => {
    const code = client.lobby?.code;
    client.leave();
    if (code) clearToken(code);
    useRoom.getState().setClient(null);
    nav('/', { replace: true });
  };
  if (client.state === 'kicked') {
    return (
      <ResultPanel
        title={t('room.kickedTitle')}
        actions={
          <Button tone="primary" onClick={leave}>
            {t('common.home')}
          </Button>
        }
      >
        <p>{t('room.kickedBody')}</p>
      </ResultPanel>
    );
  }
  if (client.state === 'closed') {
    return (
      <ResultPanel
        title={t('room.closedTitle')}
        actions={
          <Button tone="primary" onClick={leave}>
            {t('common.home')}
          </Button>
        }
      >
        <p>{t('room.closedBody')}</p>
      </ResultPanel>
    );
  }
  const waiting = client.state === 'waitingHost';
  const banner = waiting ? (
    <ResultPanel
      title={t('room.waitingHost')}
      actions={<Button onClick={leave}>{t('common.leaveTable')}</Button>}
    >
      <p>
        {t('room.waitingHostBody')} <Countdown until={client.deadline} />
      </p>
    </ResultPanel>
  ) : null;
  if (client.state === 'lobby' && client.lobby) {
    return (
      <>
        <LobbyView lobby={client.lobby} client={client} onLeave={leave} />
        {banner}
      </>
    );
  }
  if (client.state === 'playing' || waiting) {
    if (!client.lobby) return <Loading />;
    return <OnlineTable session={client} host={null} onLeave={leave} banner={banner} />;
  }
  return <Loading />;
}

export function RoomScreen() {
  const { code } = useParams();
  const host = useRoom((r) => r.host);
  const client = useRoom((r) => r.client);
  if (host && host.code === code) return <HostRoom host={host} />;
  if (client && client.lobby?.code === code) return <ClientRoom client={client} />;
  return <Navigate to={`/join/${code ?? ''}`} replace />;
}
