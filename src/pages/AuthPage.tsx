import { useState } from 'react';
import { supabase } from '../supabase';

interface Props {
  onLogin: () => void;
}

export default function AuthPage({ onLogin }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!email || !password) { setError('请填写邮箱和密码'); return; }
    setSubmitting(true); setError('');
    try {
      if (mode === 'register') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMode('login');
        setError('注册成功，请登录');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onLogin();
      }
    } catch (e: any) { setError(e.message || '操作失败'); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'linear-gradient(160deg, #F0F4FF 0%, #F8F8FA 50%, #FFF0F0 100%)' }}>
      <div className="w-full max-w-[380px] page-enter">
        {/* Logo 区域 */}
        <div className="text-center" style={{ marginBottom: 32 }}>
          <img src="/icon-192.png" alt="经济监管工具" style={{ width: 88, height: 88, margin: '0 auto', borderRadius: 22, boxShadow: '0 8px 28px rgba(0,0,0,0.08)' }} />
          <h1 className="text-2xl font-bold tracking-tight" style={{ marginTop: 24, marginBottom: 8 }}>经济监管工具</h1>
          <p className="text-sm text-gray-500">个人财政记录与管理</p>
        </div>

        {/* 登录/注册卡片 */}
        <div className="card" style={{ padding: 32 }}>
          <div className="segment" style={{ marginBottom: 28, padding: 3 }}>
            <button
              onClick={() => { setMode('login'); setError(''); }}
              className={mode === 'login' ? 'active' : ''}
              style={{ padding: '12px 16px' }}
            >登录</button>
            <button
              onClick={() => { setMode('register'); setError(''); }}
              className={mode === 'register' ? 'active' : ''}
              style={{ padding: '12px 16px' }}
            >注册</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label className="text-sm font-medium text-gray-600" style={{ display: 'block', marginBottom: 8 }}>邮箱</label>
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input-apple"
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                style={{ width: '100%', padding: '14px 16px', fontSize: 15 }}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600" style={{ display: 'block', marginBottom: 8 }}>密码</label>
              <input
                type="password"
                placeholder="至少6位"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input-apple"
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                style={{ width: '100%', padding: '14px 16px', fontSize: 15 }}
              />
            </div>

            {error && (
              <div className="text-sm rounded-xl text-center" style={{ padding: '12px 16px', color: '#dc2626', background: '#fef2f2' }}>
                {error}
              </div>
            )}

            <button onClick={handleSubmit} disabled={submitting} className="btn-primary w-full flex items-center justify-center gap-2" style={{ padding: '16px 24px', fontSize: 16, marginTop: 4 }}>
              {submitting && <div className="spinner" />}
              {mode === 'login' ? '登录' : '注册'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
