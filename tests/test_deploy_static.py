import unittest

from scripts.deploy_static import build_sync_command


class DeployStaticTest(unittest.TestCase):
    def test_sync_excludes_data_json_by_default(self):
        command = build_sync_command("s3://example/site", include_data=False)

        self.assertIn("--exclude", command)
        self.assertIn("data.json", command)

    def test_sync_can_include_data_json_explicitly(self):
        command = build_sync_command("s3://example/site", include_data=True)

        self.assertNotIn("--exclude", command)
        self.assertNotIn("data.json", command)


if __name__ == "__main__":
    unittest.main()
