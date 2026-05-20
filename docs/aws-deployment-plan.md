# AWS Deployment Plan

## Goal

Deploy the Strava workout grass app so it can be viewed over the internet by the owner only, while keeping the existing local sync workflow available.

The deployment should:

- serve the static Vite app from AWS;
- include the generated `data.json` in the deployed site;
- keep Strava credentials and tokens out of git and out of public files;
- allow the current local `npm run sync` workflow to continue working;
- use Strava webhook events as the primary remote sync trigger;
- support a private manual fallback trigger, likely from an iPhone Shortcut.

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

### Phase 2: Webhook-Driven Strava Sync

```text
Strava Webhook Events API
  |
  v
Public webhook endpoint
  - Lambda Function URL
  - GET subscription challenge response
  - POST event receiver
  |
  v
Quick HTTP 200 response
  |
  v
SQS queue
  |
  v
Background sync work
  |
  +-- validate event owner/object/aspect
  +-- debounce and deduplicate events
  +-- fetch latest Strava activity data
  +-- aggregate derived data
  +-- write S3 data.json
  +-- optionally invalidate CloudFront data paths
```

The webhook endpoint is expected to be publicly reachable because Strava needs to call it. It must still reject unrelated or malformed events.

Strava subscription creation sends a `GET` validation request containing `hub.challenge`, `hub.mode`, and `hub.verify_token`. The endpoint must validate the configured verify token and echo the challenge as JSON quickly.

Strava event delivery uses `POST`. The POST handler should respond quickly and avoid long synchronous work. The receiver Lambda should validate accepted events, enqueue them into SQS, and return HTTP 200.

The worker Lambda should be triggered by SQS and reuse the existing aggregation logic where practical.

The local sync path and AWS sync path should share the Strava fetch and aggregation behavior, but use different storage backends:

| Concern | Local | AWS |
| --- | --- | --- |
| Strava client ID/secret | `.env` | SSM Parameter Store |
| Refresh token | `.strava_tokens.json` / `.env` | SSM Parameter Store |
| Generated output | `public/data.json` | S3 `data.json` |
| Invocation | `npm run sync` | Strava webhook / manual Lambda trigger |

### Phase 3: Manual Fallback Trigger

```text
iPhone Shortcut or local curl
  |
  | POST /manual-refresh
  | X-Refresh-Token: secret
  v
Lambda Function URL
  |
  +-- validate secret header
  +-- enqueue a manual refresh event into SQS
```

This avoids putting any refresh secret in public static JavaScript or HTML.

Expected uses:

- force refresh;
- retry failed webhook updates;
- test and debug the AWS sync path;
- temporarily sync when webhook delivery is delayed or disabled.

### Deferred: In-App Refresh Button

An in-app refresh button is no longer the preferred first remote trigger because any secret embedded in static JavaScript would be public to anyone who can view the app.

If added later, it should call a protected backend endpoint through the same owner-only access layer as the app, or use an auth mechanism that does not expose a long-lived shared secret in static files.

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

### 6. Add Lambda Sync Worker

- Package a Lambda handler using Python.
- Store Strava credentials and the current refresh token in SSM Parameter Store.
- Give the Lambda IAM permission to:
  - read/write the required SSM parameters;
  - write `data.json` to the S3 bucket;
  - optionally create CloudFront invalidations for `data.json`;
  - consume messages from the SQS queue;
  - write logs to CloudWatch.
- Invoke the Lambda manually first.
- Confirm that it updates `data.json` in S3.

### 7. Add Strava Webhook Receiver

- Add an HTTP endpoint using Lambda Function URL.
- Implement Strava subscription validation:
  - handle `GET`;
  - validate `hub.verify_token`;
  - echo `hub.challenge` as JSON.
- Implement event receiving:
  - handle `POST`;
  - validate expected owner/athlete ID;
  - accept only relevant `object_type` and `aspect_type` values;
  - ignore duplicate or unnecessary events;
  - enqueue accepted events into SQS;
  - return HTTP 200 quickly.
- Trigger the sync worker from SQS.
- Create the Strava webhook subscription.
- Test create/update/delete event behavior with real activities.

### 8. Add Manual Fallback Trigger

- Add a manual refresh endpoint or route.
- Require a secret request header stored outside the static app.
- Use this from an iPhone Shortcut, local curl, or temporary debugging tool.
- Enqueue a manual refresh event into SQS so it uses the same worker path as webhook events.

### 9. Optional Scheduled Sync

After the webhook and manual fallback are reliable, add EventBridge Scheduler for a daily automatic sync if desired.

This is optional because webhook events should cover normal activity changes.

## Cost Strategy

The expected usage is very small, so the app should be near-free or very low cost.

Use:

- S3 for static files;
- CloudFront for delivery;
- CloudFront Function for Basic Auth;
- Lambda for sync;
- SQS for webhook/manual trigger buffering;
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
- Keep the Strava webhook endpoint public but narrow:
  - validate `hub.verify_token` for subscription challenge requests;
  - validate expected owner/athlete ID on event requests;
  - validate object type and aspect type;
  - ignore unrelated events.
- Protect the manual refresh endpoint with a secret header.
- Do not embed manual refresh secrets in static JavaScript or HTML.
- Rotate Strava credentials if they are accidentally exposed.

## Webhook Event Handling Rules

Initial event filtering:

- accept `object_type=activity`;
- accept `aspect_type=create`;
- accept `aspect_type=delete`;
- accept all `aspect_type=update` events and regenerate the data;
- validate the expected owner/athlete ID from SSM or Lambda environment configuration.

Idempotency and rate limiting:

- treat duplicate events for the same activity as normal;
- store a small sync state record in SSM Parameter Store;
- skip regeneration if the last successful sync was within 60 seconds;
- make full regeneration safe to run repeatedly;
- prefer correctness over trying to apply per-activity deltas at first.

Background processing:

- the receiver should return quickly;
- the receiver should put accepted events onto SQS;
- the worker should consume SQS messages;
- the worker can fetch the recent activity window and regenerate `data.json`;
- the worker should persist rotated Strava refresh tokens;
- the worker should log enough detail to debug ignored events and failed syncs without logging secrets.

## Verification Checklist

Before considering each phase complete:

- Run `npm run build`.
- Run `npm run test:py`.
- Confirm the local app still works at `http://127.0.0.1:5173/`.
- Confirm the deployed app loads `data.json`.
- Confirm S3 direct object access is blocked.
- Confirm CloudFront access requires authentication.
- Confirm Strava webhook subscription validation succeeds.
- Confirm webhook event POSTs are filtered and logged correctly.
- Confirm manual refresh requires the secret header.
- Confirm no ignored personal files are staged in git.

## Open Decisions

- Whether to use CloudFront Function Basic Auth or Cognito for owner-only access.
- Whether scheduled sync is useful after webhook and manual fallback triggers exist.

## Resource Management Approach

Use AWS CLI commands executed one at a time, with AWS Console checks after important steps.

Do not start with a large provisioning script, CDK app, or Terraform module. The first AWS rollout should favor learning, visibility, and easy manual verification.

Record reusable commands with placeholders in [aws-cli-runbook.md](aws-cli-runbook.md). Keep real account IDs, bucket names, distribution IDs, and other private deployment values in local ignored files such as `.aws-deploy.env`.

## Suggested Next Step

Start with Phase 1:

1. create the private S3 bucket;
2. create the CloudFront distribution;
3. add Basic Auth;
4. deploy the existing built app including locally generated `data.json`.

Do not build webhook or manual refresh triggers until static private hosting is working.
