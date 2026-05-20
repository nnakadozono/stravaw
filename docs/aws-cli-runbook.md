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
  --origin-access-control-config Name=stravaw-s3-oac,Description=stravaw-s3-origin-access-control,SigningProtocol=sigv4,SigningBehavior=always,OriginAccessControlOriginType=s3
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
  --name stravaw-basic-auth \
  --function-config Comment=stravaw-basic-auth,Runtime=cloudfront-js-2.0 \
  --function-code fileb://.aws-cloudfront-basic-auth.js
```

Publish it with the returned ETag:

```sh
aws cloudfront publish-function \
  --name stravaw-basic-auth \
  --if-match "$FUNCTION_ETAG"
```

Console check:

- CloudFront Functions shows `stravaw-basic-auth` as published.

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
npm run sync
```

```sh
npm run deploy:aws
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

The real account ID and bucket name are intentionally not recorded here.
