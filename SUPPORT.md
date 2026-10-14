# Support

How to get help with the twigex Docker Compose stack.

## Where to ask

- **Documentation first** — most setup questions are answered in:
  - [`README.md`](README.md) — configuration reference,
    self-hosting scenarios, backups, production notes
  - [`INSTALLATION.md`](INSTALLATION.md) — step-by-step first install
  - [`SECURITY.md`](SECURITY.md) — secrets and exposure caveats
- **Issues** — for bugs and feature requests, open an issue on the
  repository's issue tracker.
- **Security problems** — never in public issues; follow
  [`SECURITY.md`](SECURITY.md) instead.

## Before filing a bug

Collect the following — it makes a report answerable in one round:

```bash
# 1. Versions
docker compose version && docker --version
git rev-parse --short HEAD

# 2. Service state (all 8 services, statuses and ports)
docker compose ps

# 3. Logs from the failing service (default all)
docker compose logs --no-color --tail=100 twigex
#    repeat for the relevant service: mariadb, redis, cube-api,
#    cube-router, cube-worker-1, eurooffice, livekit

# 4. Config as Docker actually parsed it (REDACT SECRETS before posting!)
docker compose config
```

## What to include

1. What you expected vs. what happened.
2. The service(s) involved and how you access them (same-host browser,
   LAN IP, or public domain — the relevant URLs are `TWIGEX_SERVER_SITE_URL`
   (browser + eurooffice container), `TWIGEX_OFFICE_HOST`, and
   `TWIGEX_CHANNEL_HOST` — all in `.env`).
3. The logs and `docker compose ps` output from above, **with all
   passwords/secrets redacted**.
4. Any change you made to `.env`, `docker-compose.yml`, or `livekit.yaml`.

## Common quick answers

- **App can't reach the database after changing `TWIGEX_DB_PASSWORD`** —
  it's one-time-set (baked in at first init); see
  `README.md` → "Production notes".
- **LiveKit crashes with `cannot unmarshal !!str /liveki…`** — the
  `LIVEKIT_CONFIG` env var must not be set; the container must run with
  `command: ["--config", "/livekit.yaml"]`.
- **Chat connects but camera/mic are greyed out on a LAN IP** —
  secure-context limitation; needs TLS (see `README.md` →
  "Self-hosting").
- **Office editor iframe blank** — `TWIGEX_OFFICE_SECRET` and the
  eurooffice `JWT_SECRET` must be the same string, and
  `TWIGEX_OFFICE_HOST` must be a URL the *browser* can reach.

## Expectations

This is a single-maintainer self-hosting repo; responses are best-effort.
Patches with the diagnostic info above usually get a reply within days.
