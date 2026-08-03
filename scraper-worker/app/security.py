import hashlib
import hmac
import ipaddress
import socket
import time
from typing import Callable, Iterable, Optional
from urllib.parse import urlsplit


class SecurityError(ValueError):
    pass


Resolver = Callable[..., Iterable[tuple]]


def verify_signature(
    secret: str,
    timestamp: str,
    signature: str,
    body: bytes,
    *,
    now: Optional[int] = None,
) -> None:
    if not secret or not timestamp or not signature:
        raise SecurityError("Missing scraper authentication.")
    try:
        issued_at = int(timestamp)
    except ValueError as error:
        raise SecurityError("Invalid scraper timestamp.") from error
    if abs((now if now is not None else int(time.time())) - issued_at) > 60:
        raise SecurityError("Expired scraper request.")
    expected = hmac.new(
        secret.encode(), timestamp.encode() + b"." + body, hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise SecurityError("Invalid scraper signature.")


def host_allowed(host: str, allowed_hosts: tuple[str, ...]) -> bool:
    normalized = host.rstrip(".").lower()
    return any(
        normalized == allowed or normalized.endswith(f".{allowed}")
        for allowed in allowed_hosts
    )


def validate_url(
    raw_url: str,
    allowed_hosts: tuple[str, ...],
    *,
    resolver: Resolver = socket.getaddrinfo,
    require_allowed_host: bool = True,
) -> str:
    try:
        parsed = urlsplit(raw_url)
        port = parsed.port
    except ValueError as error:
        raise SecurityError("Malformed target URL.") from error
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise SecurityError("Only HTTP(S) target URLs are allowed.")
    if parsed.username or parsed.password or port not in {None, 80, 443}:
        raise SecurityError("Credentials and custom target ports are forbidden.")

    host = parsed.hostname.rstrip(".").lower()
    if require_allowed_host and not host_allowed(host, allowed_hosts):
        raise SecurityError(f'Target host "{host}" is not allowlisted.')

    try:
        literal = ipaddress.ip_address(host)
        addresses = [literal]
    except ValueError:
        try:
            records = resolver(host, port or (443 if parsed.scheme == "https" else 80))
            addresses = list(
                {
                    ipaddress.ip_address(record[4][0].split("%", 1)[0])
                    for record in records
                }
            )
        except (OSError, ValueError) as error:
            raise SecurityError(f'Could not resolve target host "{host}".') from error

    if not addresses or any(not address.is_global for address in addresses):
        raise SecurityError("Target resolves to a private or non-public address.")
    return raw_url
