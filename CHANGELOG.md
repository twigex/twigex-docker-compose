# Changelog

Keyed to the default `TWIGEX_IMAGE_TAG` in `.env.example`. Newest first.

## [0.16.0] - 2026-10-15
- App image 0.15.0 → 0.16.0.
- `cube.js`: SSL/TLS for workspace DB connections (`ssl_mode`/`ssl_ca`,
  `require`/`verify-ca`/`verify-full`), bounded connect timeout
  (`CUBE_DB_CONNECT_TIMEOUT_MS`, default 15000), port cast to number.

## [0.15.0] - 2026-10-09
- First release.
- All image tags `.env`-configurable; `TWIGEX_SMTP_ENABLED` toggle.

