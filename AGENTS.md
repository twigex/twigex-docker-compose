# AGENTS.md — guidance for AI agents and automation working on this repo

This is a single-node Docker Compose stack for the **twigex** product. The
whole stack lives in `docker-compose.yml`; supporting config is
`cube.js` (Cube.js schema) and `livekit.yaml` (LiveKit media
server). Docs for humans live in `README.md` — read it before
changing anything: it is the source of truth for how the services connect.

## Layout

```
├── docker-compose.yml   the entire stack (8 services, 7 volumes)
├── generate-secrets.sh  one-shot secret rotation (paired secrets in sync)
├── cube.js              analytics schema (Cube.js runtime config — rarely edited)
├── livekit.yaml         LiveKit media-server config
└── README.md            setup, configuration, operational notes
```

Top-level files (AGENTS.md, SECURITY.md, INSTALLATION.md, SUPPORT.md,
SKILL.md, CODE_OF_CONDUCT.md, llms.txt) are docs only — they do not affect
the stack.

## Naming: twigex vs TWIGEX_*

The product is **twigex** everywhere in this repo (folder, compose project
name, service/volume names, prose, database name and user). The app's
environment variables use the `TWIGEX_*` prefix — that is the image's
contract; never rename the prefix.

## Paired-secret invariants

Several secrets are **single `.env` variables consumed by two services**
(the service-specific name mapping lives in `docker-compose.yml`
`environment:` blocks), so the sides cannot drift:

| Pair | `.env` variable | Service-local names | Notes |
|---|---|---|---|
| Office JWT | `TWIGEX_OFFICE_SECRET` | `JWT_SECRET` (eurooffice) | |
| LiveKit auth | `TWIGEX_CHANNEL_SECRET` (+ `TWIGEX_CHANNEL_KEY`) | `LIVEKIT_KEYS` (livekit) | Key name is the literal `key` |
| Redis password | `TWIGEX_REDIS_PASSWORD` | same name on `redis` svc (read by `redis-server --requirepass`) | |
| Cube auth | `TWIGEX_COLLIMATO_CUBE_API_SECRET` / `_CALLBACK_SECRET` | `CUBEJS_API_SECRET` / `CUBE_CALLBACK_SECRET` (cube-api) | |
| MariaDB app password | `TWIGEX_DB_PASSWORD` | `MARIADB_PASSWORD` (mariadb) | **One-time-set**: baked into the DB on first init. Rotating needs an `ALTER USER` too (README → "Manual rotation"). |

`MARIADB_ROOT_PASSWORD` can be rotated freely. Default for all secrets is
`change-me` in `.env.example`; the rotation script is `generate-secrets.sh`
(which creates the git-ignored `.env`)
in the repo root and keeps the pairs in sync — prefer running/extending
it over hand-editing single sides.

## Known traps (do not reintroduce)

- **LiveKit config flag.** Run livekit with `command: ["--config",
  "/livekit.yaml"]`. Do NOT set the `LIVEKIT_CONFIG` env var: urfave/cli v3
  binds it to `--config-body` (raw YAML string), so the literal path would
  be parsed as the config body and the server crashes with
  `cannot unmarshal !!str /liveki… into config.Config`.
- **LiveKit TURN field names.** `relay_range_start` / `relay_range_end`
  under `turn:` — the older `udp_port_range_{start,end}` is wrong for
  current LiveKit schemas.
- **LiveKit ports.** 7880 (WebSocket signaling), 7881 (ICE TCP fallback),
  7882/udp (ICE UDP), 50000–50100/udp (TURN relay). Values in
  `livekit.yaml` (`port`, `rtc.tcp_port`, `rtc.udp_port`, `turn.relay_range_*`)
  must match the published ports in `docker-compose.yml`.
- **Browser-facing URLs.** `TWIGEX_OFFICE_HOST` and `TWIGEX_CHANNEL_HOST`
  are URLs the *browser* resolves — never Compose service DNS names.
  `TWIGEX_SERVER_SITE_URL` is dual-consumer: the browser AND the
  eurooffice container (doc fetch + save callbacks) — `localhost` breaks
  office editing; office needs the host's LAN IP or a domain. Defaults
  are `localhost` (same-host first boot); LAN/public variants are in
  `README.md` → "Self-hosting".
- **Cubestore images are bare** (no curl/wget/nc) — remember this if
  adding probes or debug tooling. Worker port
  9001 is cluster protocol, not HTTP.
- **`TWIGEX_SERVER_ENCRYPT_KEY`** must be exactly 32 hex chars
  (`openssl rand -hex 16` works).

## Working rules

1. One change at a time; small diffs.
2. Validate before proposing: `docker compose config -q`
   (and `docker compose config` to eyeball interpolation).
3. Don't bump image tags casually — current app image is
   ghcr.io/twigex/twigex-ee:0.16.0.
4. Keep `README.md` accurate: any env var, port, or secret change
   must be reflected there (and in SECURITY.md's secret inventory when
   secrets change).
5. All config lives in the git-ignored `.env` (from `.env.example`);
   `docker-compose.yml` is structure-only and safe to commit. Don't move
   values back into the compose file without an
   explicit request.
