#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, Iterable
from urllib.parse import urlencode
from urllib.request import Request, urlopen

try:
    from scripts.aggregate import aggregate_activities
except ModuleNotFoundError:
    from aggregate import aggregate_activities

ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT / ".env"
TOKEN_PATH = ROOT / ".strava_tokens.json"
TOKEN_URL = "https://www.strava.com/oauth/token"
ACTIVITIES_URL = "https://www.strava.com/api/v3/athlete/activities"


def main() -> int:
    env = load_env(ENV_PATH)
    client_id = require(env, "STRAVA_CLIENT_ID")
    client_secret = require(env, "STRAVA_CLIENT_SECRET")
    refresh_token = load_refresh_token(env)
    output_path = ROOT / env.get("STRAVA_OUTPUT_PATH", "public/data.json")
    lookback_days = int(env.get("STRAVA_LOOKBACK_DAYS", "400"))

    data, token, activity_count = sync_strava_data(client_id, client_secret, refresh_token, lookback_days)
    save_tokens(token)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {output_path.relative_to(ROOT)} from {activity_count} Strava activities")
    return 0


def sync_strava_data(
    client_id: str,
    client_secret: str,
    refresh_token: str,
    lookback_days: int,
) -> tuple[Dict[str, Any], Dict[str, Any], int]:
    token = refresh_access_token(client_id, client_secret, refresh_token)
    after = int((datetime.now(timezone.utc) - timedelta(days=lookback_days)).timestamp())
    activities = list(fetch_activities(token["access_token"], after=after))
    return aggregate_activities(activities), token, len(activities)


def load_env(path: Path) -> Dict[str, str]:
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


def require(env: Dict[str, str], key: str) -> str:
    value = env.get(key)
    if not value:
        raise SystemExit(f"Missing {key}. Copy .env.example to .env and fill it in.")
    return value


def load_refresh_token(env: Dict[str, str]) -> str:
    if TOKEN_PATH.exists():
        saved = json.loads(TOKEN_PATH.read_text(encoding="utf-8"))
        if saved.get("refresh_token"):
            return str(saved["refresh_token"])
    return require(env, "STRAVA_REFRESH_TOKEN")


def refresh_access_token(client_id: str, client_secret: str, refresh_token: str) -> Dict[str, Any]:
    body = urlencode(
        {
            "client_id": client_id,
            "client_secret": client_secret,
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
        }
    ).encode("utf-8")
    request = Request(TOKEN_URL, data=body, method="POST")
    request.add_header("Content-Type", "application/x-www-form-urlencoded")
    return request_json(request)


def fetch_activities(access_token: str, after: int) -> Iterable[Dict[str, Any]]:
    page = 1
    while True:
        query = urlencode({"after": after, "page": page, "per_page": 200})
        request = Request(f"{ACTIVITIES_URL}?{query}")
        request.add_header("Authorization", f"Bearer {access_token}")
        batch = request_json(request)
        if not batch:
            break
        if not isinstance(batch, list):
            raise RuntimeError("Strava activities response was not a list")
        yield from batch
        page += 1


def request_json(request: Request) -> Any:
    try:
        with urlopen(request, timeout=30) as response:
            rate_limit = response.headers.get("X-RateLimit-Limit")
            rate_usage = response.headers.get("X-RateLimit-Usage")
            if rate_limit and rate_usage:
                print(f"Strava rate usage {rate_usage} / {rate_limit}", file=sys.stderr)
            return json.loads(response.read().decode("utf-8"))
    except Exception as exc:
        raise RuntimeError(f"Strava request failed: {exc}") from exc


def save_tokens(token: Dict[str, Any]) -> None:
    TOKEN_PATH.write_text(
        json.dumps(
            {
                "access_token": token.get("access_token"),
                "refresh_token": token.get("refresh_token"),
                "expires_at": token.get("expires_at"),
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    raise SystemExit(main())
