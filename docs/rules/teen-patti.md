# Teen Patti (तिनपत्ती)
Players 2–7 (default 4). Deck 52. 3 cards each. Chips. Direction counter-clockwise.

## Hand ranking (shared evaluator src/engine/core/threeCard.ts, also used by Kitti)
1. Trail: three of a kind (AAA high, 222 low)
2. Pure sequence: straight flush
3. Sequence: straight
4. Color: flush
5. Pair
6. High card
A-K-Q is the highest sequence, A-2-3 second highest (config: A-2-3 lowest). K-A-2 is not a sequence.
Ties: compare by category rules (pair rank, then kicker; otherwise highest card down). Suits never break ties. Exact tie at a show: config, default the player who asked for the show loses; option split.

## Round
Everyone puts the boot (config, default 10) in the pot. Everyone starts blind. On your turn you may look at your cards (become seen) before acting.
Stake S starts at the boot.
- Blind: bet S, or raise by betting 2S (then S doubles).
- Seen: bet 2S (chaal), or raise by betting 4S (then S doubles).
- Pack (fold) any time on your turn.
- Side show: a seen player may, as their bet, ask the previous active seen player to compare. That player accepts or refuses. If accepted, the lower hand packs; on a tie the asker packs.
- Show: only when 2 players remain. Seen pays 2S, blind pays S. Hands compared, winner takes the pot.
Limits (config): max blind turns 4 (then must look), max stake 128 × boot, pot limit 1024 × boot (reaching it forces a show of all remaining players).

## Variants (toggles)
Classic; Muflis (lowest hand wins); AK47 (every A, K, 4, 7 is wild); Joker (after the deal, flip one card: its rank is wild). Wild hands evaluate to the best possible hand.

## Timeout
Pack (configurable: auto-chaal for blind players).

## Bot notes
Precompute strength percentile for all 22,100 hands. Bet, raise, or pack by percentile thresholds per difficulty; play blind for a few turns at random; hard bluffs about 8% of the time and uses side shows when ahead.

## Must test
full category order; A-2-3 vs A-K-Q both configs; tie breaks; blind vs seen stake math; raises; side show accept/refuse/tie; show costs; max blind turns; pot limit auto-show; Muflis inversion; AK47 and Joker best-hand.
