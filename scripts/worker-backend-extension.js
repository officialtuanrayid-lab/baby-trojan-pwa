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
      capabilities: ['custom-endpoints', 'workspace-memory', 'workspace-audit', 'safe-deploy'],
      timestamp: new Date().toISOString()
    });
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
