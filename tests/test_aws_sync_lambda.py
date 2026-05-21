import json
import os
import unittest
from unittest.mock import patch

from scripts import aws_sync_lambda


class AwsSyncLambdaTest(unittest.TestCase):
    def test_webhook_challenge_echoes_hub_challenge(self):
        event = {
            "requestContext": {"http": {"method": "GET"}},
            "queryStringParameters": {
                "hub.challenge": "challenge-value",
                "hub.verify_token": "expected-token",
            },
        }

        with patch.dict(os.environ, {"STRAVA_VERIFY_TOKEN_PARAM": "/stravaw/verify-token"}), patch(
            "scripts.aws_sync_lambda.get_parameter",
            return_value="expected-token",
        ):
            response = aws_sync_lambda.webhook_handler(event, None)

        self.assertEqual(response["statusCode"], 200)
        self.assertEqual(json.loads(response["body"]), {"hub.challenge": "challenge-value"})

    def test_webhook_ignores_unrelated_owner(self):
        event = {
            "requestContext": {"http": {"method": "POST"}},
            "body": json.dumps(
                {
                    "aspect_type": "create",
                    "object_type": "activity",
                    "object_id": 123,
                    "owner_id": 999,
                }
            ),
        }

        with patch.dict(os.environ, {"STRAVA_OWNER_ID_PARAM": "/stravaw/owner-id"}), patch(
            "scripts.aws_sync_lambda.get_parameter",
            return_value="111",
        ), patch("scripts.aws_sync_lambda.enqueue_sync") as enqueue:
            response = aws_sync_lambda.webhook_handler(event, None)

        self.assertEqual(response["statusCode"], 200)
        self.assertEqual(json.loads(response["body"]), {"message": "ignored"})
        enqueue.assert_not_called()

    def test_webhook_enqueues_create_update_and_delete(self):
        for aspect_type in ["create", "update", "delete"]:
            with self.subTest(aspect_type=aspect_type):
                event = {
                    "requestContext": {"http": {"method": "POST"}},
                    "body": json.dumps(
                        {
                            "aspect_type": aspect_type,
                            "object_type": "activity",
                            "object_id": 123,
                            "owner_id": 111,
                        }
                    ),
                }

                with patch.dict(os.environ, {"STRAVA_OWNER_ID_PARAM": "/stravaw/owner-id"}), patch(
                    "scripts.aws_sync_lambda.get_parameter",
                    return_value="111",
                ), patch("scripts.aws_sync_lambda.enqueue_sync") as enqueue:
                    response = aws_sync_lambda.webhook_handler(event, None)

                self.assertEqual(response["statusCode"], 200)
                self.assertEqual(json.loads(response["body"]), {"message": "queued"})
                enqueue.assert_called_once()

    def test_manual_refresh_requires_secret_header(self):
        event = {
            "requestContext": {"http": {"method": "POST"}},
            "headers": {"X-Refresh-Token": "provided"},
        }

        with patch.dict(os.environ, {"MANUAL_REFRESH_TOKEN_PARAM": "/stravaw/manual-token"}), patch(
            "scripts.aws_sync_lambda.get_parameter",
            return_value="expected",
        ), patch("scripts.aws_sync_lambda.enqueue_sync") as enqueue:
            response = aws_sync_lambda.manual_refresh_handler(event, None)

        self.assertEqual(response["statusCode"], 401)
        enqueue.assert_not_called()


if __name__ == "__main__":
    unittest.main()
