import type { ConfigField, Preset } from '../../core/types';

export const SYMBOLS = ['crown', 'flag', 'heart', 'spade', 'diamond', 'club'] as const;
export type Symbol6 = (typeof SYMBOLS)[number];
/** total returned per unit staked when 0 to 6 dice show the symbol (0 dice always loses the stake) */
export const DEFAULT_RETURNS = [0, 0, 2, 3, 4, 5, 6] as const;

export interface LangurConfig extends Record<string, boolean | number | string> {
  startChips: number;
  rounds: number;
  minBet: number;
  maxBet: number;
  /** stakes move in multiples of this */
  step: number;
  /** the house (a bot in the last seat) banks, used when playing alone */
  houseBanks: boolean;
  /** banker passes to the next seat every N rounds, 0 = never */
  bankerRotate: number;
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
  minBet: 5,
  maxBet: 1000,
  step: 5,
  houseBanks: false,
  bankerRotate: 0,
  pay1: 0,
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
  default: DEFAULT_RETURNS[n],
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
    key: 'step',
    type: 'number',
    stake: true,
    labelKey: 'lb.step',
    group: 'betting',
    default: 5,
    min: 1,
    max: 1000,
    step: 1,
  },
  {
    key: 'minBet',
    type: 'number',
    stake: true,
    labelKey: 'lb.minBet',
    group: 'betting',
    default: 5,
    min: 1,
    max: 1000,
    step: 5,
  },
  {
    key: 'maxBet',
    type: 'number',
    stake: true,
    labelKey: 'lb.maxBet',
    group: 'betting',
    default: 1000,
    min: 5,
    max: 100000,
    step: 5,
  },
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
