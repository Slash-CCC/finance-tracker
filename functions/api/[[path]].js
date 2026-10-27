// ============================================================
// 财政管家 · Pages Functions 数据 API
// 挂在 /api/* 路径下，与前端同域（pages.dev），国内免 VPN 可达。
// 免登录：每设备一个 owner_token(64位hex)，经请求头 x-owner-token 传递。
//
// 需要在 Pages 项目设置里绑定 D1：
//   Settings → Functions → D1 database bindings → 变量名 DB → finance-tracker-db
// ============================================================

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

  // CORS 预检
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  // 去掉 /api 前缀，得到内部路由（/api/records -> /records）
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api/, '') || '/';
  const method = request.method;

  // 健康检查（公开，无需 token，便于验证部署）
  if (path === '/health' && method === 'GET') {
    return json({ ok: true }, 200, origin);
  }

  const db = env.DB;
  if (!db) return err('服务端未绑定 D1 数据库(绑定名应为 DB)', 500, origin);

  const owner = getOwner(request);
  if (!owner) return err('缺少或非法的 x-owner-token 请求头', 401, origin);

  // ==== /summary ====
  // 由数据库直接汇总，不传输任何明细。
  // 记录再多也只返回一行，彻底避免"取最近N条导致余额不准"的问题。
  if (path === '/summary' && method === 'GET') {
    const row = await db.prepare(
      `SELECT
         COALESCE((SELECT initial_balance FROM user_settings WHERE user_id = ?1), 0) AS initial_balance,
         COALESCE((SELECT SUM(amount) FROM records WHERE user_id = ?1 AND type = 'income'),  0) AS total_income,
         COALESCE((SELECT SUM(amount) FROM records WHERE user_id = ?1 AND type = 'expense'), 0) AS total_expense,
         COALESCE((SELECT COUNT(*)     FROM records WHERE user_id = ?1), 0) AS record_count`
    ).bind(owner).first();

    const initial = Number(row?.initial_balance || 0);
    const income = Number(row?.total_income || 0);
    const expense = Number(row?.total_expense || 0);
    const balance = Math.round((initial + income - expense) * 100) / 100;

    return json({
      balance,
      initial_balance: Math.round(initial * 100) / 100,
      total_income: Math.round(income * 100) / 100,
      total_expense: Math.round(expense * 100) / 100,
      record_count: Number(row?.record_count || 0),
    }, 200, origin);
  }

  // ==== /records ====
  if (path === '/records') {
    if (method === 'GET') {
      const limit = Math.min(Number(url.searchParams.get('limit')) || 5000, 20000);
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

  // ==== /records/all ====
  if (path === '/records/all' && method === 'GET') {
    const { results } = await db.prepare(
      'SELECT * FROM records WHERE user_id = ? ORDER BY timestamp ASC'
    ).bind(owner).all();
    return json(results || [], 200, origin);
  }

  // ==== DELETE /records/:id ====
  if (path.startsWith('/records/') && method === 'DELETE') {
    const id = path.slice('/records/'.length);
    const res = await db.prepare('DELETE FROM records WHERE id = ? AND user_id = ?').bind(id, owner).run();
    return json({ deleted: res.meta.changes > 0 }, 200, origin);
  }

  // ==== /settings ====
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

  // ==== /targets ====
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
