import unittest

from app.transports import FetchError, FetchResult, fetch_with_cascade


class TransportTests(unittest.TestCase):
    def test_v19_uses_first_successful_transport(self):
        calls = []

        def fail(_url):
            calls.append("curl")
            raise FetchError("blocked")

        def succeed(url):
            calls.append("browser")
            return FetchResult("<html>listing</html>", url, "browser", 200)

        result = fetch_with_cascade(
            "https://www.immobilienscout24.at/expose/1",
            ("curl", "browser"),
            {"curl": fail, "browser": succeed},
        )

        self.assertEqual(calls, ["curl", "browser"])
        self.assertEqual(result.transport, "browser")

    def test_v20_rejects_oversized_transport_output(self):
        def oversized(url):
            return FetchResult("x" * 2_000_001, url, "curl", 200)

        with self.assertRaises(FetchError):
            fetch_with_cascade(
                "https://www.immobilienscout24.at/expose/1",
                ("curl",),
                {"curl": oversized},
            )

    def test_v19_continues_after_transport_library_error(self):
        def broken(_url):
            raise ValueError("unexpected browser library failure")

        def succeed(url):
            return FetchResult("<html>listing</html>", url, "browser", 200)

        result = fetch_with_cascade(
            "https://www.immobilienscout24.at/expose/1",
            ("curl", "browser"),
            {"curl": broken, "browser": succeed},
        )
        self.assertEqual(result.transport, "browser")


if __name__ == "__main__":
    unittest.main()
