# Security Policy

## Scope

This repository contains the **Helm chart and deployment tooling** used to
self-host [Cospace](https://cospace.mytwigex.com) on Kubernetes. It does not
contain the Cospace application source code.

- **Vulnerabilities in the Helm chart** (templates, default values, RBAC,
  secret handling, ingress configuration, etc.) — report here, in this repo.
- **Vulnerabilities in the Cospace application itself** (the container image
  at `ghcr.io/twigex/cospace`) — also report here; we'll route it to the
  right team internally.
- **Vulnerabilities in third-party dependencies** this chart deploys
  (MariaDB, Redis, LiveKit, EuroOffice, Collabora) — please also report
  upstream to those projects directly, in addition to letting us know if the
  issue is specific to how this chart configures them.

## Supported Versions

We support the **latest published chart version** on
[GHCR](https://github.com/orgs/twigex/packages/container/package/helm-charts%2Fcospace)
and [Artifact Hub](https://artifacthub.io/packages/helm/cospace/cospace).
Security fixes are released as new chart versions rather than backported to
older ones — please upgrade to the latest version as part of remediation.

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Instead, report privately using one of these methods:

1. **Preferred:** Use [GitHub Security Advisories](https://github.com/twigex/cospace/security/advisories/new)
   for this repository (Security tab → "Report a vulnerability"). This creates
   a private discussion thread with maintainers only.
2. **Email:** [cospacesupport@twigex.com](mailto:cospacesupport@twigex.com) — please put "SECURITY" in the subject line so it's triaged promptly.

Please include:

- A description of the vulnerability and its potential impact
- Steps to reproduce (chart values, Kubernetes version, affected component)
- Any suggested remediation, if you have one

## What to Expect

- **Acknowledgment:** within 3 business days of your report.
- **Initial assessment:** within 7 days, including whether we can reproduce
  the issue and its severity.
- **Fix & disclosure:** we aim to ship a patched chart version and coordinate
  disclosure timing with you. We ask that you give us a reasonable window to
  release a fix before any public disclosure.

We're a small team — thank you for your patience, and for reporting
responsibly rather than disclosing publicly first.

## Known Sensitive Areas

Given what this chart handles, reports involving any of the following are
treated as high priority:

- `cospace.server.encryptKey` handling or exposure
- Default/weak secrets shipped in `values.yaml` (e.g. default admin password,
  default MariaDB/Redis passwords) being usable in a way that isn't clearly
  flagged as "change for production"
- RBAC over-permissioning in chart templates
- Ingress/TLS misconfiguration that could expose the app without the
  intended authentication
- WOPI allow-list (`aliasgroup1`) misconfiguration between Cospace and
  EuroOffice/Collabora that could allow unauthorized document access