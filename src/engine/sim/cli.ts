import { availableGameIds, loadGame } from '../registry';
import type { GameId } from '../core/types';
import { simulate } from './simulate';

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

async function main() {
  const which = arg('game', 'all');
  const n = Number(arg('n', '2000'));
  const seed = Number(arg('seed', '1'));
  const ids = which === 'all' ? availableGameIds() : [which as GameId];
  let failed = 0;
  for (const id of ids) {
    const game = await loadGame(id);
    const r = simulate(game, { n, seed });
    const status = r.failures.length === 0 ? 'ok  ' : 'FAIL';
    console.log(
      `${status} ${id.padEnd(12)} games=${r.games} avgSteps=${r.avgSteps} maxSteps=${r.maxSteps} ${r.ms}ms`,
    );
    for (const f of r.failures.slice(0, 5)) console.log(`     seed ${f.seed}: ${f.error}`);
    if (r.failures.length > 5) console.log(`     ...and ${r.failures.length - 5} more`);
    failed += r.failures.length;
  }
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
