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

  const parseMoney = (value) => {
    const digits = String(value || '').replace(/[^0-9]/g, '');
    const amount = Number(digits);
    return Number.isFinite(amount) ? Math.round(amount) : 0;
  };
  const parseWorkspaceAction = (workspace, message, workplaceId) => {
    const text = String(message || '').trim();
    const lower = text.toLowerCase();
    const packMatch = lower.match(/(?:sebanyak\s*)?(\d+)\s*(pack|renceng|pcs|buah|unit)/i);
    const quantity = packMatch ? Math.max(1, Number(packMatch[1])) : 1;
    const unit = packMatch && /pack|renceng/i.test(packMatch[2]) ? 'pack' : 'satuan';
    const priceMatch = text.match(/(?:harga|nominal|sebesar|total)\s*(?:rp\s*)?([0-9][0-9.,]*)/i);
    const numberMatches = Array.from(text.matchAll(/(?:rp\s*)?([0-9][0-9.,]*)/ig));
    const moneyMatch = priceMatch || numberMatches[numberMatches.length - 1];
    const amount = moneyMatch ? parseMoney(moneyMatch[1]) : 0;
    const expense = /(uang\s*keluar|pengeluaran|belanja|beli|pembelian|bayar)/i.test(lower);
    const income = /(uang\s*masuk|pemasukan|terima|pendapatan|gaji)/i.test(lower);
    if ((workspace === 'work' || workspace === 'finance') && amount > 0 && (expense || income)) {
      let note = text.replace(/(?:rp\s*)?[0-9][0-9.,]*/ig, '')
        .replace(/\b(cat(et|at)|uang\s*(keluar|masuk)|pengeluaran|pemasukan|belanja|beli|pembelian|bayar|terima|pendapatan|gaji|harga|nominal|sebesar|total|sebanyak|pack|renceng|pcs|buah|unit)\b/ig, ' ')
        .replace(/\s+/g, ' ').trim();
      if (!note) note = expense ? 'Belanja kerja' : 'Pemasukan';
      return { kind: income ? 'income' : 'expense', workspace, note: note.substring(0, 160), amount, unit, quantity, workplaceId: String(workplaceId || 'mdc-bekasi').substring(0, 80) };
    }
    return null;
  };

  if (path === '/api/workspace/action/preview' && method === 'POST') {
    try {
      const body = await request.json();
      const workspace = String(body.workspace || '').toLowerCase();
      if (!['finance', 'work'].includes(workspace)) return json({ error: 'Workspace action tidak tersedia' }, 400);
      const action = parseWorkspaceAction(workspace, body.message, body.workplaceId);
      if (!action) return json({ status: 'none', message: 'Belum menemukan perintah pencatatan yang lengkap.' });
      return json({ status: 'preview', action, explanation: action.kind === 'expense' ? 'Akan mencatat uang keluar dan memasukkan item ke log belanja.' : 'Akan mencatat uang masuk ke ledger workspace.' });
    } catch (error) { return json({ error: error.message || 'Gagal membuat preview action' }, 500); }
  }

  if (path === '/api/workspace/action/confirm' && method === 'POST') {
    try {
      const body = await request.json();
      const action = body.action || {};
      const workspace = String(action.workspace || body.workspace || '').toLowerCase();
      const amount = Number(action.amount);
      const quantity = Math.max(1, Math.min(100000, Number(action.quantity) || 1));
      const note = String(action.note || '').trim().substring(0, 160);
      const workplaceId = String(action.workplaceId || 'mdc-bekasi').substring(0, 80);
      if (!['finance', 'work'].includes(workspace) || !['income', 'expense'].includes(action.kind) || !note || !Number.isFinite(amount) || amount < 1 || amount > 100000000000) return json({ error: 'Action tidak valid' }, 400);
      const now = new Date().toISOString();
      if (workspace === 'work') {
        let cashflow = await kvGet('work_cashflow') || [];
        if (!Array.isArray(cashflow)) cashflow = [];
        const entry = { id: crypto.randomUUID(), type: action.kind, note, amount: Math.round(amount), workplaceId, date: now, source: 'workspace-agent' };
        cashflow.push(entry);
        await kvPut('work_cashflow', cashflow.slice(-200));
        let purchase = null;
        if (action.kind === 'expense') {
          let purchases = await kvGet('work_purchases') || [];
          if (!Array.isArray(purchases)) purchases = [];
          purchase = { id: crypto.randomUUID(), item: note, price: Math.round(amount), unit: action.unit === 'pack' ? 'pack' : 'satuan', quantity, unitPrice: action.unit === 'pack' ? Math.round(amount / quantity) : Math.round(amount), workplaceId, date: now, ts: Date.now(), source: 'workspace-agent', cashflowId: entry.id };
          purchases.push(purchase);
          await kvPut('work_purchases', purchases.slice(-100));
        }
        return json({ status: 'ok', workspace, entry, purchase });
      }
      let ledger = await kvGet('finance_agent_ledger') || [];
      if (!Array.isArray(ledger)) ledger = [];
      const entry = { id: crypto.randomUUID(), type: action.kind, note, amount: Math.round(amount), unit: action.unit === 'pack' ? 'pack' : 'satuan', quantity, date: now, source: 'finance-agent' };
      ledger.push(entry);
      await kvPut('finance_agent_ledger', ledger.slice(-200));
      return json({ status: 'ok', workspace, entry });
    } catch (error) { return json({ error: error.message || 'Gagal menyimpan action' }, 500); }
  }

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
