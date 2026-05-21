#!/usr/bin/env python3
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AWS_ENV_PATH = ROOT / ".aws-deploy.env"
PUBLIC_DATA_PATH = ROOT / "public" / "data.json"
DIST_PATH = ROOT / "dist"


def main() -> int:
    env = load_env(AWS_ENV_PATH)
    s3_uri = env.get("AWS_DEPLOY_S3_URI") or env.get("S3_URI")
    distribution_id = env.get("AWS_CLOUDFRONT_DISTRIBUTION_ID")
    allow_missing_data = env.get("AWS_DEPLOY_ALLOW_MISSING_DATA") == "1"

    if not s3_uri:
        print("Missing AWS_DEPLOY_S3_URI, for example s3://your-private-bucket/site", file=sys.stderr)
        return 2

    if not PUBLIC_DATA_PATH.exists() and not allow_missing_data:
        print(
            "Missing public/data.json. Run `npm run sync` first, or set "
            "AWS_DEPLOY_ALLOW_MISSING_DATA=1 to deploy with sample data only.",
            file=sys.stderr,
        )
        return 2

    run(["npm", "run", "build"])
    run(["aws", "s3", "sync", str(DIST_PATH) + "/", s3_uri, "--delete"])

    if distribution_id:
        run(
            [
                "aws",
                "cloudfront",
                "create-invalidation",
                "--distribution-id",
                distribution_id,
                "--paths",
                "/*",
            ]
        )
    else:
        print("Skipping CloudFront invalidation because AWS_CLOUDFRONT_DISTRIBUTION_ID is not set.")

    return 0


def run(command: list[str]) -> None:
    print(f"+ {' '.join(command)}")
    subprocess.run(command, cwd=ROOT, check=True)


def load_env(path: Path) -> dict[str, str]:
    env = dict(os.environ)
    if not path.exists():
        return env

    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        env[key.strip()] = value.strip().strip('"').strip("'")
    return env


if __name__ == "__main__":
    raise SystemExit(main())
