# Strava Workout Grass

Personal, iPhone-first workout visualization for Strava activities.

## Setup

```sh
npm install
cp .env.example .env
```

Create a Strava API app, then put your client ID, client secret, and refresh token in `.env`.
Use `activity:read_all` if you want private activities included.

To get the first refresh token:

```sh
npm run auth:url
```

Open the printed URL, approve the app, and copy the `code` query parameter from the redirected `localhost` URL.

```sh
STRAVA_CODE=the-code-from-the-url npm run auth:exchange
```

## Local development

```sh
npm run dev
```

The app reads `public/data.json`. If it is missing, it falls back to `public/sample-data.json`.

## Sync Strava data

```sh
npm run sync
```

The sync command refreshes the Strava access token, fetches recent activities, aggregates them by local start date, and writes `public/data.json`. Rotated tokens are stored in `.strava_tokens.json`, which is ignored by git.

Published JSON contains only derived totals:

- daily seconds and distance for `run`, `swim`, `bike`, and `other`
- monthly distance totals for `run`, `swim`, and `bike`

It does not publish tokens, activity names, maps, or location data.

## Deploy to S3

```sh
S3_URI=s3://your-bucket/secret-path npm run deploy:s3
```

This builds the static site and syncs `dist/` to S3. Use a hard-to-guess bucket path or CloudFront path for lightweight personal access control.
