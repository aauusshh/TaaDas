# Jut Patti (जुटपत्ती)

Players 2–6 (default 4). Deck 52. Deal an odd number each: 5 / 7 / 9 / 11 (default 7); block combinations that leave fewer than 10 stock cards. Direction counter-clockwise.

## Joker

After the deal, flip the top stock card face up and tuck it under the stock (the indicator). Default: every card one rank above the indicator, any suit, is a joker (K → A, A → 2). Config: same rank as the indicator.

## Pairs (jut)

Two cards of the same rank. Config (default off): must also be the same color. A joker pairs with any card; two jokers pair.

## Turn

Draw from the stock or take the previous player's discard. If your whole hand (now an even number) is all pairs, declare and win. Otherwise discard one card. The first player draws from the stock.
Stock empty: shuffle the discards except the top card; the indicator stays.

## Scoring

Winner +1 per round; match to 3 / 5 / 7 wins (config) or single round. Chips option: each other player pays the winner a set amount.

## Bot notes

Keep pairs and jokers; discard the card whose rank is most "dead" (copies already discarded); easy may discard a joker by mistake.

## Must test

joker rank wrap; color option; two jokers pair; win detection with 8 cards from a 7-card deal; take-discard flow; reshuffle.
