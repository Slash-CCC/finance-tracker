import { useState } from 'react';
import type { UserSettings } from '../supabase';

interface Props {
  settings: UserSettings | null;
  onSetBalance: (balance: number) => Promise<void>;
  onLogout: () => Promise<void>;
}

export default function SettingsPage({ settings, onSetBalance, onLogout }: Props) {
  const [bal, setBal] = useState(settings?.initial_balance?.toString() || '0');
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function save() {
    const n = parseFloat(bal);
    if (isNaN(n) || n < 0) return;
    setSubmitting(true);
    await onSetBalance(n);
    setSubmitting(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="page-enter p-6">
      <h2 className="text-[20px] font-bold mb-6">⚙️ 设置</h2>

      {/* 初始余额 */}
      <div className="card p-6 mb-6">
        <div className="text-[15px] font-semibold text-[var(--apple-text-secondary)] mb-4">初始余额</div>
        <div className="flex items-center gap-3 bg-[var(--apple-gray-1)] rounded-xl px-4 py-3 mb-4">
          <span className="text-[var(--apple-text-secondary)]">¥</span>
          <input
            type="number"
            value={bal}
            onChange={e => setBal(e.target.value)}
            className="flex-1 font-bold outline-none bg-transparent amount-font text-[17px]"
          />
        </div>
        <button
          onClick={save}
          disabled={submitting}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          {submitting && <div className="spinner" />}
          {saved ? '✅ 已保存' : '保存'}
        </button>
      </div>

      {/* 退出登录 */}
      <div className="card p-6">
        <div className="text-[15px] text-[var(--apple-text-secondary)] mb-4">已登录</div>
        <button onClick={onLogout} className="btn-danger w-full">
          退出登录
        </button>
      </div>
    </div>
  );
}
