const ALLOWED_ORIGINS = [
  'https://finance-tracker-51y.pages.dev',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.includes(origin) ? origin : '',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-owner-token',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json',
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders(origin) });
}

function err(msg, status, origin) {
  return json({ error: msg }, status, origin);
}

function validToken(t) {
  return !!t && /^[0-9a-f]{64}$/.test(t);
}

function getOwner(request) {
  const t = request.headers.get('x-owner-token');
  return validToken(t) ? t : null;
}

async function readBody(request) {
  try { return await request.json(); } catch { return null; }
}

export async function onRequest(context) {
  const request = context.request;
  const env = context.env;
  const origin = request.headers.get('Origin') || '';

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api/, '') || '/';
  const method = request.method;

  if (path === '/health' && method === 'GET') {
    return json({ ok: true }, 200, origin);
  }

  const db = env.DB;
  if (!db) return err('服务端未绑定 D1 数据库(绑定名应为 DB)', 500, origin);

  const owner = getOwner(request);
  if (!owner) return err('缺少或非法的 x-owner-token 请求头', 401, origin);

  if (path === '/records') {
    if (method === 'GET') {
      const limit = Math.min(Number(url.searchParams.get('limit')) || 500, 1000);
      const { results } = await db.prepare(
        'SELECT * FROM records WHERE user_id = ? ORDER BY timestamp DESC, created_at DESC LIMIT ?'
      ).bind(owner, limit).all();
      return json(results || [], 200, origin);
    }
    if (method === 'POST') {
      const b = await readBody(request);
      if (!b || typeof b.type !== 'string' || typeof b.amount !== 'number') {
        return err('参数错误', 400, origin);
      }
      const id = b.id || crypto.randomUUID();
      const timestamp = b.timestamp || new Date().toISOString();
      const now = new Date().toISOString();
      await db.prepare(
        'INSERT INTO records (id, user_id, type, amount, category, detail, is_family_card, timestamp, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(id, owner, b.type, b.amount, b.category || '', b.detail || null, b.is_family_card ? 1 : 0, timestamp, now).run();
      return json({ id, user_id: owner, type: b.type, amount: b.amount, category: b.category || '', detail: b.detail || null, is_family_card: !!b.is_family_card, timestamp, created_at: now }, 201, origin);
    }
    return err('Method not allowed', 405, origin);
  }

  if (path === '/records/all' && method === 'GET') {
    const { results } = await db.prepare(
      'SELECT * FROM records WHERE user_id = ? ORDER BY timestamp ASC'
    ).bind(owner).all();
    return json(results || [], 200, origin);
  }

  if (path.startsWith('/records/') && method === 'DELETE') {
    const id = path.slice('/records/'.length);
    const res = await db.prepare('DELETE FROM records WHERE id = ? AND user_id = ?').bind(id, owner).run();
    return json({ deleted: res.meta.changes > 0 }, 200, origin);
  }

  if (path === '/settings') {
    if (method === 'GET') {
      const { results } = await db.prepare('SELECT * FROM user_settings WHERE user_id = ? LIMIT 1').bind(owner).all();
      return json((results && results[0]) || null, 200, origin);
    }
    if (method === 'PUT') {
      const b = await readBody(request);
      if (b === null || typeof b.initial_balance !== 'number') return err('参数错误', 400, origin);
      await db.prepare(
        'INSERT INTO user_settings (user_id, initial_balance) VALUES (?, ?) ON CONFLICT (user_id) DO UPDATE SET initial_balance = excluded.initial_balance'
      ).bind(owner, b.initial_balance).run();
      const { results } = await db.prepare('SELECT * FROM user_settings WHERE user_id = ? LIMIT 1').bind(owner).all();
      return json(results[0], 200, origin);
    }
    return err('Method not allowed', 405, origin);
  }

  if (path === '/targets') {
    if (method === 'GET') {
      const y = url.searchParams.get('year');
      const m = url.searchParams.get('month');
      let sql = 'SELECT * FROM month_targets WHERE user_id = ?';
      const args = [owner];
      if (y) { sql += ' AND year = ?'; args.push(Number(y)); }
      if (m) { sql += ' AND month = ?'; args.push(Number(m)); }
      sql += ' ORDER BY year DESC, month DESC';
      const { results } = await db.prepare(sql).bind(...args).all();
      return json(results || [], 200, origin);
    }
    if (method === 'PUT') {
      const b = await readBody(request);
      if (b === null || !b.year || !b.month || typeof b.target !== 'number') return err('参数错误', 400, origin);
      await db.prepare(
        'INSERT INTO month_targets (user_id, year, month, target) VALUES (?, ?, ?, ?) ON CONFLICT (user_id, year, month) DO UPDATE SET target = excluded.target'
      ).bind(owner, b.year, b.month, b.target).run();
      return json({ ok: true, user_id: owner, year: b.year, month: b.month, target: b.target }, 200, origin);
    }
    return err('Method not allowed', 405, origin);
  }

  return err('Not found', 404, origin);
}
