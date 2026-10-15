# Contributing to twigex-docker-compose

Thanks for helping improve the twigex single-node Docker Compose stack!

## Reporting issues

- **Security vulnerabilities** — never in public issues. Follow
  [`SECURITY.md`](SECURITY.md) (GitHub private security reporting or
  support@twigex.com).
- **Setup questions / bugs** — open a GitHub issue. Use the bug report
  template if one applies; it mirrors the checklist in
  [`SUPPORT.md`](SUPPORT.md): include `docker compose ps`, logs from the
  failing service, and `docker compose config` output with **all secrets
  redacted**.

## Proposing changes

1. Keep diffs small — one change (one service, one doc fix, one feature)
   per pull request.
2. Validate before submitting:

   ```bash
   cp .env.example .env
   docker compose config -q        # syntax + interpolation must pass
   ```

3. **Paired secrets are single `.env` variables.** Several values are
   consumed by two services (office JWT, LiveKit key, Redis password,
   Cube auth, MariaDB app password). See the invariants table in
   [`AGENTS.md`](AGENTS.md) before touching anything secret-related.
4. **Keep docs in sync.** Any env var, port, secret, or image tag change
   must be reflected in `README.md` (and `SECURITY.md` for secret
   changes).
5. **Never commit real secret values.** The committed defaults are the
   literal `change-me`; keep it that way.
6. **Don't bump image tags casually.** Tags are pinned deliberately; bump
   them in a dedicated PR that notes the upstream changelog.

## Style

- Compose file: comments above every block a new user might stumble on.
- Docs: Markdown, one sentence per line is welcome but not required.

## License

By contributing, you agree that your contributions are licensed under
the [MIT License](LICENSE).
