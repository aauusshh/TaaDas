# Things you do by hand

## Before Phase 0
1. Install Node.js (LTS version) from nodejs.org, Git, and Claude Code.
2. Clone your repo and copy these files in, keeping the folders: CLAUDE.md at the root, docs/, and .claude/. Commit and push them yourself.
3. Choose hosting:
   - GitHub Pages: on a free GitHub account it works only with a PUBLIC repo (private + Pages needs a paid plan). If you're fine making it public: Settings → General → Change visibility → Public. Then Settings → Pages → Build and deployment → Source: "GitHub Actions".
   - Keep the repo private: use Cloudflare Pages (free). In the Cloudflare dashboard: Workers & Pages → Create → Pages → Connect to Git → choose the repo → build command `npm run build`, output folder `dist`, environment variable `VITE_BASE` = `/`.
4. Write your choice and the app name in docs/PROGRESS.md under "Owner decisions".

## During the build
- Phase 2 (recommended): download free CC0 sounds from kenney.nl → Assets (the "Casino Audio" and "Interface Sounds" packs). Unzip and put the sound files in public/sounds/raw/. Claude picks and renames what it needs. CC0 means no credit required.
- Whenever "Questions for owner" in PROGRESS.md has items, write your family's rules under each question.
- Phase 5 (online): test with a friend on a different network (one of you on mobile data). If connecting often fails, sign up for a free TURN relay service and add its details as repository secrets VITE_TURN_URLS, VITE_TURN_USERNAME, VITE_TURN_CREDENTIAL (Settings → Secrets and variables → Actions; or Cloudflare Pages environment variables). These values end up visible in the website code, so use a free or limited account.
- Phase 11: read the Nepali text (src/i18n/ne.json) and fix anything that sounds unnatural.
- Test on real phones: a cheap Android, an iPhone if possible, portrait and landscape.

## Before sharing publicly
- Read the About, Terms, and Privacy pages.
- Go through docs/QA.md on real phones with friends.
- Merge `dev` into `main` (or ask Claude to) so it deploys.
- Ads later: apply only after the site has real players, and keep the "chips have no money value" text visible.
