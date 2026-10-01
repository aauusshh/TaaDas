import type { ConfigField, Preset } from '../../core/types';

export interface RangiConfig extends Record<string, boolean | number | string> {
  /** 0 = a single round, otherwise play to this many points */
  target: number;
  startCards: number;
  direction: 'cw' | 'ccw';
  challenge: boolean;
  callEk: boolean;
  stacking: boolean;
  stackMixed: boolean;
  sevenZero: boolean;
  jumpIn: boolean;
  drawUntilPlay: boolean;
  mustPlay: boolean;
}

export const defaultConfig: RangiConfig = {
  target: 500,
  startCards: 7,
  direction: 'cw',
  challenge: true,
  callEk: true,
  stacking: false,
  stackMixed: false,
  sevenZero: false,
  jumpIn: false,
  drawUntilPlay: false,
  mustPlay: false,
};

export const configSchema: ConfigField[] = [
  {
    key: 'target',
    type: 'select',
    labelKey: 'rangi.target',
    group: 'game',
    default: 500,
    options: [
      { value: 0, labelKey: 'rangi.target.single' },
      { value: 250, labelKey: 'rangi.target.250' },
      { value: 500, labelKey: 'rangi.target.500' },
      { value: 1000, labelKey: 'rangi.target.1000' },
    ],
  },
  {
    key: 'startCards',
    type: 'number',
    labelKey: 'rangi.startCards',
    group: 'game',
    default: 7,
    min: 5,
    max: 10,
  },
  {
    key: 'direction',
    type: 'select',
    labelKey: 'common.direction',
    group: 'game',
    default: 'cw',
    options: [
      { value: 'cw', labelKey: 'common.cw' },
      { value: 'ccw', labelKey: 'common.ccw' },
    ],
  },
  {
    key: 'challenge',
    type: 'toggle',
    labelKey: 'rangi.challenge',
    hintKey: 'rangi.challengeHint',
    group: 'rules',
    default: true,
  },
  {
    key: 'callEk',
    type: 'toggle',
    labelKey: 'rangi.callEk',
    hintKey: 'rangi.callEkHint',
    group: 'rules',
    default: true,
  },
  { key: 'mustPlay', type: 'toggle', labelKey: 'rangi.mustPlay', group: 'house', default: false },
  {
    key: 'drawUntilPlay',
    type: 'toggle',
    labelKey: 'rangi.drawUntilPlay',
    group: 'house',
    default: false,
  },
  {
    key: 'stacking',
    type: 'toggle',
    labelKey: 'rangi.stacking',
    hintKey: 'rangi.stackingHint',
    group: 'house',
    default: false,
  },
  {
    key: 'stackMixed',
    type: 'toggle',
    labelKey: 'rangi.stackMixed',
    group: 'house',
    default: false,
  },
  {
    key: 'sevenZero',
    type: 'toggle',
    labelKey: 'rangi.sevenZero',
    hintKey: 'rangi.sevenZeroHint',
    group: 'house',
    default: false,
  },
  {
    key: 'jumpIn',
    type: 'toggle',
    labelKey: 'rangi.jumpIn',
    hintKey: 'rangi.jumpInHint',
    group: 'house',
    default: false,
  },
];

export const presets: Preset<RangiConfig>[] = [
  { id: 'standard', nameKey: 'preset.standard', config: {} },
  { id: 'single', nameKey: 'rangi.presetSingle', config: { target: 0 } },
  {
    id: 'wild',
    nameKey: 'rangi.presetWild',
    config: { stacking: true, sevenZero: true, jumpIn: true, mustPlay: true },
  },
];
