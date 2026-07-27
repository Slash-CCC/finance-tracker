import { useState, useRef } from 'react';
import type { UserSettings } from '../supabase';

interface Props {
  settings: UserSettings | null;
  onSetBalance: (v: number) => Promise<void>;
  onLogout: () => Promise<void>;
}

function getProfile(): { name: string; avatar: string } {
  try {
    const raw = localStorage.getItem('user-profile');
    if (raw) return JSON.parse(raw);
  } catch {}
  return { name: '', avatar: '' };
}

function saveProfile(p: { name: string; avatar: string }) {
  localStorage.setItem('user-profile', JSON.stringify(p));
}

export default function SettingsPage({ settings, onSetBalance, onLogout }: Props) {
  const [bal, setBal] = useState(settings?.initial_balance?.toString() || '0');
  const [saved, setSaved] = useState(false);
  const [profile, setProfile] = useState(getProfile);
  const [name, setName] = useState(profile.name);
  const [nameSaved, setNameSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function saveBalance() {
    const n = parseFloat(bal);
    if (isNaN(n) || n < 0) return;
    await onSetBalance(n);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  function saveName() {
    const p = { ...profile, name: name.trim() };
    setProfile(p);
    saveProfile(p);
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 1500);
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('图片不能超过2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const p = { ...profile, avatar: reader.result as string };
      setProfile(p);
      saveProfile(p);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="page-enter p-4 md:p-8">
      <h2 className="text-2xl font-bold mb-6 tracking-tight hidden md:block">设置</h2>

      {/* 头像和用户名 */}
      <div className="card p-7 mb-5">
        <h3 className="text-base font-semibold mb-5">个人信息</h3>
        <div className="flex items-center gap-5 mb-6">
          <div
            className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0 border-2 border-dashed border-gray-200"
            onClick={() => fileRef.current?.click()}
            title="点击更换头像"
          >
            {profile.avatar ? (
              <img src={profile.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl text-gray-400">+</span>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
          <div className="flex-1 space-y-2">
            <div className="text-xs text-gray-500">用户名</div>
            <div className="flex gap-2">
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="设置用户名"
                className="input-apple flex-1"
                maxLength={30}
              />
              <button onClick={saveName} className="btn-primary text-sm px-4 py-2.5 flex-shrink-0">
                {nameSaved ? '✓ 已保存' : '保存'}
              </button>
            </div>
            <div className="text-[11px] text-gray-400">点击左侧圆圈上传头像（最大2MB）</div>
          </div>
        </div>
      </div>

      {/* 初始余额 */}
      <div className="card p-7 mb-5">
        <h3 className="text-base font-semibold mb-5">初始余额</h3>
        <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-5 py-3.5 mb-5">
          <span className="text-gray-400 font-medium">¥</span>
          <input type="number" value={bal} onChange={e => setBal(e.target.value)} className="flex-1 font-bold outline-none amount-font bg-transparent" />
        </div>
        <button onClick={saveBalance} className="btn-primary w-full flex items-center justify-center gap-2">
          {saved ? '✓ 已保存' : '保存'}
        </button>
      </div>

      {/* 账号 */}
      <div className="card p-7">
        <h3 className="text-base font-semibold mb-5">账号</h3>
        <button onClick={onLogout} className="w-full py-3.5 rounded-xl bg-red-50 text-red-500 font-medium hover:bg-red-100 transition-colors">
          退出登录
        </button>
      </div>
    </div>
  );
}
