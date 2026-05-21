# AWS CLI Runbook

This runbook records the AWS CLI workflow without committing private resource names, account IDs, or secrets.

Use placeholders in committed docs and scripts. Keep real values in `.aws-deploy.env`, which is ignored by git.

## Local Configuration

Create a local-only config file:

```sh
cp .aws-deploy.env.example .aws-deploy.env
```

Edit `.aws-deploy.env` with real values:

```sh
AWS_REGION=ap-northeast-1
AWS_ACCOUNT_ID=123456789012
AWS_DEPLOY_BUCKET=stravaw-example-private
AWS_DEPLOY_PREFIX=site
AWS_DEPLOY_S3_URI=s3://stravaw-example-private/site
AWS_CLOUDFRONT_DISTRIBUTION_ID=E123EXAMPLE
AWS_CLOUDFRONT_DOMAIN=dexample.cloudfront.net
AWS_CLOUDFRONT_OAC_ID=E123OACEXAMPLE
AWS_BASIC_AUTH_USERNAME=stravaw
AWS_BASIC_AUTH_PASSWORD=replace-me
```

Load it in a shell before running commands:

```sh
set -a
. ./.aws-deploy.env
set +a
```

Regenerate derived local-only AWS files:

```sh
npm run aws:render-local
```

This writes:

- `.aws-cloudfront-basic-auth.js`
- `.aws-cloudfront-distribution-config.json`
- `.aws-s3-bucket-policy.json`
- `.aws-iam-lambda-trust.json`
- `.aws-iam-trigger-policy.json`
- `.aws-iam-worker-policy.json`

These files are ignored by git and can be recreated from `.aws-deploy.env`.

## Safety Rules

- Do not commit `.aws-deploy.env`.
- Do not commit AWS account IDs, bucket names, CloudFront distribution IDs, access keys, or Strava secrets in runbooks.
- Commit commands with environment variables, not literal private values.
- Run one command at a time and verify important steps in the AWS Console.
- Prefer `aws sts get-caller-identity` before creating or changing resources.

## Phase 1: Static Hosting

### 1. Verify AWS identity

```sh
aws sts get-caller-identity
```

Confirm the expected account in the output.

### 2. Check existing budgets

```sh
aws budgets describe-budgets \
  --account-id "$AWS_ACCOUNT_ID" \
  --max-results 20
```

Confirm a low monthly budget alert exists before creating public-facing resources.

### 3. Create the private S3 bucket

```sh
aws s3api create-bucket \
  --bucket "$AWS_DEPLOY_BUCKET" \
  --region "$AWS_REGION" \
  --create-bucket-configuration LocationConstraint="$AWS_REGION"
```

Console check:

- S3 bucket exists in the expected region.

### 4. Block public access

```sh
aws s3api put-public-access-block \
  --bucket "$AWS_DEPLOY_BUCKET" \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
```

Verify:

```sh
aws s3api get-public-access-block \
  --bucket "$AWS_DEPLOY_BUCKET"
```

Console check:

- S3 bucket permissions show all Block Public Access settings enabled.

### 5. Enable default encryption

```sh
aws s3api put-bucket-encryption \
  --bucket "$AWS_DEPLOY_BUCKET" \
  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
```

Verify:

```sh
aws s3api get-bucket-encryption \
  --bucket "$AWS_DEPLOY_BUCKET"
```

Console check:

- S3 bucket properties show default encryption enabled with SSE-S3.

### 6. Create CloudFront Origin Access Control

```sh
aws cloudfront create-origin-access-control \
  --origin-access-control-config Name="$AWS_CLOUDFRONT_OAC_NAME",Description=private-s3-origin-access-control,SigningProtocol=sigv4,SigningBehavior=always,OriginAccessControlOriginType=s3
```

Save the returned `OriginAccessControl.Id` in `.aws-deploy.env` as `AWS_CLOUDFRONT_OAC_ID`.

Console check:

- CloudFront Origin access controls contains the new S3 OAC.

### 7. Create and publish the Basic Auth CloudFront Function

Generate a password and store it only in `.aws-deploy.env`:

```sh
openssl rand -base64 24
```

Regenerate `.aws-cloudfront-basic-auth.js`:

```sh
npm run aws:render-local
```

Create the function:

```sh
aws cloudfront create-function \
  --name "$AWS_CLOUDFRONT_BASIC_AUTH_FUNCTION_NAME" \
  --function-config Comment=basic-auth,Runtime=cloudfront-js-2.0 \
  --function-code fileb://.aws-cloudfront-basic-auth.js
```

Publish it with the returned ETag:

```sh
aws cloudfront publish-function \
  --name "$AWS_CLOUDFRONT_BASIC_AUTH_FUNCTION_NAME" \
  --if-match "$FUNCTION_ETAG"
```

Console check:

- CloudFront Functions shows the configured Basic Auth function as published.

### 8. Create the CloudFront distribution

Regenerate `.aws-cloudfront-distribution-config.json`:

```sh
npm run aws:render-local
```

Important settings:

- S3 REST origin, not S3 static website hosting.
- Origin path should match `/$AWS_DEPLOY_PREFIX`.
- Origin Access Control should use `AWS_CLOUDFRONT_OAC_ID`.
- Default behavior should attach the Basic Auth function on `viewer-request`.
- Viewer protocol policy should redirect HTTP to HTTPS.
- Default root object should be `index.html`.

Create the distribution:

```sh
aws cloudfront create-distribution \
  --distribution-config file://.aws-cloudfront-distribution-config.json
```

Save the returned distribution ID and domain in `.aws-deploy.env`:

```sh
AWS_CLOUDFRONT_DISTRIBUTION_ID=E123EXAMPLE
AWS_CLOUDFRONT_DOMAIN=dexample.cloudfront.net
```

Console check:

- Distribution exists.
- Status eventually becomes `Deployed`.
- Default behavior has the Basic Auth CloudFront Function association.

### 9. Allow CloudFront to read the S3 prefix

Regenerate `.aws-s3-bucket-policy.json`:

```sh
npm run aws:render-local
```

The policy should allow `s3:GetObject` on:

```text
arn:aws:s3:::$AWS_DEPLOY_BUCKET/$AWS_DEPLOY_PREFIX/*
```

Only allow the CloudFront service principal when `AWS:SourceArn` matches the distribution ARN.

Apply it:

```sh
aws s3api put-bucket-policy \
  --bucket "$AWS_DEPLOY_BUCKET" \
  --policy file://.aws-s3-bucket-policy.json
```

Console check:

- S3 bucket policy exists.
- S3 Block Public Access remains enabled.

### 10. Deploy the site

```sh
npm run deploy:aws
```

`npm run deploy:aws` updates static app files but leaves the hosted `data.json` untouched by default. This avoids overwriting newer S3 data with an older local `public/data.json`.

To intentionally publish local generated workout data:

```sh
npm run sync
AWS_DEPLOY_INCLUDE_DATA=1 npm run deploy:aws
```

Verify unauthenticated CloudFront access is blocked:

```sh
curl -I "https://$AWS_CLOUDFRONT_DOMAIN/"
```

Expected: `401 Unauthorized`.

Verify authenticated CloudFront access works:

```sh
curl -I \
  -u "$AWS_BASIC_AUTH_USERNAME:$AWS_BASIC_AUTH_PASSWORD" \
  "https://$AWS_CLOUDFRONT_DOMAIN/"
```

Expected: `200 OK`.

Verify direct S3 access is blocked:

```sh
curl -I "https://$AWS_DEPLOY_BUCKET.s3.$AWS_REGION.amazonaws.com/$AWS_DEPLOY_PREFIX/index.html"
```

Expected: `403 Forbidden`.

## Commands Already Run In This Rollout

The following command types have been run successfully, using local private values:

- `aws sts get-caller-identity`
- `aws budgets describe-budgets`
- `aws s3api create-bucket`
- `aws s3api put-public-access-block`
- `aws s3api get-public-access-block`
- `aws s3api put-bucket-encryption`
- `aws s3api get-bucket-encryption`
- `aws cloudfront create-origin-access-control`
- `aws cloudfront create-function`
- `aws cloudfront publish-function`
- `aws cloudfront create-distribution`
- `aws s3api put-bucket-policy`
- `npm run deploy:aws`
- `curl -I` checks for CloudFront and S3 access
- `aws sqs create-queue`
- `aws sqs get-queue-attributes`
- `aws ssm put-parameter`
- `aws iam create-role`
- `aws iam put-role-policy`
- `npm run aws:package-lambda`
- `aws lambda create-function`
- `aws lambda create-event-source-mapping`
- `aws lambda create-function-url-config`
- `aws lambda add-permission`
- `aws logs tail`
- Strava `GET /api/v3/push_subscriptions`
- Strava `POST /api/v3/push_subscriptions`

The real account ID and bucket name are intentionally not recorded here.

## Phase 2: Webhook Sync

Phase 2 uses this flow:

```text
Strava webhook or manual refresh
  -> Lambda Function URL
  -> SQS
  -> worker Lambda
  -> Strava API
  -> S3 data.json
  -> CloudFront invalidation for /data.json
```

### Resource Summary

Create these resources with local private values:

- SQS queue: `$AWS_SYNC_QUEUE_NAME`
- SSM parameters under `/stravaw/prod/...`
- IAM role for webhook/manual trigger Lambdas
- IAM role for SQS worker Lambda
- Lambda function: `$AWS_LAMBDA_WEBHOOK_NAME`
- Lambda function: `$AWS_LAMBDA_MANUAL_NAME`
- Lambda function: `$AWS_LAMBDA_WORKER_NAME`
- Lambda Function URL for webhook receiver
- Lambda Function URL for manual refresh
- SQS event source mapping for the worker
- Strava webhook subscription

### 1. Create the SQS Queue

```sh
aws sqs create-queue \
  --queue-name "$AWS_SYNC_QUEUE_NAME" \
  --attributes VisibilityTimeout=300,MessageRetentionPeriod=1209600
```

Fetch the queue ARN:

```sh
aws sqs get-queue-attributes \
  --queue-url "$AWS_SYNC_QUEUE_URL" \
  --attribute-names QueueArn
```

Save the queue URL and ARN in `.aws-deploy.env`:

```sh
AWS_SYNC_QUEUE_URL=https://sqs.ap-northeast-1.amazonaws.com/123456789012/example-sync-events
AWS_SYNC_QUEUE_ARN=arn:aws:sqs:ap-northeast-1:123456789012:example-sync-events
```

### 2. Generate Webhook And Manual Tokens

Generate two local-only tokens:

```sh
openssl rand -hex 24
openssl rand -hex 24
```

Save them in `.aws-deploy.env`:

```sh
AWS_STRAVA_VERIFY_TOKEN=replace-me
AWS_MANUAL_REFRESH_TOKEN=replace-me
```

### 3. Get The Strava Owner ID

Use the existing local Strava credentials to fetch the athlete ID:

```sh
python3 -c 'import json; from pathlib import Path; import sys; sys.path.insert(0,"scripts"); import strava_sync; env=strava_sync.load_env(Path(".env")); token=strava_sync.refresh_access_token(env["STRAVA_CLIENT_ID"], env["STRAVA_CLIENT_SECRET"], strava_sync.load_refresh_token(env)); strava_sync.save_tokens(token); from urllib.request import Request, urlopen; req=Request("https://www.strava.com/api/v3/athlete"); req.add_header("Authorization", "Bearer "+token["access_token"]); athlete=json.loads(urlopen(req, timeout=30).read().decode()); print(athlete["id"])'
```

Save the value in `.aws-deploy.env`:

```sh
AWS_STRAVA_OWNER_ID=123456789
```

If this refreshes the local Strava token, remember to store the newest refresh token in SSM in the next step.

### 4. Create SSM Parameters

Load both local env files:

```sh
set -a
. ./.env
. ./.aws-deploy.env
set +a
```

Store Strava credentials and tokens:

```sh
aws ssm put-parameter \
  --name "$AWS_STRAVA_CLIENT_ID_PARAM" \
  --value "$STRAVA_CLIENT_ID" \
  --type SecureString \
  --overwrite
```

```sh
aws ssm put-parameter \
  --name "$AWS_STRAVA_CLIENT_SECRET_PARAM" \
  --value "$STRAVA_CLIENT_SECRET" \
  --type SecureString \
  --overwrite
```

Prefer the latest refresh token from `.strava_tokens.json` after any local Strava API call:

```sh
REFRESH_TOKEN=$(python3 -c 'import json; print(json.load(open(".strava_tokens.json"))["refresh_token"])')
aws ssm put-parameter \
  --name "$AWS_STRAVA_REFRESH_TOKEN_PARAM" \
  --value "$REFRESH_TOKEN" \
  --type SecureString \
  --overwrite
```

Store validation and sync state parameters:

```sh
aws ssm put-parameter \
  --name "$AWS_STRAVA_OWNER_ID_PARAM" \
  --value "$AWS_STRAVA_OWNER_ID" \
  --type String \
  --overwrite
```

```sh
aws ssm put-parameter \
  --name "$AWS_STRAVA_VERIFY_TOKEN_PARAM" \
  --value "$AWS_STRAVA_VERIFY_TOKEN" \
  --type SecureString \
  --overwrite
```

```sh
aws ssm put-parameter \
  --name "$AWS_MANUAL_REFRESH_TOKEN_PARAM" \
  --value "$AWS_MANUAL_REFRESH_TOKEN" \
  --type SecureString \
  --overwrite
```

```sh
aws ssm put-parameter \
  --name "$AWS_SYNC_STATE_PARAM" \
  --value '{}' \
  --type String \
  --overwrite
```

### 5. Create IAM Roles And Policies

Regenerate the local-only IAM trust and inline policy files:

```sh
npm run aws:render-local
```

Create the trigger Lambda role:

```sh
aws iam create-role \
  --role-name "$AWS_LAMBDA_TRIGGER_ROLE_NAME" \
  --assume-role-policy-document file://.aws-iam-lambda-trust.json
```

Create the worker Lambda role:

```sh
aws iam create-role \
  --role-name "$AWS_LAMBDA_WORKER_ROLE_NAME" \
  --assume-role-policy-document file://.aws-iam-lambda-trust.json
```

The generated local-only inline policy files are:

- `.aws-iam-trigger-policy.json`
- `.aws-iam-worker-policy.json`

The trigger policy should allow:

- CloudWatch Logs writes;
- `sqs:SendMessage` to the sync queue;
- `ssm:GetParameter` for owner ID, webhook verify token, and manual refresh token.

The worker policy should allow:

- CloudWatch Logs writes;
- SQS receive/delete/change visibility on the sync queue;
- `ssm:GetParameter` / `ssm:PutParameter` for `/stravaw/prod/*`;
- `s3:PutObject` for the deployed `data.json`;
- `cloudfront:CreateInvalidation` for the app distribution.

Attach policies:

```sh
aws iam put-role-policy \
  --role-name "$AWS_LAMBDA_TRIGGER_ROLE_NAME" \
  --policy-name trigger-lambda-policy \
  --policy-document file://.aws-iam-trigger-policy.json
```

```sh
aws iam put-role-policy \
  --role-name "$AWS_LAMBDA_WORKER_ROLE_NAME" \
  --policy-name worker-lambda-policy \
  --policy-document file://.aws-iam-worker-policy.json
```

### Package Lambda Code

```sh
npm run aws:package-lambda
```

This writes `dist/lambda/stravaw-sync.zip`.

### 6. Create Lambda Functions

Create the worker:

```sh
aws lambda create-function \
  --function-name "$AWS_LAMBDA_WORKER_NAME" \
  --runtime python3.12 \
  --role "arn:aws:iam::$AWS_ACCOUNT_ID:role/$AWS_LAMBDA_WORKER_ROLE_NAME" \
  --handler scripts.aws_sync_lambda.worker_handler \
  --zip-file fileb://dist/lambda/stravaw-sync.zip \
  --timeout 300 \
  --memory-size 256 \
  --environment "Variables={STRAVA_CLIENT_ID_PARAM=$AWS_STRAVA_CLIENT_ID_PARAM,STRAVA_CLIENT_SECRET_PARAM=$AWS_STRAVA_CLIENT_SECRET_PARAM,STRAVA_REFRESH_TOKEN_PARAM=$AWS_STRAVA_REFRESH_TOKEN_PARAM,SYNC_STATE_PARAM=$AWS_SYNC_STATE_PARAM,OUTPUT_BUCKET=$AWS_DEPLOY_BUCKET,OUTPUT_KEY=$AWS_DEPLOY_PREFIX/data.json,CLOUDFRONT_DISTRIBUTION_ID=$AWS_CLOUDFRONT_DISTRIBUTION_ID,SYNC_DEBOUNCE_SECONDS=60,STRAVA_LOOKBACK_DAYS=400}"
```

Create the webhook receiver:

```sh
aws lambda create-function \
  --function-name "$AWS_LAMBDA_WEBHOOK_NAME" \
  --runtime python3.12 \
  --role "arn:aws:iam::$AWS_ACCOUNT_ID:role/$AWS_LAMBDA_TRIGGER_ROLE_NAME" \
  --handler scripts.aws_sync_lambda.webhook_handler \
  --zip-file fileb://dist/lambda/stravaw-sync.zip \
  --timeout 10 \
  --memory-size 128 \
  --environment "Variables={SYNC_QUEUE_URL=$AWS_SYNC_QUEUE_URL,STRAVA_OWNER_ID_PARAM=$AWS_STRAVA_OWNER_ID_PARAM,STRAVA_VERIFY_TOKEN_PARAM=$AWS_STRAVA_VERIFY_TOKEN_PARAM}"
```

Create the manual refresh handler:

```sh
aws lambda create-function \
  --function-name "$AWS_LAMBDA_MANUAL_NAME" \
  --runtime python3.12 \
  --role "arn:aws:iam::$AWS_ACCOUNT_ID:role/$AWS_LAMBDA_TRIGGER_ROLE_NAME" \
  --handler scripts.aws_sync_lambda.manual_refresh_handler \
  --zip-file fileb://dist/lambda/stravaw-sync.zip \
  --timeout 10 \
  --memory-size 128 \
  --environment "Variables={SYNC_QUEUE_URL=$AWS_SYNC_QUEUE_URL,MANUAL_REFRESH_TOKEN_PARAM=$AWS_MANUAL_REFRESH_TOKEN_PARAM}"
```

### 7. Connect SQS To Worker Lambda

```sh
aws lambda create-event-source-mapping \
  --function-name "$AWS_LAMBDA_WORKER_NAME" \
  --event-source-arn "$AWS_SYNC_QUEUE_ARN" \
  --batch-size 10 \
  --maximum-batching-window-in-seconds 30
```

Verify:

```sh
aws lambda list-event-source-mappings \
  --function-name "$AWS_LAMBDA_WORKER_NAME"
```

Expected: state eventually becomes `Enabled`.

### 8. Create Lambda Function URLs

Create webhook Function URL:

```sh
aws lambda create-function-url-config \
  --function-name "$AWS_LAMBDA_WEBHOOK_NAME" \
  --auth-type NONE \
  --cors 'AllowOrigins=["*"],AllowMethods=["GET","POST"],AllowHeaders=["content-type"]'
```

Create manual refresh Function URL:

```sh
aws lambda create-function-url-config \
  --function-name "$AWS_LAMBDA_MANUAL_NAME" \
  --auth-type NONE \
  --cors 'AllowOrigins=["*"],AllowMethods=["POST"],AllowHeaders=["content-type","x-refresh-token"]'
```

Save the returned URLs in `.aws-deploy.env`:

```sh
AWS_WEBHOOK_FUNCTION_URL=https://example.lambda-url.ap-northeast-1.on.aws/
AWS_MANUAL_FUNCTION_URL=https://example.lambda-url.ap-northeast-1.on.aws/
```

### Function URL Permissions

For public Function URLs with `AuthType=NONE`, grant both:

- `lambda:InvokeFunctionUrl`
- `lambda:InvokeFunction` with `--invoked-via-function-url`

Without both permissions, public requests can return `403 Forbidden`.

Add permissions for the webhook receiver:

```sh
aws lambda add-permission \
  --function-name "$AWS_LAMBDA_WEBHOOK_NAME" \
  --statement-id FunctionURLAllowPublicAccess \
  --action lambda:InvokeFunctionUrl \
  --principal '*' \
  --function-url-auth-type NONE
```

```sh
aws lambda add-permission \
  --function-name "$AWS_LAMBDA_WEBHOOK_NAME" \
  --statement-id FunctionURLAllowPublicInvokeFunction \
  --action lambda:InvokeFunction \
  --principal '*' \
  --invoked-via-function-url
```

Add permissions for manual refresh:

```sh
aws lambda add-permission \
  --function-name "$AWS_LAMBDA_MANUAL_NAME" \
  --statement-id FunctionURLAllowPublicAccess \
  --action lambda:InvokeFunctionUrl \
  --principal '*' \
  --function-url-auth-type NONE
```

```sh
aws lambda add-permission \
  --function-name "$AWS_LAMBDA_MANUAL_NAME" \
  --statement-id FunctionURLAllowPublicInvokeFunction \
  --action lambda:InvokeFunction \
  --principal '*' \
  --invoked-via-function-url
```

### 9. Create Strava Webhook Subscription

Check existing subscriptions first:

```sh
curl -sS -G https://www.strava.com/api/v3/push_subscriptions \
  --data-urlencode "client_id=$STRAVA_CLIENT_ID" \
  --data-urlencode "client_secret=$STRAVA_CLIENT_SECRET"
```

Create the subscription:

```sh
curl -sS -X POST https://www.strava.com/api/v3/push_subscriptions \
  -F "client_id=$STRAVA_CLIENT_ID" \
  -F "client_secret=$STRAVA_CLIENT_SECRET" \
  -F "callback_url=$AWS_WEBHOOK_FUNCTION_URL" \
  -F "verify_token=$AWS_STRAVA_VERIFY_TOKEN"
```

Save the returned subscription ID in `.aws-deploy.env`:

```sh
AWS_STRAVA_WEBHOOK_SUBSCRIPTION_ID=123456
```

Verify the subscription:

```sh
curl -sS -G https://www.strava.com/api/v3/push_subscriptions \
  --data-urlencode "client_id=$STRAVA_CLIENT_ID" \
  --data-urlencode "client_secret=$STRAVA_CLIENT_SECRET"
```

### Verification

Verify Strava callback challenge:

```sh
curl -G "$AWS_WEBHOOK_FUNCTION_URL" \
  --data-urlencode "hub.mode=subscribe" \
  --data-urlencode "hub.verify_token=$AWS_STRAVA_VERIFY_TOKEN" \
  --data-urlencode "hub.challenge=test-challenge"
```

Expected:

```json
{"hub.challenge":"test-challenge"}
```

Verify manual refresh rejects missing token:

```sh
curl -i -X POST "$AWS_MANUAL_FUNCTION_URL"
```

Expected: `401 Unauthorized`.

Verify manual refresh queues work:

```sh
curl -i -X POST "$AWS_MANUAL_FUNCTION_URL" \
  -H "x-refresh-token: $AWS_MANUAL_REFRESH_TOKEN"
```

Expected: `202 Accepted`.

Check worker logs:

```sh
aws logs tail "/aws/lambda/$AWS_LAMBDA_WORKER_NAME" --since 10m
```

Expected: a `sync finished` log line.

Check SQS queue depth:

```sh
aws sqs get-queue-attributes \
  --queue-url "$AWS_SYNC_QUEUE_URL" \
  --attribute-names ApproximateNumberOfMessages ApproximateNumberOfMessagesNotVisible ApproximateNumberOfMessagesDelayed
```

Expected after successful processing: all counts are `0`.

Simulate a webhook POST:

```sh
curl -i -X POST "$AWS_WEBHOOK_FUNCTION_URL" \
  -H 'content-type: application/json' \
  -d "{\"aspect_type\":\"update\",\"event_time\":1779318000,\"object_id\":123456789,\"object_type\":\"activity\",\"owner_id\":$AWS_STRAVA_OWNER_ID,\"subscription_id\":$AWS_STRAVA_WEBHOOK_SUBSCRIPTION_ID}"
```

Expected: `200 OK` with `{"message":"queued"}`.
