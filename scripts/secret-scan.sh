#!/usr/bin/env bash
# secret-scan: blokir pola kredensial biar gak masuk commit.
# Dipanggil otomatis pre-commit; bisa juga manual: bash scripts/secret-scan.sh <file...>
set -u
PATTERNS='cfut_[A-Za-z0-9_-]{20,}|gsk_[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AAGur[0-9A-Za-z_-]{15,}|sk-or-v1-[A-Za-z0-9]{20,}|sk-proj-[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{35}'
if [ $# -gt 0 ]; then
  FILES="$*"
else
  FILES=$(git diff --cached --name-only --diff-filter=ACM)
fi
[ -z "$FILES" ] && { echo "secret-scan: tidak ada file berubah, aman."; exit 0; }
HITS=$(echo "$FILES" | xargs -r rg -l -E "$PATTERNS" 2>/dev/null)
if [ -n "$HITS" ]; then
  echo "⛔ secret-scan: pola kredensial ketemu — commit DIBLOKIR:"
  echo "$HITS"
  exit 1
fi
echo "✅ secret-scan: bersih."
