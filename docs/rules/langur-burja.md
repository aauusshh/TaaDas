# Langur Burja (लङ्गुर बुर्जा)
Six dice. Each die has six faces: Crown, Flag, Heart (Paan, पान), Spade (Hukum, हुकुम), Diamond (Itta, इट्टा), Club (Chidi, चिडी). Owner will confirm the Nepali names for Crown and Flag. The mat has six squares with the same symbols.
Roles: one banker (the host by default) and 1–10 players who bet.

## Round
1. Betting (timer, default 15 s; the banker can close betting early). Players place chips on one or more symbols. Chip values 10 / 50 / 100 / 500 (config). Min and max bet per symbol (config).
2. The banker shakes the covered bowl, then lifts it.
3. For each bet: count the dice showing that symbol. Default payout table: 0 → lose the stake; 1 → win 1× the stake (plus stake back); 2 → 2×; 3 → 3×; 4 → 4×; 5 → 5×; 6 → 6×. The host can edit every row of the table and save it as a house rule.
4. The banker's balance changes by the opposite amount. Show a short round summary: who won or lost what.
History strip of the last 20 rolls with symbol counts.
Option (default off): banker rotates every N rounds.

## Modes
- Online: host is banker; the host's screen shows the big mat and bowl (works well on a tablet or laptop in the middle of the room); players bet from their own phones. Roll animation is synced: the host sends the result together with an animation start offset so every screen reveals at the same moment.
- Same device: add players by name; tap a player's chip color, then tap symbols to place that player's chips; banker taps "Roll".
- Single-player: you bet, the house is banker, optional 3 bot bettors for atmosphere.

## Fairness and secrecy
Only the host rng decides the roll, and only after betting closes. The result is never sent before that.

## Visuals
Brass bowl seen from above with a lid; dice as 3D CSS cubes with SVG faces (ivory, red and black symbols); cloth mat with printed squares and a soft fold shadow; Tihar theme adds a marigold border and diyo lights on the rim.

## Bot notes
Small random bets spread over 1–3 symbols; sometimes follow the most frequent recent symbol.

## Must test
payout math for every count; multiple bets per player; banker balance conservation (sum of all changes = 0); bets locked after close; early close; edited payout table applied.
