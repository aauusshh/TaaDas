import type { ConfigField, Preset } from '../../core/types';

export const SYMBOLS = ['crown', 'flag', 'heart', 'spade', 'diamond', 'club'] as const;
export type Symbol6 = (typeof SYMBOLS)[number];
export const CHIP_VALUES = [10, 50, 100, 500] as const;

export interface LangurConfig extends Record<string, boolean | number | string> {
  startChips: number;
  rounds: number;
  minBet: number;
  maxBet: number;
  /** the house (a bot in the last seat) banks, used when playing alone */
  houseBanks: boolean;
  /** banker passes to the next seat every N rounds, 0 = never */
  bankerRotate: number;
  loseOnZero: boolean;
  pay1: number;
  pay2: number;
  pay3: number;
  pay4: number;
  pay5: number;
  pay6: number;
}

export const defaultConfig: LangurConfig = {
  startChips: 5000,
  rounds: 10,
  minBet: 10,
  maxBet: 1000,
  houseBanks: false,
  bankerRotate: 0,
  loseOnZero: true,
  pay1: 1,
  pay2: 2,
  pay3: 3,
  pay4: 4,
  pay5: 5,
  pay6: 6,
};

const pay = (n: number): ConfigField => ({
  key: `pay${n}`,
  type: 'number',
  labelKey: `lb.pay${n}`,
  group: 'payout',
  default: n,
  min: 0,
  max: 20,
});

export const configSchema: ConfigField[] = [
  {
    key: 'rounds',
    type: 'select',
    labelKey: 'lb.rounds',
    group: 'game',
    default: 10,
    options: [5, 10, 20, 50].map((v) => ({ value: v, labelKey: `lb.rounds.${v}` })),
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
    key: 'bankerRotate',
    type: 'number',
    labelKey: 'lb.bankerRotate',
    hintKey: 'lb.bankerRotateHint',
    group: 'game',
    default: 0,
    min: 0,
    max: 10,
  },
  {
    key: 'minBet',
    type: 'select',
    labelKey: 'lb.minBet',
    group: 'betting',
    default: 10,
    options: [10, 50, 100].map((v) => ({ value: v, labelKey: `lb.chips.${v}` })),
  },
  {
    key: 'maxBet',
    type: 'select',
    labelKey: 'lb.maxBet',
    group: 'betting',
    default: 1000,
    options: [500, 1000, 2000, 5000].map((v) => ({ value: v, labelKey: `lb.chips.${v}` })),
  },
  { key: 'loseOnZero', type: 'toggle', labelKey: 'lb.loseOnZero', group: 'payout', default: true },
  pay(1),
  pay(2),
  pay(3),
  pay(4),
  pay(5),
  pay(6),
];

export const presets: Preset<LangurConfig>[] = [
  { id: 'standard', nameKey: 'preset.standard', config: {} },
  {
    id: 'generous',
    nameKey: 'lb.presetGenerous',
    config: { pay1: 1, pay2: 3, pay3: 5, pay4: 8, pay5: 10, pay6: 12 },
  },
  { id: 'short', nameKey: 'lb.presetShort', config: { rounds: 5 } },
];
