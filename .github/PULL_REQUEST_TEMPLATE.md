<!-- Mirrors the checklist in CONTRIBUTING.md → "Proposing changes" -->

## What

<!-- One change per PR: one service, one doc fix, one feature. -->

## Why

## Checklist

- [ ] One change per PR (small diff).
- [ ] `docker compose config -q` passes locally.
- [ ] If secrets are touched: paired secrets changed **together** (see
      the invariants table in `AGENTS.md`), and `README.md`/`SECURITY.md`
      updated.
- [ ] Any env var, port, or image-tag change is reflected in `README.md`
      (and `.env.example`).
- [ ] No real secret values committed (defaults stay the literal
      `change-me`).
- [ ] Image tags only bumped in a dedicated PR that notes the upstream
      changelog.

## Validation

<!-- Paste the output of `docker compose config -q` (or state why N/A). -->
