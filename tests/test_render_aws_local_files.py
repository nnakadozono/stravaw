import unittest

from scripts.render_aws_local_files import render_basic_auth_function


class RenderAwsLocalFilesTest(unittest.TestCase):
    def test_basic_auth_function_sets_persistent_cookie(self):
        function_code = render_basic_auth_function(
            {
                "AWS_BASIC_AUTH_USERNAME": "stravaw",
                "AWS_BASIC_AUTH_PASSWORD": "secret",
            }
        )

        self.assertIn("stravaw_auth", function_code)
        self.assertIn("Max-Age=", function_code)
        self.assertIn("request.cookies", function_code)
        self.assertIn("Secure; HttpOnly; SameSite=Lax", function_code)
        self.assertIn("hasValidCookie", function_code)

    def test_basic_auth_function_redirects_after_password_auth(self):
        function_code = render_basic_auth_function(
            {
                "AWS_BASIC_AUTH_USERNAME": "stravaw",
                "AWS_BASIC_AUTH_PASSWORD": "secret",
            }
        )

        self.assertIn("statusCode: 302", function_code)
        self.assertIn("cookies:", function_code)
        self.assertIn("www-authenticate", function_code)


if __name__ == "__main__":
    unittest.main()
