# Dhumbal / Jhyap (धुम्बल / झ्याप)
Players 2–7 (default 4). Deck 52, optional 2 jokers worth 0. Deal 5 each (config 5 or 7). Direction counter-clockwise.
Card values: A = 1, 2–10 face value, J = 11, Q = 12, K = 13 (config: J/Q/K = 10).
Start: deal, flip the top stock card to begin the discard.

## Turn
Either call Jhyap (if allowed), or throw then pick:
- Throw one of: a single card; 2–4 cards of the same rank; a run of 3+ consecutive cards of one suit (Ace low only). Config: jokers may fill a set or run (default off).
- Pick exactly one: the top stock card, or one of the cards the previous player just threw (from a set any card; from a run only an end card, config "any card").
- Config (default off): if the card you pick from the stock matches the rank you just threw, you may throw it immediately.

## Jhyap
At the start of your turn, if your hand total ≤ limit (config 5 / 7 / 10 / 13, default 10). Not allowed during the first round of turns (config).
Everyone reveals:
- Caller strictly lowest: caller scores 0; everyone else adds their hand total.
- Anyone equal or lower (counter-jhyap): caller adds their total plus a penalty (default 25); the lowest other player scores 0; others add their totals.

## Game
A player whose score goes over 100 is out (exactly 100 stays). Config limit 100 / 150 / 200. Last player left wins. Option: fixed number of rounds, lowest total wins.
Stock empty: shuffle discards except the latest throw.

## Bot notes
Throw the combination that lowers the total most while keeping low cards; pick from the discard if it's ≤ 3 or builds a set/run; call when under the limit and the estimated opponent minimum (from what they picked up) is higher. Hard tracks pickups.

## Must test
values both configs; valid and invalid throws; run end picks; Jhyap limit; first-round block; counter-jhyap including ties; elimination at >100 not =100; stock reshuffle.
