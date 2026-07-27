import { useState } from 'react';
import type { Record, MonthTarget } from '../supabase';
import { fmt, getCurMonth, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from './utils';

interface Props {
  records: Record[];
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

  const allCats = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];
  const stats = allCats
    .map(cat => {
      const curAmt = mr.filter(r => r.category === cat).reduce((s, r) => s + r.amount, 0);
      const prevAmt = pr.filter(r => r.category === cat).reduce((s, r) => s + r.amount, 0);
      const lyAmt = lr.filter(r => r.category === cat).reduce((s, r) => s + r.amount, 0);
      const mom = prevAmt > 0 ? ((curAmt - prevAmt) / prevAmt) * 100 : curAmt > 0 ? 100 : 0;
      const yoy = lyAmt > 0 ? ((curAmt - lyAmt) / lyAmt) * 100 : curAmt > 0 ? 100 : 0;
      return { cat, curAmt, prevAmt, lyAmt, mom, yoy };
    })
    .filter(s => s.curAmt > 0 || s.prevAmt > 0 || s.lyAmt > 0)
    .sort((a, b) => b.curAmt - a.curAmt);

  const ct = targets.find(t => t.year === vy && t.month === vm);
  const mInc = mr.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0);
  const mExp = mr.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0);
  const mNet = mInc - mExp;

  function prevMonth() {
    if (vm === 1) { setVm(12); setVy(vy - 1); }
    else setVm(vm - 1);
  }
  function nextMonth() {
    if (vm === 12) { setVm(1); setVy(vy + 1); }
    else setVm(vm + 1);
  }

  return (
    <div className="page-enter p-6">
      {/* 月份切换 */}
      <div className="flex items-center justify-center gap-6 mb-6">
        <button onClick={prevMonth} className="btn-ghost text-xl px-3">‹</button>
        <span className="text-[20px] font-bold">{vy}年{vm}月</span>
        <button onClick={nextMonth} className="btn-ghost text-xl px-3">›</button>
      </div>

      {/* 月度概览 */}
      <div className="card p-6 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-[13px] text-[var(--apple-text-secondary)] mb-1">总收入</div>
            <div className="text-xl font-bold amount-font text-[var(--apple-green)]">{fmt(mInc)}</div>
          </div>
          <div>
            <div className="text-[13px] text-[var(--apple-text-secondary)] mb-1">总支出</div>
            <div className="text-xl font-bold amount-font text-[var(--apple-red)]">{fmt(mExp)}</div>
          </div>
        </div>
        {ct && (
          <div className="mt-4 pt-4 border-t border-[var(--apple-gray-2)] flex justify-between items-center">
            <span className="text-[15px] text-[var(--apple-text-secondary)]">结余目标 {fmt(ct.target)}</span>
            <span className={`text-[15px] font-semibold amount-font ${
              mNet >= ct.target ? 'text-[var(--apple-green)]' : 'text-[var(--apple-orange)]'
            }`}>
              {fmt(mNet)} ({ct.target > 0 ? Math.round(mNet / ct.target * 100) : 0}%)
            </span>
          </div>
        )}
      </div>

      {/* 分类明细 */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--apple-gray-2)]">
          <span className="text-[15px] font-semibold text-[var(--apple-text-secondary)]">
            分类明细（环比上月 / 同比去年）
          </span>
        </div>
        {stats.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-4xl mb-3">📊</div>
            <p className="text-[15px] text-[var(--apple-text-secondary)]">暂无数据</p>
          </div>
        ) : (
          stats.map(s => (
            <div key={s.cat} className="px-6 py-4 border-b border-[var(--apple-gray-2)] last:border-0">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[15px] font-medium">{s.cat}</span>
                <span className="text-[17px] font-bold amount-font">{fmt(s.curAmt)}</span>
              </div>
              <div className="flex gap-6 text-[13px]">
                <span className={s.mom > 0 ? 'text-[var(--apple-red)]' : s.mom < 0 ? 'text-[var(--apple-green)]' : 'text-[var(--apple-text-secondary)]'}>
                  环比 {s.mom > 0 ? '↑' : s.mom < 0 ? '↓' : ''}{Math.abs(s.mom).toFixed(1)}%
                </span>
                <span className={s.yoy > 0 ? 'text-[var(--apple-red)]' : s.yoy < 0 ? 'text-[var(--apple-green)]' : 'text-[var(--apple-text-secondary)]'}>
                  同比 {s.yoy > 0 ? '↑' : s.yoy < 0 ? '↓' : ''}{Math.abs(s.yoy).toFixed(1)}%
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
