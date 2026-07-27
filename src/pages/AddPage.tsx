import { useState } from 'react';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from './utils';

interface Props {
  onAdd: (r: {
    type: 'expense' | 'income';
    amount: number;
    category: string;
    detail?: string;
    is_family_card?: boolean;
  }) => Promise<void>;
}

export default function AddPage({ onAdd }: Props) {
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [amount, setAmount] = useState('');
  const [cat, setCat] = useState('');
  const [detail, setDetail] = useState('');
  const [fc, setFc] = useState(false);
  const [ok, setOk] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const cats = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  async function submit() {
    const n = parseFloat(amount);
    if (!n || n <= 0 || !cat) return;
    if (cat === '其他' && !detail.trim()) return;
    setSubmitting(true);
    await onAdd({
      type,
      amount: n,
      category: cat,
      detail: cat === '其他' ? detail.trim() : (detail.trim() || undefined),
      is_family_card: type === 'expense' ? fc : false,
    });
    setAmount('');
    setCat('');
    setDetail('');
    setFc(false);
    setSubmitting(false);
    setOk(true);
    setTimeout(() => setOk(false), 1200);
  }

  const isValid = amount && cat && (cat !== '其他' || detail.trim());

  return (
    <div className="page-enter p-6 pb-24 md:pb-6 md:max-w-[680px]">
      <h2 className="text-2xl font-bold mb-6 tracking-tight hidden md:block">记一笔</h2>

      <div className="segment mb-6 max-w-[280px]">
        <button onClick={() => { setType('expense'); setCat(''); }} className={type === 'expense' ? 'active' : ''}>支出</button>
        <button onClick={() => { setType('income'); setCat(''); }} className={type === 'income' ? 'active' : ''}>收入</button>
      </div>

      <div className="card p-6 mb-5">
        <label className="text-xs font-medium text-gray-500 mb-2 block">{type === 'expense' ? '支出金额' : '收入金额'}</label>
        <div className="flex items-center gap-3">
          <span className="text-2xl font-semibold text-gray-400">¥</span>
          <input
            type="number"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="flex-1 text-4xl font-bold outline-none amount-font bg-transparent placeholder:text-gray-300"
            autoFocus
          />
        </div>
      </div>

      <div className="card p-5 mb-5">
        <label className="text-xs font-medium text-gray-500 mb-3 block">选择分类</label>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
          {cats.map(c => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`
                py-3 px-2 rounded-xl text-[13px] font-medium transition-all border
                ${cat === c
                  ? (type === 'expense'
                    ? 'bg-red-50 border-red-200 text-red-600 shadow-sm'
                    : 'bg-green-50 border-green-200 text-green-600 shadow-sm')
                  : 'bg-gray-50/60 border-transparent text-gray-600 hover:bg-gray-100'
                }
              `}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {cat === '其他' && (
        <div className="card p-5 mb-5 scale-in">
          <label className="text-xs font-medium text-gray-500 mb-2 block">详细说明</label>
          <input type="text" placeholder="请说明具体内容..." value={detail} onChange={e => setDetail(e.target.value)} className="input-apple" autoFocus />
        </div>
      )}

      {type === 'expense' && (
        <div className="card p-5 mb-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={fc} onChange={e => setFc(e.target.checked)} className="w-5 h-5 rounded-md accent-blue-500" />
            <span className="text-sm text-gray-700">亲属卡支付</span>
          </label>
        </div>
      )}

      <button
        onClick={submit}
        disabled={submitting || !isValid}
        className={`
          w-full py-4 rounded-2xl text-white font-bold text-lg transition-all flex items-center justify-center gap-2
          ${!isValid
            ? 'bg-gray-300 cursor-not-allowed'
            : type === 'expense'
              ? 'bg-red-500 hover:bg-red-600 active:scale-[0.98] shadow-lg shadow-red-200'
              : 'bg-green-500 hover:bg-green-600 active:scale-[0.98] shadow-lg shadow-green-200'
          }
        `}
      >
        {submitting && <div className="spinner" />}
        {ok ? '✓ 已记录' : type === 'expense' ? '记录支出' : '记录收入'}
      </button>
    </div>
  );
}
