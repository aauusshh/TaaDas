import { featureFlags } from '../../config/featureFlags';

/**
 * A place for an ad, switched off (featureFlags.ads = false). Ads may only ever appear on Home and on
 * the game-over screen, never on the table, and the chips note stays visible next to them.
 */
export function AdSlot({ where }: { where: 'home' | 'gameover' }) {
  if (!featureFlags.ads) return null;
  return <div data-ad-slot={where} style={{ minHeight: 60 }} />;
}
