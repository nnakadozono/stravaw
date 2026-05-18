#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any, Dict
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT / ".env"
TOKEN_PATH = ROOT / ".strava_tokens.json"
TOKEN_URL = "https://www.strava.com/oauth/token"
AUTHORIZE_URL = "https://www.strava.com/oauth/authorize"
REDIRECT_URI = "http://localhost/exchange_token"
SCOPE = "activity:read_all"


def main(argv: list[str]) -> int:
    if len(argv) != 2 or argv[1] not in {"url", "exchange"}:
        print("Usage: python3 scripts/strava_auth.py [url|exchange]", file=sys.stderr)
        return 2

    env = load_env(ENV_PATH)
    if argv[1] == "url":
        print(build_authorize_url(require(env, "STRAVA_CLIENT_ID")))
        return 0

    exchange_code(env)
    return 0


def build_authorize_url(client_id: str) -> str:
    query = urlencode({
        'client_id': client_id,
        'redirect_uri': REDIRECT_URI,
        'response_type': 'code',
        'approval_prompt': 'force',
        'scope': SCOPE,
    })
    return f"{AUTHORIZE_URL}?{query}"


def exchange_code(env: Dict[str, str]) -> None:
    code = os.environ.get("STRAVA_CODE")
    if not code:
        raise SystemExit("Set STRAVA_CODE to the code from the redirected localhost URL.")

    body = urlencode(
        {
            "client_id": require(env, "STRAVA_CLIENT_ID"),
            "client_secret": require(env, "STRAVA_CLIENT_SECRET"),
            "code": code,
            "grant_type": "authorization_code",
        }
    ).encode("utf-8")
    request = Request(TOKEN_URL, data=body, method="POST")
    request.add_header("Content-Type", "application/x-www-form-urlencoded")

    with urlopen(request, timeout=30) as response:
        token = json.loads(response.read().decode("utf-8"))

    refresh_token = token.get("refresh_token")
    if not refresh_token:
        raise SystemExit("Token response did not include refresh_token.")

    TOKEN_PATH.write_text(
        json.dumps(
            {
                "access_token": token.get("access_token"),
                "refresh_token": refresh_token,
                "expires_at": token.get("expires_at"),
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    update_env_value(ENV_PATH, "STRAVA_REFRESH_TOKEN", str(refresh_token))
    print("Saved refresh token to .env and .strava_tokens.json")


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
    if not value or value in {"replace-me", "12345"}:
        raise SystemExit(f"Missing {key}. Fill it in .env first.")
    return value


def update_env_value(path: Path, key: str, value: str) -> None:
    lines = path.read_text(encoding="utf-8").splitlines() if path.exists() else []
    prefix = f"{key}="
    updated = False
    next_lines = []
    for line in lines:
        if line.startswith(prefix):
            next_lines.append(f"{key}={value}")
            updated = True
        else:
            next_lines.append(line)
    if not updated:
        next_lines.append(f"{key}={value}")
    path.write_text("\n".join(next_lines).rstrip() + "\n", encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
