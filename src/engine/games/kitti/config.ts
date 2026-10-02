import type { ConfigField, Preset } from '../../core/types';

export interface KittiConfig extends Record<string, boolean | number | string> {
  boot: number;
  a23: 'second' | 'lowest';
  top235: boolean;
  descending: boolean;
  tieRule: 'none' | 'earlier';
  winRule: 'any2' | 'run2';
  salamiBonus: boolean;
  packFirst: boolean;
  rounds: number;
  startChips: number;
  direction: 'ccw' | 'cw';
}

export const defaultConfig: KittiConfig = {
  boot: 10,
  a23: 'second',
  top235: false,
  descending: false,
  tieRule: 'none',
  winRule: 'any2',
  salamiBonus: true,
  packFirst: false,
  rounds: 5,
  startChips: 5000,
  direction: 'ccw',
};

export const configSchema: ConfigField[] = [
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
    key: 'salamiBonus',
    type: 'toggle',
    labelKey: 'kt.salami',
    hintKey: 'kt.salamiHint',
    group: 'betting',
    default: true,
  },
  {
    key: 'packFirst',
    type: 'toggle',
    labelKey: 'kt.packFirst',
    hintKey: 'kt.packFirstHint',
    group: 'betting',
    default: false,
  },
  {
    key: 'winRule',
    type: 'select',
    labelKey: 'kt.winRule',
    group: 'rules',
    default: 'any2',
    options: [
      { value: 'any2', labelKey: 'kt.win.any2' },
      { value: 'run2', labelKey: 'kt.win.run2' },
    ],
  },
  {
    key: 'tieRule',
    type: 'select',
    labelKey: 'kt.tieRule',
    group: 'rules',
    default: 'none',
    options: [
      { value: 'none', labelKey: 'kt.tie.none' },
      { value: 'earlier', labelKey: 'kt.tie.earlier' },
    ],
  },
  {
    key: 'descending',
    type: 'toggle',
    labelKey: 'kt.descending',
    hintKey: 'kt.descendingHint',
    group: 'rules',
    default: false,
  },
  {
    key: 'top235',
    type: 'toggle',
    labelKey: 'kt.top235',
    hintKey: 'kt.top235Hint',
    group: 'rules',
    default: false,
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
];

export const presets: Preset<KittiConfig>[] = [
  { id: 'standard', nameKey: 'preset.standard', config: {} },
  {
    id: 'strict',
    nameKey: 'kt.presetStrict',
    config: { descending: true, winRule: 'run2', tieRule: 'earlier' },
  },
];
