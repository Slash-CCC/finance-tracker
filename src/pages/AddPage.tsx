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

  const formContent = (
    <>
      <div className="segment" style={{ marginBottom: 24, maxWidth: 280 }}>
        <button
          onClick={() => { setType('expense'); setCat(''); }}
          className={type === 'expense' ? 'active' : ''}
          style={{ padding: '12px 16px' }}
        >支出</button>
        <button
          onClick={() => { setType('income'); setCat(''); }}
          className={type === 'income' ? 'active' : ''}
          style={{ padding: '12px 16px' }}
        >收入</button>
      </div>

      {/* 金额输入 + 提交按钮（同一行） */}
      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <label className="text-xs font-medium text-gray-500" style={{ display: 'block', marginBottom: 8 }}>
          {type === 'expense' ? '支出金额' : '收入金额'}
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 28, fontWeight: 600, color: '#9ca3af', flexShrink: 0 }}>¥</span>
          <input
            type="number"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && isValid && !submitting) submit(); }}
            style={{ flex: 1, fontSize: 36, fontWeight: 700, outline: 'none', background: 'transparent', border: 'none', color: '#1d1d1f', minWidth: 0 }}
            autoFocus
          />
          {/* 记录按钮（金额框最右边） */}
          <button
            onClick={submit}
            disabled={submitting || !isValid}
            style={{
              flexShrink: 0,
              padding: '14px 20px',
              fontSize: 16,
              fontWeight: 700,
              color: '#fff',
              border: 'none',
              borderRadius: 14,
              cursor: !isValid ? 'not-allowed' : 'pointer',
              background: !isValid ? '#d1d5db' : type === 'expense' ? '#ef4444' : '#22c55e',
              boxShadow: isValid ? (type === 'expense' ? '0 4px 14px rgba(239,68,68,0.25)' : '0 4px 14px rgba(34,197,94,0.25)') : 'none',
              transition: 'all 0.15s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              whiteSpace: 'nowrap',
            }}
          >
            {submitting && <div className="spinner" />}
            {ok ? '✓' : type === 'expense' ? '记录支出' : '记录收入'}
          </button>
        </div>
      </div>

      {/* 分类选择 */}
      <div className="card" style={{ padding: 32, marginBottom: 20 }}>
        <label className="text-xs font-medium text-gray-500" style={{ display: 'block', marginBottom: 12 }}>选择分类</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 10 }}>
          {cats.map(c => {
            const selected = cat === c;
            const isExpense = type === 'expense';
            return (
              <button
                key={c}
                onClick={() => setCat(c)}
                style={{
                  padding: '14px 8px',
                  borderRadius: 14,
                  fontSize: 14,
                  fontWeight: 500,
                  border: selected
                    ? (isExpense ? '1.5px solid #fca5a5' : '1.5px solid #86efac')
                    : '1.5px solid transparent',
                  background: selected
                    ? (isExpense ? '#fef2f2' : '#f0fdf4')
                    : '#f9fafb',
                  color: selected
                    ? (isExpense ? '#dc2626' : '#16a34a')
                    : '#4b5563',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  boxShadow: selected ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                {c}
              </button>
            );
          })}
        </div>
      </div>

      {/* 其他说明 */}
      {cat === '其他' && (
        <div className="card scale-in" style={{ padding: 32, marginBottom: 20 }}>
          <label className="text-xs font-medium text-gray-500" style={{ display: 'block', marginBottom: 8 }}>详细说明</label>
          <input
            type="text"
            placeholder="请说明具体内容..."
            value={detail}
            onChange={e => setDetail(e.target.value)}
            className="input-apple"
            style={{ width: '100%', padding: '14px 16px', fontSize: 15 }}
            autoFocus
          />
        </div>
      )}

      {/* 亲属卡 */}
      {type === 'expense' && (
        <div className="card" style={{ padding: 32, marginBottom: 24 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
            <input type="checkbox" checked={fc} onChange={e => setFc(e.target.checked)} style={{ width: 20, height: 20, borderRadius: 6, accentColor: '#3b82f6' }} />
            <span style={{ fontSize: 14, color: '#374151' }}>亲属卡支付</span>
          </label>
        </div>
      )}
    </>
  );

  return (
    <div className="page-enter p-4 md:p-8">
      {/* 手机端：单列 */}
      <div className="md:hidden pb-24">
        {formContent}
      </div>

      {/* 桌面端：左右分栏 */}
      <div className="hidden md:flex gap-8" style={{ maxWidth: 1100 }}>
        {/* 左侧：表单 */}
        <div style={{ flex: '0 0 480px' }}>
          {formContent}
        </div>
        {/* 右侧：提示信息 */}
        <div style={{ flex: 1, paddingTop: 0 }}>
          <div className="card" style={{ padding: 32 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>💡 记录说明</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <TipItem icon="📝" title="选择类型" desc="点击支出/收入切换记录类型，分类会自动切换" />
              <TipItem icon="💳" title="亲属卡" desc="支出时可以勾选「亲属卡支付」标记为亲属卡消费" />
              <TipItem icon="📊" title="分类统计" desc="在「统计」页面可按分类查看环比和同比变化" />
              <TipItem icon="📋" title="查看明细" desc="在「明细」页面可按日期筛选、导出 CSV/JSON" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TipItem({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1d1d1f', marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>{desc}</div>
      </div>
    </div>
  );
}
