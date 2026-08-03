import json
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from .security import SecurityError, validate_url, verify_signature
from .transports import FetchError, build_runners, fetch_with_cascade

MAX_REQUEST_BYTES = 4_096
FETCH_SLOT = threading.BoundedSemaphore(1)
DEFAULT_HOSTS = (
    "immobilienscout24.at",
    "willhaben.at",
    "lystio.at",
)


def _allowed_hosts() -> tuple[str, ...]:
    configured = os.environ.get("SCRAPER_ALLOWED_HOSTS", "")
    hosts = tuple(host.strip().lower() for host in configured.split(",") if host.strip())
    return hosts or DEFAULT_HOSTS


class Handler(BaseHTTPRequestHandler):
    server_version = "AppScannerScraper/1"

    def _json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("content-type", "application/json; charset=utf-8")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        if self.path != "/health":
            self._json(404, {"error": "Not found."})
            return
        self._json(
            200,
            {
                "ok": True,
                "concurrency": 1,
                "cloakEnabled": os.environ.get("CLOAKBROWSER_ENABLED") == "true",
            },
        )

    def do_POST(self) -> None:
        if self.path != "/v1/fetch":
            self._json(404, {"error": "Not found."})
            return
        try:
            length = int(self.headers.get("content-length", "0"))
            if length <= 0 or length > MAX_REQUEST_BYTES:
                raise SecurityError("Invalid scraper request size.")
            body = self.rfile.read(length)
            verify_signature(
                os.environ.get("SCRAPER_WORKER_SECRET", ""),
                self.headers.get("x-appscanner-timestamp", ""),
                self.headers.get("x-appscanner-signature", ""),
                body,
            )
            payload = json.loads(body)
            if not isinstance(payload, dict):
                raise SecurityError("Invalid scraper request payload.")
            url = payload.get("url")
            transports = payload.get("transports")
            if not isinstance(url, str) or not isinstance(transports, list):
                raise SecurityError("Invalid scraper request payload.")
            if not transports or len(transports) > 3 or any(
                transport not in {"curl", "browser", "cloak"}
                for transport in transports
            ):
                raise SecurityError("Invalid scraper transport list.")
            hosts = _allowed_hosts()
            validate_url(url, hosts)
            with FETCH_SLOT:
                result = fetch_with_cascade(
                    url,
                    transports,
                    build_runners(
                        hosts,
                        cloak_enabled=os.environ.get("CLOAKBROWSER_ENABLED") == "true",
                    ),
                )
            print(
                json.dumps(
                    {
                        "event": "scraper.fetch.success",
                        "host": url.split("/", 3)[2],
                        "transport": result.transport,
                        "status": result.status,
                    }
                ),
                flush=True,
            )
            self._json(
                200,
                {
                    "html": result.html,
                    "finalUrl": result.final_url,
                    "transport": result.transport,
                    "status": result.status,
                },
            )
        except SecurityError as error:
            self._json(401, {"error": str(error)})
        except (FetchError, json.JSONDecodeError, UnicodeDecodeError) as error:
            self._json(502, {"error": str(error)[:800]})

    def log_message(self, _format: str, *_args) -> None:
        return


def main() -> None:
    secret = os.environ.get("SCRAPER_WORKER_SECRET", "")
    if len(secret) < 32:
        raise RuntimeError("SCRAPER_WORKER_SECRET must contain at least 32 characters.")
    port = int(os.environ.get("PORT", "8080"))
    server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    print(json.dumps({"event": "scraper.worker.ready", "port": port}), flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
