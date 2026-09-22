#!/bin/bash
# Quick syntax check for Adaptia worker
BACKUP="/root/baby-trojan-render/core-memory/worker-full-backup.js"
node -e "
const fs = require('fs');
const w = fs.readFileSync('$BACKUP', 'utf8');
const m = w.match(/'\/index\.html':\s*'([A-Za-z0-9+/=]*)'/);
if (!m) { console.log('❌ No index.html found'); process.exit(1); }
const html = Buffer.from(m[1], 'base64').toString();
const sm = html.match(/<script>([\s\S]*?)<\/script>/);
if (!sm) { console.log('❌ No script found'); process.exit(1); }
try { new Function(sm[1]); console.log('✅ Syntax OK (' + sm[1].length + ' chars)'); } catch(e) { console.log('❌ Syntax Error: ' + e.message); process.exit(1); }
"
