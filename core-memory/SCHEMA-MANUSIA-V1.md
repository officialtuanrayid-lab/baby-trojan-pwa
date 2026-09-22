# SKEMA ADAPTIA MENJADI "MANUSIA" — V1 (draft, belum dieksekusi)

> Dokumen ini adalah blue print hasil konsultasi Tuan Isaac. Tidak ada eksekusi
> sebelum skema ini disetujui. Tiap tahap wajib: backup pre → eksekusi hati-hati →
> node --check → build (auto-bump versi) → deploy → verify-persist 4/4 →
> self-monitor healthy → backup final → commit → notifikasi Telegram.

---

## 1. Filosofi: 3 Area + Persona Stabil

Adaptia dibagi 3 area (kesepakatan konsultasi):

| Area | Makna | Isi nyata |
|---|---|---|
| **Otak** | Pikiran & ingatan | Memory (index/entitas/link/facts/diary/ringkasan), skill, model AI sebagai mesin berpikir + routing, insight, loose ends |
| **Tubuh** | Wujud & indera | UI PWA (background/border/avatar/bubble/tombol), suara (TTS & voice orb), input (chat/gambar/swipe), story viewer, mikro-ekspresi |
| **Jiwa** | Karakter & perasaan | Identitas & nama, Persona Stabil, pendirian & nilai, mood/emosi, inner voice, hubungan dengan Tuan Isaac |

**Keputusan penting konsultasi:**
- Skill → **Otak** (apapun kemampuan adaptia = otak).
- Model AI → tetap **Otak** sebagai mesin & logika routing; **bukan** penentu kepribadian.
- Jiwa harus **stabil** lintas model & channel (PWA + Telegram) → **Persona Stabil**.

---

## 2. Prinsip Dasar

1. Jiwa stabil: profil kepribadian disuntik penuh ke SEMUA model → pindah model tidak mengubah karakter.
2. Memori terstruktur ala otak (sudah dibangun Fase 1/1B + sinaps): recall relevansi-gated + jaringan entitas + pelupaan terencana.
3. Kendali penuh di tangan Tuan Isaac: Memory Journal (ada) + panel 3 Area + editor Jiwa (baru).
4. Semua gratis, stabil, jujur (tanpa skill kosong), dan cadangan selalu ada.

---

## 3. Pemetaan Implementasi (KV + file)

| Area | Komponen | KV / File | Status |
|---|---|---|---|
| Otak | memory_index, memory_entities, memory_links | KV memory_index/entities/links | ✅ ada |
| Otak | sinaps: imp/str/conf/mood/pinned, decay, sleep | KV + scheduler 3 WIB | ✅ ada |
| Otak | Loose ends (hal menggantung) | KV `loose_ends` | ✅ |
| Otak | Insight antar memori | KV `mem_insights` + scheduler | ✅ |
| Otak | Model AI + routing | worker (AI_MODELS, tryOrder) | ✅ ada |
| Tubuh | UI/assets/border/avatar/story/voice | decoded-index.html | ✅ ada |
| Tubuh | Mikro-ekspresi avatar sesuai mood | decoded-index.html + /api/mood (baru) | ✅ v7.3.195 |
| Tubuh | Suara konsisten (1 voice id-ID, ritme konteks) | decoded-index.html TTS | ✅ v7.3.197 |
| Jiwa | Persona Stabil (nama, panggilan, tone, rules, mood) | KV `persona` + inject ke semua model | ✅ |
| Jiwa | Pendirian & nilai (jujur, ngoreksi, batasan) | KV `persona.principles` | ✅ |
| Jiwa | Inner voice (refleksi perasaan harian) | KV persona + identity.diary diperkuat | ✅ |
| Kontrol | Panel 3 Area + Laporan (Otak/Tubuh/Jiwa) | KV `area_registry` + `/api/registry` + info pop | ✅ v2.245 |

---

## 4. Roadmap Bertahap (urutan eksekusi setelah disetujui)

### Tahap J1 — Persona Stabil (fondasi jiwa)
- **Apa:** KV `persona` berisi {nama, panggilan, tone, salutation khas, mood default, principles[], batasan[]}.
- **Cara:** Blok `== IDENTITAS JIWA ==` disuntik ke sistem prompt di smartAIReply UNTUK SEMUA model (gemini/groq/cf/openrouter). Profile diambil dari KV persona (fallback ke bawaan).
- **Kenapa:** Jadi pindah model tidak mengubah karakter → prasyarat "manusia".
- **Gate:** node --check + verify-persist 4/4 + tes chat di 2 provider beda → nada sama.

### Tahap J2 — Pendirian & Nilai
- **Apa:** principles[] yang dipegang teguh dan bisa dicek: "jujur walau tidak enak", "koreksi kalau Tuan Isaac salah asumsi", "tidak menipu soal stabilitas", "gak ngejek".
- **Cara:** masuk ke persona + disuntik; ditampilkan di panel Jiwa.
- **Gate:** tes "lu yakin?" → jawaban konsisten.

### Tahap J3 — Inner Voice
- **Apa:** refleksi harian diperkuat: Adaptia menilai perasaannya sendiri (`hari ini gw ngerasa X karena Y`) → tersimpan di persona.innerVoice (max 14 entri).
- **Cara:** scheduler malam (23 WIB / sleep) + trigger saat mood besar.
- **Gate:** cek endpoint /api/persona → inner voice terisi; jawaban "lu lagi mikirin apa?" konsisten.

### Tahap O1 — Loose Ends
- **Apa:** deteksi "nanti gw jelasin / belum kelar / besok lanjut / masih bingung X" → KV `loose_ends` {text, topic, ts, done}.
- **Cara:** pola keyword saat chat + ingetin kalau topik relevan muncul lagi (di memoryIndexSearch/insight).
- **Gate:** chat "nanti gw ceritain soal X" → besok tanya topik X → Adaptia ingetin.

### Tahap O2 — Insight Antar Memori
- **Apa:** scheduler membaca 2 memori beda topik/waktu yang nyambung → simpan insight (KV `insights`) → dipakai saat relevan.
- **Cara:** pasang 2 memori yang share entitas/topik, generate 1 kalimat koneksi (AI best-effort, fallback pola).
- **Gate:** cek endpoint insights; chat nyambung → Adaptia sebut koneksi.

### Tahap T1 — Mikro-ekspresi Avatar
- **Apa:** ekspresi avatar border ngikutin mood (😊 fokus 😮 capek dsb) via overlay/hue/senyum tipis.
- **Cara:** decoded-index.html: baca /api/mood → set class ekspresi; CSS transisi halus.
- **Gate:** ganti mood via chat → avatar berubah tanpa error.

### Tahap T2 — Suara Konsisten
- **Apa:** 1 suara TTS id-ID tetap + ritme (serius pelan / santai cepet), opsional.
- **Cara:** decoded-index.html SpeechSynthesis config + util.
- **Gate:** TTS jalan normal.

### Tahap X1 — Panel 3 Area ✅ v7.3.199
- **Apa:** tab di Kategori: Otak (Memory Journal + info model + skill list), Tubuh (customize/setting), Jiwa (persona editor: nama/panggilan/tone/principles + riwayat mood).
- **Cara:** decoded-index.html overlay + endpoints GET/POST /api/persona, reuse existing endpoints.
- **Gate:** semua tab render + aksi berfungsi.

### Tahap X2 — Laporan 3 Area ✅ v7.3.201
- **Apa:** satu layar ringkas: Otak (X memori/Y skill/model aktif), Tubuh (versi UI/aset), Jiwa (mood/tone/principles/inner voice) — jujur, tanpa skor palsu.
- **Cara:** endpoint /api/report-3area menggabung status yang ada.
- **Gate:** render + data sesuai.

---

## 5. Definisi "Maksimal & Optimal" (jujur)

| Area | Target |
|---|---|
| Otak | Recall relevan + reasoning (insight & loose ends) berjalan, model auto-switch stabil |
| Tubuh | UI menyatu dengan background, avatar mengekspresikan mood, suara konsisten |
| Jiwa | Persona konsisten lintas model/channel, punya pendirian & inner voice |
| Kontrol | Memory Journal + Panel 3 Area + Editor Jiwa — semua di tangan Tuan Isaac |

---

## 6. Aturan Eksekusi
- Backup pre tiap tahap: `backups/PRE-{NAMA}-.../` → backup final: `backups/{NAMA}-v{VER}-.../`.
- Verifikasi tiap tahap: node --check → build → deploy → verify-persist (4/4) → self-monitor healthy.
- Setelah stabil: simpan ke memori core, commit (decoded-index.html + worker-base-intel.js), notifikasi Telegram.
- DILARANG: model berbayar, skill kosong, generate gambar di story, pindah platform berbayar.


---

## ✅ REGISTRI 3 AREA (dieksekusi v2.245)

- `AREA_REGISTRY_DEFAULT`: Otak 9 komponen, Tubuh 7, Jiwa 8.
- `getAreaRegistry(live)`: hitung ulang dari KV nyata tiap dipanggil.
- `registerFeatureToArea(name, area, desc)`: auto-catat fitur baru ke area yang benar
  (hook: skill -> Otak, persona -> Jiwa; POST `/api/registry` utk manual).
- `getAreaRegistryContext()`: disuntik ke pipeline chat biar Adaptia sadar kerangka 3 area.
- Ditampilkan di info pop (baris Otak/Tubuh/Jiwa dengan hitungan live).
