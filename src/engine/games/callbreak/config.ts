import type { ConfigField, Preset } from '../../core/types';
import type { Direction } from '../../core/seats';

export interface CallBreakConfig extends Record<string, boolean | number | string> {
  maxBid: number;
  redealNoSpade: boolean;
  redealNoFace: boolean;
  mustTrumpWhenCantBeat: boolean;
  bonusBid8: boolean;
  rounds: number;
  direction: Direction;
}

export const defaultConfig: CallBreakConfig = {
  maxBid: 13,
  redealNoSpade: true,
  redealNoFace: false,
  mustTrumpWhenCantBeat: true,
  bonusBid8: false,
  rounds: 5,
  direction: 'ccw',
};

export const configSchema: ConfigField[] = [
  {
    key: 'rounds',
    type: 'number',
    labelKey: 'callbreak.rounds',
    group: 'game',
    default: 5,
    min: 1,
    max: 10,
  },
  {
    key: 'maxBid',
    type: 'select',
    labelKey: 'callbreak.maxBid',
    group: 'bidding',
    default: 13,
    options: [
      { value: 13, labelKey: 'callbreak.maxBid13' },
      { value: 8, labelKey: 'callbreak.maxBid8' },
    ],
  },
  {
    key: 'redealNoSpade',
    type: 'toggle',
    labelKey: 'callbreak.redealNoSpade',
    group: 'dealing',
    default: true,
  },
  {
    key: 'redealNoFace',
    type: 'toggle',
    labelKey: 'callbreak.redealNoFace',
    group: 'dealing',
    default: false,
  },
  {
    key: 'mustTrumpWhenCantBeat',
    type: 'toggle',
    labelKey: 'callbreak.mustTrump',
    hintKey: 'callbreak.mustTrumpHint',
    group: 'play',
    default: true,
  },
  {
    key: 'bonusBid8',
    type: 'toggle',
    labelKey: 'callbreak.bonus8',
    group: 'scoring',
    default: false,
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

export const presets: Preset<CallBreakConfig>[] = [
  { id: 'standard', nameKey: 'preset.standard', config: {} },
  {
    id: 'short',
    nameKey: 'callbreak.presetShort',
    config: { rounds: 3, maxBid: 8 },
  },
];
