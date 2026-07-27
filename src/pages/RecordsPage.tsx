import { useState } from 'react';
import type { Record } from '../supabase';
import { getAllRecords } from '../supabase';
import { fmt, formatDate, formatTime } from './utils';

interface Props {
  records: Record[];
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

  const allCats = [...new Set(records.map(r => r.category))];

  // 按日期分组
  const grouped: { date: string; items: Record[]; subtotal: number }[] = [];
  let lastDate = '';
  for (const r of filtered) {
    const d = formatDate(r.timestamp);
    if (d !== lastDate) {
      lastDate = d;
      grouped.push({ date: d, items: [], subtotal: 0 });
    }
    const group = grouped[grouped.length - 1];
    group.items.push(r);
    group.subtotal += r.type === 'expense' ? -r.amount : r.amount;
  }

  async function exportCSV() {
    setExporting(true);
    let data = filtered;
    if (!ds && !de && ft === 'all' && !fcat) data = await getAllRecords();
    const h = '\uFEFF类型,金额,分类,详细说明,亲属卡,时间\n';
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

  return (
    <div className="page-enter p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-[20px] font-bold">明细</h2>
        <div className="flex gap-2">
          <button onClick={exportCSV} disabled={exporting} className="btn-ghost text-[13px]">
            {exporting ? '导出中...' : 'CSV'}
          </button>
          <button onClick={exportJSON} disabled={exporting} className="btn-ghost text-[13px]">
            JSON
          </button>
        </div>
      </div>

      {/* 筛选栏 */}
      <div className="card p-4 mb-6 space-y-3">
        {/* 类型筛选 */}
        <div className="segment">
          <button className={ft === 'all' ? 'active' : ''} onClick={() => setFt('all')}>全部</button>
          <button className={ft === 'expense' ? 'active' : ''} onClick={() => setFt('expense')}>支出</button>
          <button className={ft === 'income' ? 'active' : ''} onClick={() => setFt('income')}>收入</button>
        </div>

        {/* 分类下拉 */}
        <select
          value={fcat}
          onChange={e => setFcat(e.target.value)}
          className="input-apple text-[13px]"
        >
          <option value="">全部分类</option>
          {allCats.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* 日期范围 */}
        <div className="flex gap-2 items-center">
          <input
            type="date"
            value={ds}
            onChange={e => setDs(e.target.value)}
            className="input-apple text-[13px] flex-1"
          />
          <span className="text-[var(--apple-text-secondary)] text-[13px]">至</span>
          <input
            type="date"
            value={de}
            onChange={e => setDe(e.target.value)}
            className="input-apple text-[13px] flex-1"
          />
        </div>
      </div>

      {/* 记录列表 */}
      {grouped.length === 0 ? (
        <div className="card p-8 text-center">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-[15px] text-[var(--apple-text-secondary)]">暂无匹配记录</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(group => (
            <div key={group.date}>
              {/* 日期标题 */}
              <div className="flex justify-between items-center mb-3 px-1">
                <span className="text-[15px] font-semibold text-[var(--apple-text)]">{group.date}</span>
                <span className={`text-[13px] font-medium amount-font ${
                  group.subtotal >= 0 ? 'text-[var(--apple-green)]' : 'text-[var(--apple-red)]'
                }`}>
                  当日小计 {fmt(group.subtotal)}
                </span>
              </div>
              {/* 当日记录 */}
              <div className="space-y-2">
                {group.items.map(r => (
                  <RecordRow key={r.id} record={r} onDelete={onDelete} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
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
          {formatTime(record.timestamp)}
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
