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
- AWS static deploy: `npm run deploy:aws`
- Render ignored local AWS files: `npm run aws:render-local`
- Package AWS Lambda zip: `npm run aws:package-lambda`

## Data And Secrets

- Never commit `.env`.
- Never commit `.strava_tokens.json`.
- Never commit `.aws-deploy.env`.
- Never commit generated local AWS files such as `.aws-cloudfront-basic-auth.js`, `.aws-cloudfront-distribution-config.json`, `.aws-s3-bucket-policy.json`, or `.aws-iam-*.json`.
- Never commit `public/data.json`; it contains personal derived workout data.
- Keep `public/sample-data.json` commit-safe and free of real personal data.
- Published JSON should contain only derived totals, not Strava tokens, activity names, maps, or location data.
- Store local AWS deployment values in `.aws-deploy.env` and back them up in a password manager or other private secret store.

## AWS Deployment Notes

- Static hosting uses private S3 behind CloudFront.
- CloudFront owner-only access currently uses a CloudFront Function Basic Auth gate.
- Remote sync uses Strava webhook events sent to a Lambda Function URL, SQS buffering, and a worker Lambda that regenerates `data.json`.
- Manual refresh uses a separate Lambda Function URL protected by the `x-refresh-token` header.
- AWS setup is intentionally CLI-first and run one command at a time, with reusable placeholder commands documented in `docs/aws-cli-runbook.md`.
- Keep real AWS account IDs, bucket names, distribution IDs, Function URLs, ARNs, webhook subscription IDs, and generated tokens out of committed docs.

## Implementation Notes

- Keep the UI iPhone-first and clean by default.
- Use the existing 7-column week grid with newest weeks first.
- Future dates after today are hidden with placeholder cells so the 7-column grid stays aligned.
- Day cells represent performed sports with equal regions in this fixed order: `run`, `swim`, `bike`, `other`.
- Day cells are rendered with absolutely positioned `.day-region` layers using `clip-path`; avoid SVG, conic gradients, or opacity-only color levels unless there is a specific reason.
- Sport intensity uses four discrete color levels per sport, selected by sport-specific duration thresholds in `src/main.ts`.
- Monthly KPI includes only `run`, `swim`, and `bike` distance.
- KPI is sticky and updates to the visible month while scrolling.
- Clicking the KPI area toggles a monthly history view for RUN/SWIM/BIKE without changing the four-column card layout.
- Clicking the selected day cell or the open detail card closes the detail card.
- The header image controls should remain compact icon buttons above the updated timestamp: share first, then download.
- The saved image is generated from canvas in `src/main.ts` as a landscape GitHub-contribution-style grid.
- The saved image should use the current theme, show `Stravaw` as the title, include an updated timestamp with the year, use uppercase month and weekday labels, and omit monthly KPI cards.
- Saved image sharing should prefer Web Share API file sharing when available, with PNG download as the share fallback; the download icon should always use PNG download.
- Theme switching is implemented via `THEMES` in `src/main.ts`; the default theme is `May`.
- The initial theme can be selected with the `theme` URL query parameter, matched case-insensitively to a `THEMES` key; selecting the default `May` theme should remove the parameter.
- When adding themes, keep all sport palettes to four ordered levels and include card background/border colors.
- `other` should stay gray or neutral across themes.

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
