# QA checklist (real phones)

Do this on a cheap Android phone and, if you can, an iPhone. Portrait and landscape. Mark each line.
Automated checks already cover rules and flows; this list is for feel, touch and network.

## Before you start
- [ ] Open the site link. Home shows in under 20 seconds on mobile data.
- [ ] Add to home screen. The icon looks right and the app opens full screen.
- [ ] Turn on airplane mode, reopen the app: Home and a game against bots still work.
- [ ] Settings: switch language to Nepali and back. Text fits in buttons and sheets.

## Every game (do each: Call Break, Marriage, Teen Patti, Dhumbal, Jut Patti, Kitti, In Between, Rangi, Langur Burja)
- [ ] Open the game, read Rules, tap "Try a practice round". Hints highlight a move.
- [ ] Play a full game against bots. Nothing freezes, no card or chip disappears.
- [ ] Rotate the phone mid-game. The table re-lays out and nothing is cut off.
- [ ] Every tap target is comfortable with a thumb (nothing tiny, nothing overlapping).
- [ ] Menu: Rules, Settings, Leave table. Leaving asks first.
- [ ] Reload the page mid-game, then "Continue game" on Home resumes at the same point.
- [ ] Turn timer on (15 s): let it run out twice. The seat goes to Auto, "I'm back" returns control.
- [ ] Sound on: shuffle, deal, place, chips are audible and not harsh. Sound off: silence.
- [ ] Game over screen: shows the free-play chips note. Rematch works.

## Same device
- [ ] Setup: "Same device", make two people. The "Pass to <name>" cover hides the previous player's cards.
- [ ] Lock the screen and unlock: the cover is back before cards are shown.
- [ ] Langur Burja: banker holds the phone, picks a player color, taps symbols to place that player's chips.

## Online (use two phones, one on mobile data)
- [ ] Create a room, share the link by WhatsApp/Viber. The preview shows the Chautari image.
- [ ] Join by typing the code, by link and by scanning the QR.
- [ ] Both players tap Ready, host starts, a full game finishes.
- [ ] Guest closes the tab mid-game and reopens the link: same seat, game continues. Meanwhile a bot played ("Auto").
- [ ] Host locks the screen for 20 seconds: guest sees "Waiting for the host" with a countdown, then play resumes.
- [ ] Spectator joins and watches without seeing anyone's hidden cards.
- [ ] Reactions appear next to the sender's seat.
- [ ] If connecting often fails, add a TURN service (see docs/MANUAL_STEPS.md).

## Rules to confirm with your family (Questions for owner in docs/PROGRESS.md)
- [ ] Marriage maal values, bonuses, Man and Superman cards.
- [ ] Call Break max bid and redeal rules.
- [ ] Dhumbal Jhyap limit, J/Q/K values, counter-Jhyap penalty.
- [ ] Jut Patti joker rule, pair color.
- [ ] Kitti win rule and tie rule.
- [ ] Langur Burja payouts and the Nepali names for the crown and the flag.
- [ ] Nepali text in src/i18n/ne.json reads naturally.

## Automated checks you can run on your computer
- `npm test` (rules and guardrails), `npm run sim -- --game all --n 2000` (bot games),
  `npm run lint`, `npm run typecheck`, `npm run build`.
- With `npm run dev` running in another terminal: `npm run e2e:online` (two browsers through the PeerJS cloud), and the
  scripts in `e2e/` (play a full game through the UI at phone size).
