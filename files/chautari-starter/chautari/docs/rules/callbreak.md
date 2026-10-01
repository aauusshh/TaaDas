# Call Break (कल ब्रेक)
Players: exactly 4 (bots fill). Deck: 52. Direction: counter-clockwise (toggle). Ace high. Spades (हुकुम) are always trump.

## Deal
Random first dealer, then the deal passes to the next player. 13 cards each.
Redeal (config, default on): if any hand has no spade. Option (default off): also redeal if a hand has no J, Q, K or A.

## Bidding
Starting after the dealer, each player bids once from 1 to maxBid (config 13, option 8). No passing.

## Play
Player after the dealer leads the first trick; each trick's winner leads the next. Enforce legality and only enable legal cards:
1. If you have the led suit, you must play it. If no spade has been played in this trick, you must also beat the highest card of the led suit so far, if you can.
2. If you don't have the led suit, you must play a spade if you have one, and beat any spade already in the trick if you can. Config `mustTrumpWhenCantBeat` (default true): if you can't beat the spade already played, you still must play a spade. If false, you may play any card.
3. Otherwise, any card.
Trick winner: highest spade if any, else highest card of the led suit.

## Scoring per round
- Made bid: +bid + 0.1 per extra trick (bid 4, won 6 → 4.2).
- Failed: −bid.
- Option (default off): made bid of 8 or more scores 13.
Game: 5 rounds (config 1–10). Highest total wins; ties share the win.

## UI
Bid picker as a row of number chips; seat shows "won/bid"; last trick reviewable; score ledger with one column per player.

## Bot notes
Medium bid estimate: A♠ 1; K♠ 1 if 2+ spades; Q♠ 1 if 3+ spades; each other ace 1; each other king 0.5 if suit has 2–3 cards; +0.5 per spade beyond 3; round, min 1. Play: win tricks cheaply while short of bid, dump high losers once the bid is made, remember played cards. Hard: track voids, sample hidden hands.

## Must test
must-overtake within suit; no overtake needed once trumped; must trump when void; overtrump; can't-overtrump still plays spade (and the false option); scoring made/extra/failed; 8+ option; redeal; lead passes to trick winner.
