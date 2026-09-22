#!/bin/bash
# ============================================
# ADAPTIA SAVE-CHECKPOINT — Snapshot sesuai fitur yang di-update
# Format: bash SAVE-CHECKPOINT.sh <nama-fitur>
# Contoh: bash SAVE-CHECKPOINT.sh welcome-screen
#         bash SAVE-CHECKPOINT.sh story-viewer
# Hasil : CHECKPOINT-UPDATE-welcome-screen-20260912-1430.js
# CHECKPOINT-STABLE = JANGAN PERNAH DIUBAH (lihat RULES-CHECKPOINT.md)
# ============================================

BACKUP_DIR="$(cd "$(dirname "$0")" && pwd)/backups"
STABLE=$(ls -t "$BACKUP_DIR"/CHECKPOINT-STABLE-*.js 2>/dev/null | head -1)

if [ -z "$STABLE" ]; then
    echo "❌ CHECKPOINT-STABLE tidak ditemukan di $BACKUP_DIR"
    exit 1
fi

# Label fitur (default: unnamed)
LABEL="${1:-unnamed}"
# Bersihkan label: huruf/angka/dash aja
LABEL=$(echo "$LABEL" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g' | sed 's/--*/-/g' | sed 's/^-//; s/-$//')
[ -z "$LABEL" ] && LABEL="unnamed"

STABLE_BASE=$(basename "$STABLE" .js | sed 's/CHECKPOINT-STABLE-//')
TS=$(date +%Y%m%d-%H%M%S)
NEW="$BACKUP_DIR/CHECKPOINT-UPDATE-${LABEL}-${TS}.js"
NEWHTML="${NEW%.js}.html"

cp "$STABLE" "$NEW"
if [ -f "${STABLE%.js}.html" ]; then
    cp "${STABLE%.js}.html" "$NEWHTML"
fi

echo "✅ Backup dibuat: CHECKPOINT-UPDATE-${LABEL}-${TS}.js"
echo "   $NEW"
echo ""
echo "🛡️  Aturan: CHECKPOINT-STABLE tidak disentuh, semua backup masuk CHECKPOINT-UPDATE."
echo "💡 Update sekarang? Kalau error → bash RESTORE.sh"
