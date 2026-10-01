# Progress

## Current phase
Phase 5 — Online (Phase 4 done)

## Branch
dev

## Owner decisions
- Hosting: GitHub Pages, repo TaaDas, VITE_BASE=/TaaDas/ (set in deploy workflow and .env.example)
- App name: Chautari (working name, change in src/config/brand.ts)

## Done
- Phase 0: Vite+React+TS strict, eslint (bans Math.random in engine), prettier, vitest, folder tree, brand.ts, env.ts, featureFlags.ts, deploy workflow, felt placeholder. lint/typecheck/test/build pass.

- Phase 1: engine core (rng, cards, deck, seats, events, types/GameDefinition, registry, sim CLI, LocalSession, highcard test game). 15 tests, sim 2000 games ok.

- Phase 2: tokens + 4 themes, fonts, SVG card faces/backs/joker, RangiCard, Hand (fan, drag, keyboard), Piles, Seat+TurnRing, ChipStack, 16 avatars, anim queue + FlightLayer (WAAPI), SoundManager with synth fallback, settings/profile stores, i18n en/ne, Home, SettingsSheet, dev kit /dev/kit. Screenshots reviewed (docs/design-notes.md).

- Phase 3: Call Break engine (rules, config, bot easy/medium/hard, view), 31 unit tests, sim 2000 games ok, table UI (TableShell, Ledger, ResultPanel, Petals, bid chips, last trick review, rules sheet), GameScreen at /play/:gameId. Full 5-round game auto-played through the UI at 360x740 with no console errors (e2e/playgame.mjs).

- Phase 4: setup sheet from configSchema (modes bots/same device, player count, names, bot level, presets + saved house rules, timer, hints), turn timer with Auto seat after 2 timeouts, pass-and-play cover and face-down hands, profile screen + stats, save/resume with Continue game, haptics helper. 36 tests. e2e/local.mjs verified setup, cover, resume.

## Decisions and why
- Newer toolchain than the spec assumed (Vite 8, TS 6, vitest 5, react-router 7, zod 4, motion 13). Used as installed.
- vite-plugin-pwa installed but configured in Phase 11.
- Build script runs tsc --noEmit before vite build.

- Card ranks: 1=Ace..13=King, jokers suit J rank 0; ace-high helper rankAceHigh.
- Events carry visibleTo; filterEventsDefault hides cards/secret from other seats.
- GameDefinition.invariants() is an optional sim-only hook (card/chip conservation).
- LocalSession bots act only after start(); thinkMs injectable (0 in tests).

- Flights use WAAPI on fixed-position clones located via anchor registry (useAnchor keys: deck, discard, seat:N, hand:N, card:ID).
- No sound files in public/sounds yet: synthesized fallback is used until the owner adds files (mp3 named shuffle,deal,place,slide,flip,chip,chips,rattle,bowl,tick,win,tap).
- Nepali strings are my draft; owner reviews in Phase 11 step.
- Dev server was left running in background for screenshots; stop it with the final phase.

- Table screens receive TableProps and animate via useAnimatedView (shown view trails real view until animations land).
- Round end actors are human seats only so bots never skip the result panel; with no humans seat 0 advances (sims).
- Call Break UI uses a launch store (app/launch.ts); Phase 4 setup sheet fills it.
- Manual drag-reorder of hand not built yet; autoSort setting sorts by suit.

- Turn timer and cover only apply while GameDefinition.isPlayPhase() is true.
- Setup keeps per-game memory (setup.<game>) and house rules (house.<game>) in localStorage.
- Online tab in setup shows a placeholder until Phase 5.

## Next step
Phase 5 per SPEC section 16 (SPEC 6, 7): net layer (zod protocol, transport interface, PeerJS), host/client sessions, lobby, QR/share, reconnect, Auto seats, wake lock, reactions.

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
