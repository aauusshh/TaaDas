import { useSettings, type BackId, type Lang, type ThemeId } from '../storage/settings';
import { useT } from '../i18n/t';
import { BottomSheet } from '../ui/components/Overlays';
import { Segmented, Toggle } from '../ui/components/Controls';
import { CardBack } from '../ui/cards/CardFace';
import { sound } from '../ui/sound/SoundManager';
import s from './SettingsSheet.module.css';

function Row({
  label,
  children,
  stack,
}: {
  label: string;
  children: React.ReactNode;
  stack?: boolean;
}) {
  return (
    <div className={`${s.row} ${stack ? s.stack : ''}`}>
      <span className={s.label}>{label}</span>
      {children}
    </div>
  );
}

const THEMES: ThemeId[] = ['classic', 'dhaka', 'sal', 'tihar'];
const BACKS: BackId[] = ['dhaka', 'indigo', 'forest'];

export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const st = useSettings();
  return (
    <BottomSheet open={open} onClose={onClose} title={t('settings.title')} tall>
      <Row label={t('settings.language')}>
        <Segmented<Lang>
          label={t('settings.language')}
          value={st.lang}
          onChange={(v) => st.set('lang', v)}
          options={[
            { value: 'en', label: 'English' },
            { value: 'ne', label: 'नेपाली' },
          ]}
        />
      </Row>
      <Row label={t('settings.sound')}>
        <Toggle
          label={t('settings.sound')}
          checked={st.sound}
          onChange={(v) => st.set('sound', v)}
        />
      </Row>
      <Row label={t('settings.volume')}>
        <input
          className={s.range}
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={st.volume}
          aria-label={t('settings.volume')}
          onChange={(e) => st.set('volume', Number(e.target.value))}
          onPointerUp={() => sound.play('place')}
        />
      </Row>
      <Row label={t('settings.haptics')}>
        <Toggle
          label={t('settings.haptics')}
          checked={st.haptics}
          onChange={(v) => st.set('haptics', v)}
        />
      </Row>
      <Row label={t('settings.animSpeed')}>
        <Segmented<number>
          label={t('settings.animSpeed')}
          value={st.animSpeed}
          onChange={(v) => st.set('animSpeed', v as 0.5 | 1 | 1.5)}
          options={[
            { value: 0.5, label: '0.5x' },
            { value: 1, label: '1x' },
            { value: 1.5, label: '1.5x' },
          ]}
        />
      </Row>
      <Row label={t('settings.reduceMotion')}>
        <Toggle
          label={t('settings.reduceMotion')}
          checked={st.reduceMotion}
          onChange={(v) => st.set('reduceMotion', v)}
        />
      </Row>
      <Row label={t('settings.theme')} stack>
        <Segmented<ThemeId>
          label={t('settings.theme')}
          value={st.theme}
          onChange={(v) => st.set('theme', v)}
          options={THEMES.map((v) => ({ value: v, label: t(`theme.${v}`) }))}
        />
      </Row>
      <Row label={t('settings.cardBack')} stack>
        <div className={s.backs} role="radiogroup" aria-label={t('settings.cardBack')}>
          {BACKS.map((b) => (
            <button
              key={b}
              type="button"
              role="radio"
              aria-checked={st.cardBack === b}
              data-on={st.cardBack === b}
              className={s.backBtn}
              onClick={() => st.set('cardBack', b)}
            >
              <CardBack variant={b} style={{ width: 42 }} />
              <span>{t(`back.${b}`)}</span>
            </button>
          ))}
        </div>
      </Row>
      <Row label={t('settings.fourColor')}>
        <Toggle
          label={t('settings.fourColor')}
          checked={st.fourColor}
          onChange={(v) => st.set('fourColor', v)}
        />
      </Row>
      <Row label={t('settings.leftHanded')}>
        <Toggle
          label={t('settings.leftHanded')}
          checked={st.leftHanded}
          onChange={(v) => st.set('leftHanded', v)}
        />
      </Row>
      <Row label={t('settings.showPlayable')}>
        <Toggle
          label={t('settings.showPlayable')}
          checked={st.showPlayable}
          onChange={(v) => st.set('showPlayable', v)}
        />
      </Row>
      <Row label={t('settings.autoSort')}>
        <Toggle
          label={t('settings.autoSort')}
          checked={st.autoSort}
          onChange={(v) => st.set('autoSort', v)}
        />
      </Row>
    </BottomSheet>
  );
}
