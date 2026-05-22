#!/usr/bin/env python3
from __future__ import annotations

import base64
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT / ".aws-deploy.env"
BASIC_AUTH_PATH = ROOT / ".aws-cloudfront-basic-auth.js"
DISTRIBUTION_CONFIG_PATH = ROOT / ".aws-cloudfront-distribution-config.json"
BUCKET_POLICY_PATH = ROOT / ".aws-s3-bucket-policy.json"
IAM_TRUST_POLICY_PATH = ROOT / ".aws-iam-lambda-trust.json"
IAM_TRIGGER_POLICY_PATH = ROOT / ".aws-iam-trigger-policy.json"
IAM_WORKER_POLICY_PATH = ROOT / ".aws-iam-worker-policy.json"

CACHING_OPTIMIZED_POLICY_ID = "658327ea-f89d-4fab-a63d-7e88639e58f6"


def main() -> int:
    env = load_env(ENV_PATH)
    required = [
        "AWS_REGION",
        "AWS_ACCOUNT_ID",
        "AWS_DEPLOY_BUCKET",
        "AWS_DEPLOY_PREFIX",
        "AWS_CLOUDFRONT_OAC_ID",
        "AWS_CLOUDFRONT_BASIC_AUTH_FUNCTION_NAME",
        "AWS_BASIC_AUTH_USERNAME",
        "AWS_BASIC_AUTH_PASSWORD",
        "AWS_SYNC_QUEUE_ARN",
        "AWS_STRAVA_OWNER_ID_PARAM",
        "AWS_STRAVA_VERIFY_TOKEN_PARAM",
        "AWS_MANUAL_REFRESH_TOKEN_PARAM",
        "AWS_CLOUDFRONT_DISTRIBUTION_ID",
    ]
    missing = [key for key in required if not env.get(key)]
    if missing:
        print(f"Missing required values in {ENV_PATH.name}: {', '.join(missing)}", file=sys.stderr)
        return 2

    write_text(BASIC_AUTH_PATH, render_basic_auth_function(env))
    write_json(DISTRIBUTION_CONFIG_PATH, build_distribution_config(env))
    write_json(BUCKET_POLICY_PATH, build_bucket_policy(env))
    write_json(IAM_TRUST_POLICY_PATH, build_lambda_trust_policy())
    write_json(IAM_TRIGGER_POLICY_PATH, build_trigger_policy(env))
    write_json(IAM_WORKER_POLICY_PATH, build_worker_policy(env))

    print(f"Wrote {BASIC_AUTH_PATH.name}")
    print(f"Wrote {DISTRIBUTION_CONFIG_PATH.name}")
    print(f"Wrote {BUCKET_POLICY_PATH.name}")
    print(f"Wrote {IAM_TRUST_POLICY_PATH.name}")
    print(f"Wrote {IAM_TRIGGER_POLICY_PATH.name}")
    print(f"Wrote {IAM_WORKER_POLICY_PATH.name}")
    return 0


def load_env(path: Path) -> dict[str, str]:
    if not path.exists():
        raise SystemExit(f"Missing {path.name}. Copy .aws-deploy.env.example and fill in real local values.")

    env: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def render_basic_auth_function(env: dict[str, str]) -> str:
    token = base64.b64encode(
        f"{env['AWS_BASIC_AUTH_USERNAME']}:{env['AWS_BASIC_AUTH_PASSWORD']}".encode("utf-8")
    ).decode("ascii")
    return f'''function handler(event) {{
  var request = event.request;
  var headers = request.headers;
  var expected = "Basic {token}";
  var cookieName = "stravaw_auth";
  var cookieValue = "{token}";
  var maxAge = 60 * 60 * 24 * 30;

  if (hasValidCookie(request.cookies, cookieName, cookieValue)) {{
    return request;
  }}

  if (headers.authorization && headers.authorization.value === expected) {{
    return {{
      statusCode: 302,
      statusDescription: "Found",
      headers: {{
        location: {{
          value: request.uri + buildQueryString(request.querystring),
        }},
      }},
      cookies: {{
        stravaw_auth: {{
          value: cookieValue,
          attributes: "Max-Age=" + maxAge + "; Path=/; Secure; HttpOnly; SameSite=Lax",
        }},
      }},
    }};
  }}

  return {{
    statusCode: 401,
    statusDescription: "Unauthorized",
    headers: {{
      "www-authenticate": {{
        value: 'Basic realm="stravaw"',
      }},
    }},
  }};
}}

function hasValidCookie(cookies, cookieName, cookieValue) {{
  if (!cookies || !cookies[cookieName]) {{
    return false;
  }}

  return cookies[cookieName].value === cookieValue;
}}

function buildQueryString(querystring) {{
  var parts = [];
  for (var name in querystring) {{
    if (!Object.prototype.hasOwnProperty.call(querystring, name)) {{
      continue;
    }}

    var item = querystring[name];
    if (item.multiValue) {{
      for (var index = 0; index < item.multiValue.length; index += 1) {{
        parts.push(name + "=" + item.multiValue[index].value);
      }}
    }} else if (item.value === "") {{
      parts.push(name);
    }} else {{
      parts.push(name + "=" + item.value);
    }}
  }}

  return parts.length > 0 ? "?" + parts.join("&") : "";
}}
'''


def build_distribution_config(env: dict[str, str]) -> dict[str, object]:
    account_id = env["AWS_ACCOUNT_ID"]
    bucket = env["AWS_DEPLOY_BUCKET"]
    region = env["AWS_REGION"]
    prefix = env["AWS_DEPLOY_PREFIX"].strip("/")
    oac_id = env["AWS_CLOUDFRONT_OAC_ID"]
    function_name = env["AWS_CLOUDFRONT_BASIC_AUTH_FUNCTION_NAME"]
    caller_reference = env.get("AWS_CLOUDFRONT_CALLER_REFERENCE") or "stravaw-20260520-01"

    return {
        "CallerReference": caller_reference,
        "Comment": "stravaw private static hosting",
        "Enabled": True,
        "DefaultRootObject": "index.html",
        "PriceClass": "PriceClass_100",
        "HttpVersion": "http2",
        "IsIPV6Enabled": True,
        "Origins": {
            "Quantity": 1,
            "Items": [
                {
                    "Id": "stravaw-s3-origin",
                    "DomainName": f"{bucket}.s3.{region}.amazonaws.com",
                    "OriginPath": f"/{prefix}" if prefix else "",
                    "OriginAccessControlId": oac_id,
                    "S3OriginConfig": {"OriginAccessIdentity": ""},
                    "ConnectionAttempts": 3,
                    "ConnectionTimeout": 10,
                    "OriginShield": {"Enabled": False},
                }
            ],
        },
        "DefaultCacheBehavior": {
            "TargetOriginId": "stravaw-s3-origin",
            "ViewerProtocolPolicy": "redirect-to-https",
            "AllowedMethods": {
                "Quantity": 2,
                "Items": ["GET", "HEAD"],
                "CachedMethods": {
                    "Quantity": 2,
                    "Items": ["GET", "HEAD"],
                },
            },
            "Compress": True,
            "CachePolicyId": CACHING_OPTIMIZED_POLICY_ID,
            "FunctionAssociations": {
                "Quantity": 1,
                "Items": [
                    {
                        "FunctionARN": f"arn:aws:cloudfront::{account_id}:function/{function_name}",
                        "EventType": "viewer-request",
                    }
                ],
            },
        },
        "CacheBehaviors": {"Quantity": 0},
        "CustomErrorResponses": {"Quantity": 0},
        "Restrictions": {
            "GeoRestriction": {
                "RestrictionType": "none",
                "Quantity": 0,
            }
        },
        "ViewerCertificate": {
            "CloudFrontDefaultCertificate": True,
            "MinimumProtocolVersion": "TLSv1",
            "CertificateSource": "cloudfront",
        },
    }


def build_bucket_policy(env: dict[str, str]) -> dict[str, object]:
    account_id = env["AWS_ACCOUNT_ID"]
    bucket = env["AWS_DEPLOY_BUCKET"]
    prefix = env["AWS_DEPLOY_PREFIX"].strip("/")
    distribution_id = env.get("AWS_CLOUDFRONT_DISTRIBUTION_ID")
    if not distribution_id:
        raise SystemExit("Missing AWS_CLOUDFRONT_DISTRIBUTION_ID in .aws-deploy.env")

    resource = f"arn:aws:s3:::{bucket}/{prefix}/*" if prefix else f"arn:aws:s3:::{bucket}/*"
    return {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Sid": "AllowCloudFrontServicePrincipalReadOnly",
                "Effect": "Allow",
                "Principal": {"Service": "cloudfront.amazonaws.com"},
                "Action": "s3:GetObject",
                "Resource": resource,
                "Condition": {
                    "StringEquals": {
                        "AWS:SourceArn": f"arn:aws:cloudfront::{account_id}:distribution/{distribution_id}"
                    }
                },
            }
        ],
    }


def build_lambda_trust_policy() -> dict[str, object]:
    return {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Principal": {"Service": "lambda.amazonaws.com"},
                "Action": "sts:AssumeRole",
            }
        ],
    }


def build_trigger_policy(env: dict[str, str]) -> dict[str, object]:
    account_id = env["AWS_ACCOUNT_ID"]
    region = env["AWS_REGION"]
    queue_arn = env["AWS_SYNC_QUEUE_ARN"]
    return {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Action": "logs:CreateLogGroup",
                "Resource": f"arn:aws:logs:{region}:{account_id}:*",
            },
            {
                "Effect": "Allow",
                "Action": ["logs:CreateLogStream", "logs:PutLogEvents"],
                "Resource": f"arn:aws:logs:{region}:{account_id}:log-group:/aws/lambda/*:*",
            },
            {
                "Effect": "Allow",
                "Action": "sqs:SendMessage",
                "Resource": queue_arn,
            },
            {
                "Effect": "Allow",
                "Action": "ssm:GetParameter",
                "Resource": [
                    ssm_parameter_arn(env, env["AWS_STRAVA_OWNER_ID_PARAM"]),
                    ssm_parameter_arn(env, env["AWS_STRAVA_VERIFY_TOKEN_PARAM"]),
                    ssm_parameter_arn(env, env["AWS_MANUAL_REFRESH_TOKEN_PARAM"]),
                ],
            },
        ],
    }


def build_worker_policy(env: dict[str, str]) -> dict[str, object]:
    account_id = env["AWS_ACCOUNT_ID"]
    region = env["AWS_REGION"]
    bucket = env["AWS_DEPLOY_BUCKET"]
    prefix = env["AWS_DEPLOY_PREFIX"].strip("/")
    data_key = f"{prefix}/data.json" if prefix else "data.json"
    distribution_id = env["AWS_CLOUDFRONT_DISTRIBUTION_ID"]
    return {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Action": "logs:CreateLogGroup",
                "Resource": f"arn:aws:logs:{region}:{account_id}:*",
            },
            {
                "Effect": "Allow",
                "Action": ["logs:CreateLogStream", "logs:PutLogEvents"],
                "Resource": f"arn:aws:logs:{region}:{account_id}:log-group:/aws/lambda/*:*",
            },
            {
                "Effect": "Allow",
                "Action": [
                    "sqs:ReceiveMessage",
                    "sqs:DeleteMessage",
                    "sqs:GetQueueAttributes",
                    "sqs:ChangeMessageVisibility",
                ],
                "Resource": env["AWS_SYNC_QUEUE_ARN"],
            },
            {
                "Effect": "Allow",
                "Action": ["ssm:GetParameter", "ssm:PutParameter"],
                "Resource": f"arn:aws:ssm:{region}:{account_id}:parameter/stravaw/prod/*",
            },
            {
                "Effect": "Allow",
                "Action": "s3:PutObject",
                "Resource": f"arn:aws:s3:::{bucket}/{data_key}",
            },
            {
                "Effect": "Allow",
                "Action": "cloudfront:CreateInvalidation",
                "Resource": f"arn:aws:cloudfront::{account_id}:distribution/{distribution_id}",
            },
        ],
    }


def ssm_parameter_arn(env: dict[str, str], name: str) -> str:
    account_id = env["AWS_ACCOUNT_ID"]
    region = env["AWS_REGION"]
    path = name.lstrip("/")
    return f"arn:aws:ssm:{region}:{account_id}:parameter/{path}"


def write_text(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8")


def write_json(path: Path, data: dict[str, object]) -> None:
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())
