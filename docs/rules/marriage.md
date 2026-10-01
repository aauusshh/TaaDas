# Marriage (म्यारिज) — 21-card Nepali Marriage
Hardest game. Build last, use Opus for the engine and meld solver.
Players 2–5 (default 4). Deck: 3 × 52 = 156 cards. Optional Man cards (printed jokers, 0–3, default 0) and one optional Superman card (default off). Direction counter-clockwise.

## Terms
- Pure sequence: 3+ consecutive cards of one suit, no wilds. A-2-3 and Q-K-A are valid; K-A-2 is not.
- Tunnela: 3 identical cards (same rank AND suit). Counts as a pure set when showing.
- Trial: 3 cards of the same rank in different suits (after seeing; wilds allowed).
- Sequence: consecutive same-suit cards using wilds (after seeing).
- Dublee: 2 identical cards (same rank and suit). Wilds can't make a dublee (config: two printed jokers count as a dublee).
- Joker card: a hidden card that is revealed to each player when they "see". Relative to it:
  - Tiplu: same rank and suit as the joker card.
  - Poplu: same suit, one rank above. Jhiplu: same suit, one rank below. (Ranks wrap for maal: tiplu K → poplu A.)
  - Alter: same rank, the other suit of the same color.
  - Ordinary jokers: same rank, the two suits of the other color. Wild, 0 points.
  - Man cards: wild after seeing. Points config (default 0).
  - Superman: wild before and after seeing, usable in pure sequences.
  - After a player has seen, tiplu, poplu, jhiplu, alter, ordinary jokers, and Man cards are all wild in sequences and trials.
- A "marriage" is jhiplu + tiplu + poplu of the tiplu suit together in one sequence.

## Deal and turn
21 cards each. The rest is the stock; flip one card to start the discard pile. Set aside one random stock card face down as the joker card (shown under the stock).
Turn: draw (top of stock, or top of discard if allowed) → optionally show → discard one card face up.
Discard pick rules (config, defaults):
- Unseen sequence player: may take the discard only if it completes a pure sequence or tunnela they show this same turn.
- Dublee player: may take the discard only if it completes their 8th dublee.
- Seen player: may take any discard.
Stock empty: shuffle discards except the top card into a new stock.

## Seeing the maal
- Sequence route: show 3 sets, each a pure sequence or tunnela. Shown cards go face up in front of the player and still count toward their 21.
- Dublee route: show 7 dublees.
- After showing, that player sees the joker card. Players who haven't seen can't use wilds (except Superman) and can't see tiplu markings.

## Finishing
- Sequence route: a seen player, after drawing, discards 1 of 22 and declares. All 21 cards (shown sets + hand) must split into valid sets of 3+ cards: pure sequences, sequences, trials, tunnelas, marriages.
- Dublee route: the game ends when the dublee player forms their 8th dublee.

## Scoring (defaults; all values in a config table, owner to confirm)
Maal points (counted only for players who have seen; see modes):
- Per copies held of the same card: tiplu 3 / 6 / 9 (default linear, owner to confirm), poplu 2 / 5 / 10, jhiplu 2 / 5 / 10, alter 5 / 15 / 25. Man: 0.
- Marriage held: 10 (replaces those three cards' individual points).
- Tunnela of a non-maal card shown: 5.
Settlement (zero-sum): M = total maal of counted players, N = players. Each player i: net = maal_i × N − M.
Winner bonus: each seen player pays the winner 3; each unseen player pays 10. Dublee finish: +5 from each player (config).
Modes (config):
- Classic: unseen players keep their maal points.
- Kidnap: unseen players' maal goes to the winner.
- Murder: unseen players' maal is void.
Points convert to chips at a chip value per point (config, default 10).

## UI
- Hand: two rows in portrait. "Arrange" button groups detected sets with gaps; drag to reorder.
- Select cards → "Show" enables only when the selection forms valid sets for the current stage.
- Shown sets sit face up in front of each player.
- Seen players: the joker card appears next to the stock, and matching maal cards in hand get a small brass corner mark with a label on long-press (Tiplu, Poplu, Jhiplu, Alter, Joker).
- End: ledger with each player's maal breakdown and net.

## Meld solver
Given cards and the wild set, find a full partition into valid sets (backtracking with memo, try pure sets first, sort by suit/rank). Used for finish validation, the Arrange button, and bots. Must run under 30 ms for 22 cards.

## Bot notes
Before seeing: keep cards that build pure sequences or tunnelas; discard isolated high cards; choose the dublee route if the starting hand has 5+ dublees. After seeing: use the solver to minimize unmatched cards; keep maal; track discards (hard).

## Must test
A-2-3 and Q-K-A valid, K-A-2 invalid; tunnela identical only; trial needs distinct suits; wilds only after seeing; Superman before seeing; dublee identical and no wild dublee; finish with wilds; maal wrap K→A; marriage scoring; settlement sums to zero; Classic/Kidnap/Murder; discard pick restrictions; solver speed.
