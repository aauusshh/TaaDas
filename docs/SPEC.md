# Chautari — Product and Build Spec

Working name "Chautari": the stone resting platform under a tree where people in Nepal sit together. Rename later in one place: `src/config/brand.ts`.

## 0. How to use this spec
Build in phases (section 16), one phase per session. Each session: read docs/PROGRESS.md, then only the sections the phase lists. Game rules live in docs/rules/<game>.md. The defaults there are the starting point; every variant listed there must become a toggle in that game's setup screen.

## 1. What we're building
A fast, mobile-first website where people in Nepal play the games they already play at home and during Tihar:
- Taas: Call Break, Marriage, Teen Patti, Dhumbal (Jhyap), Jut Patti, Kitti, In Between
- Rangi: our own color-matching shedding game (same family as the famous one, original name and art)
- Langur Burja: six symbol dice, one player is the banker

Every game supports single-player vs bots, pass-and-play on one device (where it makes sense), and online rooms with friends via room code, link, or QR. Free play chips only.

Success looks like this: someone who grew up playing these games opens the link on a cheap Android phone and is in a game within 20 seconds. Cards slide and snap, the shuffle sounds real, the rules match what their family plays, and nothing feels like a template.

## 2. Non-negotiables
1. Engine is pure and deterministic (seeded rng). UI and network never contain game rules.
2. Online: host-authoritative. Clients only ever receive their own view.
3. No real money, no purchases, no cash-out, no transfers. "Chips" and "points" only.
4. No UNO name, logo, or card look. No copied art, logos, names, or layouts from any app or brand.
5. Looks and feels like a real card table made by people (section 8).
6. Works on low-end Android over flaky mobile data.
7. Every rule variant in the rules files is configurable.

## 3. Stack (don't add others without writing why in PROGRESS.md)
- Vite + React 18 + TypeScript (strict), CSS Modules + CSS custom properties (no Tailwind, no UI kits like MUI/shadcn/Chakra; custom components keep it from looking templated)
- zustand (UI state), motion (Framer Motion) for animation, react-router (HashRouter)
- peerjs (online rooms), zod (validate every network message), qrcode (join QR)
- vite-plugin-pwa (install + offline)
- @fontsource/mukta (UI, supports Devanagari) and @fontsource/rozha-one (titles and big moments only)
- lucide-react for small UI control icons only (settings, close, volume). Game art is our own SVG.
- Dev: vitest, @playwright/test (screenshots, two-tab online test), eslint, prettier, tsx (sim CLI)

## 4. Architecture
```
src/
  app/          routes (HashRouter), providers, screens
  config/       brand.ts, env.ts, featureFlags.ts
  engine/
    core/       rng.ts, cards.ts, deck.ts, types.ts, events.ts, threeCard.ts (Teen Patti + Kitti evaluator), seats.ts
    games/<id>/ index.ts (GameDefinition), rules.ts, config.ts, view.ts, bot.ts, *.test.ts
    registry.ts
    sim/        simulate.ts  (npm run sim -- --game callbreak --n 2000)
  session/      LocalSession (bots + pass-and-play), HostSession, ClientSession — one interface for the UI
  net/          protocol.ts (zod), transport.ts (interface), peerTransport.ts, host.ts, client.ts, roomCode.ts
  ui/
    table/      Table, Seat, Hand, Pile, TrickArea, ChipStack, Pot, DiceBowl, TurnRing, Ledger
    cards/      CardFace, CardBack, art/ (SVG pieces), RangiCard
    anim/       event queue that turns GameEvents into animations
    sound/      SoundManager (+ WebAudio fallback)
    components/ Button, BottomSheet, Toggle, Stepper, Segmented, Dialog, Toast
    theme/      tokens.css, themes/*.css
  i18n/         en.json, ne.json, t.ts
  storage/      profile, settings, stats, saved games (localStorage, try/catch everywhere)
public/sounds/, public/icons/
```

### 4.1 Engine contract
```ts
export interface GameDefinition<S, A, C, V> {
  id: GameId; nameKey: string;
  minPlayers: number; maxPlayers: number;
  supports: { bots: boolean; passAndPlay: boolean; online: boolean };
  defaultConfig: C;
  configSchema: ConfigField[];          // drives the setup screen automatically (toggle, select, number, presets)
  presets: { id: string; nameKey: string; config: Partial<C> }[];
  setup(players: PlayerInfo[], config: C, rng: Rng): Step<S>;
  currentActors(state: S): number[];   // seats allowed to act now (several during betting / Kitti arranging)
  legalActions(state: S, seat: number): A[];
  apply(state: S, seat: number, action: A, rng: Rng): Step<S>;   // pure; throws IllegalActionError
  view(state: S, seat: number | 'spectator'): V;                  // hides secrets
  filterEvents(events: GameEvent[], seat: number | 'spectator'): GameEvent[];
  timeoutAction(state: S, seat: number): A;
  result(state: S): GameResult | null;
  bot: (view: V, legal: A[], difficulty: 'easy' | 'medium' | 'hard', rng: Rng) => A;
}
type Step<S> = { state: S; events: GameEvent[] };
```
- GameEvents describe what physically happened (deal, move card from X to Y, flip, trick won, bid, chips moved, dice rolled, reveal, round end). The UI animates events in order; it never diffs state to guess animations.
- Card identity: every physical card has a unique id (Marriage has 3 copies of each card).
- rng: mulberry32 with serializable state; Fisher-Yates shuffle.
- Saving: after every step, the session saves `{gameId, config, players, state, rngState}` to localStorage. On reload, Home shows "Continue game".

## 5. Play modes
- Single-player: you plus bots. Pick number of players, edit bot names, set difficulty per bot.
- Pass-and-play: several humans on one device, bots optional. Before each human turn that has hidden cards, show a full-screen cover "Pass to <name>" and reveal on tap. Hide hands when the tab goes to background. Not offered where it makes no sense (online-only features).
- Online room: section 6.
- Langur Burja local mode: banker holds the device; players are added by name; select a player's chip color, then tap symbols to place that player's chips.

## 6. Online rooms without a server
- Transport: PeerJS (WebRTC data channels) with the free PeerJS cloud for signaling, wrapped behind a `Transport` interface so a WebSocket server can replace it later without touching UI or engine.
- The room creator is the host. The host's browser runs the engine, bots, and timers. In Langur Burja the host is the banker by default.
- Room code: 5 characters from `ABCDEFGHJKMNPQRSTUVWXYZ23456789`. Peer id: `<brandPrefix>-<code>`; on collision pick a new code.
- Join by typing the code, opening `/#/join/<code>`, or scanning the QR. Share button uses the Web Share API (falls back to copy link). Share text in the current language, e.g. "Join my Call Break table on Chautari: <link>".
- Lobby: seats visible. Host can choose game and rules, reorder seats, add or remove bots, kick, set turn timer, lock the room, and start. Players set name/avatar and tap Ready. Extra people can watch as spectators (toggle).
- Protocol (zod, versioned):
  - client→host: `hello {v, name, avatar, token?}`, `action {seq, action}`, `react {id}`, `ready {on}`, `ping`
  - host→client: `welcome {seat, token, lobby}`, `lobby {...}`, `view {seq, view, events}`, `error {code}`, `pong`, `kicked`, `hostPaused`, `closed {results}`
- Host computes `view(state, seat)` and `filterEvents(events, seat)` per player. Never broadcast full state.
- Reconnect: client keeps its token in localStorage. Within 3 minutes the host gives back the same seat. While someone is away, a bot plays their seat (marked "Auto") and hands control back when they return.
- Host leaves: clients show "Waiting for host" with a countdown. The host saves state after each action, so reopening the link resumes the room (same code if free). After 3 minutes, clients see "Room closed" with results so far.
- Host device: request Screen Wake Lock; show a small note "You're hosting. Keep this screen open."; confirm before closing the tab mid-game.
- ICE: Google STUN by default. Optional TURN from env (VITE_TURN_URLS, VITE_TURN_USERNAME, VITE_TURN_CREDENTIAL). If a connection isn't up within 15 s: "Couldn't connect. Try again on Wi-Fi, or ask the host to turn on relay." Relay toggle appears only if TURN is configured.
- Limits: messages ≤ 64 KB, ≤ 20 actions/s per client, names 1–16 chars, trimmed.
- Feel: optimistic UI only for local selection (lifting a card). A play animates when the host confirms (usually <150 ms). Each seat shows a small connection dot (good / slow / away).
- Same-tap races (Rangi jump-in, "Caught!"): host decides by arrival order.

## 7. Chips and legal guardrails
- Profile chips (single-player): start 10,000; daily top-up to 5,000 if below. Online rooms use room chips set by the host (default 5,000 each), which reset when the room ends.
- No buying, cash-out, transfer, gifting, or "real" wording. Never "bet real money", "win cash".
- About page and game-over screens of chip games show: "Free games for fun. Chips have no money value and can't be bought, sold, or cashed out."

## 8. Design direction: a real table, not a template

### 8.1 The feel
A card session in a Nepali home during Tihar: felt or a cotton mat, cards with weight, the click of chips, a brass bowl for the dice, a notebook for scores. Physical and warm. Every motion has a physical cause: a hand dealt it, a player threw it.

### 8.2 Reference study (start of Phase 2, short)
If you have web access, read descriptions and look at screenshots of well-made card games (Microsoft Solitaire Collection, popular Nepali Call Break and Marriage apps, Board Game Arena, photos of real card tables). Write 10–15 observations in docs/design-notes.md: seat layout, card size vs screen, how hands fan, where scores sit, how turns are signaled, deal timing, how wins are celebrated. Take observations only: no assets, logos, names, or exact layouts. Without web access, use 8.3, which already captures these conventions.

### 8.3 Table conventions
- Landscape: you at bottom center, others around an oval table. Nepali taas runs counter-clockwise, so the next player sits on your right. Portrait: opponents in an arc across the top, your hand at the bottom, piles and tricks in the middle.
- Your hand: a fanned arc (about ±12° total), overlapping so about 40% of each card shows. Marriage's 21 cards: two rows in portrait or tighter overlap, with small gaps between grouped sets.
- Card size: your cards about 22% of viewport height in landscape, never under 64 px wide. Opponents: small stacked backs with a count.
- Center: draw pile with visible thickness (3–5 offset edges), discard with the top card face up and the previous 2 peeking at random ±6°, trick cards landing at random ±4° offset toward the player who played them.
- Seat: round avatar, name, chips or score, game info (e.g. bid "2/4"), a ring around the avatar that drains as the timer runs. Dealer marked by a brass dealer token.
- Your turn: your ring drains, playable cards lift 6 px, others dim to 55% (setting "Show playable cards", on by default in single-player).
- Scores live in a ledger that looks like a ruled notebook page (families keep scores on paper).

### 8.4 Visual language
Palette tokens (CSS custom properties):
- `--felt #1F5A45`, `--felt-deep #123A2C`, `--rim #5A3A22` (sal wood), `--paper #FBF8F1` (card stock), `--ink #000000`, `--suit-red #C8102E`, `--brass #B8893A`, `--panel #173F31`, `--panel-text #F4F1E8`
- Themes: Classic (green felt), Dhaka (maroon felt #6B1E2A, rim with a dhaka-style geometric band), Sal wood (wooden tabletop, no felt), Tihar night (indigo #1E2140 with small diyo light dots on the rim; suggested for Langur Burja in October/November).

Typography: Rozha One only for game titles, the winner's name, and big moments. Mukta for everything else (English and नेपाली). Tabular numerals for scores. Self-hosted fonts (offline).

Card art (SVG, generated in code, reused via `<symbol>`/`<use>`):
- Proportions 63:88, corner radius 5.5% of width, card stock color with a faint grain (SVG noise at 3% opacity), thin inner border.
- Standard pip layouts for 2–10, indices top-left and bottom-right (rotated).
- Courts are our own: large index, suit, and a simple two-tone emblem in suit color plus brass: K = crown, Q = lotus, J = dhaka topi. Framed panel, mirrored top/bottom like real courts.
- A♠ has a large ornate spade with the brand mark. Other aces: one large pip.
- Optional four-color deck (♠ black, ♥ red, ♦ blue #1F5FBF, ♣ green #1E7B3C) for small screens.
- Backs: geometric pattern inspired by Dhaka textile (diamonds and zigzags), two colors plus white, with a white border like printed cards. Options: Dhaka red, Indigo, Forest.
- Chips: flat chips with edge stripes. 10 white, 50 red, 100 blue, 500 green, 1000 black. Stacks with slight random offsets.
- Langur Burja: ivory dice with red/black symbols, a brass bowl seen from above, a cloth mat with six printed squares.

### 8.5 Motion (the biggest real-vs-fake signal)
- All game motion comes from GameEvents played by an animation queue. On-screen state updates as each animation lands. Settings: animation speed 0.5x/1x/1.5x; "Reduce motion" (and prefers-reduced-motion) switches to quick crossfades.
- Deal: deck → seats in deal order, 70 ms stagger, 260 ms flight, ease-out, random ±3° rotation, 1–2 px settle on landing. One shuffle sound, then a soft flick every second card.
- Play a card: 220 ms on a slight arc (not a straight line), scale 1.04 at the peak, small rotation on landing. Trick: 350 ms after the last card, cards gather and slide to the winner's seat in 300 ms.
- Drag: card follows the finger and tilts up to 8° in the direction of movement; valid targets highlight; invalid drop springs back (stiffness ~400, damping ~30). Tap to select, tap again or "Play" also works.
- Flip: 3D rotateY, 240 ms, face swaps at the midpoint.
- Chips: small stacks slide to the pot with 30 ms stagger and a clack.
- Dice: covered bowl shakes 1.2 s (wobble + rattle), lid lifts 300 ms, dice settle with a slight bounce; dice matching each bet symbol pulse once; payouts slide out.
- No idle animation, no floating particles, no fade-and-slide-up on every menu item. One celebration only, at game end: a short fall of marigold petals (1.5 s).
- Haptics (setting): vibrate 10 ms at your turn start, 20 ms on an invalid move.

### 8.6 Sound
- Needed: riffle shuffle, deal flick, card place, card slide, flip, chip clack (single and stack), dice rattle in bowl, bowl lift, timer tick (last 5 s), short warm win sting, very subtle button tap.
- Source: CC0 files the owner puts in public/sounds/raw (see MANUAL_STEPS). Pick, trim, and rename into public/sounds/. If files are missing, use WebAudio-synthesized fallbacks (filtered noise bursts) so nothing breaks.
- SoundManager: preload, per-sound volume, master volume, mute. No music by default. Unlock audio on first tap.

### 8.7 Words on screen
- Sentence case, plain verbs, same verb through a flow: "Create room", "Join room", "Play", "Rules", "Rematch", "Leave table".
- Game names in English and नेपाली: Call Break (कल ब्रेक), Marriage (म्यारिज), Teen Patti (तिनपत्ती), Dhumbal (धुम्बल), Jut Patti (जुटपत्ती), Kitti (किट्टी), In Between, Rangi (रंगी), Langur Burja (लङ्गुर बुर्जा).
- Errors say what happened and what to do: "Room K7M2Q is full. Ask the host for a seat, or join to watch."
- Home is not a grid of identical rounded boxes. It's the table itself with each game laid on it as an object: a fanned hand per card game (Marriage shows jhiplu-tiplu-poplu, Call Break shows A♠, Teen Patti shows a trail), the bowl and dice for Langur Burja, three Rangi cards. Tap an object and its setup sheet slides up from the bottom.

### 8.8 Banned (these make it look generated)
- Purple/blue gradients, glassmorphism, neon glows, gradient text.
- Identical rounded cards with the same soft grey shadow for every menu item; one border-radius on everything.
- Emoji as icons or in headings; ✨🚀🎉 in UI text (emoji only as player reactions).
- ALL-CAPS tracked labels above headings, "→" appended to buttons, "A · B · C" meta strings.
- Inter/Roboto/system font as the identity; monospace for numbers.
- Fade-and-slide-up on everything, infinite pulsing, floating particles.
- Hype copy: "Unleash", "Elevate", "Epic", "Let's go!".
- Cream background with terracotta accent; black background with acid-green accent.
- "Player 1 / Player 2" when a real name exists; lorem ipsum.
- Cards drawn as plain rectangles with "K♠" typed in a font.

### 8.9 Self-review loop (end of every UI phase)
Run the app, use Playwright to screenshot at 360x740, 740x360 and 1366x768 (max 6 shots), look at them, and write in docs/design-notes.md: Would a player think a person designed this? What looks generic? What's the one thing to fix? Fix the top 3 issues before finishing the phase.

## 9. Screens
1. Home: the table with games as objects; top bar with profile (avatar, name, chips) and settings; a prominent "Join room" with code input; "Continue game" if a saved game exists.
2. Setup (bottom sheet): mode tabs [Play with bots | Same device | Online room]; player count stepper within game limits; names (editable, remembered); bot difficulty; rules built from configSchema, grouped, with a presets dropdown (Standard + the owner's saved house rules); turn timer; rounds or target; Start.
3. Lobby (online): big room code, QR, Share; seats; host controls; ready states.
4. Table: game layout; corner menu (pause in local games, rules, settings, leave); ledger button; reactions button (online).
5. Round result: ledger with a row per round; "Next round".
6. Game over: winner moment, final ledger, "Rematch", "Change rules", "Home".
7. Rules and tutorial per game: short rules drawn with real card components; "Try a practice round" with hints in single-player.
8. Settings: language (English / नेपाली), sound, volume, haptics, animation speed, reduce motion, theme, card back, four-color deck, left-handed (mirrors action buttons), show playable cards, auto-sort hand.
9. Profile: name; avatar from 16 original simple SVG emblems (yak, danphe, rhododendron, mountain, tiger, rhino, temple bell, diyo, marigold, momo, prayer flags, snow leopard, kite, madal, dhaka pattern, sun); local stats per game.
10. About, Terms, Privacy: short plain pages with the chips disclaimer.
11. Dev kit page `/#/dev/kit` (dev builds only): every UI component and card face for review.

Reactions (online): preset phrases in both languages ("Ramro khel!", "Chito garnus", "Sorry", "Haha", "Lucky!", "Feri khelau") and 6 emoji reactions. No free-text chat for now.

## 10. Every game must have
- Player counts from its rules file; real names on seats; bots fill empty seats; dealer rotation; direction (Nepali taas default counter-clockwise, toggle).
- All variants from its rules file as config, plus presets.
- Single-player, pass-and-play (where it makes sense), and online.
- Turn timer: Off / 15 / 30 / 60 s (online default 30). On timeout, `timeoutAction`. Two timeouts in a row put the seat on Auto until the player taps "I'm back".
- Single-player hints toggle (highlights the medium bot's suggested move).
- Hand sorting: by suit, by rank, or manual drag; Marriage gets auto-arrange.
- Tap the pile to review the last trick or move.
- Ledger, rounds or target score, rematch.
- Save and resume after reload (local games and host).
- Rules page and practice round.
- Tests: every "Must test" item in its rules file, plus `npm run sim` of 2,000 bot games with random configs: no exceptions, card count conserved, chip total conserved, every game ends.

## 11. Bots
- `bot(view, legal, difficulty, rng)`: bots only see their own view. No peeking.
- Easy: mostly random legal moves with basic sense. Medium: the heuristics in each rules file. Hard: heuristics plus card tracking, and where useful Monte Carlo sampling of unseen cards (50–200 samples within 150 ms).
- Think delay 500–1600 ms, longer for big decisions; zero in sims.
- Names: Aarati, Bibek, Dawa, Gita, Hari, Kabita, Lhakpa, Manish, Nima, Pooja, Ram, Sabina, Sanjay, Sushila, Tenzing, Usha, Bishnu, Anil, Rekha, Pemba. Shown with a small "bot" tag.

## 12. Language
All UI text through i18n keys, en.json and ne.json. Digits stay 0–9. The owner reviews Nepali text (MANUAL_STEPS).

## 13. Accessibility and performance
- Tap targets ≥ 44 px; color is never the only signal (suits have shapes, Rangi colors also have corner symbols); visible focus; desktop keyboard play (arrows select, Enter plays, number keys bid).
- 60 fps on mid/low Android: animate transform and opacity only; no CSS blur filters; ≤ 120 nodes animating at once.
- Initial JS ≤ 250 KB gzip, each game lazy-loaded, fonts subset. Lighthouse mobile performance ≥ 85.
- Offline single-player and pass-and-play via PWA.

## 14. Build and deploy
- HashRouter so refreshes work on any static host.
- Vite `base` from `VITE_BASE` (GitHub Pages project site: `/<repo-name>/`; Cloudflare Pages: `/`).
- `.github/workflows/deploy.yml` (only if hosting is GitHub Pages): on push to main → npm ci, lint, typecheck, test, build, deploy with actions/upload-pages-artifact + actions/deploy-pages. Cloudflare Pages needs no workflow: build `npm run build`, output `dist`.
- PWA manifest, icons 192/512 + maskable, generated from an SVG mark by a script.
- Open Graph image 1200x630 generated from SVG (for WhatsApp/Viber/Messenger link previews).

## 15. Testing and QA
- Unit tests for every "Must test" item.
- `npm run sim -- --game all --n 2000`.
- Online test (Playwright, two browser contexts): host creates a Call Break room, client joins, both play 3 turns, client reloads and gets the same seat back, and no message to the client contains another player's cards. Tag `@online`; skip in CI if the PeerJS cloud is flaky.
- Write docs/QA.md: a manual checklist for the owner on real phones.

## 16. Phases (one per session, in order)
Model advice: Sonnet for most phases. Haiku for mechanical work (strings, copy, small fixes). Opus for Phase 10 and for any bug that survives two attempts.

| Phase | Read | Build | Done when |
|---|---|---|---|
| 0 Setup | 0–4, 14, 16 | Vite+React+TS, lint, prettier, vitest, folder tree, brand.ts, env.ts, deploy workflow if GitHub Pages, felt-colored placeholder page | `npm run build` and `npm test` pass; owner told what to enable |
| 1 Engine core | 4, 10, 11 | rng, cards (unique ids), deck, events, GameDefinition, registry, LocalSession, sim CLI, tiny "High card" test game | tests + sim pass |
| 2 Table kit | 8, 9, 13 | reference study, tokens, themes, fonts, all card faces and backs, Hand, Pile, Seat + TurnRing, ChipStack, animation queue, SoundManager + fallback, Settings, Home, dev kit page, self-review | dev kit shows everything; screenshots reviewed and top 3 fixes done |
| 3 Call Break | rules/callbreak, 10, 11 | engine, bots, UI, single-player | rule tests + sim pass; full 5-round game vs bots at phone size |
| 4 Local modes | 5, 9, 10 | setup sheet from configSchema, presets, pass-and-play cover, profile, stats, save/resume | Call Break works in all local modes; reload resumes |
| 5 Online | 6, 7 | net layer, lobby, QR/share, reconnect, Auto seats, wake lock, reactions | two tabs and two phones finish a Call Break game; online test passes; hidden-info check passes |
| 6 Rangi | rules/rangi | deck art, engine, bots, house rules, UI, all modes | tests + sim; self-review |
| 7 Langur Burja | rules/langur-burja | dice/bowl/mat, betting UI, banker logic, single/local/online | tests; synced roll on 2 devices |
| 8 Dhumbal + Jut Patti | rules/dhumbal, rules/jut-patti | shared draw/discard table, both engines + bots | tests + sim |
| 9 Teen Patti + Kitti + In Between | rules/teen-patti, rules/kitti, rules/in-between | threeCard evaluator, pot and betting controls, arranging UI | tests + sim |
| 10 Marriage (Opus) | rules/marriage | meld solver, seen/unseen flow, maal reveal, dublee path, scoring, auto-arrange, 2-row hand | tests + sim; solver < 30 ms |
| 11 Polish | 8, 12, 13, 14 | Nepali language, tutorials for all games, PWA, OG image, accessibility and performance passes | Lighthouse ≥ 85; self-review |
| 12 Launch | 7, 15 | QA.md, About/Terms/Privacy, final design review, owner checklist | owner signs off |

After each phase: tests and sim pass, UI screenshots reviewed (UI phases), commit, update PROGRESS.md (done, decisions, next step, owner questions), stop.

## 17. Not now (leave clean hooks only)
- Accounts, cloud saves, leaderboards, matchmaking with strangers (needs a server and moderation).
- Ads: an `<AdSlot/>` component behind `featureFlags.ads = false`, allowed only on Home and Game over, never on the table.
- Native app wrapper (Capacitor), voice chat, free-text chat.
