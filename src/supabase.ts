import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eozdliognoqryvptwjcp.supabase.co';
const supabaseAnonKey = 'sb_publishable_c2vRrZhjaoVTGOimn6ioJA_gx5byokf';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ==================== 类型 ====================

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
  id: string;
  user_id: string;
  year: number;
  month: number;
  target: number;
}

export interface UserSettings {
  id: string;
  user_id: string;
  initial_balance: number;
}

// ==================== API ====================

// 用户设置
export async function getUserSettings() {
  const { data, error } = await supabase.from('user_settings').select('*').single();
  if (error && error.code === 'PGRST116') return null; // 未设置
  if (error) throw error;
  return data as UserSettings;
}

export async function upsertUserSettings(balance: number) {
  const user = await supabase.auth.getUser();
  const userId = user.data.user?.id;
  if (!userId) throw new Error('未登录');
  const { data, error } = await supabase
    .from('user_settings')
    .upsert({ user_id: userId, initial_balance: balance }, { onConflict: 'user_id' })
    .select()
    .single();
  if (error) throw error;
  return data as UserSettings;
}

// 月度目标
export async function getMonthTargets(year?: number, month?: number) {
  let q = supabase.from('month_targets').select('*');
  if (year) q = q.eq('year', year);
  if (month) q = q.eq('month', month);
  const { data, error } = await q;
  if (error) throw error;
  return data as MonthTarget[];
}

export async function upsertMonthTarget(year: number, month: number, target: number) {
  const user = await supabase.auth.getUser();
  const userId = user.data.user?.id;
  if (!userId) throw new Error('未登录');
  const { data, error } = await supabase
    .from('month_targets')
    .upsert({ user_id: userId, year, month, target }, { onConflict: 'user_id,year,month' })
    .select()
    .single();
  if (error) throw error;
  return data as MonthTarget;
}

// 记录 CRUD
export async function getRecords(limit = 500) {
  const { data, error } = await supabase
    .from('records')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as Record[];
}

export async function getRecordsInRange(start: string, end: string) {
  const { data, error } = await supabase
    .from('records')
    .select('*')
    .gte('timestamp', start)
    .lte('timestamp', end)
    .order('timestamp', { ascending: false });
  if (error) throw error;
  return data as Record[];
}

export async function addRecord(r: {
  type: 'expense' | 'income';
  amount: number;
  category: string;
  detail?: string;
  is_family_card?: boolean;
}) {
  const user = await supabase.auth.getUser();
  const userId = user.data.user?.id;
  if (!userId) throw new Error('未登录');
  const { data, error } = await supabase
    .from('records')
    .insert({
      user_id: userId,
      type: r.type,
      amount: r.amount,
      category: r.category,
      detail: r.detail || null,
      is_family_card: r.type === 'expense' ? (r.is_family_card || false) : false,
      timestamp: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data as Record;
}

export async function deleteRecord(id: string) {
  const { error } = await supabase.from('records').delete().eq('id', id);
  if (error) throw error;
}

// 获取所有记录（用于导出）
export async function getAllRecords() {
  const all: Record[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('records')
      .select('*')
      .order('timestamp', { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}
