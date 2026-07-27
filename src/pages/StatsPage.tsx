import { useState } from 'react';
import { fmt, getCurMonth } from './utils';
import type { Record as FinRecord, MonthTarget } from '../supabase';

interface Props {
  records: FinRecord[];
  targets: MonthTarget[];
}

export default function StatsPage({ records, targets }: Props) {
  const cur = getCurMonth();
  const [vy, setVy] = useState(cur.year);
  const [vm, setVm] = useState(cur.month);

  const mr = records.filter(r => {
    const d = new Date(r.timestamp);
    return d.getFullYear() === vy && d.getMonth() + 1 === vm;
  });

  const pm = vm === 1 ? 12 : vm - 1;
  const py = vm === 1 ? vy - 1 : vy;
  const pr = records.filter(r => {
    const d = new Date(r.timestamp);
    return d.getFullYear() === py && d.getMonth() + 1 === pm;
  });

  const ly = vy - 1;
  const lr = records.filter(r => {
    const d = new Date(r.timestamp);
    return d.getFullYear() === ly && d.getMonth() + 1 === vm;
  });

  const allCats = [...new Set(records.map(r => r.category))].sort();
  const stats = allCats.map(cat => {
    const c = mr.filter(r => r.category === cat).reduce((s, r) => s + r.amount, 0);
    const p = pr.filter(r => r.category === cat).reduce((s, r) => s + r.amount, 0);
    const l = lr.filter(r => r.category === cat).reduce((s, r) => s + r.amount, 0);
    const mom = p > 0 ? ((c - p) / p) * 100 : (c > 0 ? 100 : 0);
    const yoy = l > 0 ? ((c - l) / l) * 100 : (c > 0 ? 100 : 0);
    return { cat, cur: c, mom, yoy };
  }).filter(s => s.cur > 0).sort((a, b) => b.cur - a.cur);

  const ct = targets.find(t => t.year === vy && t.month === vm);
  const mNet = mr.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0) - mr.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0);

  return (
    <div className="page-enter p-4 md:p-8">
      <h2 className="text-2xl font-bold mb-6 tracking-tight hidden md:block">统计</h2>

      <div className="card" style={{padding:32,marginBottom:20}}>
        <div className="flex items-center justify-center gap-6 mb-5">
          <button onClick={() => { if (vm === 1) { setVm(12); setVy(vy - 1); } else setVm(vm - 1); }} className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors">‹</button>
          <span className="text-lg font-bold">{vy}年{vm}月</span>
          <button onClick={() => { if (vm === 12) { setVm(1); setVy(vy + 1); } else setVm(vm + 1); }} className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors">›</button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-green-50 rounded-2xl p-4">
            <div className="text-xs text-green-600 mb-1">总收入</div>
            <div className="text-xl font-bold amount-font text-green-600">{fmt(mr.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0))}</div>
          </div>
          <div className="bg-red-50 rounded-2xl p-4">
            <div className="text-xs text-red-600 mb-1">总支出</div>
            <div className="text-xl font-bold amount-font text-red-600">{fmt(mr.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0))}</div>
          </div>
        </div>

        {ct && (
          <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center text-sm">
            <span className="text-gray-500">结余目标 {fmt(ct.target)}</span>
            <span className={mNet >= ct.target ? 'text-green-500 font-semibold' : 'text-orange-500 font-semibold'}>
              {fmt(mNet)} ({ct.target > 0 ? Math.round(mNet / ct.target * 100) : 0}%)
            </span>
          </div>
        )}
      </div>

      <div className="card" style={{padding:32}}>
        <h3 className="text-base font-semibold mb-4">分类明细（环比 / 同比）</h3>
        {stats.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">暂无数据</div>
        ) : (
          <div className="space-y-3">
            {stats.map(s => (
              <div key={s.cat} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors">
                <div>
                  <div className="text-sm font-medium text-gray-800">{s.cat}</div>
                  <div className="flex gap-3 text-xs mt-0.5">
                    <span className={s.mom > 0 ? 'text-red-400' : s.mom < 0 ? 'text-green-400' : 'text-gray-400'}>
                      环比{s.mom > 0 ? '↑' : s.mom < 0 ? '↓' : ''}{Math.abs(s.mom).toFixed(1)}%
                    </span>
                    <span className={s.yoy > 0 ? 'text-red-400' : s.yoy < 0 ? 'text-green-400' : 'text-gray-400'}>
                      同比{s.yoy > 0 ? '↑' : s.yoy < 0 ? '↓' : ''}{Math.abs(s.yoy).toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="text-base font-bold amount-font text-gray-800">{fmt(s.cur)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
