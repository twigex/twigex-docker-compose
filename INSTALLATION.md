# Installing twigex (Docker Compose, single node)

Standalone installation guide for the twigex single-node Compose stack.
For the full configuration reference, see
[`README.md`](README.md).

## Prerequisites

- Linux host with Docker Engine 20.10+ and the Compose v2 plugin
  (`docker compose version` must work). Rootless or root — either works.
- ~4 GB RAM free (app + MariaDB + Redis + Cube + EuroOffice + LiveKit).
- Outbound internet to pull images from `ghcr.io`, Docker Hub, and
  `livekit/` (LiveKit images).
- No ports already bound on the host for: **3000/tcp** (app),
  **9980/tcp** (document editor), **7880/tcp** (chat signaling),
  **7881/tcp** (ICE fallback), **7882/udp** (ICE), **50000–50100/udp**
  (TURN relay).

## 1. Get the repo

```bash
git clone https://github.com/twigex/twigex-docker-compose.git twigex-docker-compose
cd twigex-docker-compose
```

## 2. Generate secrets

Every secret ships as the literal `change-me` in `.env.example`. Replace
**all of them** before exposing the stack:

```bash
bash generate-secrets.sh
# → copies .env.example → .env (git-ignored, chmod 600)
# → rotates every change-me to a fresh random value (the two S3
#   storage keys are blanked — only used with S3 storage)
# → prints the generated admin password; a re-run on a configured
#   stack is a friendly no-op
# → verifies no placeholder is left (exits non-zero otherwise)
```

All values then live in `.env`; each cross-service secret is one variable
consumed by both of its services, so pairs stay in sync by construction.

Notes:

- `TWIGEX_SERVER_ENCRYPT_KEY` must be exactly 32 hex chars
  (`openssl rand -hex 16` is fine). Losing it = losing stored
  credentials — back it up.
- `TWIGEX_DB_PASSWORD` is **one-time-set**: baked into the database on
  first init (mariadb reads it only on the first boot of its volume).
  Decide it now. MariaDB root (`MARIADB_ROOT_PASSWORD`) is baked in the
  same way — the backup command and the `ALTER USER` one-liner both
  authenticate as root with this value.
- Only using local file storage (the default)?
  `TWIGEX_STORAGE_ACCESS_KEY` / `_SECRET_KEY` can stay empty — they
  aren't read (`TWIGEX_STORAGE_TYPE` itself stays `local`).

## 3. Set the public URLs

Three browser-facing URLs (all default to `localhost` — correct when the
browser runs on the same host AND the office editor is disabled; office
is enabled by default, so the SiteURL note in the table matters on
first boot too):

| Variable | Default | Set to |
|---|---|---|
| `TWIGEX_SERVER_SITE_URL` | `http://localhost:3000` | URL users open the app at — must also be reachable from the eurooffice container (localhost breaks office editing; use the host's LAN IP or domain) |
| `TWIGEX_OFFICE_HOST` | `http://localhost:9980` | URL the browser loads the editor iframe from |
| `TWIGEX_CHANNEL_HOST` | `ws://localhost:7880` | URL the browser dials for chat |

Full scenario table (same-host / LAN / LAN-TLS / public domain) is in
`README.md` → "Self-hosting".

## 4. Start the stack

```bash
docker compose up -d
docker compose ps            # all 8 services Up
docker compose logs -f twigex
```

First boot: the `twigex` container creates the initial admin user from
the `TWIGEX_ADMIN_*` env vars.

## 5. Verify

```bash
# App answers:
curl -fsS -o /dev/null -w '%{http_code}\n' http://localhost:3000/
# Document editor answers:
curl -fsS -o /dev/null -w '%{http_code}\n' http://localhost:9980/
# Chat signaling port accepts TCP:
(exec 3<>/dev/tcp/localhost/7880 && echo ok)
```

Open `http://localhost:3000`, log in as `admin` / your
`TWIGEX_ADMIN_PASSWORD`, and confirm: file upload, opening a `.docx`
in the editor, and joining a chat (if you'll use chat — see the
secure-context caveat below for LAN/plain-HTTP installs).

## 6. TLS / reverse proxy (LAN or internet)

Port 3000 is plain HTTP — **don't expose it directly to the internet.**
Put a reverse proxy in front (Caddy, Traefik, Nginx Proxy Manager all
work) and forward:

- `https://twigex.your-domain` → `localhost:3000`
- `https://euro-office.your-domain` → `localhost:9980`
- `wss://livekit.your-domain` → `localhost:7880`, plus TCP 7881,
  UDP 7882, and UDP 50000–50100 (TURN). **UDP forwarding is mandatory
  for WebRTC audio** — no UDP ⇒ no audio.

Then update the three URLs from step 3 to their public `https://` /
`wss://` values and `docker compose up -d` again.

> **Secure-context caveat (LAN, plain HTTP):** browsers only grant
> camera/microphone (`getUserMedia`) on `https://` and `http://localhost`.
> On a LAN IP over HTTP, chat mic/camera buttons will be greyed out.

## Upgrading

```bash
docker compose pull
docker compose up -d
# Data lives in named volumes (twigex_twigex_data, twigex_mariadb_data, …
# — the `twigex_` project prefix is prepended) and survives.
```

All image tags are `.env` variables (`TWIGEX_IMAGE_TAG`, `CUBE_IMAGE_TAG`,
`CUBESTORE_IMAGE_TAG`, `MARIADB_IMAGE_TAG`, `REDIS_IMAGE_TAG`,
`EUROOFFICE_IMAGE_TAG`, `LIVEKIT_IMAGE_TAG`) with defaults baked into
`docker-compose.yml`. Upgrading means bumping the tag in `.env` (read
[CHANGELOG.md](CHANGELOG.md) first — breaking changes are documented
per version), then
`docker compose pull && docker compose up -d`. Take a backup first (see
`README.md` → "Backups"). The app image is currently
`ghcr.io/twigex/twigex-ee` at tag `${TWIGEX_IMAGE_TAG:-0.16.0}`.

## Backups and teardown

Backup commands (database dump + file volumes) are in
`README.md` → "Backups". To remove everything including data:

```bash
docker compose down -v
```
