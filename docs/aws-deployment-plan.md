# AWS Deployment Plan

## Goal

Deploy the Strava workout grass app so it can be viewed over the internet by the owner only, while keeping the existing local sync workflow available.

The deployment should:

- serve the static Vite app from AWS;
- include the generated `data.json` in the deployed site;
- keep Strava credentials and tokens out of git and out of public files;
- allow the current local `npm run sync` workflow to continue working;
- later support an in-app refresh button that triggers a remote Strava sync.

## Current State

- Frontend: Vanilla TypeScript + Vite.
- Local data sync: `scripts/strava_sync.py`.
- Aggregation logic: `scripts/aggregate.py`.
- App data source: `/data.json`, with fallback to `/sample-data.json`.
- Local generated data: `public/data.json`.
- Local secrets:
  - `.env`
  - `.strava_tokens.json`
- Ignored personal data:
  - `public/data.json`
  - `.strava_tokens.json`

This is a good foundation because the public app only needs derived workout totals, not raw Strava activity data or tokens.

## Target Architecture

### Phase 1: Static Private Hosting

```text
Browser
  |
  v
CloudFront
  |
  v
Private S3 bucket
  - index.html
  - assets/*
  - data.json
  - sample-data.json
```

Use S3 as a private origin and CloudFront as the only public entry point.

Access control options:

- Preferred first step: CloudFront Function Basic Auth.
- Stronger later option: Cognito, signed cookies, or another identity-aware layer.

Avoid public S3 website hosting because the bucket would be easier to expose accidentally.

### Phase 2: Remote Strava Sync

```text
Manual trigger or Lambda Function URL
  |
  v
Lambda
  |
  +-- Strava API
  +-- SSM Parameter Store for Strava credentials/tokens
  +-- S3 put_object for data.json
```

The Lambda should reuse the existing aggregation logic where practical.

The local sync path and AWS sync path should share the Strava fetch and aggregation behavior, but use different storage backends:

| Concern | Local | AWS |
| --- | --- | --- |
| Strava client ID/secret | `.env` | SSM Parameter Store |
| Refresh token | `.strava_tokens.json` / `.env` | SSM Parameter Store |
| Generated output | `public/data.json` | S3 `data.json` |
| Invocation | `npm run sync` | Lambda |

### Phase 3: In-App Refresh Button

```text
Browser
  |
  | POST /api/refresh
  v
CloudFront
  |
  v
Lambda Function URL or API Gateway
  |
  v
Lambda sync
  |
  v
S3 data.json updated
  |
  v
Browser refetches /data.json with cache busting
```

This should be added after the Lambda sync works independently.

The refresh endpoint must be protected. It should not be a public unauthenticated URL.

## Recommended Implementation Order

### 1. Prepare AWS Account Safety

- Enable MFA on the AWS root account.
- Create an IAM user or role for deployment.
- Set an AWS Budget alert, for example 1 USD/month.
- Use one region consistently, preferably close to the owner.

### 2. Create Static Hosting

- Create a private S3 bucket for the built site.
- Block all public access on the bucket.
- Create a CloudFront distribution with S3 as the origin.
- Use Origin Access Control so only CloudFront can read from S3.
- Add a CloudFront Function for Basic Auth.
- Confirm that the app is not accessible directly through S3.

### 3. Deploy the Current App With Local Data

- Run `npm run sync` locally to generate `public/data.json`.
- Run `npm run build`.
- Upload `dist/` to the S3 bucket.
- Confirm that CloudFront serves the app and `data.json`.
- Confirm that `public/data.json` is still not committed to git.

### 4. Add Deployment Automation

Add a local deploy command or script that:

- runs `npm run build`;
- syncs `dist/` to S3;
- invalidates CloudFront paths if needed.

Keep this local at first. Do not introduce remote sync yet.

### 5. Refactor Sync Code for Reuse

Refactor the Python sync code so that the core workflow can be reused:

- load Strava credentials;
- refresh access token;
- fetch activities;
- aggregate activities;
- write generated data;
- persist rotated refresh token.

The local entry point should keep writing to `public/data.json`.

The AWS entry point should write to S3 and update SSM Parameter Store.

### 6. Add Lambda Sync

- Package a Lambda handler using Python.
- Store Strava credentials and the current refresh token in SSM Parameter Store.
- Give the Lambda IAM permission to:
  - read/write the required SSM parameters;
  - write `data.json` to the S3 bucket;
  - write logs to CloudWatch.
- Invoke the Lambda manually first.
- Confirm that it updates `data.json` in S3.

### 7. Add UI Refresh Button

- Add a small refresh control near the updated timestamp.
- On click, call the protected refresh endpoint.
- Show loading, success, and error states.
- After success, refetch `/data.json` with a cache-busting query parameter.
- Re-render the app.

### 8. Optional Scheduled Sync

After the manual refresh flow is reliable, add EventBridge Scheduler for a daily automatic sync.

This is optional because the in-app refresh button may be enough for personal use.

## Cost Strategy

The expected usage is very small, so the app should be near-free or very low cost.

Use:

- S3 for static files;
- CloudFront for delivery;
- CloudFront Function for Basic Auth;
- Lambda for sync;
- SSM Parameter Store instead of Secrets Manager unless Secrets Manager rotation is explicitly needed.

Avoid at first:

- Route 53 custom domain;
- AWS WAF;
- NAT Gateway;
- always-on compute;
- database services.

Set an AWS Budget alert before deploying anything public.

## Security Notes

- Never commit `.env`.
- Never commit `.strava_tokens.json`.
- Never commit `public/data.json`.
- Do not publish raw Strava activity names, maps, coordinates, or tokens.
- Keep S3 Block Public Access enabled.
- Prefer CloudFront-only access to S3.
- Protect any refresh endpoint before connecting it to the UI.
- Rotate Strava credentials if they are accidentally exposed.

## Verification Checklist

Before considering each phase complete:

- Run `npm run build`.
- Run `npm run test:py`.
- Confirm the local app still works at `http://127.0.0.1:5173/`.
- Confirm the deployed app loads `data.json`.
- Confirm S3 direct object access is blocked.
- Confirm CloudFront access requires authentication.
- Confirm no ignored personal files are staged in git.

## Open Decisions

- Whether to use CloudFormation, CDK, Terraform, or manual AWS console setup.
- Whether to use CloudFront Function Basic Auth or Cognito for owner-only access.
- Whether the first AWS sync trigger should be manual Lambda invocation or a protected HTTP endpoint.
- Whether scheduled sync is useful after the refresh button exists.

## Suggested Next Step

Start with Phase 1:

1. create the private S3 bucket;
2. create the CloudFront distribution;
3. add Basic Auth;
4. deploy the existing built app including locally generated `data.json`.

Do not build the refresh button until static private hosting is working.
