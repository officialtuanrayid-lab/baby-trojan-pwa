# MEMORI-CORE LOG (catatan permanen lokal)
Catatan update yang WAJIB masuk memori core Adaptia. Kalau KV write gagal (kuota CF),
fakta dicatat di sini dulu, lalu di-retry otomatis setelah kuota reset.

## 2026-09-16
- [v7.3.241] Fitur INFO SKILL BAHASA AWAM: tap item skill di Jendela Jiwa (Otak/Tubuh/Jiwa) -> popup nama skill, sub teknis, area, dan 💡 Kegunaan dalam bahasa awam; kamus SKILL_AWAM 44 skill + fallback.
- [v7.3.242] Mode hari di header Jendela Jiwa dirapikan jadi chip futuristik (ikon fase + nama + jam WIB rata kanan), sejajar dengan bar Energi dan Fokus.
- STATUS KV: kuota write Cloudflare KV gratis habis hari ini (429 code 10048) -> fakta di atas dijadwalkan retry otomatis setelah reset (~00:10 UTC 2026-09-16); snapshot KV penuh aman di backups/FULL-BACKUP-ALL-3-20260916-060508/kv/
- [v7.3.243] Fix HUD Mode hari yang kepotong: div tengah header dapat ruang flex penuh (soul-pop-mid), HUD width 100%, mode jadi 2 baris compact (label MODE + jam WIB di atas; chip icon fase + nama di bawah).
- [v7.3.244] Jam di Mode hari diperkecil (font 6px, letter-spacing 0) supaya terlihat semua di layar kecil; max-width jam naik ke 60%.
- [v7.3.245] SYSTEM VITAL: Energi & Fokus sekarang dihitung dari kesehatan gabungan semua provider model AI (Gemini/Groq/CF/OpenRouter), bukan jam biologis lagi. Mode dihapus dari HUD (jadi 2 item), info pop diganti "Status Sistem", tone otomatis kalem saat energi rendah.
- [v7.3.246] Energi jadi REALTIME: Jendela Jiwa buka -> live probe tiap provider model AI (cache 60s, tanpa write KV). Bobot provider: Gemini 40/Groq 25/CF 20/OpenRouter 15 jadi satu energi gabungan. Stress sliding-window 30 menit bikin turun gradual & pulih bertahap. Desc jujur tanpa breakdown.

## 2026-09-17 (sesi malam WIB)
- [v7.3.247] Hapus teks "Santai jawab!" dari alasan mood: rule detectMood diubah reason jadi kosong + sanitizer read di /api/mood & status TG (data lama di KV tetap aman karena read disanitasi).
- [v7.3.248] Hapus "Nama: ADAPTIA" & "Mood: 😌 Stabil" dari section Jiwa (idInner) — avatar 🫀 tetap.
- [v7.3.249] ECG REALTIME di section Jiwa: canvas gelombang jantung di sebelah avatar (posisi [avatar][ECG]), inject aman langsung di loadSoulWindow (tanpa override), label status + persen dari energi/fokus.
- [v7.3.250] ECG LIVE BPM: amplitude & ritme gelombang dihitung dari vibe (energi+fokus): BPM = 55+vibe*0.55, amplitude = 6+vibe*0.26, warna dari pulseColor (hijau/kuning/merah). Label 💓 BPM update live.
- [v7.3.251] Hapus fade hitam di ujung kanan ECG (gradient solid dihapus).
- [v7.3.252] ECG & JANTUNG SINKRON 1:1: detak 🫀 di-trigger JS pas puncak R ECG (prevPh<=29&&ph>29), animasi CSS lama diganti hb-beat (scale + glow), satu sumber BPM. Kayak alat medis asli (ECG sinyal listrik -> denyut mekanik).
- [v7.3.253] Panel jiwa refresh 10s -> 5s; probe provider AI di-throttle 30s (sebelumnya probe=1 ping 4 provider tiap fetch) biar hemat & anti rate-limit.
- [v7.3.254] Jendela Jiwa futuristik (white neon glass): garis neon atas animasi, bracket section, glow title/bar/badge/button, scrollbar tipis.
- [v7.3.255] Panel Skill & Hubungan futuristik: skill tree/status/quest log jadi kartu glass + glow putih, bond/connection/timeline/inner voice/mood strip/achievement jadi hologram glass.
- STATUS KV: kuota write KV masih abis (429 10048) -> data mood lama pakai sanitizer read; retry write saat kuota reset.
- FULL BACKUP: core-memory/backups/checkpoint-FULL-BACKUP-20260917-035401/
- [v7.3.256] QUEST LOG DIPISAH: panel Quest Log jadi kategori sendiri (📋 Quest) di Jendela Jiwa, tidak lagi numpang di panel Skill — biar isi panel Skill gak kepanjangan.
- [v7.3.257] PANEL HUBUNGAN DISEDERHANAKAN: tetap futuristik (white neon glass) tapi lebih simpel & rapi, info bond/connection/timeline/inner voice/mood strip tetap utuh.
- [v7.3.258] ACHIEVEMENT DIHAPUS TOTAL: blok badge/badgeInner dihapus dari render Jendela Jiwa, line render "🏅 Achievement" dihapus, badgeInner dikeluarkan dari signature (sig). Data aman, cuma UI-nya yang dihapus sesuai request Tuan Isaac.
- [v7.3.259] BERSIHKAN SISA: entri "Statistik & Achievement" dihapus dari kamus SKILL_AWAM (fallback '*' tetap jalan), title naik ke v7.3.259, cache-buster adaptia-v2.257 supaya refresh otomatis ambil UI baru.
- BACKUP: core-memory/backups/checkpoint-hapus-achievement-20260917-040403/ (sebelum hapus achievement) + checkpoint-hapus-string-achievement-20260917-040624/ (sebelum bersihkan string terakhir); FULL BACKUP: checkpoint-FULL-BACKUP-20260917-035401/.
- STATUS: deploy sukses, health ok, HTTP 200, live bersih dari string achievement/badgeInner.
- [v7.3.260] STATUS CHARACTER REALTIME-PRESISI: 5 stat RPG sekarang dihitung dari data asli live, bukan formula statis:
  - INT: skill + topik mastery + entitas knowledge graph + facts.
  - CHA: skala log interaksi + titik mood trend + facts.
  - EMP: skor mood real (senang/motivasi/rileks/fokus/serius/kaget/khawatir/idle) + emosi memories + mood trend + vibe.
  - DET: skill + entitas + loose ends + koreksi.
  - SPD: LATENSI PROBE REALTIME — backend probe tiap provider AI sekarang ngukur waktu respon (ms), dirata-ratakan berbobot, dikirim sebagai probeMs di /api/self/state, SPD = 100 - ms*0.5 + bonus fokus.
  - Tiap stat nampilin sumber datanya (misal "skill 62 · topik 18", "403ms realtime · fokus 29%") biar keliatan presisi & realtime.
- BACKUP: core-memory/backups/checkpoint-stat-real-realtime-20260917-042731/
- STATUS: deploy sukses, /api/self/state balikin probeMs real (403ms), HTML v7.3.260 live, health ok.
- [v7.3.261] FIX BAR SEJAJAR di Status Character & Skill Tree: kolom nama di-kunci lebarnya (stat: flex 0 0 126px + ellipsis pada label sumber; area Otak/Tubuh/Jiwa: flex 0 0 62px) sehingga track bar semua mulai dari posisi yang sama dan cuma isi fill yang bergerak sesuai nilai.
- BACKUP: core-memory/backups/checkpoint-stat-bar-sejajar-20260917-043701/
- STATUS: deploy sukses, health ok, HTML v7.3.261 live.
- [v7.3.262] NAMA STAT LENGKAP di Status Character: singkatan INT/CHA/EMP/DET/SPD diganti tampilan penuh (Proses Logika, Natural Talk, Empati, Detail, Respon Cepat) biar gak lupa artinya; singkatan tetap ada sebagai tooltip (hover).
- BACKUP: core-memory/backups/checkpoint-nama-stat-lengkap-20260917-050429/
- STATUS: deploy sukses, health ok, HTML v7.3.262 live.
