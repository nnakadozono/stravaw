from __future__ import annotations

import base64
import json
import os
from datetime import datetime, timezone
from typing import Any

from scripts.strava_sync import sync_strava_data

RELEVANT_ASPECT_TYPES = {"create", "update", "delete"}


def webhook_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    method = request_method(event)
    if method == "GET":
        return handle_subscription_challenge(event)
    if method == "POST":
        return handle_webhook_event(event)
    return response(405, {"message": "method not allowed"})


def manual_refresh_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    expected = get_parameter(required_env("MANUAL_REFRESH_TOKEN_PARAM"), decrypt=True)
    provided = header_value(event, "x-refresh-token")
    if not provided or provided != expected:
        return response(401, {"message": "unauthorized"})

    enqueue_sync({"trigger": "manual", "receivedAt": now_iso()})
    return response(202, {"message": "queued"})


def worker_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    records = event.get("Records") or []
    trigger_count = len(records)
    if should_skip_for_debounce():
        print(json.dumps({"message": "sync skipped by debounce", "records": trigger_count}))
        return {"status": "skipped", "records": trigger_count}

    mark_sync_started(trigger_count)

    client_id = get_parameter(required_env("STRAVA_CLIENT_ID_PARAM"), decrypt=True)
    client_secret = get_parameter(required_env("STRAVA_CLIENT_SECRET_PARAM"), decrypt=True)
    refresh_token_param = required_env("STRAVA_REFRESH_TOKEN_PARAM")
    refresh_token = get_parameter(refresh_token_param, decrypt=True)
    lookback_days = int(os.environ.get("STRAVA_LOOKBACK_DAYS", "400"))

    data, token, activity_count = sync_strava_data(client_id, client_secret, refresh_token, lookback_days)
    put_parameter(refresh_token_param, str(token["refresh_token"]), secure=True)
    put_data_json(data)
    invalidate_cloudfront()
    mark_sync_finished(trigger_count, activity_count)

    print(json.dumps({"message": "sync finished", "records": trigger_count, "activities": activity_count}))
    return {"status": "synced", "records": trigger_count, "activities": activity_count}


def handle_subscription_challenge(event: dict[str, Any]) -> dict[str, Any]:
    params = event.get("queryStringParameters") or {}
    expected = get_parameter(required_env("STRAVA_VERIFY_TOKEN_PARAM"), decrypt=True)
    if params.get("hub.verify_token") != expected:
        return response(403, {"message": "invalid verify token"})
    challenge = params.get("hub.challenge")
    if not challenge:
        return response(400, {"message": "missing challenge"})
    return response(200, {"hub.challenge": challenge})


def handle_webhook_event(event: dict[str, Any]) -> dict[str, Any]:
    payload = parse_body(event)
    reason = ignored_event_reason(payload)
    if reason:
        print(json.dumps({"message": "webhook ignored", "reason": reason, "payload": safe_event_log(payload)}))
        return response(200, {"message": "ignored"})

    enqueue_sync(
        {
            "trigger": "strava-webhook",
            "receivedAt": now_iso(),
            "event": payload,
        }
    )
    return response(200, {"message": "queued"})


def ignored_event_reason(payload: dict[str, Any]) -> str:
    if payload.get("object_type") != "activity":
        return "unsupported object_type"
    if payload.get("aspect_type") not in RELEVANT_ASPECT_TYPES:
        return "unsupported aspect_type"

    expected_owner = get_parameter(required_env("STRAVA_OWNER_ID_PARAM"), decrypt=False)
    owner_id = payload.get("owner_id")
    if str(owner_id) != str(expected_owner):
        return "unexpected owner_id"

    return ""


def enqueue_sync(message: dict[str, Any]) -> None:
    boto3_client("sqs").send_message(
        QueueUrl=required_env("SYNC_QUEUE_URL"),
        MessageBody=json.dumps(message, separators=(",", ":")),
    )


def should_skip_for_debounce() -> bool:
    state = get_sync_state()
    last_finished = state.get("lastSyncFinishedAt")
    if not last_finished:
        return False

    finished_at = parse_iso(last_finished)
    elapsed = (datetime.now(timezone.utc) - finished_at).total_seconds()
    return elapsed < int(os.environ.get("SYNC_DEBOUNCE_SECONDS", "60"))


def mark_sync_started(trigger_count: int) -> None:
    state = get_sync_state()
    state["lastSyncStartedAt"] = now_iso()
    state["lastTriggerCount"] = trigger_count
    put_sync_state(state)


def mark_sync_finished(trigger_count: int, activity_count: int) -> None:
    state = get_sync_state()
    state["lastSyncFinishedAt"] = now_iso()
    state["lastTriggerCount"] = trigger_count
    state["lastActivityCount"] = activity_count
    put_sync_state(state)


def get_sync_state() -> dict[str, Any]:
    param = os.environ.get("SYNC_STATE_PARAM")
    if not param:
        return {}
    try:
        raw = get_parameter(param, decrypt=False)
    except Exception as exc:
        print(json.dumps({"message": "sync state missing or unreadable", "error": str(exc)}))
        return {}
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def put_sync_state(state: dict[str, Any]) -> None:
    param = os.environ.get("SYNC_STATE_PARAM")
    if not param:
        return
    put_parameter(param, json.dumps(state, separators=(",", ":")), secure=False)


def put_data_json(data: dict[str, Any]) -> None:
    bucket = required_env("OUTPUT_BUCKET")
    key = required_env("OUTPUT_KEY")
    boto3_client("s3").put_object(
        Bucket=bucket,
        Key=key,
        Body=json.dumps(data, indent=2, ensure_ascii=False).encode("utf-8") + b"\n",
        ContentType="application/json; charset=utf-8",
        CacheControl=os.environ.get("DATA_JSON_CACHE_CONTROL", "max-age=60"),
    )


def invalidate_cloudfront() -> None:
    distribution_id = os.environ.get("CLOUDFRONT_DISTRIBUTION_ID")
    if not distribution_id:
        return
    boto3_client("cloudfront").create_invalidation(
        DistributionId=distribution_id,
        InvalidationBatch={
            "Paths": {"Quantity": 1, "Items": ["/data.json"]},
            "CallerReference": f"stravaw-data-{datetime.now(timezone.utc).timestamp()}",
        },
    )


def get_parameter(name: str, decrypt: bool) -> str:
    value = boto3_client("ssm").get_parameter(Name=name, WithDecryption=decrypt)["Parameter"]["Value"]
    return str(value)


def put_parameter(name: str, value: str, secure: bool) -> None:
    boto3_client("ssm").put_parameter(
        Name=name,
        Value=value,
        Type="SecureString" if secure else "String",
        Overwrite=True,
    )


def boto3_client(service: str) -> Any:
    import boto3

    return boto3.client(service)


def parse_body(event: dict[str, Any]) -> dict[str, Any]:
    raw = event.get("body") or "{}"
    if event.get("isBase64Encoded"):
        raw = base64.b64decode(raw).decode("utf-8")
    parsed = json.loads(raw)
    if not isinstance(parsed, dict):
        raise ValueError("request body must be a JSON object")
    return parsed


def request_method(event: dict[str, Any]) -> str:
    context = event.get("requestContext") or {}
    http = context.get("http") or {}
    return str(http.get("method") or event.get("httpMethod") or "").upper()


def header_value(event: dict[str, Any], name: str) -> str:
    headers = event.get("headers") or {}
    lower_name = name.lower()
    for key, value in headers.items():
        if key.lower() == lower_name:
            return str(value)
    return ""


def response(status_code: int, body: dict[str, Any]) -> dict[str, Any]:
    return {
        "statusCode": status_code,
        "headers": {"content-type": "application/json"},
        "body": json.dumps(body, separators=(",", ":")),
    }


def safe_event_log(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "aspect_type": payload.get("aspect_type"),
        "object_type": payload.get("object_type"),
        "object_id": payload.get("object_id"),
        "owner_id": payload.get("owner_id"),
    }


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def parse_iso(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def required_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing {name}")
    return value
