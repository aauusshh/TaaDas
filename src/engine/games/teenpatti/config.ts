import type { ConfigField, Preset } from '../../core/types';

export interface TeenPattiConfig extends Record<string, boolean | number | string> {
  boot: number;
  variant: 'classic' | 'muflis' | 'ak47' | 'joker';
  a23: 'second' | 'lowest';
  maxBlind: number;
  maxStakeMult: number;
  potLimitMult: number;
  tieShow: 'asker' | 'split';
  sideShow: boolean;
  autoChaal: boolean;
  rounds: number;
  startChips: number;
  direction: 'ccw' | 'cw';
}

export const defaultConfig: TeenPattiConfig = {
  boot: 10,
  variant: 'classic',
  a23: 'second',
  maxBlind: 4,
  maxStakeMult: 128,
  potLimitMult: 1024,
  tieShow: 'asker',
  sideShow: true,
  autoChaal: false,
  rounds: 5,
  startChips: 5000,
  direction: 'ccw',
};

export const configSchema: ConfigField[] = [
  {
    key: 'variant',
    type: 'select',
    labelKey: 'tp.variant',
    group: 'game',
    default: 'classic',
    options: ['classic', 'muflis', 'ak47', 'joker'].map((v) => ({
      value: v,
      labelKey: `tp.variant.${v}`,
    })),
  },
  {
    key: 'rounds',
    type: 'select',
    labelKey: 'tp.rounds',
    group: 'game',
    default: 5,
    options: [3, 5, 10].map((v) => ({ value: v, labelKey: `tp.rounds.${v}` })),
  },
  {
    key: 'startChips',
    type: 'select',
    labelKey: 'lb.startChips',
    group: 'game',
    default: 5000,
    options: [1000, 5000, 10000].map((v) => ({ value: v, labelKey: `lb.chips.${v}` })),
  },
  {
    key: 'direction',
    type: 'select',
    labelKey: 'common.direction',
    group: 'game',
    default: 'ccw',
    options: [
      { value: 'ccw', labelKey: 'common.ccw' },
      { value: 'cw', labelKey: 'common.cw' },
    ],
  },
  {
    key: 'boot',
    type: 'number',
    stake: true,
    labelKey: 'tp.boot',
    group: 'betting',
    default: 10,
    min: 5,
    max: 1000,
    step: 5,
  },
  {
    key: 'maxBlind',
    type: 'number',
    labelKey: 'tp.maxBlind',
    hintKey: 'tp.maxBlindHint',
    group: 'betting',
    default: 4,
    min: 1,
    max: 8,
  },
  {
    key: 'maxStakeMult',
    type: 'select',
    labelKey: 'tp.maxStake',
    group: 'betting',
    default: 128,
    options: [32, 64, 128, 256].map((v) => ({ value: v, labelKey: `tp.times.${v}` })),
  },
  {
    key: 'potLimitMult',
    type: 'select',
    labelKey: 'tp.potLimit',
    hintKey: 'tp.potLimitHint',
    group: 'betting',
    default: 1024,
    options: [256, 512, 1024, 2048].map((v) => ({ value: v, labelKey: `tp.times.${v}` })),
  },
  { key: 'sideShow', type: 'toggle', labelKey: 'tp.sideShow', group: 'rules', default: true },
  {
    key: 'tieShow',
    type: 'select',
    labelKey: 'tp.tieShow',
    group: 'rules',
    default: 'asker',
    options: [
      { value: 'asker', labelKey: 'tp.tie.asker' },
      { value: 'split', labelKey: 'tp.tie.split' },
    ],
  },
  {
    key: 'a23',
    type: 'select',
    labelKey: 'tp.a23',
    group: 'rules',
    default: 'second',
    options: [
      { value: 'second', labelKey: 'tp.a23.second' },
      { value: 'lowest', labelKey: 'tp.a23.lowest' },
    ],
  },
  {
    key: 'autoChaal',
    type: 'toggle',
    labelKey: 'tp.autoChaal',
    hintKey: 'tp.autoChaalHint',
    group: 'rules',
    default: false,
  },
];

export const presets: Preset<TeenPattiConfig>[] = [
  { id: 'standard', nameKey: 'preset.standard', config: {} },
  { id: 'muflis', nameKey: 'tp.variant.muflis', config: { variant: 'muflis' } },
  { id: 'ak47', nameKey: 'tp.variant.ak47', config: { variant: 'ak47' } },
  { id: 'joker', nameKey: 'tp.variant.joker', config: { variant: 'joker' } },
];
