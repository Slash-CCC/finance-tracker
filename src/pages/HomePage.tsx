import { useState, useEffect } from 'react';
import type { Record, MonthTarget, UserSettings } from '../supabase';
import { fmt, formatDate, formatTime, mk, getCurMonth } from './utils';

interface Props {
  records: Record[];
  settings: UserSettings | null;
  targets: MonthTarget[];
  onSetBalance: (balance: number) => Promise<void>;
  onSetTarget: (year: number, month: number, target: number) => Promise<void>;
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
    const has = targets.some((t) => t.year === cur.year && t.month === cur.month);
    if (today === 1 && !has) setShowTarget(true);
  }, [targets, cur.year, cur.month]);

  const initialBalance = Number(settings?.initial_balance ?? 0);
  const totalIncome = records.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0);
  const totalExpense = records.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0);
  const balance = settings ? initialBalance + totalIncome - totalExpense : 0;

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
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const rs = records.filter(r => {
      const rd = new Date(r.timestamp);
      return rd.getFullYear() === y && rd.getMonth() + 1 === m;
    });
    avg6 += rs.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0)
         - rs.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0);
  }
  avg6 /= 6;

  const curTarget = targets.find(t => t.year === cur.year && t.month === cur.month);
  const recent = records.slice(0, 15);

  return (
    <div className="page-enter p-6">
      {/* 余额区域 */}
      <div className="text-center mb-8">
        <div className="text-[13px] text-[var(--apple-text-secondary)] mb-2">个人总余额</div>
        <div className={`text-[40px] font-bold amount-font tracking-tight ${
          balance >= 0 ? 'text-[var(--apple-text)]' : 'text-[var(--apple-red)]'
        }`}>
          {fmt(balance)}
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="本月收入" value={mInc} color="text-[var(--apple-green)]" />
        <StatCard label="本月支出" value={mExp} color="text-[var(--apple-red)]" />
        <StatCard label="本月净结余" value={mNet} color={mNet >= 0 ? 'text-[var(--apple-blue)]' : 'text-[var(--apple-red)]'} />
        <StatCard label="6月均结余" value={avg6} color={avg6 >= 0 ? 'text-[var(--apple-text)]' : 'text-[var(--apple-red)]'} />
      </div>

      {/* 预算进度 */}
      {curTarget && (
        <div className="card p-5 mb-8">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[15px] font-semibold text-[var(--apple-text-secondary)]">
              {mk(cur.year, cur.month)} 结余目标
            </span>
            <span className={`text-[15px] font-semibold amount-font ${
              mNet >= curTarget.target ? 'text-[var(--apple-green)]' : 'text-[var(--apple-orange)]'
            }`}>
              {fmt(mNet)} / {fmt(curTarget.target)}
            </span>
          </div>
          <div className="h-2 bg-[var(--apple-gray-2)] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                mNet >= curTarget.target ? 'bg-[var(--apple-green)]' : 'bg-[var(--apple-blue)]'
              }`}
              style={{ width: `${Math.min(curTarget.target > 0 ? (mNet / curTarget.target) * 100 : 0, 100)}%` }}
            />
          </div>
          <div className="text-right mt-1.5">
            <span className="text-[13px] text-[var(--apple-text-secondary)]">
              {curTarget.target > 0 ? Math.round(mNet / curTarget.target * 100) : 0}%
            </span>
          </div>
        </div>
      )}

      {/* 最近记录 */}
      <div>
        <h3 className="text-[17px] font-semibold text-[var(--apple-text)] mb-4">最近记录</h3>
        {recent.length === 0 ? (
          <div className="card p-8 text-center">
            <div className="text-4xl mb-3">📝</div>
            <p className="text-[15px] text-[var(--apple-text-secondary)] mb-4">暂无记录</p>
            <p className="text-[13px] text-[var(--apple-text-secondary)]">点击下方 + 开始记账</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recent.map(r => (
              <RecordRow key={r.id} record={r} onDelete={onDelete} />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {showSetup && (
        <SetupModal
          onSubmit={async (v) => {
            await onSetBalance(v);
            setShowSetup(false);
          }}
        />
      )}
      {showTarget && (
        <TargetModal
          year={cur.year}
          month={cur.month}
          onSubmit={async (t) => {
            await onSetTarget(cur.year, cur.month, t);
            setShowTarget(false);
          }}
        />
      )}
    </div>
  );
}

// ===== 子组件 =====

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="card p-5">
      <div className="text-[13px] text-[var(--apple-text-secondary)] mb-2">{label}</div>
      <div className={`text-xl md:text-2xl font-bold amount-font ${color}`}>{fmt(value)}</div>
    </div>
  );
}

function RecordRow({ record, onDelete }: { record: Record; onDelete: (id: string) => Promise<void> }) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="card p-4 flex items-center gap-3 group relative">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0 ${
        record.type === 'expense' ? 'bg-red-50' : 'bg-green-50'
      }`}>
        {record.type === 'expense' ? '💸' : '💰'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-medium truncate flex items-center gap-2">
          {record.category}
          {record.detail && (
            <span className="text-[13px] text-[var(--apple-text-secondary)] truncate">- {record.detail}</span>
          )}
          {record.is_family_card && (
            <span className="text-[11px] text-[var(--apple-orange)] bg-orange-50 px-1.5 py-0.5 rounded-md flex-shrink-0">
              亲属卡
            </span>
          )}
        </div>
        <div className="text-[13px] text-[var(--apple-text-secondary)] mt-0.5">
          {formatDate(record.timestamp)} {formatTime(record.timestamp)}
        </div>
      </div>
      <div className={`text-[17px] font-bold amount-font flex-shrink-0 ${
        record.type === 'expense' ? 'text-[var(--apple-red)]' : 'text-[var(--apple-green)]'
      }`}>
        {record.type === 'expense' ? '-' : '+'}{fmt(record.amount)}
      </div>
      {!confirmDelete ? (
        <button
          onClick={() => setConfirmDelete(true)}
          className="opacity-0 group-hover:opacity-100 text-[var(--apple-red)] text-[13px] font-medium hover:bg-red-50 px-2 py-1 rounded-lg transition-all"
        >
          删除
        </button>
      ) : (
        <div className="flex items-center gap-1">
          <button
            onClick={async () => { await onDelete(record.id); }}
            className="btn-danger text-[13px] px-3 py-1.5"
          >
            确认
          </button>
          <button
            onClick={() => setConfirmDelete(false)}
            className="btn-ghost text-[13px] px-2 py-1.5"
          >
            取消
          </button>
        </div>
      )}
    </div>
  );
}

function SetupModal({ onSubmit }: { onSubmit: (v: number) => Promise<void> }) {
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handle = async () => {
    const n = parseFloat(value);
    if (isNaN(n) || n < 0) return;
    setSubmitting(true);
    await onSubmit(n);
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="card p-6 w-full max-w-sm scale-in">
        <div className="text-4xl mb-4">💰</div>
        <h2 className="text-[20px] font-bold mb-2">设置初始余额</h2>
        <p className="text-[15px] text-[var(--apple-text-secondary)] mb-6">请输入您当前的个人总余额</p>
        <div className="flex items-center gap-3 bg-[var(--apple-gray-1)] rounded-xl px-4 py-3 mb-6">
          <span className="text-xl text-[var(--apple-text-secondary)]">¥</span>
          <input
            type="number"
            inputMode="decimal"
            placeholder="0.00"
            value={value}
            onChange={e => setValue(e.target.value)}
            className="flex-1 text-xl font-bold outline-none bg-transparent amount-font"
            autoFocus
            onKeyDown={e => e.key === 'Enter' && handle()}
          />
        </div>
        <button
          onClick={handle}
          disabled={!value || submitting}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          {submitting && <div className="spinner" />}
          确认
        </button>
      </div>
    </div>
  );
}

function TargetModal({ year, month, onSubmit }: { year: number; month: number; onSubmit: (v: number) => Promise<void> }) {
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handle = async () => {
    const n = parseFloat(value);
    if (isNaN(n) || n < 0) return;
    setSubmitting(true);
    await onSubmit(n);
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="card p-6 w-full max-w-sm scale-in">
        <div className="text-4xl mb-4">🎯</div>
        <h2 className="text-[20px] font-bold mb-2">设置本月结余目标</h2>
        <p className="text-[15px] text-[var(--apple-text-secondary)] mb-6">{year}年{month}月</p>
        <div className="flex items-center gap-3 bg-[var(--apple-gray-1)] rounded-xl px-4 py-3 mb-6">
          <span className="text-xl text-[var(--apple-text-secondary)]">¥</span>
          <input
            type="number"
            inputMode="decimal"
            placeholder="0.00"
            value={value}
            onChange={e => setValue(e.target.value)}
            className="flex-1 text-xl font-bold outline-none bg-transparent amount-font"
            autoFocus
            onKeyDown={e => e.key === 'Enter' && handle()}
          />
        </div>
        <div className="flex gap-3">
          <button onClick={() => onSubmit(0)} className="btn-secondary flex-1">
            跳过
          </button>
          <button
            onClick={handle}
            disabled={!value || submitting}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            {submitting && <div className="spinner" />}
            设置
          </button>
        </div>
      </div>
    </div>
  );
}
