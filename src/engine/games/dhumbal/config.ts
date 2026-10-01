import type { ConfigField, Preset } from '../../core/types';

export interface DhumbalConfig extends Record<string, boolean | number | string> {
  handSize: number;
  jokers: boolean;
  jokersWild: boolean;
  /** J, Q, K count 10 instead of 11, 12, 13 */
  jqk10: boolean;
  pickAnyFromRun: boolean;
  throwAfterMatch: boolean;
  jhyapLimit: number;
  noJhyapFirstRound: boolean;
  counterPenalty: number;
  eliminateAt: number;
  /** 0 = play until one player is left; otherwise a fixed number of rounds */
  fixedRounds: number;
  direction: 'ccw' | 'cw';
}

export const defaultConfig: DhumbalConfig = {
  handSize: 5,
  jokers: false,
  jokersWild: false,
  jqk10: false,
  pickAnyFromRun: false,
  throwAfterMatch: false,
  jhyapLimit: 10,
  noJhyapFirstRound: true,
  counterPenalty: 25,
  eliminateAt: 100,
  fixedRounds: 0,
  direction: 'ccw',
};

export const configSchema: ConfigField[] = [
  {
    key: 'fixedRounds',
    type: 'number',
    labelKey: 'dh.fixedRounds',
    hintKey: 'dh.fixedRoundsHint',
    group: 'game',
    default: 0,
    min: 0,
    max: 15,
  },
  {
    key: 'eliminateAt',
    type: 'select',
    labelKey: 'dh.eliminateAt',
    hintKey: 'dh.eliminateAtHint',
    group: 'game',
    default: 100,
    options: [100, 150, 200].map((v) => ({ value: v, labelKey: `dh.limit.${v}` })),
  },
  {
    key: 'handSize',
    type: 'select',
    labelKey: 'dh.handSize',
    group: 'game',
    default: 5,
    options: [5, 7].map((v) => ({ value: v, labelKey: `dh.hand.${v}` })),
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
    key: 'jhyapLimit',
    type: 'select',
    labelKey: 'dh.jhyapLimit',
    group: 'jhyap',
    default: 10,
    options: [5, 7, 10, 13].map((v) => ({ value: v, labelKey: `dh.jlimit.${v}` })),
  },
  {
    key: 'noJhyapFirstRound',
    type: 'toggle',
    labelKey: 'dh.noFirst',
    group: 'jhyap',
    default: true,
  },
  {
    key: 'counterPenalty',
    type: 'number',
    labelKey: 'dh.penalty',
    hintKey: 'dh.penaltyHint',
    group: 'jhyap',
    default: 25,
    min: 0,
    max: 100,
    step: 5,
  },
  { key: 'jqk10', type: 'toggle', labelKey: 'dh.jqk10', group: 'cards', default: false },
  {
    key: 'jokers',
    type: 'toggle',
    labelKey: 'dh.jokers',
    hintKey: 'dh.jokersHint',
    group: 'cards',
    default: false,
  },
  { key: 'jokersWild', type: 'toggle', labelKey: 'dh.jokersWild', group: 'cards', default: false },
  { key: 'pickAnyFromRun', type: 'toggle', labelKey: 'dh.pickAny', group: 'play', default: false },
  {
    key: 'throwAfterMatch',
    type: 'toggle',
    labelKey: 'dh.throwAfter',
    hintKey: 'dh.throwAfterHint',
    group: 'play',
    default: false,
  },
];

export const presets: Preset<DhumbalConfig>[] = [
  { id: 'standard', nameKey: 'preset.standard', config: {} },
  { id: 'short', nameKey: 'dh.presetShort', config: { fixedRounds: 5 } },
  {
    id: 'loose',
    nameKey: 'dh.presetLoose',
    config: { jokers: true, jokersWild: true, pickAnyFromRun: true, throwAfterMatch: true },
  },
];
