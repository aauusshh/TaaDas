import type { ConfigField, Preset } from '../../core/types';

export interface InBetweenConfig extends Record<string, boolean | number | string> {
  ante: number;
  minBet: number;
  aceHigh: boolean;
  equalPosts: 'pass' | 'guess';
  rounds: number;
  startChips: number;
  direction: 'ccw' | 'cw';
}

export const defaultConfig: InBetweenConfig = {
  ante: 10,
  minBet: 10,
  aceHigh: false,
  equalPosts: 'pass',
  rounds: 5,
  startChips: 5000,
  direction: 'ccw',
};

export const configSchema: ConfigField[] = [
  {
    key: 'rounds',
    type: 'select',
    labelKey: 'ib.rounds',
    group: 'game',
    default: 5,
    options: [3, 5, 10].map((v) => ({ value: v, labelKey: `ib.rounds.${v}` })),
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
    key: 'ante',
    type: 'number',
    stake: true,
    labelKey: 'ib.ante',
    group: 'betting',
    default: 10,
    min: 5,
    max: 1000,
    step: 5,
  },
  {
    key: 'minBet',
    type: 'number',
    stake: true,
    labelKey: 'lb.minBet',
    group: 'betting',
    default: 10,
    min: 5,
    max: 1000,
    step: 5,
  },
  {
    key: 'aceHigh',
    type: 'toggle',
    labelKey: 'ib.aceHigh',
    hintKey: 'ib.aceHighHint',
    group: 'rules',
    default: false,
  },
  {
    key: 'equalPosts',
    type: 'select',
    labelKey: 'ib.equalPosts',
    group: 'rules',
    default: 'pass',
    options: [
      { value: 'pass', labelKey: 'ib.equal.pass' },
      { value: 'guess', labelKey: 'ib.equal.guess' },
    ],
  },
];

export const presets: Preset<InBetweenConfig>[] = [
  { id: 'standard', nameKey: 'preset.standard', config: {} },
  { id: 'short', nameKey: 'ib.presetShort', config: { rounds: 3 } },
  {
    id: 'highstakes',
    nameKey: 'ib.presetHigh',
    config: { ante: 50, minBet: 50, equalPosts: 'guess' },
  },
];
