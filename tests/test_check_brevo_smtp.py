import ast
import builtins
import importlib.util
import io
import pathlib
import socket
import ssl
import sys
import unittest
from unittest.mock import Mock, patch


ROOT = pathlib.Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "tools" / "diagnostics" / "check_brevo_smtp.py"
SPEC = importlib.util.spec_from_file_location("check_brevo_smtp", SCRIPT)
diagnostic = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = diagnostic
SPEC.loader.exec_module(diagnostic)


class FakeSocket:
    def __init__(self):
        self.closed = False
        self.timeout = None

    def settimeout(self, timeout):
        self.timeout = timeout

    def connect(self, _address):
        return None

    def makefile(self, _mode):
        return io.BytesIO()

    def close(self):
        self.closed = True


class FakeSMTP:
    def __init__(self, *, timeout=0, auth_code=235, starttls=True):
        self.timeout = timeout
        self.auth_code = auth_code
        self.has_starttls = starttls
        self.esmtp_features = {"auth": "PLAIN LOGIN"}
        self.sock = None
        self.file = None
        self.user = None
        self.password = None
        self.tls = False
        self.closed = False
        self.auth_calls = 0
        self.email_calls = 0

    def getreply(self):
        return 220, b"ready"

    def ehlo(self):
        return 250, b"hello"

    def has_extn(self, name):
        return name == "starttls" and self.has_starttls

    def starttls(self, *, context):
        assert isinstance(context, ssl.SSLContext)
        assert context.check_hostname
        assert context.verify_mode == ssl.CERT_REQUIRED
        self.tls = True
        return 220, b"ready"

    def auth(self, mechanism, authobject, *, initial_response_ok=True):
        assert self.tls, "SMTP AUTH must happen only after STARTTLS"
        assert mechanism == "PLAIN"
        assert initial_response_ok
        self.auth_calls += 1
        authobject(None)
        return self.auth_code, b"redacted"

    def auth_plain(self, _challenge=None):
        return b"redacted"

    def close(self):
        self.closed = True
        if self.sock:
            self.sock.close()

    def sendmail(self, *_args, **_kwargs):
        self.email_calls += 1

    def send_message(self, *_args, **_kwargs):
        self.email_calls += 1


class BrevoSMTPDiagnosticTests(unittest.TestCase):
    def setUp(self):
        self.fake_socket = FakeSocket()
        self.fake_smtp = FakeSMTP()
        self.resolver = Mock(return_value=[(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("192.0.2.1", 587))])
        self.socket_factory = Mock(return_value=self.fake_socket)
        self.smtp_factory = Mock(return_value=self.fake_smtp)
        self.credentials = Mock(return_value=("smtp-user", "smtp-password"))

    def run_check(self):
        return diagnostic.run_diagnostic(
            self.credentials,
            resolver=self.resolver,
            socket_factory=self.socket_factory,
            smtp_factory=self.smtp_factory,
        )

    def test_success_authenticates_once_after_tls_and_sends_no_email(self):
        result = self.run_check()
        self.assertEqual(result.status, diagnostic.SMTP_AUTH_OK)
        self.assertTrue(result.dns and result.tcp and result.tls and result.auth)
        self.assertEqual(self.fake_smtp.auth_calls, 1)
        self.assertEqual(self.fake_smtp.email_calls, 0)
        self.assertTrue(self.fake_smtp.closed)

    def test_535_is_classified_without_exposing_secrets(self):
        self.fake_smtp.auth_code = 535
        result = self.run_check()
        rendered = diagnostic.format_result(result)
        self.assertEqual(result.status, diagnostic.SMTP_AUTH_535)
        self.assertNotIn("smtp-user", rendered)
        self.assertNotIn("smtp-password", rendered)
        self.assertIn("EMAILS SENT:\n0", rendered)

    def test_missing_starttls_does_not_prompt_or_authenticate(self):
        self.fake_smtp.has_starttls = False
        result = self.run_check()
        self.assertEqual(result.status, diagnostic.SMTP_STARTTLS_FAILED)
        self.credentials.assert_not_called()
        self.assertEqual(self.fake_smtp.auth_calls, 0)

    def test_tcp_timeout_is_a_network_failure(self):
        self.fake_socket.connect = Mock(side_effect=socket.timeout)
        result = self.run_check()
        self.assertEqual(result.status, diagnostic.SMTP_NETWORK_FAILED)
        self.assertTrue(self.fake_socket.closed)
        self.assertEqual(self.fake_socket.timeout, diagnostic.TIMEOUT_SECONDS)
        self.credentials.assert_not_called()

    def test_missing_secure_terminal_stops_without_authentication(self):
        self.credentials.side_effect = diagnostic.CredentialInputUnavailable
        result = self.run_check()
        self.assertEqual(result.status, diagnostic.CREDENTIAL_INPUT_UNAVAILABLE)
        self.assertEqual(self.fake_smtp.auth_calls, 0)

    def test_auth_is_never_attempted_before_tls(self):
        result = self.run_check()
        self.assertTrue(self.fake_smtp.tls)
        self.assertEqual(self.fake_smtp.auth_calls, 1)

    def test_source_has_no_email_submission_calls(self):
        tree = ast.parse(SCRIPT.read_text(encoding="utf-8"))
        forbidden = {"sendmail", "send_message", "mail", "rcpt", "data"}
        calls = {
            node.func.attr
            for node in ast.walk(tree)
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)
        }
        self.assertFalse(calls & forbidden)

    def test_env_local_loader_extracts_only_allowed_fields(self):
        fake_env = io.StringIO(
            "UNRELATED_SECRET=should-not-be-returned\n"
            "BREVO_SMTP_LOGIN=allowed-login\n"
            "BREVO_SMTP_KEY='allowed-key'\n"
        )
        with patch.object(builtins, "open", return_value=fake_env) as open_file:
            credentials = diagnostic.load_env_local_credentials(pathlib.Path("fake.env"))
        self.assertEqual(credentials, ("allowed-login", "allowed-key"))
        open_file.assert_called_once()

    def test_env_local_loader_rejects_missing_credentials(self):
        fake_env = io.StringIO("BREVO_SMTP_LOGIN=allowed-login\n")
        with patch.object(builtins, "open", return_value=fake_env):
            with self.assertRaises(diagnostic.CredentialsUnavailable):
                diagnostic.load_env_local_credentials(pathlib.Path("fake.env"))

    def test_env_local_loader_rejects_placeholders(self):
        fake_env = io.StringIO(
            "BREVO_SMTP_LOGIN=your_smtp_login\nBREVO_SMTP_KEY=allowed-key\n"
        )
        with patch.object(builtins, "open", return_value=fake_env):
            with self.assertRaises(diagnostic.CredentialsUnavailable):
                diagnostic.load_env_local_credentials(pathlib.Path("fake.env"))

    def test_env_local_missing_credentials_do_not_connect(self):
        fake_env = io.StringIO("BREVO_SMTP_LOGIN=allowed-login\n")
        with patch.object(builtins, "open", return_value=fake_env):
            result = diagnostic.run_env_local_diagnostic(
                env_path=pathlib.Path("fake.env"),
                resolver=self.resolver,
                socket_factory=self.socket_factory,
                smtp_factory=self.smtp_factory,
            )
        self.assertEqual(result.status, diagnostic.CREDENTIALS_UNAVAILABLE)
        self.resolver.assert_not_called()
        self.smtp_factory.assert_not_called()
        self.assertEqual(self.fake_smtp.auth_calls, 0)

    def test_env_local_auth_attempts_once_after_tls_without_disclosure(self):
        fake_env = io.StringIO(
            "BREVO_SMTP_LOGIN=private-login\nBREVO_SMTP_KEY=private-key\n"
        )
        with patch.object(builtins, "open", return_value=fake_env):
            result = diagnostic.run_env_local_diagnostic(
                env_path=pathlib.Path("fake.env"),
                resolver=self.resolver,
                socket_factory=self.socket_factory,
                smtp_factory=self.smtp_factory,
            )
        rendered = diagnostic.format_result(result)
        self.assertEqual(result.status, diagnostic.SMTP_AUTH_OK)
        self.assertEqual(self.fake_smtp.auth_calls, 1)
        self.assertTrue(self.fake_smtp.tls)
        self.assertEqual(self.fake_smtp.email_calls, 0)
        self.assertNotIn("private-login", rendered)
        self.assertNotIn("private-key", rendered)

    def test_auth_unsupported_is_classified(self):
        self.fake_smtp.esmtp_features = {"auth": "CRAM-MD5"}
        result = self.run_check()
        self.assertEqual(result.status, diagnostic.SMTP_AUTH_UNSUPPORTED)
        self.credentials.assert_not_called()
        self.assertEqual(self.fake_smtp.auth_calls, 0)


if __name__ == "__main__":
    unittest.main()
