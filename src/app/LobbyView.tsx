import { GameName, gameLabel } from '../ui/components/GameName';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { ArrowDown, ArrowUp, Share2, Copy, X } from 'lucide-react';
import { loadGame } from '../engine/registry';
import type { AnyGame, ConfigField, Difficulty, GameId } from '../engine/core/types';
import { t as tr, useT } from '../i18n/t';
import { useSettings } from '../storage/settings';
import { HostSession } from '../net/host';
import type { ClientSession } from '../net/client';
import type { Lobby } from '../net/protocol';
import { joinLink } from '../net/roomCode';
import { Avatar } from '../ui/components/Avatar';
import { Button } from '../ui/components/Button';
import { Segmented, Stepper, Toggle } from '../ui/components/Controls';
import { BottomSheet, useToast } from '../ui/components/Overlays';
import { hasTurn } from '../config/env';
import { FieldRow } from './SetupSheet';
import s from './LobbyView.module.css';

const TIMERS = [0, 15, 30, 60];

export function shareText(gameId: string, code: string) {
  return tr('room.shareText', {
    game: gameLabel(gameId),
    brand: 'Chautari',
    link: joinLink(code),
  });
}

function ShareBar({ code, gameId }: { code: string; gameId: string }) {
  const t = useT();
  const toast = useToast();
  const [qr, setQr] = useState('');
  useEffect(() => {
    let live = true;
    QRCode.toDataURL(joinLink(code), {
      margin: 1,
      width: 200,
      color: { dark: '#14402f', light: '#fbf8f1' },
    })
      .then((u) => live && setQr(u))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [code]);
  const link = joinLink(code);
  const text = shareText(gameId, code);
  return (
    <div className={s.share}>
      <div className={s.codeBlock}>
        <span className={s.codeLabel}>{t('room.code')}</span>
        <b className={`${s.code} num`} aria-label={code.split('').join(' ')}>
          {code}
        </b>
      </div>
      {qr && <img className={s.qr} src={qr} width={110} height={110} alt={t('room.qrAlt')} />}
      <div className={s.shareBtns}>
        <Button
          size="small"
          tone="primary"
          onClick={async () => {
            try {
              if (navigator.share) await navigator.share({ text, url: link });
              else throw new Error('no share');
            } catch {
              try {
                await navigator.clipboard.writeText(`${text}`);
                toast.show(t('room.copied'));
              } catch {
                toast.show(link, 6000);
              }
            }
          }}
        >
          <Share2 size={18} aria-hidden="true" />
          {t('room.share')}
        </Button>
        <Button
          size="small"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
              toast.show(t('room.copied'));
            } catch {
              toast.show(link, 6000);
            }
          }}
        >
          <Copy size={18} aria-hidden="true" />
          {t('room.copyLink')}
        </Button>
      </div>
    </div>
  );
}

function Dot({ state }: { state: 'good' | 'slow' | 'away' }) {
  return <span className={s.dot} data-state={state} aria-label={`Connection ${state}`} />;
}

export function LobbyView({
  lobby,
  host,
  client,
  onLeave,
}: {
  lobby: Lobby;
  host?: HostSession;
  client?: ClientSession;
  onLeave: () => void;
}) {
  const t = useT();
  const lang = useSettings((x) => x.lang);
  void lang;
  const [game, setGame] = useState<AnyGame | null>(null);
  const [rules, setRules] = useState(false);
  useEffect(() => {
    let live = true;
    loadGame(lobby.gameId as GameId)
      .then((g) => live && setGame(g))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [lobby.gameId]);

  const mySeat = host ? lobby.hostSeat : typeof client?.seat === 'number' ? client.seat : -1;
  const me = lobby.seats[mySeat];
  // Langur Burja rooms open at once and fill as people arrive: only the people here are listed
  const dynamic = lobby.gameId === 'langurburja';
  const filled = lobby.seats.filter((x) => x.kind !== 'empty').length;
  const emptySeats = lobby.seats.length - filled;
  const botCount = lobby.seats.filter((x) => x.kind === 'bot').length;
  const humansNotReady = lobby.seats.some((x) => x.kind === 'human' && !x.ready);
  const groups: { group: string; fields: ConfigField[] }[] = [];
  for (const f of game?.configSchema ?? []) {
    const g = groups.find((x) => x.group === f.group);
    if (g) g.fields.push(f);
    else groups.push({ group: f.group, fields: [f] });
  }

  return (
    <main className={s.page}>
      <header className={s.head}>
        <h1 className="display">
          <GameName id={lobby.gameId} />
        </h1>
        <Button tone="quiet" size="small" onClick={onLeave}>
          <X size={18} aria-hidden="true" />
          {t('common.leaveTable')}
        </Button>
      </header>

      <ShareBar code={lobby.code} gameId={lobby.gameId} />

      {dynamic && (
        <p className={s.small} aria-live="polite">
          {t('room.joined')}: <b className="num">{filled}</b> /{' '}
          <span className="num">{lobby.maxPlayers}</span>. {t('room.openLobby')}
        </p>
      )}
      <ul className={s.seats} aria-label={t('room.joined')}>
        {lobby.seats.map((seat, i) =>
          dynamic && seat.kind === 'empty' ? null : (
            <li
              key={i}
              className={s.seat}
              data-me={i === mySeat}
              data-empty={seat.kind === 'empty'}
            >
              {seat.kind === 'empty' ? (
                <div className={s.emptyAvatar}>{i + 1}</div>
              ) : (
                <Avatar id={seat.avatar} size={44} />
              )}
              <div className={s.who}>
                <span className={s.name}>
                  {seat.kind === 'empty' ? t('room.waiting') : seat.name}
                  {seat.kind === 'bot' && <i className={s.tag}>{t('common.bot')}</i>}
                  {seat.kind === 'host' && <i className={s.tag}>{t('room.host')}</i>}
                  {i === mySeat && seat.kind !== 'host' && (
                    <i className={s.tag}>{t('common.you')}</i>
                  )}
                </span>
                {seat.kind === 'human' && (
                  <span className={s.state}>
                    <Dot state={seat.conn} />
                    {seat.ready ? t('room.ready') : t('room.notReady')}
                  </span>
                )}
                {seat.kind === 'bot' && host && (
                  <Segmented<Difficulty>
                    label={t('setup.difficulty')}
                    value={seat.difficulty}
                    onChange={(v) => host.setBotDifficulty(i, v)}
                    options={[
                      { value: 'easy', label: t('diff.easy') },
                      { value: 'medium', label: t('diff.medium') },
                      { value: 'hard', label: t('diff.hard') },
                    ]}
                  />
                )}
              </div>
              {host && (
                <div className={s.controls}>
                  {seat.kind === 'empty' && lobby.botsEnabled && (
                    <Button size="small" onClick={() => host.addBot(i)}>
                      {t('room.addBot')}
                    </Button>
                  )}
                  {seat.kind === 'bot' && (
                    <Button size="small" tone="quiet" onClick={() => host.removeBot(i)}>
                      {t('room.remove')}
                    </Button>
                  )}
                  {seat.kind === 'human' && (
                    <Button size="small" tone="quiet" onClick={() => host.kick(i)}>
                      {t('room.kick')}
                    </Button>
                  )}
                  {!dynamic && (
                    <>
                      <button
                        type="button"
                        className={s.move}
                        aria-label={t('room.moveUp')}
                        disabled={i === 0}
                        onClick={() => host.swapSeats(i, i - 1)}
                      >
                        <ArrowUp size={18} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className={s.move}
                        aria-label={t('room.moveDown')}
                        disabled={i === lobby.seats.length - 1}
                        onClick={() => host.swapSeats(i, i + 1)}
                      >
                        <ArrowDown size={18} aria-hidden="true" />
                      </button>
                    </>
                  )}
                </div>
              )}
            </li>
          ),
        )}
      </ul>
      {lobby.spectatorCount > 0 && (
        <p className={s.small}>{t('room.watching', { n: lobby.spectatorCount })}</p>
      )}

      {host && (
        <section className={s.panel}>
          <div className={s.row}>
            <span>{dynamic ? t('room.maxPlayers') : t('room.seats')}</span>
            <Stepper
              label={dynamic ? t('room.maxPlayers') : t('room.seats')}
              value={lobby.seats.length}
              min={Math.max(filled, lobby.minPlayers)}
              max={lobby.gameMax}
              onChange={(v) => host.setSeatCount(v)}
            />
          </div>
          <div className={s.row}>
            <span>{t('room.bots')}</span>
            <Toggle
              label={t('room.bots')}
              checked={lobby.botsEnabled}
              onChange={(v) => host.setBotsEnabled(v)}
            />
          </div>
          {lobby.botsEnabled && (
            <div className={s.row}>
              <Button size="small" disabled={emptySeats === 0} onClick={() => host.addBotNext()}>
                {t('room.addBot')}
              </Button>
              <Button
                size="small"
                tone="quiet"
                disabled={botCount === 0}
                onClick={() => host.removeBotLast()}
              >
                {t('room.removeBot')}
              </Button>
            </div>
          )}
          <p className={s.small}>{t('room.botsHint')}</p>
          <div className={s.row}>
            <span>{t('setup.timer')}</span>
            <Segmented<number>
              label={t('setup.timer')}
              value={lobby.timerSec}
              onChange={(v) => host.setTimer(v)}
              options={TIMERS.map((v) => ({
                value: v,
                label: v === 0 ? t('common.off') : `${v} s`,
              }))}
            />
          </div>
          <div className={s.row}>
            <span>{t('room.lock')}</span>
            <Toggle
              label={t('room.lock')}
              checked={lobby.locked}
              onChange={(v) => host.setLocked(v)}
            />
          </div>
          <div className={s.row}>
            <span>{t('room.spectators')}</span>
            <Toggle
              label={t('room.spectators')}
              checked={lobby.spectators}
              onChange={(v) => host.setSpectators(v)}
            />
          </div>
          {hasTurn && (
            <p className={s.small}>{lobby.relay ? t('room.relayOn') : t('room.relayOff')}</p>
          )}
          <div className={s.row}>
            <Button onClick={() => setRules(true)}>{t('common.rules')}</Button>
            <Button tone="primary" disabled={!host.canStart()} onClick={() => host.startGame()}>
              {t('room.start')}
            </Button>
          </div>
          {filled < lobby.minPlayers && (
            <p className={s.small}>{t('room.needMin', { n: lobby.minPlayers })}</p>
          )}
          {humansNotReady && <p className={s.small}>{t('room.waitReady')}</p>}
          <p className={s.small}>{t('room.hostNote')}</p>
        </section>
      )}

      {client && (
        <section className={s.panel}>
          {typeof client.seat === 'number' ? (
            <div className={s.row}>
              <span>{me?.ready ? t('room.ready') : t('room.notReady')}</span>
              <Button tone="primary" onClick={() => client.setReady(!me?.ready)}>
                {me?.ready ? t('room.notReadyBtn') : t('room.readyBtn')}
              </Button>
            </div>
          ) : (
            <p className={s.small}>{t('room.spectatorNote')}</p>
          )}
          <p className={s.small}>{t('room.waitHost')}</p>
          <div className={s.row}>
            <Button tone="quiet" onClick={() => setRules(true)}>
              {t('common.rules')}
            </Button>
          </div>
        </section>
      )}

      <BottomSheet open={rules} onClose={() => setRules(false)} title={t('common.rules')} tall>
        {groups.map((g) => (
          <section key={g.group}>
            <h3 className={s.group}>{t(`group.${g.group}`)}</h3>
            {g.fields.map((f) =>
              host ? (
                <FieldRow
                  key={f.key}
                  field={f}
                  value={lobby.config[f.key]}
                  onChange={(v) => host.setConfig({ ...lobby.config, [f.key]: v })}
                />
              ) : (
                <ReadOnlyRule key={f.key} field={f} value={lobby.config[f.key]} />
              ),
            )}
            {host && g.group === 'payout' && (
              <Button
                size="small"
                onClick={() =>
                  host.setConfig({
                    ...lobby.config,
                    ...Object.fromEntries(g.fields.map((f) => [f.key, f.default])),
                  })
                }
              >
                {t('lb.payReset')}
              </Button>
            )}
          </section>
        ))}
      </BottomSheet>
    </main>
  );
}

function ReadOnlyRule({ field, value }: { field: ConfigField; value: boolean | number | string }) {
  const t = useT();
  let shown: string;
  if (field.type === 'toggle') shown = value ? t('common.on') : t('common.off');
  else if (field.type === 'select')
    shown = t(field.options.find((o) => o.value === value)?.labelKey ?? '') || String(value);
  else shown = String(value);
  return (
    <div className={s.row}>
      <span>{t(field.labelKey)}</span>
      <b>{shown}</b>
    </div>
  );
}
