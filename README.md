# Stravaw - Strava Workout Grass

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

## Theme links

The default theme is May. To open with another theme selected, add a `theme` query parameter:

```text
/?theme=Neon
/?theme=Apple
/?theme=Cyberpunk
/?theme=Muted
```

## Sync Strava data

```sh
npm run sync
```

The sync command refreshes the Strava access token, fetches recent activities, aggregates them by local start date, and writes `public/data.json`. Rotated tokens are stored in `.strava_tokens.json`, which is ignored by git.

Published JSON contains only derived totals:

- daily seconds and distance for `run`, `swim`, `bike`, and `other`
- monthly distance totals for `run`, `swim`, and `bike`

It does not publish tokens, activity names, maps, or location data.

## Deploy to AWS

```sh
AWS_DEPLOY_S3_URI=s3://your-private-bucket/site \
AWS_CLOUDFRONT_DISTRIBUTION_ID=E123EXAMPLE \
npm run deploy:aws
```

This builds the static site, syncs `dist/` to S3, and creates a CloudFront invalidation when `AWS_CLOUDFRONT_DISTRIBUTION_ID` is set.
By default, it does not upload `data.json`; remote sync may have newer hosted data than your local copy.

To intentionally deploy local generated data, refresh it first:

```sh
npm run sync
AWS_DEPLOY_INCLUDE_DATA=1 npm run deploy:aws
```

Recommended AWS hosting setup:

- private S3 bucket with Block Public Access enabled
- CloudFront distribution using S3 as a private origin
- Origin Access Control so only CloudFront can read the bucket
- CloudFront Function Basic Auth, or a stronger owner-only access layer

Local-only AWS config lives in `.aws-deploy.env`, which is ignored by git. After filling it in, regenerate derived local AWS files with:

```sh
npm run aws:render-local
```

See [docs/aws-deployment-plan.md](docs/aws-deployment-plan.md) for the staged rollout plan.
