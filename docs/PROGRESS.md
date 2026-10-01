# Progress

## Current phase
Phase 2 — Table kit (Phase 1 done)

## Branch
dev

## Owner decisions
- Hosting: GitHub Pages, repo TaaDas, VITE_BASE=/TaaDas/ (set in deploy workflow and .env.example)
- App name: Chautari (working name, change in src/config/brand.ts)

## Done
- Phase 0: Vite+React+TS strict, eslint (bans Math.random in engine), prettier, vitest, folder tree, brand.ts, env.ts, featureFlags.ts, deploy workflow, felt placeholder. lint/typecheck/test/build pass.

- Phase 1: engine core (rng, cards, deck, seats, events, types/GameDefinition, registry, sim CLI, LocalSession, highcard test game). 15 tests, sim 2000 games ok.

## Decisions and why
- Newer toolchain than the spec assumed (Vite 8, TS 6, vitest 5, react-router 7, zod 4, motion 13). Used as installed.
- vite-plugin-pwa installed but configured in Phase 11.
- Build script runs tsc --noEmit before vite build.

- Card ranks: 1=Ace..13=King, jokers suit J rank 0; ace-high helper rankAceHigh.
- Events carry visibleTo; filterEventsDefault hides cards/secret from other seats.
- GameDefinition.invariants() is an optional sim-only hook (card/chip conservation).
- LocalSession bots act only after start(); thinkMs injectable (0 in tests).

## Next step
Phase 2 per SPEC section 16 (read SPEC 8, 9, 13).

## Questions for owner
Answer under each question. Claude uses the default until answered.
- Marriage: maal point values for 2 and 3 copies of tiplu (default: 3 per copy). Poplu/jhiplu 2/5/10 and alter 5/15/25 for 1/2/3 copies — correct for your family?
- Marriage: winner bonus 3 from each seen player and 10 from each unseen player — correct?
- Marriage: points for Man cards (printed jokers), if used (default 0)?
- Marriage: can an unseen player pick from the discard pile only to complete a pure sequence/tunnela they show that turn (default yes)?
- Call Break: max bid 8 or 13 (default 13)? Redeal when a hand has no spade (default yes)?
- Dhumbal: Jhyap limit (default 10 or less)? J/Q/K = 11/12/13 or all 10 (default 11/12/13)?
- Jut Patti: does a pair need the same color too (default no)? Joker = one rank above the flipped card (default yes)?
- Kitti: win = any 2 of 3 shows (default) or 2 in a row?
- Langur Burja: payout table (default: 1 match pays 1x, 2 pays 2x, ... 6 pays 6x)? Nepali names for the crown and flag faces?
