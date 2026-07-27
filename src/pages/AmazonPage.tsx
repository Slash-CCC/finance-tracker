import { useState } from 'react';
import type { Record, UserSettings } from '../supabase';
import { fmt, nowBJ, AMAZON_EXPENSE, AMAZON_INCOME } from './utils';

interface Props {
  records: Record[];
  settings: UserSettings | null;
}

const PERIODS = [
  { label: '1天', days: 1 },
  { label: '3天', days: 3 },
  { label: '7天', days: 7 },
  { label: '30天', days: 30 },
  { label: '半年', days: 183 },
  { label: '1年', days: 365 },
];

export default function AmazonPage({ records, settings }: Props) {
  const [days, setDays] = useState<number | null>(30);
  const [cs, setCs] = useState('');
  const [ce, setCe] = useState('');
  const [cm, setCm] = useState(false);

  const amz = records.filter(
    r => (r.type === 'expense' && r.category === AMAZON_EXPENSE) ||
         (r.type === 'income' && r.category === AMAZON_INCOME)
  );

  let start = '';
  let end = '';
  if (cm && cs && ce) {
    start = new Date(cs + 'T00:00:00+08:00').toISOString();
    end = new Date(ce + 'T23:59:59+08:00').toISOString();
  } else if (days !== null) {
    end = nowBJ();
    start = new Date(Date.now() - days * 86400000).toISOString();
  }

  const rs = start && end ? amz.filter(r => r.timestamp >= start && r.timestamp <= end) : amz;
  const inc = rs.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0);
  const exp = rs.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0);
  const profit = inc - exp;

  const totalInc = records.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0);
  const totalExp = records.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0);
  const bal = (settings?.initial_balance || 0) + totalInc - totalExp;

  const ip = totalInc > 0 ? inc / totalInc * 100 : 0;
  const ep = totalExp > 0 ? exp / totalExp * 100 : 0;
  const pp = bal > 0 ? profit / bal * 100 : 0;

  return (
    <div className="page-enter p-6">
      <h2 className="text-[20px] font-bold mb-6">📦 亚马逊</h2>

      {/* 时间选择 */}
      <div className="card p-4 mb-6">
        <div className="flex flex-wrap gap-2 mb-3">
          {PERIODS.map(p => (
            <button
              key={p.label}
              onClick={() => { setDays(p.days); setCm(false); }}
              className={`px-4 py-2 rounded-xl text-[13px] font-medium transition-all ${
                !cm && days === p.days
                  ? 'bg-[var(--apple-orange)] text-white'
                  : 'bg-[var(--apple-gray-1)] text-[var(--apple-text-secondary)] hover:bg-[var(--apple-gray-2)]'
              }`}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={() => setCm(true)}
            className={`px-4 py-2 rounded-xl text-[13px] font-medium transition-all ${
              cm
                ? 'bg-[var(--apple-orange)] text-white'
                : 'bg-[var(--apple-gray-1)] text-[var(--apple-text-secondary)] hover:bg-[var(--apple-gray-2)]'
            }`}
          >
            自定义
          </button>
        </div>
        {cm && (
          <div className="flex gap-2 items-center">
            <input
              type="date"
              value={cs}
              onChange={e => setCs(e.target.value)}
              className="input-apple text-[13px] flex-1"
            />
            <span className="text-[var(--apple-text-secondary)] text-[13px]">至</span>
            <input
              type="date"
              value={ce}
              onChange={e => setCe(e.target.value)}
              className="input-apple text-[13px] flex-1"
            />
          </div>
        )}
      </div>

      {/* 数据卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <DataCard label="亚马逊收入" value={inc} color="text-[var(--apple-green)]" />
        <DataCard label="亚马逊支出" value={exp} color="text-[var(--apple-red)]" />
        <DataCard label="利润" value={profit} color={profit >= 0 ? 'text-[var(--apple-blue)]' : 'text-[var(--apple-red)]'} />
        <DataCard label="利润占比" value={pp} color="text-[var(--apple-text)]" isPct />
      </div>

      {/* 占比进度条 */}
      <div className="card p-6">
        <h3 className="text-[15px] font-semibold text-[var(--apple-text-secondary)] mb-5">占总个人资金比例</h3>
        <div className="space-y-4">
          <PctRow label="亚马逊收入" value={ip} color="bg-[var(--apple-green)]" />
          <PctRow label="亚马逊支出" value={ep} color="bg-[var(--apple-red)]" />
          <PctRow label="亚马逊利润" value={pp} color="bg-[var(--apple-blue)]" />
        </div>
      </div>
    </div>
  );
}

function DataCard({ label, value, color, isPct }: { label: string; value: number; color: string; isPct?: boolean }) {
  return (
    <div className="card p-5">
      <div className="text-[13px] text-[var(--apple-text-secondary)] mb-2">{label}</div>
      <div className={`text-xl md:text-2xl font-bold amount-font ${color}`}>
        {isPct ? value.toFixed(1) + '%' : fmt(value)}
      </div>
    </div>
  );
}

function PctRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[15px] text-[var(--apple-text-secondary)] w-24">{label}</span>
      <div className="flex-1 h-2 bg-[var(--apple-gray-2)] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-500`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      <span className="text-[13px] font-medium text-[var(--apple-text)] w-14 text-right">
        {value.toFixed(1)}%
      </span>
    </div>
  );
}
