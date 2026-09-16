# spotify-stats

Personal Spotify listening stats app — a stats.fm-style tool built on two
merged data sources:

1. **Spotify Extended Streaming History** — the official export from Spotify's
   privacy/data-download tool. One-time export, covers all listening up to
   the date it was generated.
2. **Live-polled listening data** — collected by a separate project (the
   StandBy TV dashboard), which polls Spotify's `recently-played` API every
   15 minutes and stores results in Upstash Redis under the key
   `play-history`. That key trims entries older than 30 days, so this repo's
   backup job exists to pull data out before it ages off.

## What's in this repo right now

- `backup.js` — fetches the full `play-history` array from Upstash, splits
  entries into monthly files under `data/`, and merges new entries in
  without creating duplicates.
- `.github/workflows/backup.yml` — runs `backup.js` once a day (03:00 UTC)
  via GitHub Actions, then commits any new data back to this repo. Can also
  be triggered manually from the Actions tab.
- `data/YYYY-MM.json` — one file per month of listening history, created
  automatically as the backup runs.

## Setup

Two repo secrets are required (Settings → Secrets and variables → Actions):

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Both come from the Upstash console for the Redis database that the StandBy
dashboard project uses.

## Status

- [x] Daily backup of live-polled data (this repo)
- [ ] Merge schema decided (Extended History export vs. live-poll shape)
- [ ] Extended History export merged in
- [ ] Actual stats app (views, tech stack) — not started

This repo is separate from the StandBy TV dashboard project — it only reads
the `play-history` key as a consumer and never modifies StandBy's backend.
