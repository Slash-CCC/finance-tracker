import { useState } from 'react';
import { fmt, nowBJ, AMAZON_EXPENSE, AMAZON_INCOME } from './utils';
import type { Record as FinRecord, UserSettings } from '../supabase';

interface Props {
  records: FinRecord[];
  settings: UserSettings | null;
}

export default function AmazonPage({ records, settings }: Props) {
  const periods = [
    { l: '1天', d: 1 },
    { l: '3天', d: 3 },
    { l: '7天', d: 7 },
    { l: '30天', d: 30 },
    { l: '半年', d: 183 },
    { l: '1年', d: 365 },
  ];

  const [days, setDays] = useState<number | null>(30);
  const [cs, setCs] = useState('');
  const [ce, setCe] = useState('');
  const [cm, setCm] = useState(false);

  const amz = records.filter(r =>
    (r.type === 'expense' && r.category === AMAZON_EXPENSE) ||
    (r.type === 'income' && r.category === AMAZON_INCOME)
  );

  let start = '', end = '';
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
  const ip = totalInc > 0 ? (inc / totalInc) * 100 : 0;
  const ep = totalExp > 0 ? (exp / totalExp) * 100 : 0;
  const pp = bal > 0 ? (profit / bal) * 100 : 0;

  return (
    <div className="page-enter p-4 md:p-8">
      <h2 className="text-2xl font-bold mb-6 tracking-tight hidden md:block">亚马逊</h2>

      <div className="card p-7 mb-5">
        <div className="flex flex-wrap gap-2 mb-4">
          {periods.map(p => (
            <button
              key={p.l}
              onClick={() => { setDays(p.d); setCm(false); }}
              className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all ${
                !cm && days === p.d ? 'bg-orange-500 text-white shadow-sm' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              {p.l}
            </button>
          ))}
          <button onClick={() => setCm(true)} className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all ${cm ? 'bg-orange-500 text-white shadow-sm' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>自定义</button>
        </div>
        {cm && (
          <div className="flex gap-3 items-center text-sm">
            <input type="date" value={cs} onChange={e => setCs(e.target.value)} className="flex-1 bg-gray-50 rounded-xl px-4 py-2.5 outline-none" />
            <span className="text-gray-400">至</span>
            <input type="date" value={ce} onChange={e => setCe(e.target.value)} className="flex-1 bg-gray-50 rounded-xl px-4 py-2.5 outline-none" />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-5">
        <div className="card p-6">
          <div className="text-xs text-gray-500 mb-1">亚马逊收入</div>
          <div className="text-xl font-bold amount-font text-green-500">{fmt(inc)}</div>
        </div>
        <div className="card p-6">
          <div className="text-xs text-gray-500 mb-1">亚马逊支出</div>
          <div className="text-xl font-bold amount-font text-red-500">{fmt(exp)}</div>
        </div>
        <div className="card p-6">
          <div className="text-xs text-gray-500 mb-1">利润</div>
          <div className={`text-xl font-bold amount-font ${profit >= 0 ? 'text-blue-500' : 'text-red-500'}`}>{fmt(profit)}</div>
        </div>
        <div className="card p-6">
          <div className="text-xs text-gray-500 mb-1">利润占比</div>
          <div className="text-xl font-bold amount-font text-gray-800">{pp.toFixed(1)}%</div>
        </div>
      </div>

      <div className="card p-6">
        <h3 className="text-base font-semibold mb-4">占总个人资金比例</h3>
        <div className="space-y-4">
          <PctBar label="亚马逊收入占比" v={ip} color="bg-green-500" />
          <PctBar label="亚马逊支出占比" v={ep} color="bg-red-500" />
          <PctBar label="亚马逊利润占比" v={pp} color="bg-blue-500" />
        </div>
      </div>
    </div>
  );
}

function PctBar({ label, v, color }: { label: string; v: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-2">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium text-gray-800">{v.toFixed(1)}%</span>
      </div>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(v, 100)}%` }} />
      </div>
    </div>
  );
}
