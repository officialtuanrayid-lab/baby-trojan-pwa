/*
 * Adaptia backend extension source.
 *
 * This file is intentionally separate from worker-current-live.js. The build
 * system injects it into the Worker bundle before the main 404 response, so
 * new backend capabilities can be built from Project Chat without editing the
 * generated bundle directly.
 */
async function adaptiaBackendExtension(request, path, method, CORS) {
  const json = (value, status = 200) => new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS }
  });

  if (path === '/api/backend/capabilities' && method === 'GET') {
    return json({
      status: 'ok',
      source: 'worker-backend-extension',
      capabilities: ['custom-endpoints', 'workspace-memory', 'workspace-audit', 'specialist-agents', 'safe-deploy'],
      timestamp: new Date().toISOString()
    });
  }

  if (path === '/api/workspace/agent' && method === 'POST') {
    try {
      const body = await request.json();
      const workspace = String(body.workspace || '').toLowerCase();
      const profiles = {
        finance: {
          name: 'Agent Keuangan',
          rules: 'Pisahkan fakta, asumsi, dan rekomendasi. Hitung angka dari data yang tersedia. Jangan menjanjikan profit dan jangan mengeksekusi transaksi.',
          actions: 'Analisis transaksi, budget, saldo, harga barang, dan pola pengeluaran.'
        },
        work: {
          name: 'Agent Operasional Pekerjaan',
          rules: 'Gunakan tempat kerja aktif sebagai konteks utama. Prioritaskan biaya, waktu, kebutuhan nyata, dan urutan kerja.',
          actions: 'Susun prioritas, analisis belanja, acara, stok, budget, dan rekomendasi operasional.'
        }
      };
      const profile = profiles[workspace];
      if (!profile) return json({ error: 'Agent workspace tidak tersedia' }, 400);
      const message = String(body.message || '').trim().substring(0, 4000);
      if (!message || (typeof isValidInput === 'function' && !isValidInput(message))) return json({ error: 'Pesan agent tidak valid' }, 400);
      const history = Array.isArray(body.history) ? body.history.slice(-10).map((item) => ({
        role: item.role === 'assistant' ? 'assistant' : 'user',
        text: String(item.text || item.content || '').substring(0, 1200)
      })) : [];
      const context = String(body.context || '').substring(0, 7000);
      const specialistContext = `\n\n== AGENT SPESIALIS ${workspace.toUpperCase()} ==\nNama agent: ${profile.name}\nAturan: ${profile.rules}\nBatas tindakan: ${profile.actions}\nJawab sebagai agent spesialis workspace ini, bukan sebagai developer atau agent workspace lain.\n== KONTEKS WORKSPACE ==\n${context}`;
      const reply = await aiReply(message, history, null, specialistContext);
      return json({ status: 'ok', workspace, agent: profile.name, reply: reply || 'Agent belum mendapat jawaban.' });
    } catch (error) {
      return json({ error: error.message || 'Agent workspace gagal memproses pesan' }, 500);
    }
  }

  // Append one bounded memory item without requiring the UI to replace the
  // complete workspace memory document.
  if (path === '/api/workspace/memory/append' && method === 'POST') {
    try {
      const body = await request.json();
      const workspace = String(body.workspace || 'default').toLowerCase()
        .replace(/[^a-z0-9_-]/g, '').substring(0, 32) || 'default';
      const text = String(body.text || '').trim().substring(0, 600);
      if (!text) return json({ error: 'Memory text wajib diisi' }, 400);
      const key = 'workspace_memory_' + workspace;
      let memory = await kvGet(key) || [];
      if (!Array.isArray(memory)) memory = [];
      memory.push({ id: crypto.randomUUID(), text, source: 'backend-extension', at: new Date().toISOString() });
      memory = memory.slice(-100);
      await kvPut(key, memory);
      return json({ status: 'ok', workspace, item: memory[memory.length - 1], memory });
    } catch (error) {
      return json({ error: error.message || 'Gagal menambah memory workspace' }, 500);
    }
  }

  return null;
}
