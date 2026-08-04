from dataclasses import dataclass
from typing import Callable, Mapping, Sequence
from urllib.parse import urljoin

from .security import SecurityError, validate_url

MAX_HTML_BYTES = 2_000_000
MAX_REDIRECTS = 5
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
)


class FetchError(RuntimeError):
    pass


@dataclass(frozen=True)
class FetchResult:
    html: str
    final_url: str
    transport: str
    status: int


Runner = Callable[[str], FetchResult]


def _validate_result(result: FetchResult) -> None:
    if not 200 <= result.status < 300:
        raise FetchError(f"Transport returned HTTP {result.status}.")
    if len(result.html.encode("utf-8")) > MAX_HTML_BYTES:
        raise FetchError("Transport response exceeds 2 MB.")
    lower = result.html[:100_000].lower()
    if any(
        marker in lower
        for marker in (
            "cf-chl-",
            "just a moment...</title>",
            "enable javascript and cookies to continue",
            "captcha-delivery.com",
            "ich bin kein roboter",
            "fälschlicherweise als roboter identifiziert",
        )
    ):
        raise FetchError("Transport returned an anti-bot challenge page.")


def fetch_with_cascade(
    url: str,
    transports: Sequence[str],
    runners: Mapping[str, Runner],
) -> FetchResult:
    errors: list[str] = []
    for transport in transports:
        runner = runners.get(transport)
        if runner is None:
            errors.append(f"{transport}: unavailable")
            continue
        try:
            result = runner(url)
            _validate_result(result)
            return result
        except Exception as error:
            errors.append(f"{transport}: {str(error)[:180]}")
    raise FetchError("All scraper transports failed: " + "; ".join(errors))


def curl_fetch(url: str, allowed_hosts: tuple[str, ...]) -> FetchResult:
    from curl_cffi import requests

    current = url
    with requests.Session(impersonate="chrome") as session:
        for redirects in range(MAX_REDIRECTS + 1):
            validate_url(current, allowed_hosts)
            response = session.get(
                current,
                allow_redirects=False,
                timeout=15,
                headers={"Accept": "text/html,application/xhtml+xml"},
            )
            if response.status_code in {301, 302, 303, 307, 308}:
                location = response.headers.get("location")
                if not location or redirects == MAX_REDIRECTS:
                    raise FetchError("Invalid or excessive redirect chain.")
                current = urljoin(current, location)
                continue
            content_type = response.headers.get("content-type", "").lower()
            if not content_type.startswith(("text/html", "application/xhtml+xml")):
                raise FetchError(f"Unsupported content type: {content_type or 'missing'}.")
            content = response.content
            if len(content) > MAX_HTML_BYTES:
                raise FetchError("Transport response exceeds 2 MB.")
            return FetchResult(response.text, current, "curl", response.status_code)
    raise FetchError("Invalid redirect chain.")


def _route_request(route, allowed_hosts: tuple[str, ...]) -> None:
    request = route.request
    if request.resource_type in {"image", "media", "font"}:
        route.abort("blockedbyclient")
        return
    try:
        validate_url(
            request.url,
            allowed_hosts,
            require_allowed_host=request.is_navigation_request(),
        )
        route.continue_()
    except SecurityError:
        route.abort("blockedbyclient")


def _browser_result(browser, url: str, allowed_hosts: tuple[str, ...], name: str):
    context = browser.new_context(service_workers="block", user_agent=USER_AGENT)
    try:
        context.route("**/*", lambda route: _route_request(route, allowed_hosts))
        page = context.new_page()
        response = page.goto(url, wait_until="domcontentloaded", timeout=30_000)
        page.wait_for_timeout(1_000)
        validate_url(page.url, allowed_hosts)
        content_type = response.header_value("content-type") if response else "text/html"
        if not content_type.lower().startswith(("text/html", "application/xhtml+xml")):
            raise FetchError(
                f"Unsupported content type: {content_type or 'missing'}."
            )
        return FetchResult(
            page.content(),
            page.url,
            name,
            response.status if response else 200,
        )
    finally:
        context.close()


def browser_fetch(url: str, allowed_hosts: tuple[str, ...]) -> FetchResult:
    from playwright.sync_api import sync_playwright

    validate_url(url, allowed_hosts)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True, args=["--disable-dev-shm-usage", "--no-sandbox"]
        )
        try:
            return _browser_result(browser, url, allowed_hosts, "browser")
        finally:
            browser.close()


def cloak_fetch(url: str, allowed_hosts: tuple[str, ...]) -> FetchResult:
    from cloakbrowser import launch

    validate_url(url, allowed_hosts)
    browser = launch(headless=True)
    try:
        return _browser_result(browser, url, allowed_hosts, "cloak")
    finally:
        browser.close()


def build_runners(
    allowed_hosts: tuple[str, ...], *, cloak_enabled: bool
) -> dict[str, Runner]:
    runners: dict[str, Runner] = {
        "curl": lambda url: curl_fetch(url, allowed_hosts),
        "browser": lambda url: browser_fetch(url, allowed_hosts),
    }
    if cloak_enabled:
        runners["cloak"] = lambda url: cloak_fetch(url, allowed_hosts)
    return runners
