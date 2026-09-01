import { useState, useEffect, useRef } from 'react';
import { Sparkles, X, Send, Bot, User, Loader2, TrendingUp } from 'lucide-react';
import { fmt, getCurMonth } from './utils';
import type { Record as FinRecord, MonthTarget, UserSettings } from '../supabase';

const WORKER_URL = 'https://finance-ai-worker.2287716262.workers.dev';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  records: FinRecord[];
  settings: UserSettings | null;
  targets: MonthTarget[];
}

function buildMonthlySummary(records: FinRecord[], _settings: UserSettings | null, targets: MonthTarget[]) {
  const cur = getCurMonth();
  const monthRecords = records.filter(r => {
    const d = new Date(r.timestamp);
    return d.getFullYear() === cur.year && d.getMonth() + 1 === cur.month;
  });

  const inc = monthRecords.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0);
  const exp = monthRecords.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0);
  const net = inc - exp;

  const dates = new Set(monthRecords.map(r => {
    const d = new Date(r.timestamp);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }));
  const dailyAvg = dates.size > 0 ? exp / dates.size : 0;

  const catMap = new Map<string, number>();
  monthRecords.filter(r => r.type === 'expense').forEach(r => {
    catMap.set(r.category, (catMap.get(r.category) || 0) + r.amount);
  });
  const catSummary = [...catMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([cat, amt]) => `${cat} ${((amt / (exp || 1)) * 100).toFixed(1)}%`)
    .join(', ');

  const target = targets.find(t => t.year === cur.year && t.month === cur.month);

  return `本月收支摘要
收入: ${fmt(inc)}
支出: ${fmt(exp)}
结余: ${fmt(net)}
日均支出: ${fmt(dailyAvg)}
${catSummary ? `支出分类: ${catSummary}` : ''}
${target ? `结余目标: ${fmt(target.target)}` : ''}`;
}

export default function AiAssistant({ records, settings, targets }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [messages, open]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading) return;

    const newMessages: Msg[] = [...messages, { role: 'user', content }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const summary = buildMonthlySummary(records, settings, targets);
      const res = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content, summary }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '请求失败');

      setMessages([...newMessages, { role: 'assistant', content: data.reply }]);
    } catch (e: any) {
      setMessages([...newMessages, { role: 'assistant', content: '⚠️ ' + (e.message || '无法连接AI服务') }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'fixed',
          bottom: 90,
          right: 20,
          zIndex: 1000,
          width: 56,
          height: 56,
          borderRadius: '50%',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
          color: '#fff',
          boxShadow: '0 8px 24px rgba(59,130,246,0.35)',
        }}
        aria-label="AI助手"
      >
        {open ? <X size={26} /> : <Sparkles size={26} />}
      </button>

      {open && (
        <div
          style={{
            position: 'fixed',
            right: 20,
            bottom: 80,
            width: 'min(380px, calc(100vw - 32px))',
            height: 'min(520px, calc(100vh - 120px))',
            zIndex: 1000,
            background: '#fff',
            borderRadius: 20,
            boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div style={{
            padding: '16px 20px',
            background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexShrink: 0,
          }}>
            <Bot size={22} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>财政管家 AI</div>
              <div style={{ fontSize: 11, opacity: 0.85 }}>基于 DeepSeek · 智能分析</div>
            </div>
            <button onClick={() => setOpen(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
              <X size={20} />
            </button>
          </div>

          <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6', flexShrink: 0 }}>
            <button
              onClick={() => send('请帮我分析这个月的收支数据，并给出建议。')}
              disabled={loading}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 12,
                border: '1px solid #bfdbfe',
                background: '#eff6ff',
                color: '#1d4ed8',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <TrendingUp size={16} />
              分析本月数据
            </button>
          </div>

          <div ref={bodyRef} style={{
            flex: 1,
            overflowY: 'auto',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            background: '#f9fafb',
          }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 13, marginTop: 24, lineHeight: 1.8 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🤖</div>
                你好！我是财政管家 AI 助手。<br />
                你可以问我：
                <div style={{ marginTop: 8, fontSize: 12 }}>
                  • 分析本月收支数据<br />
                  • 如何省钱、控制预算<br />
                  • 记账和理财的建议
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <MessageBubble key={i} msg={m} />
            ))}

            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#9ca3af', fontSize: 13, padding: 4 }}>
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                正在思考...
              </div>
            )}
          </div>

          <div style={{ padding: '12px 16px', borderTop: '1px solid #f3f4f6', flexShrink: 0, display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="输入你的问题..."
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: 20,
                border: '1px solid #e5e7eb',
                outline: 'none',
                fontSize: 14,
                background: '#f9fafb',
              }}
            />
            <button
              onClick={() => send()}
              disabled={loading || !input.trim()}
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                border: 'none',
                background: '#3b82f6',
                color: '#fff',
                cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: loading || !input.trim() ? 0.5 : 1,
                flexShrink: 0,
              }}
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function MessageBubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === 'user';
  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      gap: 8,
    }}>
      {!isUser && (
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Bot size={16} color="#4f46e5" />
        </div>
      )}
      <div style={{
        maxWidth: '80%',
        padding: '10px 14px',
        borderRadius: 14,
        fontSize: 14,
        lineHeight: 1.6,
        background: isUser ? '#3b82f6' : '#fff',
        color: isUser ? '#fff' : '#1d1d1f',
        boxShadow: isUser ? 'none' : '0 1px 4px rgba(0,0,0,0.05)',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {msg.content}
      </div>
      {isUser && (
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <User size={16} color="#2563eb" />
        </div>
      )}
    </div>
  );
}
