# Rangi (रंगी) — our color-matching shedding game

Never use the name "UNO", its logo, its white tilted oval, or its card layout. Same family of rules (match color or number), our own identity.
Players 2–10 (default 4). Direction clockwise by default (toggle).

## Deck (108)

Four colors with our own names and tones, each with a corner symbol so color-blind players can tell them apart:

- Sindoor #D2232A — symbol: sun
- Marigold #F2A900 — symbol: flower
- Sky #1C6DD0 — symbol: mountain
- Leaf #2E9A4F — symbol: leaf
  Per color: one 0; two each of 1–9; two Skip; two Reverse; two Draw Two. Plus 4 Wild and 4 Wild Draw Four.

## Card design

Full-bleed color, a large central numeral in Rozha One inside a rounded-square window (not an oval), small corner indices with the color symbol, a faint dhaka-style geometric texture at about 8% opacity. Our own action icons: Skip = a raised open palm, Reverse = two curved arrows, Draw Two = "+2" over two small stacked cards. Wild: black card with four color petals arranged like a mandala. Back: black with the "Rangi" wordmark in Rozha One and a thin four-color thread line.

## Rules (defaults)

- Deal 7. Flip the first discard. If it's Wild Draw Four, put it back and flip again. If it's an action card, its effect applies to the first player (Wild: first player picks the color).
- On your turn play a card matching the color, number, or symbol, or a Wild. Otherwise draw 1; you may play it if it fits.
- Skip: next player loses their turn. Reverse: direction flips (with 2 players it acts as Skip). Draw Two: next player draws 2 and loses their turn. Wild: choose a color. Wild Draw Four: choose a color; next player draws 4 and loses their turn; only legal if you have no card of the current color.
- Challenge (toggle, default on): the next player may challenge a Wild Draw Four. If it was illegal, the player who played it draws 4 instead; if legal, the challenger draws 6.
- Last card: when you go down to one card, tap "Ek!" (एक!) before the next player acts. If another player taps "Caught!" first, you draw 2. Bots call it (easy bots sometimes forget).
- Round ends when someone plays their last card. Scoring: the winner gets points from everyone's remaining cards: number cards face value, Skip/Reverse/Draw Two 20, Wilds 50. Game to 500 (config) or single round.

## House rules (toggles, default off)

Stacking (Draw Two on Draw Two, Draw Four on Draw Four, config whether mixed); Seven-zero (7 swaps hands with a chosen player, 0 passes every hand in the play direction); Jump-in (play an identical card out of turn; host decides races by arrival order); Draw until you can play; Must play if able; No challenge; Progressive drawing.

## Bot notes

Keep wilds for later; use actions against the player with the fewest cards; pick the color you hold most of; call "Ek!".

## Must test

deck composition = 108; legality matrix; first-card effects; Reverse with 2 players; Draw Four legality and challenge outcomes; Ek/Caught timing; stacking; Seven-zero; jump-in; scoring.
