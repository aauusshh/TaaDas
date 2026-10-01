# Chautari (working name) — Nepali card & dice games on the web

Browser game site with: Taas games (Call Break, Marriage, Teen Patti, Dhumbal/Jhyap, Jut Patti, Kitti, In Between), Rangi (our own color-matching game), and Langur Burja (six dice, one banker). Modes: single-player vs bots, pass-and-play on one device, online rooms with friends. Static site, no backend server (online uses peer-to-peer, host's browser runs the game).

## Start of every session
1. Read docs/PROGRESS.md: current phase, decisions, next step, owner answers.
2. Read only the docs/SPEC.md sections the current phase lists, and only the rules file for the game you're working on (docs/rules/<game>.md). Don't re-read the whole spec.
3. Do one phase per session. When its acceptance checks pass: run tests, commit, update PROGRESS.md, then stop and summarize in under 10 lines, including any manual steps for the owner.

## Commands
npm run dev | npm run build | npm test | npm run sim -- --game <id|all> --n 2000 | npm run lint | npm run typecheck

## Hard rules
- Game logic lives in src/engine: pure TypeScript, no DOM, no network, no Math.random (use the seeded rng).
- Online: the host's engine is the only source of truth. Clients send actions; host validates everything. Never send a player anyone else's hidden cards, the deck order, or the rng seed.
- No real money anywhere. Chips are free play money: no purchases, no cash-out, no transfers, no gifting. No payment code.
- Never use the word "UNO", its logo, or its card look. Our game is "Rangi" with original art.
- Don't copy art, names, logos, or exact layouts from any existing app or brand.
- The UI must not look AI-generated or templated. Follow SPEC section 8, including the banned list. No emoji as UI icons.
- Mobile first. Check 360x740 portrait and 740x360 landscape before calling UI work done.
- Only use dependencies listed in SPEC section 3. If you truly need another, write why in PROGRESS.md.
- Never commit secrets. Config comes from import.meta.env (VITE_*). Never read .env files.
- If a rule is unclear: use the default in the rules file, make it a config option, add a line under "Questions for owner" in PROGRESS.md, and keep going.
- After 2 failed attempts at the same bug: stop, write what you learned in PROGRESS.md, re-plan.

## Token habits
- Find code with grep/glob, then read only the needed line range. Never open node_modules, dist, lockfiles.
- Filter output: `npm test 2>&1 | tail -n 40`, `git status -s`, `git diff --stat`. On failure, read the full relevant error.
- Edit surgically. Don't rewrite a file to change a few lines.
- Screenshots only in UI review steps, max 6 per review.

## Git
- Work on branch `dev`; merge to `main` only when a phase is done and the owner agrees.
- Commit after each passing step with a clear message.
- Ask before git push, force-push, deleting branches, or changing GitHub settings.

# Compact instructions
Keep: current phase, decisions and reasons, files changed, failing tests with errors, next step, open owner questions. Drop: logs, dead ends, old drafts.
