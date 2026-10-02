import type { ConfigField, Preset } from '../../core/types';

export interface MarriageConfig extends Record<string, boolean | number | string> {
  men: number;
  superman: boolean;
  jokerDublee: boolean;
  showSets: number;
  showDublees: number;
  mode: 'classic' | 'kidnap' | 'murder';
  tipluPerCopy: number;
  marriagePts: number;
  tunnelaPts: number;
  manPts: number;
  bonusSeen: number;
  bonusUnseen: number;
  dubleeBonus: number;
  chipValue: number;
  rounds: number;
  startChips: number;
  direction: 'ccw' | 'cw';
}

export const defaultConfig: MarriageConfig = {
  men: 0,
  superman: false,
  jokerDublee: false,
  showSets: 3,
  showDublees: 7,
  mode: 'classic',
  tipluPerCopy: 3,
  marriagePts: 10,
  tunnelaPts: 5,
  manPts: 0,
  bonusSeen: 3,
  bonusUnseen: 10,
  dubleeBonus: 5,
  chipValue: 10,
  rounds: 3,
  startChips: 5000,
  direction: 'ccw',
};

const num = (
  key: string,
  def: number,
  min: number,
  max: number,
  group: string,
  step = 1,
): ConfigField => ({
  key,
  type: 'number',
  labelKey: `mg.${key}`,
  group,
  default: def,
  min,
  max,
  step,
});

export const configSchema: ConfigField[] = [
  {
    key: 'rounds',
    type: 'select',
    labelKey: 'mg.rounds',
    group: 'game',
    default: 3,
    options: [1, 3, 5].map((v) => ({ value: v, labelKey: `mg.rounds.${v}` })),
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
    key: 'mode',
    type: 'select',
    labelKey: 'mg.mode',
    group: 'scoring',
    default: 'classic',
    options: ['classic', 'kidnap', 'murder'].map((v) => ({ value: v, labelKey: `mg.mode.${v}` })),
  },
  num('tipluPerCopy', 3, 1, 10, 'scoring'),
  num('marriagePts', 10, 0, 50, 'scoring'),
  num('tunnelaPts', 5, 0, 50, 'scoring'),
  num('manPts', 0, 0, 10, 'scoring'),
  num('bonusSeen', 3, 0, 20, 'scoring'),
  num('bonusUnseen', 10, 0, 50, 'scoring'),
  num('dubleeBonus', 5, 0, 20, 'scoring'),
  {
    key: 'chipValue',
    type: 'select',
    labelKey: 'mg.chipValue',
    group: 'scoring',
    default: 10,
    options: [1, 10, 50].map((v) => ({ value: v, labelKey: `mg.chip.${v}` })),
  },
  num('men', 0, 0, 3, 'cards'),
  {
    key: 'superman',
    type: 'toggle',
    labelKey: 'mg.superman',
    hintKey: 'mg.supermanHint',
    group: 'cards',
    default: false,
  },
  {
    key: 'jokerDublee',
    type: 'toggle',
    labelKey: 'mg.jokerDublee',
    group: 'cards',
    default: false,
  },
  num('showSets', 3, 3, 4, 'cards'),
  num('showDublees', 7, 6, 7, 'cards'),
];

export const presets: Preset<MarriageConfig>[] = [
  { id: 'standard', nameKey: 'preset.standard', config: {} },
  { id: 'kidnap', nameKey: 'mg.mode.kidnap', config: { mode: 'kidnap' } },
  { id: 'murder', nameKey: 'mg.mode.murder', config: { mode: 'murder' } },
  { id: 'men', nameKey: 'mg.presetMen', config: { men: 2, superman: true } },
];
