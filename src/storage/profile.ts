import { create } from 'zustand';
import { loadJson, saveJson } from './safe';

export interface Profile {
  name: string;
  avatar: string;
  chips: number;
  /** yyyy-mm-dd of the last daily top-up */
  lastTopUp: string;
  /** bot / player names remembered for the setup sheet */
  names: string[];
}

export const START_CHIPS = 10000;
export const TOP_UP_TO = 5000;

const today = () => new Date().toISOString().slice(0, 10);

const defaults: Profile = {
  name: 'Guest',
  avatar: 'yak',
  chips: START_CHIPS,
  lastTopUp: today(),
  names: [],
};

/** If chips are below the floor, top up once per calendar day. Pure, so it can be tested. */
export function applyDailyTopUp(p: Profile, day = today()): Profile {
  if (p.lastTopUp === day || p.chips >= TOP_UP_TO) return { ...p, lastTopUp: day };
  return { ...p, chips: TOP_UP_TO, lastTopUp: day };
}

interface ProfileStore extends Profile {
  patch: (p: Partial<Profile>) => void;
  addChips: (delta: number) => void;
}

const persist = (s: ProfileStore) => {
  const { patch: _p, addChips: _a, ...data } = s;
  void _p;
  void _a;
  saveJson('profile', data);
};

export const useProfile = create<ProfileStore>((set, get) => ({
  ...applyDailyTopUp(loadJson<Profile>('profile', defaults)),
  patch: (p) => {
    set(p);
    persist(get());
  },
  addChips: (delta) => {
    set({ chips: Math.max(0, get().chips + delta) });
    persist(get());
  },
}));
