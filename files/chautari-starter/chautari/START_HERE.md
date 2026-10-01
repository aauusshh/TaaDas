# Start here

This kit splits your "crazy prompt" into files Claude Code reads only when needed. That keeps each session small, which is what lets Sonnet and Haiku build this without burning your usage or losing track.

- CLAUDE.md: short rules Claude Code loads automatically every session
- docs/SPEC.md: the full product, design, and architecture spec (the big prompt)
- docs/rules/*.md: exact rules for each game, with every variant
- docs/PROGRESS.md: memory between sessions, plus questions for you
- docs/MANUAL_STEPS.md: the things only you can do
- .claude/settings.json: stops Claude reading junk files and makes it ask before pushing

## 1. Put the files in your repo
Copy everything (including the hidden .claude folder) into the root of your repo. Do the "Before Phase 0" list in docs/MANUAL_STEPS.md.

## 2. First session: paste this into Claude Code
```
Read CLAUDE.md, docs/PROGRESS.md, and docs/SPEC.md sections 0 to 4, 14 and 16. Then do Phase 0 only.
Hosting: <GitHub Pages | Cloudflare Pages>. App name for now: Chautari.
Create the dev branch first. When Phase 0 passes its checks, commit, update docs/PROGRESS.md, tell me exactly what I must do by hand, and stop.
```

## 3. Every phase after that
Type /clear first, then paste:
```
Continue with the next phase in docs/PROGRESS.md. Read only the SPEC sections and rules files that phase lists in SPEC section 16. Meet every "Done when" check, run tests and the sim, do the design self-review if it's a UI phase, commit, update docs/PROGRESS.md, tell me any manual steps, and stop.
```

## Which model when
- Sonnet: phases 0–9, 11, 12
- Opus: phase 10 (Marriage), and any bug that survives two tries
- Haiku: small mechanical jobs (renaming, text changes, translations, tiny fixes)
Pick the model at the start of a session and don't switch mid-session.

## When something breaks
Paste the exact error and say what you did:
```
After <steps>, I see <exact error or what's wrong>. Expected <what should happen>. Fix only this, run the related tests, and commit.
```

## Saving usage
- /clear between phases (the biggest saver).
- Press Esc as soon as Claude heads the wrong way.
- Don't paste whole files; name the file and the problem.
- If a phase gets long: /compact keep goal, decisions, changed files, failing tests, next step
- Check /usage now and then.
