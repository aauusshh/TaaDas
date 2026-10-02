# Kitti (किट्टी)

Players 2–5 (default 4). Deck 52. 9 cards each. Chips. Direction counter-clockwise.

## Arrange

Everyone arranges their 9 cards into 3 groups of 3 (Show 1, Show 2, Show 3) at the same time, with a timer (default 60 s). "Auto arrange" button. On timeout, auto-arrange. Config (default off): groups must be in descending strength.

## Group ranking (shared threeCard evaluator)

Optional top hand (default off): 2-3-5 of mixed suits beats everything.
Then: Trail > Pure run > Run > Color > Pair > High card. A-K-Q highest run, A-2-3 second (config).

## Showdown

Compare everyone's Show 1; the best wins that show. Then Show 2, then Show 3. Tie for best in a show: config, default nobody wins that show; option the earlier player in turn order wins.

- Winner: a player wins 2 shows (config: any 2 of 3, default; or 2 in a row).
- Salami: a player wins all 3. Bonus: every other player pays an extra boot (config).
- Kitti: nobody meets the win condition. Pot carries over, redeal.
  Chips: everyone pays the boot (default 10) before the deal; winner takes the pot. Config (default off): a player may pack before arranging, losing only the boot.

## Bot notes

There are exactly 280 ways to split 9 cards into 3 groups of 3. Medium: pick the split with the strongest groups in order. Hard: pick the split that maximizes the chance of winning 2 shows, by sampling opponents' hands.

## Must test

280 partitions; group ranking; tie rule options; win, salami, kitti; pot carry-over; timeout auto-arrange.
