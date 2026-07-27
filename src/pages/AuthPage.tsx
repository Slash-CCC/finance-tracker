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
    if (!email || !password) {
      setError('请填写邮箱和密码');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      if (mode === 'register') {
        const { error: err } = await supabase.auth.signUp({ email, password });
        if (err) throw err;
        setError('注册成功！请查看邮箱确认链接（如开启了邮箱验证），或直接登录。');
        setMode('login');
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        onLogin();
      }
    } catch (e: any) {
      setError(e.message || '操作失败');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6"
      style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      <div className="w-full max-w-sm fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">💰</div>
          <h1 className="text-[28px] font-bold text-white tracking-tight">财政记录</h1>
          <p className="text-sm text-white/70 mt-1">电脑手机实时同步</p>
        </div>

        {/* Card */}
        <div className="card p-6">
          {/* Segment Control */}
          <div className="segment mb-6">
            <button
              className={mode === 'login' ? 'active' : ''}
              onClick={() => { setMode('login'); setError(''); }}
            >
              登录
            </button>
            <button
              className={mode === 'register' ? 'active' : ''}
              onClick={() => { setMode('register'); setError(''); }}
            >
              注册
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <div className="text-[13px] text-[var(--apple-text-secondary)] mb-1.5 ml-1">邮箱</div>
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input-apple"
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              />
            </div>
            <div>
              <div className="text-[13px] text-[var(--apple-text-secondary)] mb-1.5 ml-1">密码</div>
              <input
                type="password"
                placeholder="至少6位密码"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input-apple"
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              />
            </div>

            {error && (
              <div className={`text-[13px] px-3 py-2 rounded-xl ${
                error.includes('成功') 
                  ? 'bg-green-50 text-[var(--apple-green)]' 
                  : 'bg-red-50 text-[var(--apple-red)]'
              }`}>
                {error}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {submitting && <div className="spinner" />}
              {mode === 'login' ? '登录' : '注册'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
