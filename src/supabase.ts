// ============================================================
// 财政管家 · 数据层（Cloudflare D1 + Pages Functions 同域 API）
//
// API 挂在 /api 路径（与前端同域，pages.dev 国内免 VPN 可达），
// 代码在 functions/api/[[path]].js，D1 绑定在 Pages 项目设置里配置。
//
// 免登录架构：首次打开自动生成 64 位随机 owner_token 存 localStorage，
//   作为本设备数据归属。请求经请求头 x-owner-token 传给后端隔离。
//   换设备用「设置 → 数据迁移」复制/粘贴 token 即可搬数据。
//
// 离线支持：写操作离线时进入待同步队列(pending)并本地展示；
//   恢复联网后 flushPending() 自动补传。页面层无需感知。
//
// 保留与原 Supabase 版本同名、同签名的导出，页面层无痛复用。
// ============================================================

// ====== 云端 API 地址（同域相对路径）======
const WORKER_BASE_URL = '/api';

// ====== owner_token：每设备唯一，localStorage 持久化 ======
const TOKEN_KEY = 'finance-owner-token';

function generateToken(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

// 生成 UUID v4（兼容性兜底，不依赖 crypto.randomUUID）
function makeUUID(): string {
  try {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch { /* fall through */ }
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  arr[6] = (arr[6] & 0x0f) | 0x40; // version 4
  arr[8] = (arr[8] & 0x3f) | 0x80; // variant 10
  const h = Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

export function getOwnerToken(): string {
  let t = localStorage.getItem(TOKEN_KEY);
  if (!t || !/^[0-9a-f]{64}$/.test(t)) {
    t = generateToken();
    localStorage.setItem(TOKEN_KEY, t);
  }
  return t;
}

export function setOwnerToken(t: string): boolean {
  if (!/^[0-9a-f]{64}$/.test(t)) return false;
  localStorage.setItem(TOKEN_KEY, t);
  return true;
}

export function exportOwnerToken(): string {
  return getOwnerToken();
}

// ====== 本地缓存（离线只读展示 + 未上云写操作暂存）======
const CACHE_KEY = 'finance-local-cache-v1';
const PENDING_KEY = 'finance-pending-v1';

// ---- 类型 ----
export interface Record {
  id: string;
  user_id: string;
  type: 'expense' | 'income';
  amount: number;
  category: string;
  detail?: string | null;
  is_family_card: boolean;
  timestamp: string;
  created_at: string;
}

export interface MonthTarget {
  id?: string;
  user_id: string;
  year: number;
  month: number;
  target: number;
}

export interface UserSettings {
  id?: string;
  user_id: string;
  initial_balance: number;
}

interface LocalCache {
  records: Record[];
  settings: UserSettings | null;
  targets: MonthTarget[];
}

type PendingOp =
  | { kind: 'add'; record: Record }
  | { kind: 'delete'; id: string };

// ---- 缓存读写 ----
function readCache(): LocalCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function writeCache(patch: Partial<LocalCache>) {
  const cur = readCache() || { records: [], settings: null, targets: [] };
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ...cur, ...patch })); } catch {}
}
function readPending(): PendingOp[] {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function writePending(list: PendingOp[]) {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(list)); } catch {}
}

export function clearLocalCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(PENDING_KEY);
  } catch {}
}

// 待同步中未上云的写操作总数（设置页可显示）
export function pendingCount(): number {
  return readPending().length;
}

// 把本地缓存与 pending 合并后的记录当作"当前可见数据"
function visibleRecords(): Record[] {
  const c = readCache();
  const cache = c ? c.records : [];
  const pending = readPending();
  let out = cache;
  const deletedIds = new Set(pending.filter(p => p.kind === 'delete').map(p => p.id));
  if (deletedIds.size) out = out.filter(r => !deletedIds.has(r.id));
  const added = pending.filter(p => p.kind === 'add').map(p => p.record as Record);
  const addedIds = new Set(added.map(r => r.id));
  out = [...added, ...out.filter(r => !addedIds.has(r.id))];
  return out;
}

// ====== HTTP 封装 ======
async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(WORKER_BASE_URL + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-owner-token': getOwnerToken(),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = `请求失败 (${res.status})`;
    try { const d = await res.json(); if (d && d.error) msg = d.error; } catch {}
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

// ====== 待同步队列 flush（恢复联网时调用）======
export async function flushPending(): Promise<void> {
  if (!navigator.onLine) return;
  const pending = readPending();
  if (pending.length === 0) return;

  for (const op of pending) {
    try {
      if (op.kind === 'add') {
        await api('POST', '/records', op.record);
      } else {
        await api('DELETE', `/records/${op.id}`);
      }
    } catch {
      return;
    }
  }
  writePending([]);
  try {
    const recs = await api<Record[]>('GET', '/records/all');
    writeCache({ records: recs });
  } catch {}
}

// ====== 记录 CRUD ======

// 查询最近记录（默认500，倒序）。返回"缓存合并待同步后"的可见数据。
export async function getRecords(limit = 500): Promise<Record[]> {
  let server: Record[] | null = null;
  if (navigator.onLine) {
    try {
      server = await api<Record[]>('GET', '/records?limit=2000');
      writeCache({ records: server });
    } catch {
      // 网络失败用缓存
    }
  }
  const visible = visibleRecords();
  const sorted = [...visible].sort(
    (a, b) => (b.timestamp > a.timestamp ? 1 : b.timestamp < a.timestamp ? -1 : 0)
  );
  return server ? sorted.slice(0, limit) : sorted.slice(0, limit);
}

// 全量记录（导出用）
export async function getAllRecords(): Promise<Record[]> {
  if (navigator.onLine) {
    try {
      const server = await api<Record[]>('GET', '/records/all');
      writeCache({ records: server });
    } catch {}
  }
  return visibleRecords().sort((a, b) => (a.timestamp > b.timestamp ? 1 : -1));
}

// 新增记录：在线直接上云；离线入队本地展示
export async function addRecord(r: {
  type: 'expense' | 'income';
  amount: number;
  category: string;
  detail?: string;
  is_family_card?: boolean;
}): Promise<Record> {
  const owner = getOwnerToken();
  const id = makeUUID();
  const now = new Date().toISOString();
  const rec: Record = {
    id, user_id: owner, type: r.type, amount: r.amount,
    category: r.category, detail: r.detail || null,
    is_family_card: r.type === 'expense' ? !!r.is_family_card : false,
    timestamp: now, created_at: now,
  };

  if (navigator.onLine) {
    try {
      await api('POST', '/records', rec);
      const c = readCache();
      writeCache({ records: [rec, ...(c ? c.records : [])] });
      return rec;
    } catch {
      const p = readPending(); p.push({ kind: 'add', record: rec }); writePending(p);
      return rec;
    }
  } else {
    const p = readPending(); p.push({ kind: 'add', record: rec }); writePending(p);
    return rec;
  }
}

// 删除记录
export async function deleteRecord(id: string): Promise<void> {
  if (navigator.onLine) {
    try {
      await api('DELETE', `/records/${id}`);
      const c = readCache();
      if (c) writeCache({ records: c.records.filter(r => r.id !== id) });
      return;
    } catch {
      // 入队待删
    }
  }
  const p = readPending(); p.push({ kind: 'delete', id }); writePending(p);
  const c = readCache();
  if (c) writeCache({ records: c.records.filter(r => r.id !== id) });
}

// ====== 用户设置（初始余额）======
export async function getUserSettings(): Promise<UserSettings | null> {
  if (navigator.onLine) {
    try {
      const s = await api<UserSettings | null>('GET', '/settings');
      writeCache({ settings: s });
      return s;
    } catch {}
  }
  const c = readCache();
  return c ? c.settings : null;
}

export async function upsertUserSettings(balance: number): Promise<UserSettings> {
  const owner = getOwnerToken();
  const s: UserSettings = { user_id: owner, initial_balance: balance };
  writeCache({ settings: s });
  if (navigator.onLine) {
    try {
      const ret = await api<UserSettings>('PUT', '/settings', { initial_balance: balance });
      writeCache({ settings: ret });
      return ret;
    } catch { /* 本地已更新 */ }
  }
  return s;
}

// ====== 月度目标 ======
export async function getMonthTargets(year?: number, month?: number): Promise<MonthTarget[]> {
  if (navigator.onLine) {
    try {
      let path = '/targets';
      const qs: string[] = [];
      if (year !== undefined) qs.push(`year=${year}`);
      if (month !== undefined) qs.push(`month=${month}`);
      if (qs.length) path += '?' + qs.join('&');
      const tgs = await api<MonthTarget[]>('GET', path);
      writeCache({ targets: tgs });
      return tgs;
    } catch {}
  }
  const c = readCache();
  const list = c ? c.targets : [];
  let out = list;
  if (year !== undefined) out = out.filter(t => t.year === year);
  if (month !== undefined) out = out.filter(t => t.month === month);
  return out;
}

export async function upsertMonthTarget(year: number, month: number, target: number): Promise<MonthTarget> {
  const owner = getOwnerToken();
  const tg: MonthTarget = { user_id: owner, year, month, target };
  const c = readCache();
  const list = c ? c.targets : [];
  const idx = list.findIndex(t => t.year === year && t.month === month);
  if (idx >= 0) list[idx] = { ...tg, id: list[idx].id };
  else list.push(tg);
  writeCache({ targets: list });

  if (navigator.onLine) {
    try {
      await api('PUT', '/targets', { year, month, target });
    } catch { /* 本地已更新 */ }
  }
  return tg;
}
