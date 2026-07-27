import { useState } from 'react';
import type { UserSettings } from '../supabase';

interface Props {
  settings: UserSettings | null;
  onSetBalance: (v: number) => Promise<void>;
  onLogout: () => Promise<void>;
}

export default function SettingsPage({ settings, onSetBalance, onLogout }: Props) {
  const [bal, setBal] = useState(settings?.initial_balance?.toString() || '0');
  const [saved, setSaved] = useState(false);

  async function save() {
    const n = parseFloat(bal);
    if (isNaN(n) || n < 0) return;
    await onSetBalance(n);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="page-enter p-4 md:p-8">
      <h2 className="text-2xl font-bold mb-6 tracking-tight hidden md:block">设置</h2>

      <div className="card p-6 mb-5">
        <h3 className="text-base font-semibold mb-4">初始余额</h3>
        <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 mb-4">
          <span className="text-gray-400 font-medium">¥</span>
          <input type="number" value={bal} onChange={e => setBal(e.target.value)} className="flex-1 font-bold outline-none amount-font bg-transparent" />
        </div>
        <button onClick={save} className="btn-primary w-full flex items-center justify-center gap-2">
          {saved ? '✓ 已保存' : '保存'}
        </button>
      </div>

      <div className="card p-6">
        <h3 className="text-base font-semibold mb-4">账号</h3>
        <button onClick={onLogout} className="w-full py-3 rounded-xl bg-red-50 text-red-500 font-medium hover:bg-red-100 transition-colors">
          退出登录
        </button>
      </div>
    </div>
  );
}
