#!/bin/bash
# SessionStart hook for Claude Code cloud sessions: installs project tooling
# (npm devDependencies, Salesforce CLI) and logs in to the demo org as `npo-demo`.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

export SF_AUTOUPDATE_DISABLE=true SF_DISABLE_TELEMETRY=true
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo 'export SF_AUTOUPDATE_DISABLE=true SF_DISABLE_TELEMETRY=true' >> "$CLAUDE_ENV_FILE"
fi

# Jest, ESLint, Prettier (husky/lint-staged pre-commit)
npm install --no-audit --no-fund

# Salesforce CLI
if ! command -v sf >/dev/null 2>&1; then
  npm install -g @salesforce/cli --no-audit --no-fund
fi

# Log in from the SF_AUTH_URL environment secret. The URL holds a refresh token:
# never echo it — pass it via a private temp file and discard all CLI output.
if [ -z "${SF_AUTH_URL:-}" ]; then
  echo "session-start: SF_AUTH_URL not set; skipping org login." >&2
  exit 0
fi

auth_file="$(umask 077 && mktemp)"
trap 'rm -f "$auth_file"' EXIT
printf '%s' "$SF_AUTH_URL" > "$auth_file"

if sf org login sfdx-url --sfdx-url-file "$auth_file" --alias npo-demo --set-default --json >/dev/null 2>&1 &&
  sf org display -o npo-demo --json >/dev/null 2>&1; then
  echo "session-start: logged in to org as alias npo-demo."
else
  echo "session-start: org login failed — SF_AUTH_URL may be expired or revoked." >&2
fi
