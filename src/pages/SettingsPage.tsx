import { useState, useRef } from 'react';
import type { UserSettings } from '../supabase';
import { exportOwnerToken, setOwnerToken, clearLocalCache } from '../supabase';

interface Props {
  settings: UserSettings | null;
  onSetBalance: (v: number) => Promise<void>;
  onLogout: () => void;
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
  window.dispatchEvent(new Event('storage'));
  window.dispatchEvent(new CustomEvent('profile-changed', { detail: p }));
}

export default function SettingsPage({ settings, onSetBalance, onLogout }: Props) {
  const [bal, setBal] = useState(settings?.initial_balance?.toString() || '0');
  const [saved, setSaved] = useState(false);
  const [profile, setProfile] = useState(getProfile);
  const [name, setName] = useState(profile.name);
  const [nameSaved, setNameSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // 数据迁移相关
  const [myCode, setMyCode] = useState(() => exportOwnerToken());
  const [importCode, setImportCode] = useState('');
  const [migMsg, setMigMsg] = useState('');
  const [showImport, setShowImport] = useState(false);

  function copyCode() {
    navigator.clipboard?.writeText(myCode).then(() => {
      setMigMsg('迁移码已复制 ✓');
      setTimeout(() => setMigMsg(''), 2000);
    }).catch(() => setMigMsg('复制失败，请手动长按选择复制'));
  }

  function applyImport() {
    const code = importCode.trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(code)) {
      setMigMsg('迁移码格式不正确（应为64位）');
      return;
    }
    const ok = window.confirm('导入后，本设备将切换为该迁移码对应的云端数据。\n(本机之前若另有数据，建议先导出其迁移码备份)\n\n确定切换吗？');
    if (!ok) return;
    const success = setOwnerToken(code);
    if (!success) { setMigMsg('迁移码无效'); return; }
    setMyCode(code);
    clearLocalCache();
    setMigMsg('已切换，正在重新加载数据…请刷新页面');
    // 让 App 重新拉取：通过触发 online/重载最简单
    setTimeout(() => window.location.reload(), 800);
  }

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
      <div className="card" style={{padding:32,marginBottom:20}}>
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
                onChange={e => setName(e.target.value.slice(0, 8))}
                placeholder="用户名（最多8字符）"
                className="input-apple flex-1"
                maxLength={8}
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
      <div className="card" style={{padding:32,marginBottom:20}}>
        <h3 className="text-base font-semibold mb-5">初始余额</h3>
        <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-5 py-3.5 mb-5">
          <span className="text-gray-400 font-medium">¥</span>
          <input type="number" value={bal} onChange={e => setBal(e.target.value)} className="flex-1 font-bold outline-none amount-font bg-transparent" />
        </div>
        <button onClick={saveBalance} className="btn-primary w-full flex items-center justify-center gap-2">
          {saved ? '✓ 已保存' : '保存'}
        </button>
      </div>

      {/* 数据与设备（免登录 · 云端同步） */}
      <div className="card" style={{padding:32}}>
        <h3 className="text-base font-semibold mb-1">数据与设备</h3>
        <div className="text-xs text-gray-400 mb-5">本 App 免登录。记录会自动云端同步，换手机用「迁移码」找回。</div>

        {/* 我的迁移码 */}
        <div className="rounded-xl bg-gray-50 p-4 mb-3">
          <div className="text-sm font-medium mb-2">我的迁移码</div>
          <div className="font-mono text-xs break-all text-gray-600 leading-relaxed select-all" style={{ wordBreak: 'break-all' }}>{myCode}</div>
          <button onClick={copyCode} className="btn-primary w-full mt-3 text-sm" style={{ padding: '10px' }}>
            复制迁移码
          </button>
        </div>

        {/* 恢复 / 切换设备 */}
        <button
          onClick={() => setShowImport(s => !s)}
          className="w-full py-3 mb-2 rounded-xl bg-blue-50 text-blue-600 font-medium hover:bg-blue-100 transition-colors"
        >
          {showImport ? '收起' : '在新设备恢复数据'}
        </button>
        {showImport && (
          <div className="rounded-xl bg-gray-50 p-4 mb-3">
            <div className="text-sm font-medium mb-2">粘贴旧设备迁移码</div>
            <input
              type="text"
              value={importCode}
              onChange={e => setImportCode(e.target.value)}
              placeholder="在此粘贴迁移码"
              className="input-apple w-full mb-2"
              style={{ padding: '12px 14px', fontSize: 13, fontFamily: 'monospace' }}
            />
            <button onClick={applyImport} className="btn-primary w-full text-sm" style={{ padding: '10px' }}>
              恢复此设备数据
            </button>
          </div>
        )}

        {migMsg && <div className="text-sm text-blue-600 mb-2 text-center">{migMsg}</div>}

        <div className="border-t border-gray-100 pt-4 mt-2">
          <button
            onClick={onLogout}
            className="w-full py-3.5 rounded-xl bg-red-50 text-red-500 font-medium hover:bg-red-100 transition-colors"
          >
            清除本机数据（不删除云端记录）
          </button>
        </div>
      </div>
    </div>
  );
}
