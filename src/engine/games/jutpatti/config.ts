import type { ConfigField, Preset } from '../../core/types';

export interface JutPattiConfig extends Record<string, boolean | number | string> {
  dealCount: number;
  jokerMode: 'above' | 'same';
  pairColor: boolean;
  /** rounds to win the match, 1 = a single round */
  target: number;
  direction: 'ccw' | 'cw';
  /** chips each other player pays the winner per round, 0 = off */
  stake: number;
}

export const defaultConfig: JutPattiConfig = {
  dealCount: 7,
  jokerMode: 'above',
  pairColor: false,
  target: 3,
  direction: 'ccw',
  stake: 0,
};

export const configSchema: ConfigField[] = [
  {
    key: 'target',
    type: 'select',
    labelKey: 'jp.target',
    group: 'game',
    default: 3,
    options: [1, 3, 5, 7].map((v) => ({ value: v, labelKey: `jp.target.${v}` })),
  },
  {
    key: 'dealCount',
    type: 'select',
    labelKey: 'jp.dealCount',
    hintKey: 'jp.dealCountHint',
    group: 'game',
    default: 7,
    options: [5, 7, 9, 11].map((v) => ({ value: v, labelKey: `jp.deal.${v}` })),
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
    key: 'jokerMode',
    type: 'select',
    labelKey: 'jp.jokerMode',
    group: 'rules',
    default: 'above',
    options: [
      { value: 'above', labelKey: 'jp.joker.above' },
      { value: 'same', labelKey: 'jp.joker.same' },
    ],
  },
  { key: 'pairColor', type: 'toggle', labelKey: 'jp.pairColor', group: 'rules', default: false },
  {
    key: 'stake',
    type: 'select',
    labelKey: 'jp.stake',
    hintKey: 'jp.stakeHint',
    group: 'rules',
    default: 0,
    options: [0, 10, 50, 100].map((v) => ({
      value: v,
      labelKey: v === 0 ? 'common.off' : `lb.chips.${v}`,
    })),
  },
];

export const presets: Preset<JutPattiConfig>[] = [
  { id: 'standard', nameKey: 'preset.standard', config: {} },
  { id: 'single', nameKey: 'jp.presetSingle', config: { target: 1 } },
  { id: 'samejoker', nameKey: 'jp.presetSame', config: { jokerMode: 'same', pairColor: true } },
];
