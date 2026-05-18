# AGENTS.md

## Project

Personal Strava workout grass visualization.

The app is intentionally small and personal-use focused:

- Frontend: Vanilla TypeScript + Vite.
- Sync/backend tooling: Python scripts using the standard library where practical.
- Hosting target: static files, usually S3 or another static host.

## Commands

- Install dependencies: `npm install`
- Local dev: `npm run dev -- --port 5173`
- Build: `npm run build`
- Python tests: `npm run test:py`
- Strava sync: `npm run sync`
- Generate Strava auth URL: `npm run auth:url`
- Exchange Strava auth code: `STRAVA_CODE=... npm run auth:exchange`

## Data And Secrets

- Never commit `.env`.
- Never commit `.strava_tokens.json`.
- Never commit `public/data.json`; it contains personal derived workout data.
- Keep `public/sample-data.json` commit-safe and free of real personal data.
- Published JSON should contain only derived totals, not Strava tokens, activity names, maps, or location data.

## Implementation Notes

- Keep the UI iPhone-first and clean by default.
- Use the existing 7-column week grid with newest weeks first.
- Day cells represent performed sports with equal segments in this fixed order: `run`, `swim`, `bike`, `other`.
- Segment opacity is based on sport duration for that day.
- Monthly KPI includes only `run`, `swim`, and `bike` distance.
- `other` should stay gray.

## Verification

Before considering UI or sync changes done, run:

```sh
npm run build
npm run test:py
```

For frontend behavior changes, also verify in the browser at:

```text
http://127.0.0.1:5173/
```
