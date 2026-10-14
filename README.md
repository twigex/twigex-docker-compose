<div align="center">

<h1>Twigex Docker Compose</h1>

<p><strong>Self-host Twigex on a single machine.</strong><br/>
Files, chat and video, projects, and a BI tool, with embedded MariaDB,
Redis, LiveKit and EuroOffice document editing — one <code>docker compose</code> command.</p>

<p>
<a href="LICENSE"><img height="20" alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue?style=flat" /></a>
<a href="#"><img height="20" alt="Status: pre-1.0" src="https://img.shields.io/badge/status-pre--1.0-orange?style=flat" /></a>
<a href="https://www.twigex.com"><img height="20" alt="Made by Twigex" src="https://img.shields.io/badge/made%20by-Twigex-6f42c1?style=flat" /></a>
</p>

<p>
<a href="#quick-start"><strong>Quick start</strong></a> ·
<a href="https://demo.twigex.com/"><strong>Live demo</strong></a> ·
<a href="https://twigex.com/docs"><strong>Docs</strong></a>
</p>

</div>

---

> [!NOTE]
> Try it right now, with no signup and no setup: **[demo.twigex.com](https://demo.twigex.com/)**,
> username `twigex`, password `twigex`. The demo resets every 30 minutes, so don't put anything real in it.

More info about the project:

- [https://twigex.com](https://twigex.com)
- [https://www.reddit.com/r/twigex/](https://reddit.com/r/twigex)

Single-node stack for **twigex** (workspace app for files, chat, document
collaboration) and its **EuroOffice** document server (in-browser editor
for `.docx`, `.xlsx`, `.pptx`). Everything runs in one `docker compose`
command on one machine.

There is no Kubernetes requirement and no separate config repo. Every
editable value lives in **`.env`** (created from `.env.example`);
`docker-compose.yml` contains only structure — images, ports, volumes —
and is safe to commit. Passwords default to `change-me` in `.env` —
**replace them before exposing the stack** (the script below does).

> **Why `.env`.** One file holds every value; each cross-service secret
> is a single variable consumed by two services (the pairing map is at
> the top of `.env.example`), so rotation is a one-line edit. `.env` is
> git-ignored — never commit it, and keep it out of world-readable
> backups.

## Table of contents

- [Quick start](#quick-start)
- [What this stack runs](#what-this-stack-runs)
- [Configuration](#configuration)
- [How the office editor works](#how-the-office-editor-works)
- [How chat works](#how-chat-works)
- [Self-hosting](#self-hosting)
- [Production notes](#production-notes)
- [Single-node caveats](#single-node-caveats)
- [Files](#files)
- [License](#license)
- [Upgrading](#upgrading)

---

## Quick start

Prerequisites: Linux host with Docker Engine 20.10+ and the Compose v2
plugin (`docker compose version` must work) and ~4 GB RAM free.

```bash
# 0. Get the files.
git clone https://github.com/twigex/twigex-docker-compose.git
cd twigex-docker-compose

# 1. Create .env from .env.example with generated secrets: replaces
#    every "change-me" placeholder with a fresh random value. Paired
#    secrets (shared by two services) are single variables, so they stay
#    in sync automatically. Takes a second.
bash generate-secrets.sh

# 2. Start the stack.
docker compose up -d
```

On first boot the `twigex` container creates the initial admin user
from the `TWIGEX_ADMIN_*` env vars. Open **http://localhost:3000** and
log in as `admin` with the password the script printed
(`TWIGEX_ADMIN_PASSWORD` in `.env`). First boot takes
about a minute — `docker compose logs -f twigex` shows progress.

If you want to edit documents, set `TWIGEX_SERVER_SITE_URL` to the
host's IP in `.env` and recreate the app container (`docker compose
up -d` — a plain `restart` does not re-read `.env`). Serving other
machines on your LAN, or the public internet with HTTPS? See
"Self-hosting" below.

---

### Generating secrets

All values live in **`.env`** — including every secret. Don't edit
them one by one — run the helper script from the repo root:

```bash
bash generate-secrets.sh
```

It copies `.env.example` → `.env` (git-ignored, `chmod 600`), replaces
every `change-me` placeholder with a fresh random value (the two S3
storage keys are blanked instead — they're only used with S3 storage),
and prints the
generated admin password. Paired secrets need no special handling: each
is a single `.env` variable consumed by both of its services (see the
contract map at the top of `.env.example`). Running it again on an
already-configured stack is a no-op — it refuses to overwrite real
values. To rotate a secret later, edit its one line in `.env` and
`docker compose up -d` — with two exceptions: `TWIGEX_ADMIN_PASSWORD`
takes effect only on first boot (change it in the admin GUI later),
and the database passwords (`TWIGEX_DB_PASSWORD`,
`MARIADB_ROOT_PASSWORD`) are baked into the database on first init —
see "Manual rotation" below for the `ALTER USER` step.

### Manual rotation

<details>
<summary>If you prefer hand-picked values — expand</summary>

Edit the value directly in `.env` — each secret is one line:

```bash
# Pick the variables you want to change (all live in .env):
#   TWIGEX_ADMIN_PASSWORD        admin login (first boot only — change
#                                it in the admin GUI later)
#   TWIGEX_DB_PASSWORD           shared with mariadb (one-time-set —
#                                see the ALTER USER note below)
#   MARIADB_ROOT_PASSWORD        mariadb root (one-time-set — same
#                                ALTER USER treatment)
#   TWIGEX_REDIS_PASSWORD        shared with redis
#   TWIGEX_OFFICE_SECRET         shared with eurooffice (JWT_SECRET)
#   TWIGEX_CHANNEL_SECRET        shared with livekit (LIVEKIT_KEYS)
#   TWIGEX_COLLIMATO_CUBE_API_SECRET          shared with cube-api
#   TWIGEX_COLLIMATO_CUBE_CALLBACK_SECRET     shared with cube-api
#   TWIGEX_SERVER_ENCRYPT_KEY    32 hex chars — openssl rand -hex 16
#                                ⚠ rotating invalidates encrypted DB data

# Example: rotate the DB password (twigex picks it up; the database
# itself needs the ALTER USER step below):
sed -i "s|^TWIGEX_DB_PASSWORD=.*|TWIGEX_DB_PASSWORD=$(openssl rand -base64 30 | tr -d '/+=')|" .env

# Apply:
docker compose up -d
```

MariaDB only reads its password on first boot of its data volume. To
apply a rotated DB password to an existing stack, also run:
`docker compose exec mariadb mariadb -u root -p"$(grep '^MARIADB_ROOT_PASSWORD=' .env | cut -d= -f2-)" \
  -e "ALTER USER '$(grep '^TWIGEX_DB_USER=' .env | cut -d= -f2)'@'%' IDENTIFIED BY '$(grep '^TWIGEX_DB_PASSWORD=' .env | cut -d= -f2-)';"`
</details>

---

## What this stack runs

| Service        | What it does                                                  |
| -------------- | ------------------------------------------------------------- |
| `twigex`       | The twigex app itself (port 3000).                            |
| `mariadb`      | The app's database.                                           |
| `redis`        | Cache, sessions.                                              |
| `cube-router`  | Analytics query routing (Cube.js).                            |
| `cube-worker-1`| Analytics storage worker.                                     |
| `cube-api`     | Analytics REST + GraphQL API (internal port 4000).            |
| `eurooffice`   | The document server (port 9980 → 80). See "How the office editor works" below. |
| `livekit`      | Voice / video chat media server (signaling on 7880, ICE on TCP 7881 + UDP 7882, TURN relay on UDP 50000-50100). See "How chat works" below. |

The Compose default bridge network lets every service reach every other
by service name (`twigex` → `mariadb:3306`, etc.). No manual network
setup is required.

---

## Configuration

The config table below covers the env vars you'll actually edit.
Anything not listed has a sensible default and rarely needs touching.

| What                          | Variable (in `.env`)                                       | Notes                                                        |
| ----------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------ |
| Public URL                    | `TWIGEX_SERVER_SITE_URL`                                  | Must be reachable from the browser AND the eurooffice container (TLS in production!) |
| Office editor URL             | `TWIGEX_OFFICE_HOST`                                      | URL the browser loads the editor iframe from                 |
| Storage                       | `TWIGEX_STORAGE_TYPE` + `TWIGEX_STORAGE_*`                | `local` (named volume) or `s3` (set endpoint, bucket, keys)  |
| SMTP                          | `TWIGEX_SMTP_*`                                           | Empty by default (GUI-configurable)                          |
| Office enabled                | `TWIGEX_OFFICE_ENABLE`                                    | `"true"` to enable                                           |
| LiveKit (chat)                | `TWIGEX_CHANNEL_*`                                        | `TWIGEX_CHANNEL_HOST` defaults to `ws://localhost:7880` (browser-facing, same-host). See "How chat works" and "Self-hosting". |
| LDAP                          | `TWIGEX_LDAP_*`                                           | Set `TWIGEX_LDAP_HOST` (+ port, bind DN). Empty = configure in admin GUI |
| License                       | `TWIGEX_LICENSE`                                          | Empty = Community Edition                                    |

The default app image is the pre-built **EE** build
(`ghcr.io/twigex/twigex-ee`) with enterprise features; for the fully
open-source build, use your own image (built from the twigex source)
instead. Image tags and host ports are also `.env` variables
(`TWIGEX_IMAGE_TAG`, `TWIGEX_PORT`, `EUROOFFICE_PORT`, …) with the
defaults baked into `docker-compose.yml` as fallbacks. Two caveats:
the LiveKit host ports (7880/7881/7882/50000-50100) are hardcoded in
the compose file, and changing `TWIGEX_PORT`/`EUROOFFICE_PORT` means
updating `TWIGEX_SERVER_SITE_URL`/`TWIGEX_OFFICE_HOST` too — the URLs
embed the same ports.

---

## How the office editor works

twigex doesn't open `.docx/.xlsx/.pptx` files itself. It shows an
**iframe** pointing at the EuroOffice document server, and EuroOffice
sends back the rendered editor.

The flow (single-host default — no reverse proxy yet):

```
   Browser (on the same host as the compose stack)
     │
     │  opens http://localhost:3000
     │  twigex returns HTML with an <iframe src="http://localhost:9980/...">
     │
     ▼
   Docker host:9980  →  eurooffice container port 80
```

For LAN or public deployments, put a reverse proxy in front and
update `TWIGEX_OFFICE_HOST` to match — see "Self-hosting" below for
the four-scenario table.

Two values must always agree, plus reachability:

1. **`TWIGEX_OFFICE_HOST`** (in `.env`) = the URL the
   **browser** loads the iframe from. Default `http://localhost:9980`.
2. Where the browser can actually reach the office server:
   - same host → already published as `9980:80` on the host
   - LAN → reverse proxy or firewall-NAT to the same port
   - public → reverse proxy on a public hostname
3. **`TWIGEX_OFFICE_SECRET`** is one `.env` variable consumed by both
   twigex and eurooffice (as `JWT_SECRET`) — the two sides cannot
   drift. `generate-secrets.sh` sets it in one shot.

Traffic flows in two directions, and they use different networks:

- **Browser → EuroOffice**: the iframe (via `TWIGEX_OFFICE_HOST`).
- **EuroOffice container → twigex**: the docserver fetches the document
  and posts save-callbacks to `TWIGEX_SERVER_SITE_URL` (the URL is
  embedded in the signed editor config twigex hands over). This is
  **server-to-server over the compose network** — `localhost` in
  `TWIGEX_SERVER_SITE_URL` resolves inside the eurooffice container to
  *itself*, so office editing breaks even on the same host. That's why
  the `localhost` default only works with the office editor disabled;
  with office enabled, set `TWIGEX_SERVER_SITE_URL` to the host's LAN
  IP or public domain (see "Self-hosting"). Neither service needs an
  `external` network — both directions work over the default bridge
  as long as SiteURL is routable from inside the containers.

If you want to disable the editor entirely, set
`TWIGEX_OFFICE_ENABLE=false`. twigex will leave the `eurooffice`
container running but unused.

---

## How chat works

Voice and video chat in twigex uses **LiveKit**, a separate media
server bundled in this compose stack as the `livekit` service.

The flow (single-host LAN or single-public-host deployment):

```
   Browser
     │
     │  loads twigex; twigex loads the LiveKit JS SDK with
     │  TWIGEX_CHANNEL_HOST (default ws://localhost:7880 — the
     │  browser-facing URL, not Compose-internal DNS)
     │
     │  signaling  ── TCP 7880
     │  ICE        ── TCP 7881 (fallback) / UDP 7882 (primary)
     │  TURN relay ── UDP 50000-50100
     │
     ▼
   livekit container (ports published to the host)
```

`TWIGEX_CHANNEL_HOST` defaults to `ws://localhost:7880` — like
the other browser-facing URLs (`TWIGEX_SERVER_SITE_URL`,
`TWIGEX_OFFICE_HOST`), the value is whatever the **browser** can
reach the livekit service at. The default works when the browser
runs on the same host. **It is not a Compose-internal DNS name**;
the livekit container is invisible to the browser regardless of
network. For LAN or public deployments, follow "Self-hosting"
below — substitute `localhost` with the host's LAN IP, or put a
reverse proxy in front and use its public hostname over
`wss://`.

For internet-facing chat (users off your network), expose LiveKit
publicly:

1. Forward **`wss://livekit.your-domain:443`** on your reverse proxy
   to `<host>:7880` — signaling goes through the proxy, not raw TCP.
2. Forward **TCP 7881** (ICE TCP fallback) and **UDP 7882** (ICE UDP)
   directly on the host. Forward **UDP 50000-50100** for TURN.
   UDP is mandatory for WebRTC audio — no UDP forwarding ⇒ no audio.
3. Set `TWIGEX_CHANNEL_HOST` on the twigex service to
   `wss://livekit.your-domain`.

Four values must agree for chat to work end-to-end:

| Where | What |
|---|---|
| twigex env (`.env`) | `TWIGEX_CHANNEL_HOST`  (the URL the browser dials — default `ws://localhost:7880`) |
| twigex env (`.env`) | `TWIGEX_CHANNEL_KEY`   (token signer key, the literal `"key"`) |
| `.env` → twigex + livekit | `TWIGEX_CHANNEL_SECRET` — one variable, consumed by both services |
| `livekit.yaml` `port`, `rtc.tcp_port`, `rtc.udp_port`, `turn.relay_range_*` | Must match the host ports published in `docker-compose.yml` (7880 / 7881 / 7882 / 50000-50100). `tcp_port` is exposed as TCP; `udp_port` and the TURN range are exposed as UDP. |

The secret lives once in `.env`, so the two sides cannot drift;
`generate-secrets.sh` sets it in one operation.

If you don't need chat at all, set `TWIGEX_CHANNEL_ENABLED=false`.
twigex will leave the `livekit` container running but
unused.

**LiveKit API key (important for LAN/internet deployments).**
The LiveKit key pair ships in `.env.example` with the key `key` and
secret `change-me`. **Anyone who knows that string and can reach port
7880 can sign tokens that LiveKit will accept** — so until you rotate
it, treat the livekit port as fully open to any peer that already has
the file.

`generate-secrets.sh` rotates `TWIGEX_CHANNEL_SECRET` (and
`TWIGEX_CHANNEL_KEY` stays `key` — only the secret is secret) in one
shot, shared by twigex and livekit. **Run that before exposing port
7880 to anything other than this machine's localhost.** The rotated
key is the real authentication boundary — not `--dev` mode, and
not the bind address.

---

## Self-hosting

Three URLs control where the **browser** contacts the stack:
`TWIGEX_SERVER_SITE_URL` (twigex app), `TWIGEX_OFFICE_HOST`
(document editor iframe), and `TWIGEX_CHANNEL_HOST` (chat
signaling). They follow the same rule: the value is whatever the
**browser** can resolve and reach.

The defaults — `http://localhost:3000` for twigex,
`http://localhost:9980` for office, and `ws://localhost:7880` for
chat — are tuned for **same-host first-boot**: the user's browser
runs on the same machine as the compose stack and hits all three
ports directly. With one exception: the office editor (enabled by
default) needs a routable `TWIGEX_SERVER_SITE_URL` — see the callout
below. So the pure-default boot works for files and chat, but office
editing requires setting SiteURL to the host's LAN IP first.

When you outgrow that, swap to one of these scenarios:

> **Office editing requires a routable `TWIGEX_SERVER_SITE_URL`.**
> The EuroOffice container fetches documents and posts save-callbacks
> to twigex at `TWIGEX_SERVER_SITE_URL` — from *inside* the compose
> network. With the default `http://localhost:3000`, "localhost"
> resolves to the eurooffice container itself and office editing
> fails (502 from the docserver). If you use the office editor, set
> `TWIGEX_SERVER_SITE_URL` to the host's LAN IP or public domain —
> the "Same host" default row below is only valid with the office
> editor disabled (`TWIGEX_OFFICE_ENABLE=false`).

| Scenario | `TWIGEX_SERVER_SITE_URL` | `TWIGEX_OFFICE_HOST` | `TWIGEX_CHANNEL_HOST` |
|---|---|---|---|
| Same host (default) — office editor disabled | `http://localhost:3000` | `http://localhost:9980` | `ws://localhost:7880` |
| Same host + office editor enabled | `http://<host-ip>:3000` | `http://localhost:9980` | `ws://localhost:7880` |
| LAN without TLS | `http://<host-ip>:3000` | `http://<host-ip>:9980` | `ws://<host-ip>:7880` |
| LAN with self-signed TLS  | `https://<host-ip>:3000` | `https://<host-ip>:9980` | `wss://<host-ip>:7880` |
| Public domain + real TLS | `https://twigex.your-domain` | `https://euro-office.your-domain` | `wss://livekit.your-domain` |

For the public-domain case, the chat row points at a **separate**
hostname (`livekit.your-domain`) — chat signaling can live on its
own subdomain so it doesn't share TLS/cert lifecycle with the
main app. Same container, different reverse-proxy route.

> **About the "LAN with self-signed TLS" row:** twigex can terminate
> TLS itself (`TWIGEX_SERVER_TLS_CERT_FILE` / `_KEY_FILE` in `.env`),
> but the EuroOffice server has no TLS option — its column needs a
> reverse proxy in front of port 9980 in any case.

**Browser secure-context caveat (LAN / plain HTTP).** Modern
browsers gate `getUserMedia()` (camera and microphone) and the
WebSocket Secure upgrade prompt behind a "secure context" — only
`https://` URLs (and `http://localhost`) get access. If you
serve twigex over plain HTTP on a LAN IP:

- **Chat camera/mic buttons are greyed out.**
- Some browsers throttle or refuse `ws://` to non-secure
  contexts, so even `ws://<host-ip>:7880` may fail intermittently.
  `wss://` plus a self-signed/local-CA cert is more reliable.

Voice/video chat signaling usually still connects on LAN HTTP; what
breaks is camera/microphone access (secure context). Office document
editing is unaffected by the secure-context check — its requirement
is a routable `TWIGEX_SERVER_SITE_URL` (callout above). The fix for
chat mic/cam is LAN-TLS or the public-domain case above.

The office **secret pairing** needs no attention in any scenario:
`TWIGEX_OFFICE_SECRET` is one `.env` variable consumed by both
twigex and eurooffice (as `JWT_SECRET`).

---

## Production notes

### TLS

This Compose exposes port `3000` over plain HTTP. **Don't put that
port on the public internet.** Put a reverse proxy in front:

- **Caddy** (easiest, auto-LE): a one-line Caddyfile per host
- **Traefik** with Docker labels and a `LETSENCRYPT_EMAIL`
- **Nginx Proxy Manager**

Set `TWIGEX_SERVER_SITE_URL` to the `https://...` URL the proxy
serves so twigex generates correct absolute URLs (OAuth redirects,
email links, ...).

If you also want chat reachable from off-LAN users, see "How chat
works" above — the same reverse proxy should also route
`wss://livekit.your-domain` to `<host>:7880` and forward **TCP
7881** (ICE fallback) + **UDP 7882** (ICE primary) + **UDP
50000-50100** (TURN relay).

### Encrypt key

`TWIGEX_SERVER_ENCRYPT_KEY` must be **exactly 32 hex characters**
(`openssl rand -hex 16`).
It encrypts secrets twigex stores in the database. Losing it = losing
access to stored credentials. Back it up somewhere safe.

### Database password

`TWIGEX_DB_PASSWORD` is **one-time-set**: mariadb bakes it into the
database on first init and never re-reads it. Editing the line later
changes what twigex sends but not what the database expects — the app
won't connect (no data loss). To rotate it for real, run the
`ALTER USER` one-liner in "Manual rotation" above. MariaDB root
(`MARIADB_ROOT_PASSWORD`) is baked in the same way — same treatment
if you rotate it. (Both the backup command and the `ALTER USER`
one-liner authenticate as root using this value, so keep it in sync
with the database too.)

### Backups

```bash
# Database (name and user come from .env via the container's environment)
docker compose exec mariadb sh -c \
  'mariadb-dump -u root -p"$MARIADB_ROOT_PASSWORD" "$MARIADB_DATABASE"' > backup-$(date +%F).sql

# Files (local storage mode — default)
docker run --rm \
  -v twigex_twigex_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/files-$(date +%F).tgz -C /data .

```

**Note on the `eurooffice_data` volume.** The document server stores no
user documents — every file's source of truth lives in the twigex app
(`twigex_data` volume + the database dump above). EuroOffice only
edits temporary copies it fetches from twigex and writes back; its
`eurooffice_data` mount holds nothing but internal, regeneration-able
state. Backing it up is optional.

> Volume names use the project prefix `twigex_` (because
> `docker-compose.yml` sets `name: twigex`). If you run with a
> different `name:` or via `docker compose -p …`, adjust accordingly.

### Storage modes

`TWIGEX_STORAGE_TYPE: local` (default) keeps files in the
`twigex_data` named volume. For S3-compatible object storage
(Backblaze B2, MinIO, ...):

```bash
TWIGEX_STORAGE_TYPE=s3
TWIGEX_STORAGE_ENDPOINT=https://s3.us-west-004.backblazeb2.com
TWIGEX_STORAGE_BUCKET=twigex-prod
TWIGEX_STORAGE_SSL=true
```

…and set `TWIGEX_STORAGE_ACCESS_KEY` /
`TWIGEX_STORAGE_SECRET_KEY` to the provider's keys.

---

## Single-node caveats

This stack runs the whole product on one machine. Specifically, it
does **not** provide:

- **High availability / multi-replica.** If the host dies, the stack
  dies.
- **External secrets management** (Vault, External Secrets Operator,
  …). All secrets live in the git-ignored `.env` — keep it out of
  world-readable backups and never commit it.
- **Multi-node database clustering.** The MariaDB here is a single
  container with a single volume.

For those, run a Kubernetes-based deployment.

---

## Files

```
├── docker-compose.yml   the entire stack (8 services, 7 volumes)
├── generate-secrets.sh  one-shot secret generator (run before first boot)
├── .env.example         template for .env — every configurable value
├── cube.js              Cube.js runtime config (fetches analytics
│                        schemas from the app — rarely edited)
├── livekit.yaml         LiveKit media-server config (ports/TURN; keys come from .env)
├── INSTALLATION.md      step-by-step first install
├── SECURITY.md          security policy + full secret inventory
├── SUPPORT.md           where to get help, what to put in a bug report
├── CONTRIBUTING.md      how to propose changes
├── CHANGELOG.md         notable changes per version
├── AGENTS.md            guidance for AI agents working on this repo
├── SKILL.md             agent operating procedures
├── llms.txt             LLM-oriented index of the repo
├── CODE_OF_CONDUCT.md   Contributor Covenant
├── LICENSE              MIT (this repo)
└── README.md            this file
```

---

## License

This repository is licensed under [MIT](LICENSE). The Twigex
application deployed by this stack is licensed separately under
[AGPL-3.0](https://github.com/twigex/twigex/blob/main/LICENSE).

---

## Upgrading

Breaking changes are documented per version in [CHANGELOG.md](CHANGELOG.md).
Read them before `docker compose pull && docker compose up -d` — and
always back up first (see "Backups" above).
