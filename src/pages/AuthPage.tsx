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
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-3xl shadow-lg">💰</div>
          <h1 className="text-2xl font-bold tracking-tight">财政记录</h1>
          <p className="text-sm text-gray-500 mt-1">简单记录每一笔收支</p>
        </div>

        <div className="card p-6">
          <div className="segment mb-6">
            <button onClick={() => { setMode('login'); setError(''); }} className={mode === 'login' ? 'active' : ''}>登录</button>
            <button onClick={() => { setMode('register'); setError(''); }} className={mode === 'register' ? 'active' : ''}>注册</button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1.5 block">邮箱</label>
              <input type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} className="input-apple" onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1.5 block">密码</label>
              <input type="password" placeholder="至少6位" value={password} onChange={e => setPassword(e.target.value)} className="input-apple" onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
            </div>

            {error && (
              <div className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2.5">{error}</div>
            )}

            <button onClick={handleSubmit} disabled={submitting} className="btn-primary w-full flex items-center justify-center gap-2">
              {submitting && <div className="spinner" />}
              {mode === 'login' ? '登录' : '注册'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
