# ⚠️ ATURAN CHECKPOINT — WAJIB DIKUTI (Tuan Isaac)

## 1. CHECKPOINT-STABLE = JANGAN PERNAH DIUBAH/DITIMPA
- File: `backups/CHECKPOINT-STABLE-v7.3.4-final-20260912.js`
- Ini versi yang sudah Tuan Isaac validasi sendiri di device-nya.
- **DILARANG**: mengedit, meng-overwrite, atau mengganti isi file ini.
- Satu-satunya operasi yang boleh: DIBACA / DI-DEPLOY untuk restore darurat (`bash RESTORE.sh`).

## 2. SEMUA BACKUP UPDATE/UPGRADE → CHECKPOINT-UPDATE
- Setiap kali update/upgrade selesai dan Tuan Isaac bilang "simpan ke backup":
  - Simpan ke file baru `backups/CHECKPOINT-UPDATE-<versi>-<timestamp>.js` (+ `.html`)
  - **JANGAN PERNAH** menyimpan ke `CHECKPOINT-STABLE`.
- Gunakan: `bash SAVE-CHECKPOINT.sh` (otomatis bikin snapshot ke CHECKPOINT-UPDATE).
- CHECKPOINT-UPDATE boleh berjumlah banyak, masing-masing punya timestamp sendiri.

## 3. RESTORE DARURAT
- `bash RESTORE.sh` → selalu deploy dari `CHECKPOINT-STABLE` (master).
- Kalau master error/gak ada → baru fallback ke `CHECKPOINT-UPDATE` terbaru.

## 4. FLOW UPDATE YANG BENAR
1. `bash SAVE-CHECKPOINT.sh` → snapshot lama masuk CHECKPOINT-UPDATE
2. Lakukan update/upgrade UI/skill
3. User validasi di HP
4. Kalau sukses → backup versi baru JADI CHECKPOINT-UPDATE baru (BUKAN ganti STABLE)
5. Kalau error → `bash RESTORE.sh` (kembali ke STABLE)

## 5. PENAMAAN
- STABLE: `CHECKPOINT-STABLE-v7.3.4-final-20260912.js` (jangan pernah diubah)
- UPDATE: `CHECKPOINT-UPDATE-<nama-fitur>-<tanggal>-<jam>.js`
  - Label nama fitur: `welcome-screen`, `story-viewer`, `avatar-border`, `splash`, dll
  - Contoh: `CHECKPOINT-UPDATE-welcome-screen-20260912-1430.js`
  - Aturan: kalau update "welcome screen", backupnya `welcome-screen`
  - Masalah jelek: tidak ada. Masalah: **label harus deskriptif & sesuai update**.

## 6. LARANGAN SKIL PALSU — ABSOLUT
- **DILARANG KERAS** merekomendasikan skill kosong/palsu (hanya nama tanpa kode nyata).
- **DILARANG KERAS** mengupgrade skill palsu ke Adaptia.
- Hanya boleh rekomendasi/install skill yang:
  1. Punya kode implementasi nyata (fungsi konkret, bukan cuma `return null` atau `return ''`)
  2. Punya endpoint yang benar-benar terpanggil di alur chat (bukan endpoint duduk doang)
  3. Punya basis data nyata (Cloudflare KV, memory index, RAG, dll)
- **Jika diragukan**: verifikasi kode dulu, tunjukin baris kode ke Tuan Isaac, baru eksekusi.
- **Aturan ini berlaku untuk Codex (agen) DAN Adaptia (AI)** — keduanya wajib patuh.
