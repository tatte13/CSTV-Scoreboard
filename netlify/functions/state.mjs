import { getStore } from '@netlify/blobs';

/*
 * Stato condiviso dello scoreboard.
 * GET  /api/state?room=xxx[&since=ts] → { state, updatedAt, now }  (204 se non cambiato da "since")
 * PUT  /api/state?room=xxx  body { state } → { updatedAt, now }
 */
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, PUT, POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'access-control-expose-headers': 'x-now'
};
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...CORS }
});

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  const url = new URL(req.url);
  const room = (url.searchParams.get('room') || 'main').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40) || 'main';
  const store = getStore({ name: 'scoreboard', consistency: 'strong' });
  const key = `room-${room}`;

  if (req.method === 'GET') {
    const doc = await store.get(key, { type: 'json' });
    const since = Number(url.searchParams.get('since') || 0);
    if (!doc) return json({ state: null, updatedAt: 0, now: Date.now() });
    if (since && doc.updatedAt <= since) return new Response(null, { status: 204, headers: { 'cache-control': 'no-store', 'x-now': String(Date.now()), ...CORS } });
    return json({ ...doc, now: Date.now() });
  }

  if (req.method === 'PUT' || req.method === 'POST') {
    let body;
    try { body = await req.json(); } catch { return json({ error: 'JSON non valido' }, 400); }
    if (!body || typeof body.state !== 'object' || body.state === null) return json({ error: 'stato mancante' }, 400);
    const raw = JSON.stringify(body.state);
    if (raw.length > 2_000_000) return json({ error: 'stato troppo grande' }, 413);
    const updatedAt = Date.now();
    await store.setJSON(key, { state: body.state, updatedAt });
    return json({ updatedAt, now: updatedAt });
  }

  return json({ error: 'metodo non consentito' }, 405);
};

export const config = { path: '/api/state' };
