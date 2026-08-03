# AppScanner scraper worker

Isolated Railway transport for ImmoScout24 pages that reject Vercel/native HTTP. The Next.js app still owns robots/rate limits, parsing, provenance, persistence, and scoring.

## Railway setup

Create a service from this repository and set its root directory to `/scraper-worker`. Railway uses `railway.toml`, the Dockerfile, `$PORT`, and `/health` automatically.

Set these Railway variables:

```dotenv
SCRAPER_WORKER_SECRET=<output of: openssl rand -hex 32>
SCRAPER_ALLOWED_HOSTS=immobilienscout24.at
CLOAKBROWSER_ENABLED=false
```

Set the matching Vercel variables:

```dotenv
SCRAPER_WORKER_ENABLED=true
SCRAPER_WORKER_URL=https://<railway-service-domain>
SCRAPER_WORKER_SECRET=<same secret>
SCRAPER_WORKER_STEALTH=false
```

The default cascade is `curl_cffi` then Playwright Chromium, with one active request at a time. To experiment with CloakBrowser, build with Docker argument `WITH_CLOAK=true`, provide its required license/build configuration, then enable both `CLOAKBROWSER_ENABLED` on Railway and `SCRAPER_WORKER_STEALTH` on Vercel. It remains off by default because its current distribution is key-gated and its browser binary adds substantial image/runtime cost.

## Local checks

```bash
PYTHONPATH=scraper-worker python3 -m unittest discover -s scraper-worker/tests
docker build -t appscanner-scraper-worker scraper-worker
docker run --rm -p 8080:8080 -e SCRAPER_WORKER_SECRET="$(openssl rand -hex 32)" appscanner-scraper-worker
curl http://127.0.0.1:8080/health
```
