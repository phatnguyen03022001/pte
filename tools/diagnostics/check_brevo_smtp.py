#!/usr/bin/env python3
"""Verify Brevo SMTP authentication over verified STARTTLS without sending mail."""

from __future__ import annotations

import getpass
import argparse
import os
import smtplib
import socket
import ssl
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Sequence


HOST = "smtp-relay.brevo.com"
PORT = 587
TIMEOUT_SECONDS = 10

SMTP_AUTH_OK = "SMTP_AUTH_OK"
SMTP_AUTH_535 = "SMTP_AUTH_535"
SMTP_AUTH_REJECTED_OTHER = "SMTP_AUTH_REJECTED_OTHER"
SMTP_STARTTLS_FAILED = "SMTP_STARTTLS_FAILED"
SMTP_NETWORK_FAILED = "SMTP_NETWORK_FAILED"
SMTP_AUTH_UNSUPPORTED = "SMTP_AUTH_UNSUPPORTED"
SMTP_UNKNOWN_ERROR = "SMTP_UNKNOWN_ERROR"
CREDENTIAL_INPUT_UNAVAILABLE = "CREDENTIAL_INPUT_UNAVAILABLE"
CREDENTIALS_UNAVAILABLE = "CREDENTIALS_UNAVAILABLE"

ENV_LOCAL_FIELDS = frozenset({"BREVO_SMTP_LOGIN", "BREVO_SMTP_KEY"})


@dataclass(frozen=True)
class DiagnosticResult:
    status: str
    dns: bool = False
    tcp: bool = False
    tls: bool = False
    auth: bool = False


CredentialsProvider = Callable[[], tuple[str, str]]


class CredentialInputUnavailable(Exception):
    """Raised when an interactive controlling terminal is unavailable."""


class CredentialsUnavailable(Exception):
    """Raised when an allowed local credential is missing or unusable."""


def prompt_credentials() -> tuple[str, str]:
    """Read credentials from the controlling terminal without echoing the key."""
    try:
        descriptor = os.open("/dev/tty", os.O_RDWR | getattr(os, "O_NOCTTY", 0))
    except OSError as error:
        raise CredentialInputUnavailable from error

    try:
        if not os.isatty(descriptor):
            raise CredentialInputUnavailable
        with os.fdopen(descriptor, "r+", encoding="utf-8", buffering=1) as terminal:
            descriptor = -1
            print("SMTP username: ", end="", file=terminal, flush=True)
            username = terminal.readline().rstrip("\r\n")
            if not username:
                raise CredentialInputUnavailable
            password = getpass.getpass("SMTP password: ", stream=terminal)
            if not password:
                raise CredentialInputUnavailable
            return username, password
    finally:
        if descriptor >= 0:
            os.close(descriptor)


def _parse_env_value(raw_value: str) -> str:
    """Parse a simple dotenv value without expanding variables or commands."""
    value = raw_value.strip()
    if not value:
        return ""
    if value[0] in {"'", '"'}:
        quote = value[0]
        if len(value) < 2 or value[-1] != quote:
            return ""
        return value[1:-1]
    comment_start = value.find(" #")
    if comment_start >= 0:
        value = value[:comment_start].rstrip()
    return value


def load_env_local_credentials(path: Path | None = None) -> tuple[str, str]:
    """Read only the two explicitly permitted SMTP values from .env.local."""
    env_path = path if path is not None else Path(__file__).resolve().parents[2] / ".env.local"
    values: dict[str, str] = {}
    try:
        with open(env_path, "r", encoding="utf-8") as env_file:
            for line in env_file:
                candidate = line.strip()
                if not candidate or candidate.startswith("#"):
                    continue
                if candidate.startswith("export "):
                    candidate = candidate[7:].lstrip()
                name, separator, raw_value = candidate.partition("=")
                if not separator or name.strip() not in ENV_LOCAL_FIELDS:
                    continue
                name = name.strip()
                if name in values:
                    raise CredentialsUnavailable
                values[name] = _parse_env_value(raw_value)
    except (OSError, UnicodeError) as error:
        raise CredentialsUnavailable from error

    login = values.get("BREVO_SMTP_LOGIN", "").strip()
    key = values.get("BREVO_SMTP_KEY", "").strip()
    if not login or not key or _is_placeholder(login) or _is_placeholder(key):
        raise CredentialsUnavailable
    return login, key


def _is_placeholder(value: str) -> bool:
    normalized = value.strip().casefold()
    known_placeholders = {
        "example",
        "none",
        "null",
        "placeholder",
        "change_me",
        "changeme",
        "replace_me",
        "your_smtp_login",
        "your_brevo_smtp_login",
        "your_smtp_key",
        "your_brevo_smtp_key",
    }
    return (
        normalized in known_placeholders
        or normalized.startswith(("your_", "replace_", "changeme"))
        or (normalized.startswith("<") and normalized.endswith(">"))
    )


def _connect_socket(
    addresses: Sequence[tuple],
    socket_factory: Callable[..., socket.socket],
) -> socket.socket:
    if not addresses:
        raise OSError("No DNS addresses")
    family, socktype, proto, _canonname, sockaddr = addresses[0]
    connection = socket_factory(family, socktype, proto)
    connection.settimeout(TIMEOUT_SECONDS)
    try:
        connection.connect(sockaddr)
    except BaseException:
        connection.close()
        raise
    return connection


def run_diagnostic(
    credentials_provider: CredentialsProvider = prompt_credentials,
    *,
    resolver: Callable[..., Sequence[tuple]] = socket.getaddrinfo,
    socket_factory: Callable[..., socket.socket] = socket.socket,
    smtp_factory: Callable[..., smtplib.SMTP] = smtplib.SMTP,
    tls_context_factory: Callable[[], ssl.SSLContext] = ssl.create_default_context,
) -> DiagnosticResult:
    """Run exactly one DNS/TCP/STARTTLS/AUTH pass and always close the socket."""
    dns_ok = tcp_ok = tls_ok = auth_ok = False
    connection: socket.socket | None = None
    smtp: smtplib.SMTP | None = None

    try:
        try:
            addresses = resolver(HOST, PORT, type=socket.SOCK_STREAM)
            if not addresses:
                return DiagnosticResult(SMTP_NETWORK_FAILED)
            dns_ok = True
        except (OSError, socket.gaierror):
            return DiagnosticResult(SMTP_NETWORK_FAILED)

        try:
            connection = _connect_socket(addresses, socket_factory)
            tcp_ok = True
            smtp = smtp_factory(timeout=TIMEOUT_SECONDS)
            smtp._host = HOST
            smtp.sock = connection
            smtp.file = connection.makefile("rb")
            code, _response = smtp.getreply()
            if code != 220:
                return DiagnosticResult(SMTP_UNKNOWN_ERROR, dns_ok, tcp_ok)
            code, _response = smtp.ehlo()
            if code < 200 or code >= 300:
                return DiagnosticResult(SMTP_UNKNOWN_ERROR, dns_ok, tcp_ok)
        except (OSError, socket.timeout, smtplib.SMTPServerDisconnected):
            return DiagnosticResult(SMTP_NETWORK_FAILED, dns_ok, tcp_ok)
        except smtplib.SMTPException:
            return DiagnosticResult(SMTP_UNKNOWN_ERROR, dns_ok, tcp_ok)

        if not smtp.has_extn("starttls"):
            return DiagnosticResult(SMTP_STARTTLS_FAILED, dns_ok, tcp_ok)
        try:
            code, _response = smtp.starttls(context=tls_context_factory())
            if code != 220:
                return DiagnosticResult(SMTP_STARTTLS_FAILED, dns_ok, tcp_ok)
            tls_ok = True
        except (OSError, ssl.SSLError, smtplib.SMTPException):
            return DiagnosticResult(SMTP_STARTTLS_FAILED, dns_ok, tcp_ok)

        try:
            code, _response = smtp.ehlo()
            if code < 200 or code >= 300:
                return DiagnosticResult(SMTP_UNKNOWN_ERROR, dns_ok, tcp_ok, tls_ok)
        except (OSError, socket.timeout, smtplib.SMTPException):
            return DiagnosticResult(SMTP_UNKNOWN_ERROR, dns_ok, tcp_ok, tls_ok)

        mechanisms = set(smtp.esmtp_features.get("auth", "").upper().split())
        mechanism = "PLAIN" if "PLAIN" in mechanisms else "LOGIN" if "LOGIN" in mechanisms else None
        if mechanism is None:
            return DiagnosticResult(SMTP_AUTH_UNSUPPORTED, dns_ok, tcp_ok, tls_ok)

        try:
            username, password = credentials_provider()
        except CredentialInputUnavailable:
            return DiagnosticResult(CREDENTIAL_INPUT_UNAVAILABLE, dns_ok, tcp_ok, tls_ok)
        except (EOFError, OSError, getpass.GetPassWarning):
            return DiagnosticResult(CREDENTIAL_INPUT_UNAVAILABLE, dns_ok, tcp_ok, tls_ok)
        if not username or not password:
            username = password = ""
            return DiagnosticResult(CREDENTIAL_INPUT_UNAVAILABLE, dns_ok, tcp_ok, tls_ok)

        try:
            # AUTH is issued once, after verified TLS, using exactly one advertised mechanism.
            smtp.user = username
            smtp.password = password
            code, _response = smtp.auth(
                mechanism,
                getattr(smtp, f"auth_{mechanism.lower()}"),
                initial_response_ok=(mechanism == "PLAIN"),
            )
            username = password = ""
            if code == 235:
                auth_ok = True
                return DiagnosticResult(SMTP_AUTH_OK, dns_ok, tcp_ok, tls_ok, auth_ok)
            if code == 535:
                return DiagnosticResult(SMTP_AUTH_535, dns_ok, tcp_ok, tls_ok)
            return DiagnosticResult(SMTP_AUTH_REJECTED_OTHER, dns_ok, tcp_ok, tls_ok)
        except smtplib.SMTPAuthenticationError as error:
            username = password = ""
            if error.smtp_code == 535:
                return DiagnosticResult(SMTP_AUTH_535, dns_ok, tcp_ok, tls_ok)
            return DiagnosticResult(SMTP_AUTH_REJECTED_OTHER, dns_ok, tcp_ok, tls_ok)
        except (OSError, socket.timeout, smtplib.SMTPServerDisconnected):
            username = password = ""
            return DiagnosticResult(SMTP_NETWORK_FAILED, dns_ok, tcp_ok, tls_ok)
        except smtplib.SMTPException:
            username = password = ""
            return DiagnosticResult(SMTP_UNKNOWN_ERROR, dns_ok, tcp_ok, tls_ok)
    except Exception:
        return DiagnosticResult(SMTP_UNKNOWN_ERROR, dns_ok, tcp_ok, tls_ok, auth_ok)
    finally:
        if smtp is not None:
            smtp.user = None
            smtp.password = None
            try:
                smtp.close()
            except Exception:
                pass
        elif connection is not None:
            connection.close()


def format_result(result: DiagnosticResult) -> str:
    """Render only fixed status labels; never include exceptions or credentials."""
    dns_status = "PASS" if result.dns else "FAIL"
    tcp_status = "PASS" if result.tcp else "FAIL" if result.dns else "NOT RUN"
    if result.tls:
        tls_status = "PASS"
    elif result.tcp and result.status == SMTP_STARTTLS_FAILED:
        tls_status = "FAIL"
    else:
        tls_status = "NOT RUN"
    if result.auth:
        auth_status = "PASS"
    elif result.status in {SMTP_AUTH_535, SMTP_AUTH_REJECTED_OTHER}:
        auth_status = "FAIL"
    else:
        auth_status = "NOT RUN"
    return "\n".join(
        (
            "RESULT:",
            result.status,
            "",
            "HOST:",
            HOST,
            "",
            "PORT:",
            str(PORT),
            "",
            "DNS:",
            dns_status,
            "",
            "TCP:",
            tcp_status,
            "",
            "TLS:",
            tls_status,
            "",
            "SMTP AUTH:",
            auth_status,
            "",
            "EMAILS SENT:",
            "0",
        )
    )


def run_env_local_diagnostic(
    *,
    env_path: Path | None = None,
    resolver: Callable[..., Sequence[tuple]] = socket.getaddrinfo,
    socket_factory: Callable[..., socket.socket] = socket.socket,
    smtp_factory: Callable[..., smtplib.SMTP] = smtplib.SMTP,
    tls_context_factory: Callable[[], ssl.SSLContext] = ssl.create_default_context,
) -> DiagnosticResult:
    """Load the allowlisted values first, then run one SMTP diagnostic pass."""
    try:
        credentials = load_env_local_credentials(env_path)
    except CredentialsUnavailable:
        return DiagnosticResult(CREDENTIALS_UNAVAILABLE)
    try:
        return run_diagnostic(
            lambda: credentials,
            resolver=resolver,
            socket_factory=socket_factory,
            smtp_factory=smtp_factory,
            tls_context_factory=tls_context_factory,
        )
    finally:
        credentials = ("", "")


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--credentials-source",
        choices=("interactive", "env-local"),
        default="interactive",
    )
    arguments = parser.parse_args(argv)

    if arguments.credentials_source == "env-local":
        result = run_env_local_diagnostic()
    else:
        result = run_diagnostic()
    print(format_result(result))
    return 0 if result.status == SMTP_AUTH_OK else 1


if __name__ == "__main__":
    raise SystemExit(main())
