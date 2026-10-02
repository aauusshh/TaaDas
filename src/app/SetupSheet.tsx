import { Suspense, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadGame } from '../engine/registry';
import type {
  AnyGame,
  ConfigField,
  Difficulty,
  GameConfig,
  GameId,
  PlayerInfo,
} from '../engine/core/types';
import { useT } from '../i18n/t';
import { useProfile } from '../storage/profile';
import {
  loadHouseRules,
  loadSetup,
  saveHouseRules,
  saveSetup,
  type HouseRule,
  type SetupMemory,
} from '../storage/saves';
import { Button } from '../ui/components/Button';
import { Segmented, Stepper, Toggle } from '../ui/components/Controls';
import { BottomSheet, Dialog, useToast } from '../ui/components/Overlays';
import { createRoom } from './roomStore';
import { AVATAR_IDS } from '../ui/components/Avatar';
import { sound } from '../ui/sound/SoundManager';
import { BOT_NAMES, quickStart, useLaunch } from './launch';
import { rulesPages } from './rulesRegistry';
import s from './SetupSheet.module.css';

type Mode = SetupMemory['mode'];
interface Row {
  name: string;
  human: boolean;
  difficulty: Difficulty;
}

const TIMERS = [0, 15, 30, 60];
const BOT_AVATARS = ['danphe', 'tiger', 'rhino', 'diyo', 'kite', 'madal', 'momo', 'leopard'];

function defaultRows(count: number, you: string, saved: string[], diff: Difficulty): Row[] {
  const pool = saved.length >= count ? saved : BOT_NAMES;
  return Array.from({ length: Math.max(count, 8) }, (_, i) => ({
    name: i === 0 ? you : pool[(i * 3 + 1) % pool.length],
    human: i === 0,
    difficulty: diff,
  }));
}

export function FieldRow({
  field,
  value,
  onChange,
}: {
  field: ConfigField;
  value: GameConfig[string];
  onChange: (v: GameConfig[string]) => void;
}) {
  const t = useT();
  const label = t(field.labelKey);
  return (
    <div className={s.field}>
      <div className={s.fieldHead}>
        <span className={s.fieldLabel}>{label}</span>
        {field.type === 'toggle' && <Toggle label={label} checked={!!value} onChange={onChange} />}
        {field.type === 'number' && (
          <Stepper
            label={label}
            value={Number(value)}
            min={field.min}
            max={field.max}
            step={field.step}
            onChange={onChange}
          />
        )}
      </div>
      {field.type === 'select' && (
        <Segmented<string | number>
          label={label}
          value={value as string | number}
          onChange={onChange}
          options={field.options.map((o) => ({
            value: o.value as string | number,
            label: t(o.labelKey),
          }))}
        />
      )}
      {field.hintKey && <p className={s.hint}>{t(field.hintKey)}</p>}
    </div>
  );
}

export function SetupSheet({ gameId, onClose }: { gameId: GameId; onClose: () => void }) {
  const t = useT();
  const nav = useNavigate();
  const profile = useProfile();
  const setLaunch = useLaunch((l) => l.set);
  const [game, setGame] = useState<AnyGame | null>(null);

  useEffect(() => {
    let live = true;
    loadGame(gameId)
      .then((g) => live && setGame(g))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [gameId]);

  if (!game) {
    return (
      <BottomSheet open onClose={onClose} title={t(`game.${gameId}`)}>
        <p>{t('common.loading')}</p>
      </BottomSheet>
    );
  }
  return (
    <SetupBody
      game={game}
      onClose={onClose}
      nav={nav}
      profileName={profile.name}
      setLaunch={setLaunch}
      savedNames={profile.names}
    />
  );
}

function SetupBody({
  game,
  onClose,
  nav,
  profileName,
  setLaunch,
  savedNames,
}: {
  game: AnyGame;
  onClose: () => void;
  nav: ReturnType<typeof useNavigate>;
  profileName: string;
  setLaunch: (l: ReturnType<typeof useLaunch.getState>['launch']) => void;
  savedNames: string[];
}) {
  const t = useT();
  const toast = useToast();
  const memory = useMemo(() => loadSetup(game.id), [game.id]);
  const fixed = game.minPlayers === game.maxPlayers;
  const [mode, setMode] = useState<Mode>(
    memory?.mode === 'local' || memory?.mode === 'online' ? memory.mode : 'bots',
  );
  const [count, setCount] = useState(
    Math.min(
      game.maxPlayers,
      Math.max(game.minPlayers, memory?.count ?? Math.min(4, game.maxPlayers)),
    ),
  );
  const [difficulty, setDifficulty] = useState<Difficulty>(memory?.difficulty ?? 'medium');
  const [rows, setRows] = useState<Row[]>(() =>
    defaultRows(game.maxPlayers, profileName, savedNames, memory?.difficulty ?? 'medium'),
  );
  const [config, setConfig] = useState<GameConfig>({
    ...game.defaultConfig,
    ...(memory?.config ?? {}),
  });
  const [timerSec, setTimerSec] = useState(memory?.timerSec ?? 0);
  const [hints, setHints] = useState(memory?.hints ?? false);
  const [house, setHouse] = useState<HouseRule[]>(() => loadHouseRules(game.id));
  const [presetId, setPresetId] = useState('standard');
  const [saveOpen, setSaveOpen] = useState(false);
  const [houseName, setHouseName] = useState('');

  const groups = useMemo(() => {
    const out: { group: string; fields: ConfigField[] }[] = [];
    for (const f of game.configSchema) {
      const g = out.find((x) => x.group === f.group);
      if (g) g.fields.push(f);
      else out.push({ group: f.group, fields: [f] });
    }
    return out;
  }, [game]);

  const presetOptions = [
    ...game.presets.map((p) => ({ id: p.id, name: t(p.nameKey), config: p.config as GameConfig })),
    ...house.map((h) => ({ id: `house:${h.id}`, name: h.name, config: h.config as GameConfig })),
  ];
  const applyPreset = (id: string) => {
    setPresetId(id);
    const p = presetOptions.find((x) => x.id === id);
    if (p) setConfig({ ...game.defaultConfig, ...p.config });
  };
  const setField = (key: string, v: GameConfig[string]) => {
    setConfig((c) => ({ ...c, [key]: v }));
    setPresetId('custom');
  };

  const update = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, k) => (k === i ? { ...r, ...patch } : r)));

  const seats = fixed ? game.maxPlayers : count;
  const active = rows.slice(0, seats);
  const humansCount = mode === 'bots' ? 1 : active.filter((r) => r.human).length;
  const [busy, setBusy] = useState(false);
  const canStart = mode === 'online' ? !busy : humansCount >= 1;

  const createOnline = async () => {
    setBusy(true);
    try {
      saveSetup(game.id, { mode, count: seats, timerSec, hints, difficulty, config });
      const host = await createRoom({
        gameId: game.id,
        config,
        seatCount: seats,
        timerSec,
        relay: false,
      });
      nav(`/room/${host.code}`);
    } catch (e) {
      const m = (e as Error).message;
      toast.show(
        m === 'timeout' ? t('room.err.timeout', { code: '' }) : t('room.createFailed'),
        5000,
      );
      setBusy(false);
    }
  };

  const start = () => {
    if (mode === 'online') {
      void createOnline();
      return;
    }
    sound.play('place');
    const players: PlayerInfo[] = active.map((r, i) => {
      const human = mode === 'bots' ? i === 0 : r.human;
      const name = (r.name.trim() || (human ? profileName : BOT_NAMES[i])).slice(0, 16);
      return {
        id: `p${i}`,
        name,
        avatar: human
          ? i === 0 && mode === 'bots'
            ? useProfile.getState().avatar
            : AVATAR_IDS[(i * 5 + 2) % AVATAR_IDS.length]
          : BOT_AVATARS[i % BOT_AVATARS.length],
        isBot: !human,
        difficulty: r.difficulty,
      };
    });
    if (mode === 'bots') useProfile.getState().patch({ name: players[0].name });
    useProfile.getState().patch({
      names: players.filter((p) => p.isBot).map((p) => p.name),
    });
    saveSetup(game.id, { mode, count: seats, timerSec, hints, difficulty, config });
    const forced: GameConfig = { ...config, ...(game.modeConfig?.(mode) ?? {}) };
    // playing alone stakes the profile chips in every chip game
    if ('startChips' in game.defaultConfig && mode === 'bots') {
      forced.startChips = Math.max(500, useProfile.getState().chips);
    }
    if (game.id === 'langurburja' && mode === 'bots') {
      players[players.length - 1] = {
        ...players[players.length - 1],
        name: t('lb.house'),
        avatar: 'bell',
      };
    }
    setLaunch({
      gameId: game.id,
      players,
      config: forced,
      hints: mode === 'bots' && hints,
      timerSec,
      mode,
    });
    nav(`/play/${game.id}`);
  };

  const practice = () => {
    sound.play('place');
    const players = Math.min(4, game.maxPlayers);
    const forced: GameConfig = { ...game.defaultConfig, ...(game.modeConfig?.('bots') ?? {}) };
    if ('startChips' in game.defaultConfig)
      forced.startChips = Math.max(500, useProfile.getState().chips);
    const launch = quickStart(
      game.id,
      game.minPlayers === game.maxPlayers ? game.maxPlayers : players,
      forced,
    );
    if (game.id === 'langurburja') {
      launch.players[launch.players.length - 1] = {
        ...launch.players[launch.players.length - 1],
        name: t('lb.house'),
        avatar: 'bell',
      };
    }
    setLaunch({ ...launch, hints: true, timerSec: 0, mode: 'bots' });
    nav(`/play/${game.id}`);
  };

  const Rules = rulesPages[game.id];
  const [rulesOpen, setRulesOpen] = useState(false);

  const saveHouse = () => {
    const name = houseName.trim().slice(0, 24);
    if (!name) return;
    const rule: HouseRule = { id: String(Date.now()), name, config };
    const next = [...house, rule];
    setHouse(next);
    saveHouseRules(game.id, next);
    setPresetId(`house:${rule.id}`);
    setSaveOpen(false);
    setHouseName('');
  };
  const deleteHouse = () => {
    const id = presetId.replace('house:', '');
    const next = house.filter((h) => h.id !== id);
    setHouse(next);
    saveHouseRules(game.id, next);
    setPresetId('standard');
    setConfig({ ...game.defaultConfig });
  };

  return (
    <BottomSheet open onClose={onClose} title={t(game.nameKey)} tall>
      <div className={s.helpRow}>
        {Rules && (
          <Button size="small" onClick={() => setRulesOpen(true)}>
            {t('common.rules')}
          </Button>
        )}
        <Button size="small" onClick={practice}>
          {t('setup.practice')}
        </Button>
      </div>
      {Rules && (
        <BottomSheet
          open={rulesOpen}
          onClose={() => setRulesOpen(false)}
          title={t('common.rules')}
          tall
        >
          <Suspense fallback={<p>{t('common.loading')}</p>}>
            <Rules />
          </Suspense>
          <div className={s.footer}>
            <Button tone="primary" onClick={practice}>
              {t('setup.practice')}
            </Button>
          </div>
        </BottomSheet>
      )}
      <Segmented<Mode>
        label={t('setup.mode')}
        value={mode}
        onChange={(m) => {
          setMode(m);
          if (m === 'online' && timerSec === 0) setTimerSec(30);
        }}
        options={[
          { value: 'bots', label: t('setup.mode.bots') },
          ...(game.supports.passAndPlay
            ? [{ value: 'local' as Mode, label: t('setup.mode.local') }]
            : []),
          ...(game.supports.online
            ? [{ value: 'online' as Mode, label: t('setup.mode.online') }]
            : []),
        ]}
      />

      {
        <>
          {!fixed && (
            <div className={s.field}>
              <div className={s.fieldHead}>
                <span className={s.fieldLabel}>{t('setup.playerCount')}</span>
                <Stepper
                  label={t('setup.playerCount')}
                  value={count}
                  min={game.minPlayers}
                  max={game.maxPlayers}
                  onChange={setCount}
                />
              </div>
            </div>
          )}

          {mode !== 'online' && (
            <>
              <h3 className={s.group}>{t('setup.players')}</h3>
              <ul className={s.players}>
                {active.map((r, i) => {
                  const human = mode === 'bots' ? i === 0 : r.human;
                  return (
                    <li key={i} className={s.player}>
                      <input
                        className={s.name}
                        value={r.name}
                        maxLength={16}
                        aria-label={t('setup.nameOf', { n: i + 1 })}
                        onChange={(e) => update(i, { name: e.target.value })}
                      />
                      {mode === 'local' && (
                        <Segmented<string>
                          label={t('setup.kind')}
                          value={r.human ? 'human' : 'bot'}
                          onChange={(v) => update(i, { human: v === 'human' })}
                          options={[
                            { value: 'human', label: t('setup.person') },
                            { value: 'bot', label: t('common.bot') },
                          ]}
                        />
                      )}
                      {!human && (
                        <Segmented<Difficulty>
                          label={t('setup.difficulty')}
                          value={r.difficulty}
                          onChange={(v) => {
                            update(i, { difficulty: v });
                            setDifficulty(v);
                          }}
                          options={[
                            { value: 'easy', label: t('diff.easy') },
                            { value: 'medium', label: t('diff.medium') },
                            { value: 'hard', label: t('diff.hard') },
                          ]}
                        />
                      )}
                      {human && mode === 'bots' && <span className={s.you}>{t('common.you')}</span>}
                    </li>
                  );
                })}
              </ul>
              {humansCount < 1 && <p className={s.warn}>{t('setup.needPerson')}</p>}
            </>
          )}

          <h3 className={s.group}>{t('setup.ruleSet')}</h3>
          <div className={s.presetRow}>
            <select
              className={s.select}
              aria-label={t('setup.ruleSet')}
              value={presetId}
              onChange={(e) => applyPreset(e.target.value)}
            >
              {presetOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
              {presetId === 'custom' && <option value="custom">{t('setup.custom')}</option>}
            </select>
            <Button size="small" onClick={() => setSaveOpen(true)}>
              {t('setup.saveHouse')}
            </Button>
            {presetId.startsWith('house:') && (
              <Button size="small" tone="quiet" onClick={deleteHouse}>
                {t('setup.deleteHouse')}
              </Button>
            )}
          </div>

          {groups.map((g) => (
            <section key={g.group}>
              <h3 className={s.group}>{t(`group.${g.group}`)}</h3>
              {g.fields.map((f) => (
                <FieldRow
                  key={f.key}
                  field={f}
                  value={config[f.key]}
                  onChange={(v) => setField(f.key, v)}
                />
              ))}
            </section>
          ))}

          <h3 className={s.group}>{t('setup.table')}</h3>
          <div className={s.field}>
            <div className={s.fieldHead}>
              <span className={s.fieldLabel}>{t('setup.timer')}</span>
            </div>
            <Segmented<number>
              label={t('setup.timer')}
              value={timerSec}
              onChange={setTimerSec}
              options={TIMERS.map((v) => ({
                value: v,
                label: v === 0 ? t('common.off') : `${v} s`,
              }))}
            />
          </div>
          {mode === 'bots' && (
            <div className={s.field}>
              <div className={s.fieldHead}>
                <span className={s.fieldLabel}>{t('setup.hints')}</span>
                <Toggle label={t('setup.hints')} checked={hints} onChange={setHints} />
              </div>
            </div>
          )}
        </>
      }

      <div className={s.footer}>
        <Button tone="primary" disabled={!canStart} onClick={start}>
          {mode === 'online' ? t('room.create') : t('common.play')}
        </Button>
      </div>

      <Dialog
        open={saveOpen}
        title={t('setup.saveHouse')}
        onClose={() => setSaveOpen(false)}
        actions={
          <>
            <Button tone="quiet" onClick={() => setSaveOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button tone="primary" disabled={!houseName.trim()} onClick={saveHouse}>
              {t('setup.saveHouseOk')}
            </Button>
          </>
        }
      >
        <input
          className={s.name}
          value={houseName}
          maxLength={24}
          placeholder={t('setup.houseName')}
          aria-label={t('setup.houseName')}
          onChange={(e) => setHouseName(e.target.value)}
        />
      </Dialog>
    </BottomSheet>
  );
}
