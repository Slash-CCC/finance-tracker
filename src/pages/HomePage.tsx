import { useState, useEffect } from 'react';
import { fmt, mk, getCurMonth, formatDate, formatTime } from './utils';
import type { Record as FinRecord, MonthTarget, UserSettings } from '../supabase';

interface Props {
  records: FinRecord[];
  settings: UserSettings | null;
  targets: MonthTarget[];
  onSetBalance: (v: number) => Promise<void>;
  onSetTarget: (y: number, m: number, v: number) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export default function HomePage({ records, settings, targets, onSetBalance, onSetTarget, onDelete }: Props) {
  const cur = getCurMonth();
  const [showSetup, setShowSetup] = useState(false);
  const [showTarget, setShowTarget] = useState(false);

  useEffect(() => {
    setShowSetup(!settings);
  }, [settings]);

  useEffect(() => {
    const today = new Date().getDate();
    const has = targets.some(t => t.year === cur.year && t.month === cur.month);
    if (today === 1 && !has) setShowTarget(true);
  }, [targets, cur.year, cur.month]);

  const initialBalance = Number(settings?.initial_balance ?? 0);
  const totalIncome = records.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0);
  const totalExpense = records.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0);
  const balance = initialBalance + totalIncome - totalExpense;

  const monthRecords = records.filter(r => {
    const d = new Date(r.timestamp);
    return d.getFullYear() === cur.year && d.getMonth() + 1 === cur.month;
  });
  const mInc = monthRecords.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0);
  const mExp = monthRecords.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0);
  const mNet = mInc - mExp;

  let avg6 = 0;
  for (let i = 5; i >= 0; i--) {
    const d = new Date(cur.year, cur.month - 1 - i, 1);
    const y = d.getFullYear(), m = d.getMonth() + 1;
    const rs = records.filter(r => {
      const rd = new Date(r.timestamp);
      return rd.getFullYear() === y && rd.getMonth() + 1 === m;
    });
    avg6 += rs.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0) - rs.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0);
  }
  avg6 /= 6;

  const curTarget = targets.find(t => t.year === cur.year && t.month === cur.month);
  const recent = records.slice(0, 10);

  return (
    <div className="page-enter p-4 md:p-8">
      <h2 className="text-2xl font-bold mb-6 tracking-tight hidden md:block">总览</h2>

      {/* 总余额 */}
      <div className="card p-7 mb-5 text-center">
        <div className="text-sm text-gray-500 mb-1">个人总余额</div>
        <div className={`text-4xl md:text-5xl font-bold amount-font tracking-tight ${balance >= 0 ? 'text-gray-900' : 'text-red-500'}`}>
          {fmt(balance)}
        </div>
      </div>

      {/* 月度概览 */}
      <div className="card p-7 mb-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold">{mk(cur.year, cur.month)} 月度概览</h3>
          {curTarget && <span className="text-xs text-gray-500">目标 {fmt(curTarget.target)}</span>}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="本月收入" value={mInc} color="text-green-500" />
          <Stat label="本月支出" value={mExp} color="text-red-500" />
          <Stat label="净结余" value={mNet} color={mNet >= 0 ? 'text-blue-500' : 'text-red-500'} />
          <Stat label="6月均结余" value={avg6} color={avg6 >= 0 ? 'text-gray-700' : 'text-red-400'} />
        </div>
        {curTarget && (
          <div className="mt-5 pt-4 border-t border-gray-100">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-500">结余进度</span>
              <span className={mNet >= curTarget.target ? 'text-green-500 font-semibold' : 'text-orange-500 font-semibold'}>
                {fmt(mNet)} / {fmt(curTarget.target)} ({curTarget.target > 0 ? Math.round(mNet / curTarget.target * 100) : 0}%)
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${mNet >= curTarget.target ? 'bg-green-500' : 'bg-blue-500'}`}
                style={{ width: `${Math.min(Math.max((mNet / (curTarget.target || 1)) * 100, 0), 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 最近记录 */}
      <div className="card p-6">
        <h3 className="text-base font-semibold mb-4">最近记录</h3>
        {recent.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">暂无记录，点击下方 + 开始记账</div>
        ) : (
          <div className="space-y-3">
            {recent.map(r => (
              <RecordRow key={r.id} r={r} onDelete={onDelete} />
            ))}
          </div>
        )}
      </div>

      {showSetup && <SetupModal onSubmit={async (v) => { await onSetBalance(v); setShowSetup(false); }} />}
      {showTarget && <TargetModal year={cur.year} month={cur.month} onSubmit={async (v) => { await onSetTarget(cur.year, cur.month, v); setShowTarget(false); }} />}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-lg md:text-xl font-bold amount-font ${color}`}>{fmt(value)}</div>
    </div>
  );
}

function RecordRow({ r, onDelete }: { r: FinRecord; onDelete: (id: string) => Promise<void> }) {
  const [confirm, setConfirm] = useState(false);

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-base ${r.type === 'expense' ? 'bg-red-50' : 'bg-green-50'}`}>
        {r.type === 'expense' ? '💸' : '💰'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">
          {r.category}
          {r.detail ? ` - ${r.detail}` : ''}
          {r.is_family_card && <span className="ml-2 text-[10px] text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded-md">亲属卡</span>}
        </div>
        <div className="text-xs text-gray-400">{formatDate(r.timestamp)} {formatTime(r.timestamp)}</div>
      </div>
      <div className={`text-base font-bold amount-font ${r.type === 'expense' ? 'text-red-500' : 'text-green-500'}`}>
        {r.type === 'expense' ? '-' : '+'}{fmt(r.amount)}
      </div>
      {confirm ? (
        <button onClick={() => { onDelete(r.id); setConfirm(false); }} className="text-xs bg-red-500 text-white px-3 py-1.5 rounded-lg">删除</button>
      ) : (
        <button onClick={() => setConfirm(true)} className="text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity px-2">删除</button>
      )}
    </div>
  );
}

function SetupModal({ onSubmit }: { onSubmit: (v: number) => Promise<void> }) {
  const [v, setV] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function h() {
    const n = parseFloat(v);
    if (n >= 0) {
      setSubmitting(true);
      await onSubmit(n);
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.35)' }}>
      <div className="card w-full max-w-[360px] p-6 scale-in">
        <div className="text-3xl mb-3">💰</div>
        <h3 className="text-lg font-bold mb-1">设置初始余额</h3>
        <p className="text-sm text-gray-500 mb-5">请输入您当前的个人总余额</p>
        <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-3 mb-5">
          <span className="text-xl text-gray-400">¥</span>
          <input type="number" inputMode="decimal" placeholder="0.00" value={v} onChange={e => setV(e.target.value)} className="flex-1 text-xl font-bold outline-none amount-font bg-transparent" autoFocus onKeyDown={e => e.key === 'Enter' && h()} />
        </div>
        <button onClick={h} disabled={v === '' || submitting} className="btn-primary w-full flex items-center justify-center gap-2">{submitting && <div className="spinner" />}确认</button>
      </div>
    </div>
  );
}

function TargetModal({ year, month, onSubmit }: { year: number; month: number; onSubmit: (v: number) => Promise<void> }) {
  const [v, setV] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function h() {
    const n = parseFloat(v);
    if (n >= 0) {
      setSubmitting(true);
      await onSubmit(n);
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.35)' }}>
      <div className="card w-full max-w-[360px] p-6 scale-in">
        <div className="text-3xl mb-3">🎯</div>
        <h3 className="text-lg font-bold mb-1">设置本月结余目标</h3>
        <p className="text-sm text-gray-500 mb-5">{year}年{month}月</p>
        <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-3 mb-5">
          <span className="text-xl text-gray-400">¥</span>
          <input type="number" inputMode="decimal" placeholder="0.00" value={v} onChange={e => setV(e.target.value)} className="flex-1 text-xl font-bold outline-none amount-font bg-transparent" autoFocus onKeyDown={e => e.key === 'Enter' && h()} />
        </div>
        <div className="flex gap-3">
          <button onClick={async () => { setSubmitting(true); await onSubmit(0); setSubmitting(false); }} className="btn-secondary flex-1 text-sm">跳过</button>
          <button onClick={h} disabled={v === '' || submitting} className="btn-primary flex-1 flex items-center justify-center gap-2">{submitting && <div className="spinner" />}设置</button>
        </div>
      </div>
    </div>
  );
}
