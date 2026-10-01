# Design notes

## Reference study (no web access, so section 8.3 conventions used)
- Real tables: cards overlap about 40%, fan is shallow, piles show thickness.
- Seats are small: avatar, name, one number. Anything more is noise on a phone.
- Turn is signaled by the ring on the avatar draining, not by banners.
- Scores belong on paper (ledger), away from the table surface.
- Deal is staggered; one shuffle sound, then flicks.
- Wins get one short celebration at game end only.
- Opponent hands are stacked backs with a count, not fanned.
- Menus are objects on the table (cards, bowl) with paper tags for names.

## Phase 2 self-review (360x740, 740x360, 1366x768)
- Would a player think a person designed this? Home reads as a table with things laid on it; card faces have our own courts (crown, lotus, topi). Yes, mostly.
- Generic: sheets, buttons and the settings list still look standard; avatars are simple glyphs.
- Fixed: Home showed one game per row in portrait (object width too wide), now two per row with offset drops.
- Fixed: landscape objects were too wide, narrowed so more fit beside the join panel.
- Fixed: no CSS drop-shadow filters on cards (perf), box-shadow only.
- Next: add paper ledger and table layout in Phase 3; revisit avatars and court emblem detail in Phase 11.
