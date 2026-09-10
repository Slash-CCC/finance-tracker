// 临时数据导入接口 —— 用完请删除本文件
// 访问方式：POST /api/import  body: { token, settings, targets, records }

export async function onRequest(context) {
  const { request, env } = context;

  // ---- CORS ----
  const origin = request.headers.get('Origin') || '';
  const ALLOW = [
    'https://finance-tracker-51y.pages.dev',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ];
  const corsHeaders = {
    'Access-Control-Allow-Origin': ALLOW.includes(origin) ? origin : ALLOW[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-owner-token',
    'Access-Control-Max-Age': '86400',
  };
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return json({ error: 'method not allowed' }, 405, corsHeaders);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid json' }, 400, corsHeaders);
  }

  // ---- 安全校验：必须带上正确的 owner token ----
  const token = String(body.token || '').trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(token)) {
    return json({ error: 'bad token format' }, 400, corsHeaders);
  }

  // 只允许导入到"当前为空"的账户：若该 token 已有记录，拒绝（防重复导入/覆盖）
  const existing = await env.DB
    .prepare('SELECT COUNT(*) AS n FROM records WHERE user_id = ?')
    .bind(token)
    .first();
  const force = body.force === true;
  if (existing && existing.n > 0 && !force) {
    return json({ error: 'target account already has data', count: existing.n, hint: 'set force:true to overwrite' }, 409, corsHeaders);
  }

  // ---- 组装批量语句 ----
  const stmts = [];

  if (Array.isArray(body.records)) {
    const insRec = env.DB.prepare(
      `INSERT INTO records (id, user_id, type, amount, category, detail, is_family_card, timestamp, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         type=excluded.type, amount=excluded.amount, category=excluded.category,
         detail=excluded.detail, is_family_card=excluded.is_family_card,
         timestamp=excluded.timestamp`
    );
    for (const r of body.records) {
      stmts.push(insRec.bind(
        String(r.id),
        token,
        String(r.type),
        Number(r.amount),
        String(r.category),
        r.detail == null ? null : String(r.detail),
        r.is_family_card ? 1 : 0,
        String(r.timestamp),
        String(r.created_at || r.timestamp)
      ));
    }
  }

  if (body.settings && typeof body.settings.initial_balance !== 'undefined') {
    stmts.push(env.DB.prepare(
      `INSERT INTO user_settings (user_id, initial_balance) VALUES (?, ?)
       ON CONFLICT(user_id) DO UPDATE SET initial_balance = excluded.initial_balance`
    ).bind(token, Number(body.settings.initial_balance)));
  }

  if (Array.isArray(body.targets)) {
    const insTg = env.DB.prepare(
      `INSERT INTO month_targets (user_id, year, month, target) VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, year, month) DO UPDATE SET target = excluded.target`
    );
    for (const t of body.targets) {
      stmts.push(insTg.bind(token, Number(t.year), Number(t.month), Number(t.target)));
    }
  }

  if (stmts.length === 0) {
    return json({ error: 'nothing to import' }, 400, corsHeaders);
  }

  // D1 batch 上限 100 条/次，分批执行
  const CHUNK = 50;
  let done = 0;
  for (let i = 0; i < stmts.length; i += CHUNK) {
    const part = stmts.slice(i, i + CHUNK);
    await env.DB.batch(part);
    done += part.length;
  }

  const after = await env.DB
    .prepare('SELECT COUNT(*) AS n FROM records WHERE user_id = ?')
    .bind(token)
    .first();

  return json({ ok: true, executed: done, records_now: after ? after.n : null }, 200, corsHeaders);
}

function json(obj, status, extraHeaders) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...(extraHeaders || {}) },
  });
}
