# SKILL.md — Operating the twigex Docker Compose stack

> Skill for agents operating or troubleshooting this repository's stack.
> Assumed context: the stack is defined in `docker-compose.yml`
> (8 services: twigex, mariadb, redis, cube-router, cube-worker-1,
> cube-api, eurooffice, livekit). Read `README.md` for the full
> configuration reference before making changes.

## When to use

- Deploying, upgrading, or tearing down the stack.
- Rotating secrets or changing browser-facing URLs.
- Diagnosing a service that isn't healthy.
- Enabling/disabling the office editor or voice/video chat.

## Core invariants (memorize)

1. **Paired secrets are single `.env` variables** consumed by both
   services (see the table in `AGENTS.md`) — the two sides cannot drift.
   Don't split them into per-service variables.
2. **`TWIGEX_DB_PASSWORD` is one-time-set** (mariadb bakes it in on
   first volume boot; compose interpolates it to `MARIADB_PASSWORD`).
   Never "fix" a DB connection problem by editing only the `.env`
   value — rotation also needs an `ALTER USER` (README → "Manual rotation").
   `MARIADB_ROOT_PASSWORD` is one-time-set the same way.
3. **Browser-facing URLs** (`TWIGEX_OFFICE_HOST`, `TWIGEX_CHANNEL_HOST`)
   are URLs the *user's browser* resolves — never Compose DNS names like
   `http://twigex:3000`. `TWIGEX_SERVER_SITE_URL` is dual-consumer: the
   browser AND the eurooffice container (document fetch + save callbacks).
   `localhost` breaks office editing — office setups need the host's LAN
   IP or a domain.
4. **All config in `.env`** (created by `generate-secrets.sh` from
   `.env.example`, git-ignored); `docker-compose.yml` holds structure only.
5. Naming: repo/product = `twigex`; env prefix = `TWIGEX_*`; internal DB
   name = `twigex`.

## Procedures

### Validate a proposed change

```bash
docker compose config -q          # syntax + interpolation
docker compose config             # eyeball rendered values (redact secrets)
grep -v '^[[:space:]]*#' .env | grep -c change-me   # 0 before any exposure (ignores comment lines)
```

### Deploy / upgrade

```bash
docker compose pull
docker compose up -d
docker compose ps                 # every service: Up
```

### Diagnose an unhealthy service

```bash
docker compose ps                          # which service, which state
docker compose logs --tail=100 <svc>       # first suspect
docker compose config                      # if values look wrong
```

Known failure signatures:

- **livekit** `cannot unmarshal !!str /liveki… into config.Config` →
  `LIVEKIT_CONFIG` env var is set (it maps to `--config-body` in
  urfave/cli v3). Remove it; keep `command: ["--config", "/livekit.yaml"]`.
- **livekit** `relay_range` errors → wrong TURN field names; must be
  `relay_range_start`/`relay_range_end` under `turn:`.
- **twigex** DB auth failures → the DB was initialized with a different
  password than `.env` now sends (the password is one-time-set at first
  volume boot — classically stale test state after the generator ran
  on an existing volume). Fix with the `ALTER USER` one-liner
  (README → "Manual rotation") or wipe the volume.
- **Editor iframe blank** → `TWIGEX_OFFICE_SECRET` ≠ eurooffice
  `JWT_SECRET`, or `TWIGEX_OFFICE_HOST` not browser-reachable.
- **Chat audio missing** → UDP 7882 and/or 50000–50100 not forwarded; UDP
  is mandatory for WebRTC audio.
- **Cube stack stuck starting** → check the router first —
  worker and api `depends_on` it.

### Rotate secrets

Secrets live in `.env` (one variable per secret; pairs are single
variables shared by both services). Rotate by editing the line and
`docker compose up -d` (recreates affected containers); first-time
generation is `generate-secrets.sh`. Special cases:
`TWIGEX_DB_PASSWORD` (one-time-set in the DB volume — rotation also
needs an `ALTER USER`, see README → "Manual rotation") and
`TWIGEX_SERVER_ENCRYPT_KEY` (rotating loses access to stored secrets).

### Back up / restore

```bash
# DB (database name comes from .env via the container's environment)
docker compose exec mariadb sh -c \
  'mariadb-dump -u root -p"$MARIADB_ROOT_PASSWORD" "$MARIADB_DATABASE"' > backup-$(date +%F).sql

# Files (local storage mode)
docker run --rm -v twigex_twigex_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/files-$(date +%F).tgz -C /data .

# NOTE: eurooffice_data holds no user documents — all files belong to
# twigex (twigex_data + the DB dump above). Backing up eurooffice_data is
# optional (internal secrets only).
```

Restore = `docker compose down`, restore volume contents, `up -d`. For a
DB restore, load the dump into a freshly initialized database.

### Switch exposure scenario (same-host → LAN → public)

Edit the three browser-facing URLs per the table in
`README.md` → "Self-hosting", ensure the host ports are reachable
(LAN) or reverse-proxy routes exist (public, with TLS), then
`docker compose up -d`. For public chat, forward TCP 7880/7881 + UDP
7882 + UDP 50000–50100. Plain-HTTP LAN disables mic/camera
(secure-context) — that's a browser rule, not a bug.

### Disable a feature without removing it

- Office editor: `TWIGEX_OFFICE_ENABLE=false` in `.env` (eurooffice
  keeps running, unused).
- Chat: `TWIGEX_CHANNEL_ENABLED=false` in `.env` (livekit keeps
  running, unused).

## Escalation

For anything not covered here, gather `docker compose ps` + logs (see
`SUPPORT.md`) before proposing changes. One change per diff; validate
with `docker compose config -q` first.
