#!/usr/bin/env bash
# Generate every secret for the twigex compose stack into `.env`.
#
# - Copies .env.example → .env (refuses to overwrite an existing .env).
# - Replaces every `change-me` placeholder with a fresh random value.
# - Keeps paired secrets in sync by construction: one variable per secret,
#   consumed by both services (see the contract map in .env.example).
# - Prints the generated admin login.
#
# Safe to re-run: it refuses to touch an already-configured .env.
set -euo pipefail

cd "$(dirname "$0")"

ENV_FILE=.env
EXAMPLE=.env.example

if [[ ! -f $EXAMPLE ]]; then
  echo "ERROR: $EXAMPLE not found — this script must run from the repo root." >&2
  exit 1
fi

if [[ -f $ENV_FILE ]]; then
  if grep -v '^[[:space:]]*#' "$ENV_FILE" | grep -q 'change-me'; then
    echo "ERROR: $ENV_FILE exists but still contains 'change-me' placeholders." >&2
    echo "Fix or delete it, then re-run this script." >&2
    exit 1
  fi
  echo "$ENV_FILE already exists and looks configured — nothing to do."
  echo "Admin password: (see TWIGEX_ADMIN_PASSWORD in $ENV_FILE)"
  exit 0
fi

gen() { openssl rand -base64 30 | tr -d '/+=' ; }  # 40 chars (LiveKit requires secret >= 32)

cp "$EXAMPLE" "$ENV_FILE"
chmod 600 "$ENV_FILE"

# Rotate every placeholder. Paired secrets are single variables in .env,
# so one replacement covers both services automatically.
sed -i "s|^TWIGEX_ADMIN_PASSWORD=change-me|TWIGEX_ADMIN_PASSWORD=$(gen)|" "$ENV_FILE"
sed -i "s|^TWIGEX_DB_PASSWORD=change-me|TWIGEX_DB_PASSWORD=$(gen)|" "$ENV_FILE"
sed -i "s|^MARIADB_ROOT_PASSWORD=change-me|MARIADB_ROOT_PASSWORD=$(gen)|" "$ENV_FILE"
sed -i "s|^TWIGEX_REDIS_PASSWORD=change-me|TWIGEX_REDIS_PASSWORD=$(gen)|" "$ENV_FILE"
sed -i "s|^TWIGEX_OFFICE_SECRET=change-me|TWIGEX_OFFICE_SECRET=$(gen)|" "$ENV_FILE"
sed -i "s|^TWIGEX_CHANNEL_SECRET=change-me|TWIGEX_CHANNEL_SECRET=$(gen)|" "$ENV_FILE"
sed -i "s|^TWIGEX_COLLIMATO_CUBE_API_SECRET=change-me|TWIGEX_COLLIMATO_CUBE_API_SECRET=$(gen)|" "$ENV_FILE"
sed -i "s|^TWIGEX_COLLIMATO_CUBE_CALLBACK_SECRET=change-me|TWIGEX_COLLIMATO_CUBE_CALLBACK_SECRET=$(gen)|" "$ENV_FILE"

# S3 storage keys are only used with TWIGEX_STORAGE_TYPE=s3; leave empty.
sed -i 's|^TWIGEX_STORAGE_ACCESS_KEY=change-me|TWIGEX_STORAGE_ACCESS_KEY=|' "$ENV_FILE"
sed -i 's|^TWIGEX_STORAGE_SECRET_KEY=change-me|TWIGEX_STORAGE_SECRET_KEY=|' "$ENV_FILE"

# Encrypt key: exactly 32 hex characters (AES-256 key, read as raw bytes).
sed -i "s|^TWIGEX_SERVER_ENCRYPT_KEY=.*|TWIGEX_SERVER_ENCRYPT_KEY=$(openssl rand -hex 16)|" "$ENV_FILE"

# Verify: no placeholders left (ignore comment lines).
if grep -v '^[[:space:]]*#' "$ENV_FILE" | grep -q 'change-me'; then
  echo "ERROR: unrotated placeholders remain in $ENV_FILE:" >&2
  grep -n 'change-me' "$ENV_FILE" >&2
  exit 1
fi

ADMIN_PASS=$(grep '^TWIGEX_ADMIN_PASSWORD=' "$ENV_FILE" | cut -d= -f2-)

echo "✔ All secrets generated into $ENV_FILE (chmod 600, git-ignored)."
echo
echo "  Login: admin / $ADMIN_PASS"
echo
echo "Keep $ENV_FILE private — it contains every real secret. Back it up"
echo "separately from this repo (and from the volumes it unlocks)."
