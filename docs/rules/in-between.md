# In Between
Players 2–8 (default 5). Deck 52 (reshuffle when fewer than 3 cards remain). Chips. Direction counter-clockwise.

## Round
Everyone antes (default 10) at the start and whenever the pot is empty.
On your turn, two cards are dealt face up (the posts).
- If the first post is an Ace, you choose high or low (config: Ace always high).
- Posts equal or consecutive: no gap. Default: you pass at no cost. Config for equal posts: bet whether the next card is higher or lower (matching the posts pays double).
- Otherwise bet from the minimum (default 10) up to the pot or your chips, or pass.
- Third card: strictly between → you win your bet from the pot. Outside → your bet goes to the pot. Equal to a post → you pay double your bet into the pot.
Game end: fixed number of rounds around the table (default 5), or when the pot is empty and nobody wants to ante again.

## Bot notes
Bet proportional to the chance the next card falls between (hard counts remaining cards); pass on gaps under 4 ranks.

## Must test
payouts; post double; ace choice; no-gap pass; bet cap by pot and chips; reshuffle.
