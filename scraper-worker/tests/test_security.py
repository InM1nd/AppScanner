import hashlib
import hmac
import socket
import unittest

from app.security import SecurityError, validate_url, verify_signature


class SecurityTests(unittest.TestCase):
    def test_v18_signature_binds_timestamp_and_body(self):
        body = b'{"url":"https://www.immobilienscout24.at/expose/1"}'
        timestamp = 1_700_000_000
        signature = hmac.new(
            b"secret", str(timestamp).encode() + b"." + body, hashlib.sha256
        ).hexdigest()

        verify_signature("secret", str(timestamp), signature, body, now=timestamp)
        with self.assertRaises(SecurityError):
            verify_signature("secret", str(timestamp), signature, body + b" ", now=timestamp)
        with self.assertRaises(SecurityError):
            verify_signature("secret", str(timestamp), signature, body, now=timestamp + 61)

    def test_v18_rejects_private_or_non_allowlisted_targets(self):
        def resolver(host, *_args, **_kwargs):
            address = "127.0.0.1" if host == "private.example" else "93.184.216.34"
            return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (address, 443))]

        validate_url(
            "https://www.immobilienscout24.at/expose/1",
            ("immobilienscout24.at",),
            resolver=resolver,
        )
        with self.assertRaises(SecurityError):
            validate_url(
                "http://127.0.0.1/admin",
                ("immobilienscout24.at",),
                resolver=resolver,
            )
        with self.assertRaises(SecurityError):
            validate_url(
                "https://private.example/",
                ("private.example",),
                resolver=resolver,
            )
        with self.assertRaises(SecurityError):
            validate_url(
                "https://example.com/",
                ("immobilienscout24.at",),
                resolver=resolver,
            )


if __name__ == "__main__":
    unittest.main()
