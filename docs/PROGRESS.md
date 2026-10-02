# Progress

## Current phase
Phase 11 — Polish (Phase 10 done)

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

- Phase 5: net layer (zod protocol, Transport interface, in-memory + PeerJS transports, room codes), HostSession/ClientSession, lobby (QR, share, seats, bots, kick, lock, timer, rules), join screen, reconnect with token, Auto seats, host resume, wake lock, reactions, connection dots. 46 tests incl. leak check over the wire. e2e/online.mjs (two browsers via PeerJS cloud) passes: 3 plays each, no hidden card leaked, same seat after reload.

- Phase 6: Rangi engine (108-card deck, legality, challenge, Ek/Caught window, stacking, seven-zero, jump-in, draw-until-play, must-play, scoring), bots easy/medium/hard, RangiCard art to the rules file (sindoor/marigold/sky/leaf, symbols, palm, mandala), table UI with color/swap pickers and challenge dialog, rules sheet. 26 Rangi tests, sim 2000 ok, full round auto-played at 360x740 and 740x360.

- Phase 7: Langur Burja engine (bets, close, roll, settle, payout table config, banker rotation, house banker for solo), bots, brass bowl + 3D dice + cloth mat UI, device-sharing mode (banker holds the phone), online synced roll verified with two browsers, profile chips follow solo results. 11 tests, sim ok.

- Phase 8: Jut Patti (joker modes, pair color, odd deals cut to fit the stock, matches, stake chips) and Dhumbal (sets, runs, jokers wild, run-end picks, throw-after-match, Jhyap with counter, elimination or fixed rounds, stall safety) engines + bots + shared draw/discard table UI, multi-select hand. 25 tests, sims ok, full games auto-played at 360x740 (landscape checked for Jut Patti).

- Phase 9: shared threeCard evaluator (category order, A-2-3 options, wilds, percentile table, 2-3-5 option), Teen Patti (blind/seen stakes, raise, side show, show, pot limit, max blind, Muflis/AK47/Joker), Kitti (280 splits, ties, salami, kitti carry-over, pack first, descending, run2), In Between (posts, ace choice, equal-post guess, reshuffle), bots for all, three table UIs. 74 new tests, sims ok, full games auto-played at 360x740.

- Phase 10: Marriage rules module (maal roles with wrap, pure sequence/tunnela/trial/sequence, Superman and Man, meld solver with pure-first search, show validation, dublee counting), engine (deal with joker card set aside, seen/unseen discard rule, dublee route, declare with the solver, maal scoring with marriage, Classic/Kidnap/Murder, winner bonus, zero-sum settlement, stall safety), bots, table UI with two-row hand and Arrange. 28 tests, solver speed test, 25-game sim ok.

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

- Join dedupe: a module-level map prevents React StrictMode from taking two seats.
- Host persists room to localStorage (online.host); Home shows Reopen room; PeerJS cloud may need up to ~20 s to free the old id so resume retries.
- Spectator view uses seat 0 layout (status text may say Your turn when seat 0 acts); polish later.
- Dev-only hooks window.__host/__client/__netLog exist for the e2e test (DEV builds only).

- Bots never jump in and only call Caught when they are the next player (keeps non-turn bot actors out of the engine).
- Easy bots forget Ek 30% of the time, medium 5%, hard never (engine decides at play time).
- Progressive drawing in the rules file is treated as the stacking option (owner question added).
- LocalSession arms the turn timer only for the first actor in currentActors.

- Banker balance may go negative (house is not capped); bettors cannot stake more than they hold.
- GameDefinition got optional hooks: modeConfig (house banks when solo), timerSeats, sharedScreen (no pass cover).
- Solo stake comes from the profile chips; the profile gains or loses the human's net at game end.

- Dhumbal: a round that lasts 40 turns per player is closed automatically by the lowest hand (no penalty) so bot games always end.
- Dhumbal: a player with an empty hand can always call Jhyap (even in the first round of turns).
- Hand supports multi-select (selectedIds/onToggle) and marked cards (jokers).
- Jut Patti stake option moves free chips between players at the end of each round.

- Players with fewer chips than the boot sit out a hand; with fewer than two funded players the game ends.
- Teen Patti: a player who cannot afford a bet can only look or pack (no all-in).
- Kitti: legalActions lists only auto/pack; apply() validates any arrangement and rejects bad ones.
- In Between: a turn's result lives in events and state.last; there is no separate result phase.
- All chip games stake the profile chips when playing alone and update the profile at game end.

- Marriage rounds end after 70 turns per player with no winner (maal only for seen players) so bot games always finish.
- The solver treats maal cards as natural cards that may also stand in as wilds; leftover Man/Superman cards are absorbed into a sequence.
- Marriage points count whenever jhiplu, tiplu and poplu are held together (one of each), not only in the final arrangement of a losing player.
- Drag-to-reorder of the hand is not built; Arrange/auto-sort only.

## Next step
Phase 11 per SPEC section 16 (SPEC 8, 12, 13, 14): Nepali language pass, tutorials for all games, PWA, OG image, accessibility and performance passes.

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
- Rangi: I read "Progressive drawing" as the same thing as the stacking option (whoever cannot stack takes the whole pile). Is there a separate rule in your family?
- Rangi: bots never jump in out of turn. Fine, or should hard bots try?
- Dhumbal: when a round drags on, I close it after 40 turns per player (lowest hand wins, no penalty). OK?
- Jut Patti: deals that leave fewer than 10 stock cards are reduced automatically (6 players deal 5). OK?
- Teen Patti: a player who cannot afford a bet can only pack (no all-in). Is that fine?
- Kitti: default tie rule is that nobody wins a tied show; salami bonus on by default. OK?
- In Between: when the pot runs dry everyone antes again; players under the ante sit out. OK?
- Marriage: rounds with no finisher end after 70 turns per player (maal settles for seen players only). OK, or should the round never end?
- Marriage: a marriage scores as soon as you hold one jhiplu, one tiplu and one poplu together, even if not in one sequence. Confirm?
