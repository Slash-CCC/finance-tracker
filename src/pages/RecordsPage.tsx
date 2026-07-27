import { useState } from 'react';
import { fmt, formatDate, formatTime } from './utils';
import type { Record as FinRecord } from '../supabase';
import { getAllRecords } from '../supabase';

interface Props {
  records: FinRecord[];
  onDelete: (id: string) => Promise<void>;
}

export default function RecordsPage({ records, onDelete }: Props) {
  const [ft, setFt] = useState<'all' | 'expense' | 'income'>('all');
  const [fcat, setFcat] = useState('');
  const [ds, setDs] = useState('');
  const [de, setDe] = useState('');
  const [exporting, setExporting] = useState(false);

  let filtered = records;
  if (ft !== 'all') filtered = filtered.filter(r => r.type === ft);
  if (fcat) filtered = filtered.filter(r => r.category === fcat);
  if (ds) filtered = filtered.filter(r => r.timestamp >= new Date(ds + 'T00:00:00+08:00').toISOString());
  if (de) filtered = filtered.filter(r => r.timestamp <= new Date(de + 'T23:59:59+08:00').toISOString());

  const allCats = [...new Set(records.map(r => r.category))].sort();

  async function exportCSV() {
    setExporting(true);
    let data = filtered;
    if (!ds && !de && ft === 'all' && !fcat) data = await getAllRecords();
    const h = '﻿类型,金额,分类,详细说明,亲属卡,时间\n';
    const rows = data.map(r => {
      const t = r.type === 'income' ? '收入' : '支出';
      const fc = r.type === 'expense' ? (r.is_family_card ? '是' : '否') : '-';
      return [t, r.amount.toFixed(2), r.category, r.detail || '', fc, formatDate(r.timestamp) + ' ' + formatTime(r.timestamp)].join(',');
    }).join('\n');
    const blob = new Blob([h + rows], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `财政记录_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  }

  async function exportJSON() {
    setExporting(true);
    let data = filtered;
    if (!ds && !de && ft === 'all' && !fcat) data = await getAllRecords();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `财政记录_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  }

  // 按日期分组
  const groups: { date: string; records: FinRecord[]; dayIncome: number; dayExpense: number }[] = [];
  for (const r of filtered) {
    const d = formatDate(r.timestamp);
    const g = groups.find(x => x.date === d);
    if (g) {
      g.records.push(r);
      if (r.type === 'income') g.dayIncome += r.amount;
      else g.dayExpense += r.amount;
    } else {
      groups.push({
        date: d,
        records: [r],
        dayIncome: r.type === 'income' ? r.amount : 0,
        dayExpense: r.type === 'expense' ? r.amount : 0,
      });
    }
  }

  return (
    <div className="page-enter p-4 md:p-8">
      <h2 className="text-2xl font-bold mb-6 tracking-tight hidden md:block">明细</h2>

      <div className="card" style={{padding:32,marginBottom:20}}>
        <div className="flex gap-2 flex-wrap">
          {(['all', 'expense', 'income'] as const).map(t => (
            <button
              key={t}
              onClick={() => setFt(t)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                ft === t ? 'bg-blue-500 text-white shadow-sm' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              {t === 'all' ? '全部' : t === 'expense' ? '支出' : '收入'}
            </button>
          ))}
          <select value={fcat} onChange={e => setFcat(e.target.value)} className="flex-1 min-w-[120px] bg-gray-50 rounded-xl px-4 py-2 text-sm outline-none">
            <option value="">全部分类</option>
            {allCats.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex gap-3 items-center text-sm">
          <input type="date" value={ds} onChange={e => setDs(e.target.value)} className="flex-1 bg-gray-50 rounded-xl px-4 py-2.5 outline-none text-sm" />
          <span className="text-gray-400">至</span>
          <input type="date" value={de} onChange={e => setDe(e.target.value)} className="flex-1 bg-gray-50 rounded-xl px-4 py-2.5 outline-none text-sm" />
        </div>
        <div className="flex gap-3">
          <button onClick={exportCSV} disabled={exporting} className="btn-secondary flex-1 text-sm py-2.5">{exporting ? '导出中...' : '导出 CSV'}</button>
          <button onClick={exportJSON} disabled={exporting} className="btn-secondary flex-1 text-sm py-2.5">导出 JSON</button>
        </div>
      </div>

      <div className="space-y-4 pb-24 md:pb-0">
        {groups.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm card">暂无匹配记录</div>
        ) : groups.map(g => (
          <div key={g.date} className="card" style={{padding:32}}>
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-100">
              <span className="text-sm font-semibold text-gray-700">{g.date}</span>
              <div className="flex gap-3 text-xs">
                {g.dayIncome > 0 && <span className="text-green-500 font-medium">收 {fmt(g.dayIncome)}</span>}
                {g.dayExpense > 0 && <span className="text-red-500 font-medium">支 {fmt(g.dayExpense)}</span>}
              </div>
            </div>
            <div className="space-y-2">
              {g.records.map(r => (
                <RecordRow key={r.id} r={r} onDelete={onDelete} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecordRow({ r, onDelete }: { r: FinRecord; onDelete: (id: string) => Promise<void> }) {
  const [confirm, setConfirm] = useState(false);

  return (
    <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors group">
      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm ${r.type === 'expense' ? 'bg-red-50' : 'bg-green-50'}`}>
        {r.type === 'expense' ? '💸' : '💰'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">
          {r.category}
          {r.detail ? ` - ${r.detail}` : ''}
          {r.is_family_card && <span className="ml-2 text-[10px] text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded-md">亲属卡</span>}
        </div>
        <div className="text-xs text-gray-400">{formatTime(r.timestamp)}</div>
      </div>
      <div className={`text-sm font-bold amount-font ${r.type === 'expense' ? 'text-red-500' : 'text-green-500'}`}>
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
