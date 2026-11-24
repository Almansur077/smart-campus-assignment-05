#!/usr/bin/env bash
# Assignment #05 mitigation A05-R02 (AI review C-09): enforce AGENTS.md rules that were only text before.
# Run after `npm run build`. Exits non-zero on the first violated rule.
set -euo pipefail
fail=0

# 1. No focused or skipped tests (an agent must not silence tests to make a change pass).
if grep -rnE '\b(it|test|describe)\.(only|skip|todo)\(|\b(fit|xit|xdescribe|fdescribe)\(' src tests server; then
  echo "GUARD FAIL: focused/skipped tests found"; fail=1
else echo "guard ok: no .only/.skip/.todo in tests"; fi

# 2. No committed secrets or env files.
if git ls-files | grep -E '(^|/)\.env($|\.)'; then echo "GUARD FAIL: .env file is tracked"; fail=1
else echo "guard ok: no tracked .env files"; fi
if git grep -nE 'sk-ant-[A-Za-z0-9_-]{10,}|ANTHROPIC_API_KEY *= *[A-Za-z0-9]' -- ':!scripts/ci-guards.sh'; then
  echo "GUARD FAIL: something that looks like an API key is committed"; fail=1
else echo "guard ok: no API-key-like strings in tracked files"; fi

# 3. Browser bundle has no server code or key handling (AC-4).
if [ ! -d dist ]; then echo "GUARD FAIL: dist/ missing, run npm run build first"; fail=1
elif grep -rlE 'ANTHROPIC|x-api-key|child_process|api\.anthropic\.com' dist; then
  echo "GUARD FAIL: server/key code in the browser bundle"; fail=1
else echo "guard ok: dist/ has no key handling or server code"; fi

# 4. Browser code never imports server code.
if grep -rnE "(from|import) +'(\.\./)+server/|(from|import) +'node:" src --include='*.ts' --include='*.tsx' | grep -v '\.test\.'; then
  echo "GUARD FAIL: src/ imports server code or node modules"; fail=1
else echo "guard ok: src/ does not import server/ or node:*"; fi

exit $fail
