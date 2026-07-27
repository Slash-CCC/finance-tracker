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
      detail: cat === '其他' ? detail.trim() : detail.trim() || undefined,
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
  const accentBg = type === 'expense' ? 'bg-[var(--apple-red)]' : 'bg-[var(--apple-green)]';

  return (
    <div className="page-enter p-6 pb-20">
      {/* Segment Control */}
      <div className="segment mb-6">
        <button
          className={type === 'expense' ? 'active' : ''}
          onClick={() => { setType('expense'); setCat(''); }}
        >
          支出
        </button>
        <button
          className={type === 'income' ? 'active' : ''}
          onClick={() => { setType('income'); setCat(''); }}
        >
          收入
        </button>
      </div>

      {/* 金额输入 */}
      <div className="card p-6 mb-6">
        <div className="text-[13px] text-[var(--apple-text-secondary)] mb-3">
          {type === 'expense' ? '支出金额' : '收入金额'}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[28px] font-bold text-[var(--apple-text-secondary)]">¥</span>
          <input
            type="number"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="flex-1 text-[36px] font-bold outline-none amount-font bg-transparent"
            autoFocus
          />
        </div>
      </div>

      {/* 分类选择 */}
      <div className="card p-6 mb-6">
        <div className="text-[13px] text-[var(--apple-text-secondary)] mb-4">选择分类</div>
        <div className="grid grid-cols-3 gap-3">
          {cats.map(c => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`py-3 px-2 rounded-xl text-[13px] font-medium transition-all border ${
                cat === c
                  ? type === 'expense'
                    ? 'bg-red-50 text-[var(--apple-red)] border-red-200'
                    : 'bg-green-50 text-[var(--apple-green)] border-green-200'
                  : 'bg-[var(--apple-gray-1)] text-[var(--apple-text-secondary)] border-transparent hover:bg-[var(--apple-gray-2)]'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* 其他分类详情 */}
      {cat === '其他' && (
        <div className="card p-6 mb-6 scale-in">
          <input
            type="text"
            placeholder="请详细说明..."
            value={detail}
            onChange={e => setDetail(e.target.value)}
            className="input-apple"
            autoFocus
          />
        </div>
      )}

      {/* 亲属卡 */}
      {type === 'expense' && (
        <div className="card p-5 mb-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={fc}
              onChange={e => setFc(e.target.checked)}
              className="w-5 h-5 rounded accent-[var(--apple-orange)]"
            />
            <span className="text-[15px] text-[var(--apple-text)]">亲属卡支付</span>
          </label>
        </div>
      )}

      {/* 提交按钮 */}
      <button
        onClick={submit}
        disabled={submitting || !isValid}
        className={`w-full py-4 rounded-2xl text-white font-bold text-[17px] transition-all flex items-center justify-center gap-2 ${
          !isValid
            ? 'bg-[var(--apple-gray-3)] cursor-not-allowed'
            : `${accentBg} active:scale-[0.98]`
        }`}
      >
        {submitting && <div className="spinner border-white/30 border-t-white" />}
        {ok ? '✅ 已记录' : type === 'expense' ? '记录支出' : '记录收入'}
      </button>
    </div>
  );
}
