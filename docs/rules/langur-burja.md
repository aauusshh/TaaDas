# Langur Burja (लङ्गुर बुर्जा)

Six dice. Each die has six faces, always shown with the Nepali name first: Mukut (मुकुट, the crown), Jhanda (झण्डा, the flag), Paan (पान, heart), Hukum (हुकुम, spade), Itta (इट्टा, diamond), Chidi (चिडी, club). The mat has six squares with the same symbols. The game is called Langur Burja (लङ्गुर बुर्जा) everywhere; no other names.
Roles: one banker (साहु; shown as "Banker (साहु)", the host by default) and the players who bet. Up to 10 seats in a room by default (host setting "Max players").

## Round

1. Betting (timer, default 15 s; the banker can close betting early). Players stake chips on one or more symbols. A stake is any whole number in steps of 5 (config: step, min and max per symbol; defaults 5 / 5 / 1000). Each symbol has its own stake. The player taps a symbol, then types the stake or uses +5, +10, +50, +100, −5, Clear and Max. Stakes can be changed or removed freely until the player locks in or betting closes. The total across symbols can never pass the player's chips, and each stake stays within min and max (the screen says why: "Your chips: 120. Lower your stake.").
2. The banker shakes the covered bowl, then lifts it.
3. For each stake: count the dice showing that symbol. A single die does not pay. Default table, as total returned per chip staked: 0 dice → 0 (stake lost); 1 die → 0 (stake lost); 2 dice → 2× (double, profit 1×); 3 dice → 3× (profit 2×); 4 → 4×; 5 → 5×; 6 → 6×. Example: stake 100 on Jhanda. One Jhanda: lose 100. Two: 200 back, profit 100. Three: 300 back, profit 200. The host can edit rows 1 to 6 (0 dice always loses), has a "Reset to default" button, and can save the table as a house rule.
4. The banker pays only the profit and keeps the lost stakes: the banker's balance changes by the opposite of the players' total, so the sum of all changes is 0. The round summary lists each of your stakes ("Stake lost", "2 dice, returns 2x") with the net change.
   History strip of the last 20 rolls with symbol counts.
   Option (default off): banker rotates every N rounds.

## Modes

- Online: host is banker; the host's screen shows the big mat and bowl (works well on a tablet or laptop in the middle of the room); players bet from their own phones. Roll animation is synced: the host sends the result together with an animation start offset so every screen reveals at the same moment. Setup asks no player count: the room opens at once and the host sees a live list of who joined. Host settings in the lobby: "Max players" (default 10, changeable any time, only blocks new joins when full) and "Play with bots" (default off; when on, add or remove bots one at a time). The game starts with the people who joined (and any bots the host added); seats nobody took are dropped.
- Same device: add players by name; tap a player's chip color, then tap symbols to place that player's chips; banker taps "Roll".
- Single-player: you bet, the house is banker, optional 3 bot bettors for atmosphere.

## Fairness and secrecy

Only the host rng decides the roll, and only after betting closes. The result is never sent before that.

## Visuals

Brass bowl seen from above with a lid; dice as 3D CSS cubes with SVG faces (ivory, red and black symbols); cloth mat with printed squares and a soft fold shadow; Tihar theme adds a marigold border and diyo lights on the rim.

## Bot notes

Small random bets spread over 1–3 symbols; sometimes follow the most frequent recent symbol.

## Must test

payout math for 0, 1, 2, 3 and 6 matching dice (a single die loses the stake); free stakes on the step with min, max and chips limits; multiple bets per player; banker balance conservation (sum of all changes = 0); bets locked after close; early close; edited payout table applied.
