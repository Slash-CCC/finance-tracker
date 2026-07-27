import { useState, useEffect, useCallback } from 'react';
import { supabase, addRecord, deleteRecord, getRecords, getUserSettings, upsertUserSettings, getMonthTargets, upsertMonthTarget, getAllRecords, getRecordsInRange } from './supabase';
import type { Record, MonthTarget, UserSettings } from './supabase';

// ==================== 常量 ====================

const EXPENSE_CATEGORIES = [
  '车贷', '房租', '水电', '停车', '充电',
  '宠物消费', '日常饮食', '高消饮食', '日用品购物', '消费品购物',
  '自动续费', '看病', '亚马逊相关支出', '其他借款', '其他',
] as const;

const INCOME_CATEGORIES = ['工资', '亚马逊回款', '其他'] as const;

const AMAZON_EXPENSE = '亚马逊相关支出';
const AMAZON_INCOME = '亚马逊回款';

// ==================== 工具函数 ====================

function nowBJ(): string { return new Date().toISOString(); }
function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
function fmt(n: number): string {
  const num = typeof n === 'number' ? n : Number(n);
  if (Number.isNaN(num)) return '¥0.00';
  const sign = num < 0 ? '-' : '';
  return sign + '¥' + Math.abs(num).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function mk(y: number, m: number): string { return `${y}-${String(m).padStart(2,'0')}`; }
function getCurMonth() { const d=new Date(); return { year:d.getFullYear(), month:d.getMonth()+1 }; }

// ==================== App ====================

type Page = 'login' | 'register' | 'home' | 'add' | 'amazon' | 'stats' | 'records' | 'settings';

export default function App() {
  const [page, setPage] = useState<Page>('login');
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // 数据
  const [records, setRecords] = useState<Record[]>([]);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [targets, setTargets] = useState<MonthTarget[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  // 检查登录状态
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) { setPage('home'); loadUserData(); }
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session);
      if (session) { setPage('home'); loadUserData(); }
      else { setPage('login'); setDataLoaded(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function loadUserData() {
    try {
      const [recs, stgs, tgs] = await Promise.all([
        getRecords(500), getUserSettings(), getMonthTargets(),
      ]);
      setRecords(recs);
      setSettings(stgs);
      setTargets(tgs);
      setDataLoaded(true);
    } catch (e) { console.error(e); }
  }

  const refreshRecords = useCallback(async () => {
    const recs = await getRecords(500);
    setRecords(recs);
  }, []);

  const handleAdd = useCallback(async (r: Parameters<typeof addRecord>[0]) => {
    await addRecord(r);
    await refreshRecords();
  }, [refreshRecords]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteRecord(id);
    await refreshRecords();
  }, [refreshRecords]);

  const handleSetBalance = useCallback(async (balance: number) => {
    const s = await upsertUserSettings(balance);
    setSettings(s);
  }, []);

  const handleSetTarget = useCallback(async (year: number, month: number, target: number) => {
    await upsertMonthTarget(year, month, target);
    const tgs = await getMonthTargets();
    setTargets(tgs);
  }, []);

  if (loading) {
    return (
      <div className="app-container items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  if (!session) {
    return <AuthPage onLogin={() => { setPage('home'); loadUserData(); }} />;
  }

  if (!dataLoaded) {
    return (
      <div className="app-container items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  const props = { records, settings, targets, onAdd: handleAdd, onDelete: handleDelete, onSetBalance: handleSetBalance, onSetTarget: handleSetTarget, onRefresh: refreshRecords, onLogout: async () => { await supabase.auth.signOut(); setSession(null); setPage('login'); setDataLoaded(false); } };

  return (
    <div className="app-container safe-bottom">
      <div className="flex-1 overflow-auto pb-4">
        {page === 'home' && <HomePage {...props} />}
        {page === 'add' && <AddPage onAdd={handleAdd} />}
        {page === 'amazon' && <AmazonPage records={records} settings={settings} />}
        {page === 'stats' && <StatsPage records={records} targets={targets} />}
        {page === 'records' && <RecordsPage records={records} onDelete={handleDelete} />}
        {page === 'settings' && <SettingsPage settings={settings} onSetBalance={handleSetBalance} onLogout={props.onLogout} />}
      </div>
      <BottomNav page={page} onPage={setPage} />
    </div>
  );
}

// ==================== 登录/注册 ====================

function AuthPage({ onLogin }: { onLogin: () => void }) {
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
        setError('注册成功！请查看邮箱确认链接（如开启了邮箱验证），或直接登录。');
        setMode('login');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onLogin();
      }
    } catch (e: any) { setError(e.message || '操作失败'); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="app-container items-center justify-center p-6">
      <div className="w-full fade-in">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">💰</div>
          <h1 className="text-2xl font-bold">财政记录</h1>
          <p className="text-sm text-gray-400 mt-1">电脑手机实时同步</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <div className="flex bg-gray-100 rounded-xl p-1 mb-5">
            <button onClick={() => { setMode('login'); setError(''); }} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${mode === 'login' ? 'bg-white text-blue-500 shadow-sm' : 'text-gray-400'}`}>登录</button>
            <button onClick={() => { setMode('register'); setError(''); }} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${mode === 'register' ? 'bg-white text-blue-500 shadow-sm' : 'text-gray-400'}`}>注册</button>
          </div>

          <div className="space-y-4">
            <div>
              <div className="text-xs text-gray-400 mb-1.5">邮箱</div>
              <input type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm outline-none focus:bg-gray-100 transition-colors" onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1.5">密码</div>
              <input type="password" placeholder="至少6位密码" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm outline-none focus:bg-gray-100 transition-colors" onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
            </div>
            {error && <div className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</div>}
            <button onClick={handleSubmit} disabled={submitting} className="w-full py-3 rounded-xl bg-blue-500 text-white font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2">
              {submitting && <div className="spinner" />}
              {mode === 'login' ? '登录' : '注册'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== 首页 ====================

function HomePage({ records, settings, targets, onSetBalance, onSetTarget, onDelete, onLogout }: any) {
  const cur = getCurMonth();
  const [showSetup, setShowSetup] = useState(false);
  const [showTarget, setShowTarget] = useState(false);

  // 首次：没有设置余额
  useEffect(() => {
    setShowSetup(!settings);
  }, [settings]);

  // 每月1号弹窗
  useEffect(() => {
    const today = new Date().getDate();
    const has = targets.some((t: MonthTarget) => t.year === cur.year && t.month === cur.month);
    if (today === 1 && !has) setShowTarget(true);
  }, [targets, cur.year, cur.month]);

  const initialBalance = Number(settings?.initial_balance ?? 0);
  const balance = settings ? initialBalance + records.filter((r: Record) => r.type==='income').reduce((s:number, r:Record) => s+r.amount, 0) - records.filter((r: Record) => r.type==='expense').reduce((s:number, r:Record) => s+r.amount, 0) : 0;

  // 本月
  const monthRecords = records.filter((r: Record) => {
    const d = new Date(r.timestamp);
    return d.getFullYear() === cur.year && d.getMonth()+1 === cur.month;
  });
  const mInc = monthRecords.filter((r: Record) => r.type==='income').reduce((s:number,r:Record)=>s+r.amount,0);
  const mExp = monthRecords.filter((r: Record) => r.type==='expense').reduce((s:number,r:Record)=>s+r.amount,0);
  const mNet = mInc - mExp;

  // 6月均
  let avg6 = 0;
  for (let i=5;i>=0;i--) {
    const d=new Date(cur.year, cur.month-1-i, 1);
    const y=d.getFullYear(), m=d.getMonth()+1;
    const rs=records.filter((r:Record)=>{const rd=new Date(r.timestamp); return rd.getFullYear()===y && rd.getMonth()+1===m;});
    avg6 += rs.filter((r:Record)=>r.type==='income').reduce((s:number,r:Record)=>s+r.amount,0) - rs.filter((r:Record)=>r.type==='expense').reduce((s:number,r:Record)=>s+r.amount,0);
  }
  avg6 /= 6;

  const curTarget = targets.find((t: MonthTarget) => t.year===cur.year && t.month===cur.month);
  const recent = records.slice(0, 15);

  return (
    <div className="fade-in px-4 pt-6">
      {/* 余额 */}
      <div className="text-center mb-5">
        <div className="text-xs text-gray-400 mb-1">个人总余额</div>
        <div className={`text-4xl font-bold amount-font ${balance>=0?'text-gray-900':'text-red-500'}`}>{fmt(balance)}</div>
      </div>

      {/* 月度概览 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
        <div className="text-sm font-semibold text-gray-500 mb-3">{mk(cur.year,cur.month)} 概览</div>
        <div className="grid grid-cols-2 gap-3">
          <Mini label="本月收入" v={mInc} c="text-green-500" />
          <Mini label="本月支出" v={mExp} c="text-red-500" />
          <Mini label="本月净结余" v={mNet} c={mNet>=0?'text-blue-500':'text-red-500'} />
          <Mini label="6月均结余" v={avg6} c={avg6>=0?'text-gray-700':'text-red-400'} />
        </div>
        {curTarget && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-sm">
            <span className="text-gray-400">结余目标 {fmt(curTarget.target)}</span>
            <span className={mNet>=curTarget.target?'text-green-500 font-semibold':'text-orange-500 font-semibold'}>
              {fmt(mNet)} ({curTarget.target>0?Math.round(mNet/curTarget.target*100):0}%)
            </span>
          </div>
        )}
      </div>

      {/* 最近 */}
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-500 mb-2">最近记录</h3>
        {recent.length===0 ? (
          <div className="text-center py-6 text-gray-400 text-sm">暂无记录，点击下方 + 开始记账</div>
        ) : (
          <div className="space-y-1">
            {recent.map((r: Record) => <RecRow key={r.id} r={r} onDelete={onDelete} />)}
          </div>
        )}
      </div>

      {/* 弹窗 */}
      {showSetup && <SetupModal onSubmit={onSetBalance} />}
      {showTarget && <TargetModal year={cur.year} month={cur.month} onSubmit={(t:number) => { onSetTarget(cur.year, cur.month, t); setShowTarget(false); }} />}
    </div>
  );
}

function Mini({ label, v, c }: { label: string; v: number; c: string }) {
  return <div><div className="text-xs text-gray-400 mb-0.5">{label}</div><div className={`text-lg font-bold amount-font ${c}`}>{fmt(v)}</div></div>;
}

function RecRow({ r, onDelete }: { r: Record; onDelete: (id:string)=>void }) {
  const [del, setDel] = useState(false);
  return (
    <div className="bg-white rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm" onClick={()=>setDel(!del)}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-base ${r.type==='expense'?'bg-red-50':'bg-green-50'}`}>
        {r.type==='expense'?'💸':'💰'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{r.category}{r.detail?` - ${r.detail}`:''}{r.is_family_card&&<span className="ml-1 text-[10px] text-orange-400 bg-orange-50 px-1.5 py-0.5 rounded">亲属卡</span>}</div>
        <div className="text-xs text-gray-400">{formatDate(r.timestamp)} {formatTime(r.timestamp)}</div>
      </div>
      <div className={`text-base font-bold amount-font ${r.type==='expense'?'text-red-500':'text-green-500'}`}>{r.type==='expense'?'-':'+'}{fmt(r.amount)}</div>
      {del && <button onClick={e=>{e.stopPropagation();onDelete(r.id);}} className="absolute right-2 bg-red-500 text-white text-xs px-3 py-1 rounded-lg">删除</button>}
    </div>
  );
}

// ==================== 记账页 ====================

function AddPage({ onAdd }: { onAdd: (r: any) => Promise<void> }) {
  const [type, setType] = useState<'expense'|'income'>('expense');
  const [amount, setAmount] = useState('');
  const [cat, setCat] = useState('');
  const [detail, setDetail] = useState('');
  const [fc, setFc] = useState(false);
  const [ok, setOk] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const cats = type==='expense'?EXPENSE_CATEGORIES:INCOME_CATEGORIES;

  async function submit() {
    const n = parseFloat(amount);
    if (!n||n<=0||!cat) return;
    if (cat==='其他'&&!detail.trim()) return;
    setSubmitting(true);
    await onAdd({ type, amount:n, category:cat, detail:cat==='其他'?detail.trim():detail.trim()||undefined, is_family_card:type==='expense'?fc:false });
    setAmount(''); setCat(''); setDetail(''); setFc(false); setSubmitting(false);
    setOk(true); setTimeout(()=>setOk(false),1200);
  }

  return (
    <div className="fade-in px-4 pt-6 pb-20">
      <div className="flex bg-gray-100 rounded-xl p-1 mb-5">
        <button onClick={()=>{setType('expense');setCat('');}} className={`flex-1 py-2.5 rounded-lg text-sm font-semibold ${type==='expense'?'bg-white text-red-500 shadow-sm':'text-gray-400'}`}>支出</button>
        <button onClick={()=>{setType('income');setCat('');}} className={`flex-1 py-2.5 rounded-lg text-sm font-semibold ${type==='income'?'bg-white text-green-500 shadow-sm':'text-gray-400'}`}>收入</button>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
        <div className="text-xs text-gray-400 mb-2">{type==='expense'?'支出金额':'收入金额'}</div>
        <div className="flex items-center gap-2"><span className="text-2xl font-bold text-gray-400">¥</span><input type="number" inputMode="decimal" placeholder="0.00" value={amount} onChange={e=>setAmount(e.target.value)} className="flex-1 text-3xl font-bold outline-none amount-font bg-transparent" autoFocus /></div>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
        <div className="text-xs text-gray-400 mb-3">选择分类</div>
        <div className="grid grid-cols-3 gap-2">
          {cats.map(c=>(
            <button key={c} onClick={()=>setCat(c)} className={`py-2.5 px-2 rounded-xl text-xs font-medium transition-all ${cat===c?(type==='expense'?'bg-red-50 text-red-500 border-red-200':'bg-green-50 text-green-500 border-green-200'):'bg-gray-50 text-gray-600 border-transparent'} border`}>{c}</button>
          ))}
        </div>
      </div>

      {cat==='其他'&&(
        <div className="bg-white rounded-2xl p-5 shadow-sm mb-4 fade-in">
          <input type="text" placeholder="请详细说明..." value={detail} onChange={e=>setDetail(e.target.value)} className="w-full outline-none text-sm bg-transparent" autoFocus />
        </div>
      )}

      {type==='expense'&&(
        <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
          <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={fc} onChange={e=>setFc(e.target.checked)} className="w-5 h-5 rounded accent-orange-400" /><span className="text-sm text-gray-600">亲属卡支付</span></label>
        </div>
      )}

      <button onClick={submit} disabled={submitting||!amount||!cat||(cat==='其他'&&!detail.trim())} className={`w-full py-4 rounded-2xl text-white font-bold text-lg transition-all ${!amount||!cat||(cat==='其他'&&!detail.trim())?'bg-gray-300':type==='expense'?'bg-red-500 active:bg-red-600':'bg-green-500 active:bg-green-600'} flex items-center justify-center gap-2`}>
        {submitting&&<div className="spinner" />}{ok?'✅ 已记录':type==='expense'?'记录支出':'记录收入'}
      </button>
    </div>
  );
}

// ==================== 亚马逊 ====================

function AmazonPage({ records, settings }: { records: Record[]; settings: UserSettings | null }) {
  const periods = [{l:'1天',d:1},{l:'3天',d:3},{l:'7天',d:7},{l:'30天',d:30},{l:'半年',d:183},{l:'1年',d:365}];
  const [days, setDays] = useState<number|null>(30);
  const [cs, setCs] = useState(''); const [ce, setCe] = useState('');
  const [cm, setCm] = useState(false);

  const amz = records.filter(r=>(r.type==='expense'&&r.category===AMAZON_EXPENSE)||(r.type==='income'&&r.category===AMAZON_INCOME));

  let start='', end='';
  if (cm&&cs&&ce) { start=new Date(cs+'T00:00:00+08:00').toISOString(); end=new Date(ce+'T23:59:59+08:00').toISOString(); }
  else if (days!==null) { end=nowBJ(); start=new Date(Date.now()-days*86400000).toISOString(); }

  const rs = start&&end ? amz.filter(r=>r.timestamp>=start&&r.timestamp<=end) : amz;
  const inc = rs.filter(r=>r.type==='income').reduce((s,r)=>s+r.amount,0);
  const exp = rs.filter(r=>r.type==='expense').reduce((s,r)=>s+r.amount,0);
  const profit = inc - exp;
  const totalInc = records.filter(r=>r.type==='income').reduce((s,r)=>s+r.amount,0);
  const totalExp = records.filter(r=>r.type==='expense').reduce((s,r)=>s+r.amount,0);
  const bal = (settings?.initial_balance||0)+totalInc-totalExp;
  const ip = totalInc>0?inc/totalInc*100:0;
  const ep = totalExp>0?exp/totalExp*100:0;
  const pp = bal>0?profit/bal*100:0;

  return (
    <div className="fade-in px-4 pt-6">
      <h2 className="text-lg font-bold mb-4">📦 亚马逊板块</h2>
      <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
        <div className="flex flex-wrap gap-2 mb-3">
          {periods.map(p=>(<button key={p.l} onClick={()=>{setDays(p.d);setCm(false);}} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${!cm&&days===p.d?'bg-orange-500 text-white':'bg-gray-100 text-gray-600'}`}>{p.l}</button>))}
          <button onClick={()=>setCm(true)} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${cm?'bg-orange-500 text-white':'bg-gray-100 text-gray-600'}`}>自定义</button>
        </div>
        {cm&&(<div className="flex gap-2 items-center text-sm"><input type="date" value={cs} onChange={e=>setCs(e.target.value)} className="flex-1 bg-gray-50 rounded-lg px-3 py-2 outline-none" /><span className="text-gray-400">至</span><input type="date" value={ce} onChange={e=>setCe(e.target.value)} className="flex-1 bg-gray-50 rounded-lg px-3 py-2 outline-none" /></div>)}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <ACard label="亚马逊收入" v={inc} c="text-green-500" />
        <ACard label="亚马逊支出" v={exp} c="text-red-500" />
        <ACard label="利润" v={profit} c={profit>=0?'text-blue-500':'text-red-500'} />
        <ACard label="利润占比" v={pp} c="text-gray-700" pct />
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-500 mb-3">占总个人资金比例</h3>
        <div className="space-y-2">
          <PctRow label="亚马逊收入" v={ip} />
          <PctRow label="亚马逊支出" v={ep} />
          <PctRow label="亚马逊利润" v={pp} c="text-blue-500" />
        </div>
      </div>
    </div>
  );
}

function ACard({ label, v, c, pct }: { label: string; v: number; c: string; pct?: boolean }) {
  return <div className="bg-white rounded-2xl p-4 shadow-sm"><div className="text-xs text-gray-400 mb-1">{label}</div><div className={`text-xl font-bold amount-font ${c}`}>{pct?v.toFixed(1)+'%':fmt(v)}</div></div>;
}

function PctRow({ label, v, c }: { label: string; v: number; c?: string }) {
  return <div className="flex items-center gap-2"><span className="text-sm text-gray-500 flex-1">{label}</span><div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden"><div className={`h-full rounded-full ${c||'bg-orange-400'}`} style={{width:`${Math.min(v,100)}%`}}/></div><span className="text-xs font-medium text-gray-600 w-12 text-right">{v.toFixed(1)}%</span></div>;
}

// ==================== 统计页 ====================

function StatsPage({ records, targets }: { records: Record[]; targets: MonthTarget[] }) {
  const cur = getCurMonth();
  const [vy, setVy] = useState(cur.year);
  const [vm, setVm] = useState(cur.month);

  const mr = records.filter(r=>{const d=new Date(r.timestamp);return d.getFullYear()===vy&&d.getMonth()+1===vm;});
  const pm = vm===1?12:vm-1; const py = vm===1?vy-1:vy;
  const pr = records.filter(r=>{const d=new Date(r.timestamp);return d.getFullYear()===py&&d.getMonth()+1===pm;});
  const ly = vy-1;
  const lr = records.filter(r=>{const d=new Date(r.timestamp);return d.getFullYear()===ly&&d.getMonth()+1===vm;});

  const allCats = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];
  const stats = allCats.map(cat=>{
    const cur= mr.filter(r=>r.category===cat).reduce((s,r)=>s+r.amount,0);
    const prev= pr.filter(r=>r.category===cat).reduce((s,r)=>s+r.amount,0);
    const lyv= lr.filter(r=>r.category===cat).reduce((s,r)=>s+r.amount,0);
    const mom=prev>0?((cur-prev)/prev)*100:(cur>0?100:0);
    const yoy=lyv>0?((cur-lyv)/lyv)*100:(cur>0?100:0);
    return {cat,cur,prev,lyv,mom,yoy};
  }).filter(s=>s.cur>0||s.prev>0||s.lyv>0).sort((a,b)=>b.cur-a.cur);

  const ct = targets.find(t=>t.year===vy&&t.month===vm);
  const mNet = mr.filter(r=>r.type==='income').reduce((s,r)=>s+r.amount,0) - mr.filter(r=>r.type==='expense').reduce((s,r)=>s+r.amount,0);

  return (
    <div className="fade-in px-4 pt-6">
      <div className="flex items-center justify-center gap-4 mb-4">
        <button onClick={()=>{if(vm===1){setVm(12);setVy(vy-1);}else setVm(vm-1);}} className="text-gray-400 text-xl p-2">‹</button>
        <span className="font-bold text-lg">{vy}年{vm}月</span>
        <button onClick={()=>{if(vm===12){setVm(1);setVy(vy+1);}else setVm(vm+1);}} className="text-gray-400 text-xl p-2">›</button>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
        <div className="grid grid-cols-2 gap-3">
          <Mini label="总收入" v={mr.filter(r=>r.type==='income').reduce((s,r)=>s+r.amount,0)} c="text-green-500" />
          <Mini label="总支出" v={mr.filter(r=>r.type==='expense').reduce((s,r)=>s+r.amount,0)} c="text-red-500" />
        </div>
        {ct && <div className="mt-3 pt-3 border-t border-gray-100 text-sm"><span className="text-gray-400">结余目标 {fmt(ct.target)}</span><span className={`float-right font-semibold ${mNet>=ct.target?'text-green-500':'text-orange-500'}`}>{fmt(mNet)} ({ct.target>0?Math.round(mNet/ct.target*100):0}%)</span></div>}
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 text-sm font-semibold text-gray-500">分类明细（环比上月 / 同比去年）</div>
        {stats.length===0?<div className="text-center py-8 text-gray-400 text-sm">暂无数据</div>:stats.map(s=>(
          <div key={s.cat} className="px-4 py-3 border-b border-gray-50 last:border-0">
            <div className="flex justify-between mb-1"><span className="text-sm font-medium">{s.cat}</span><span className="text-sm font-bold amount-font">{fmt(s.cur)}</span></div>
            <div className="flex gap-4 text-xs">
              <span className={s.mom>0?'text-red-400':s.mom<0?'text-green-400':'text-gray-400'}>环比{s.mom>0?'↑':s.mom<0?'↓':''}{Math.abs(s.mom).toFixed(1)}%</span>
              <span className={s.yoy>0?'text-red-400':s.yoy<0?'text-green-400':'text-gray-400'}>同比{s.yoy>0?'↑':s.yoy<0?'↓':''}{Math.abs(s.yoy).toFixed(1)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== 明细页 ====================

function RecordsPage({ records, onDelete }: { records: Record[]; onDelete: (id:string)=>void }) {
  const [ft, setFt] = useState<'all'|'expense'|'income'>('all');
  const [fcat, setFcat] = useState('');
  const [ds, setDs] = useState(''); const [de, setDe] = useState('');
  const [exporting, setExporting] = useState(false);

  let filtered = records;
  if (ft!=='all') filtered=filtered.filter(r=>r.type===ft);
  if (fcat) filtered=filtered.filter(r=>r.category===fcat);
  if (ds) filtered=filtered.filter(r=>r.timestamp>=new Date(ds+'T00:00:00+08:00').toISOString());
  if (de) filtered=filtered.filter(r=>r.timestamp<=new Date(de+'T23:59:59+08:00').toISOString());

  const allCats = [...new Set(records.map(r=>r.category))];

  async function exportCSV() {
    setExporting(true);
    let data = filtered;
    if (!ds && !de && ft==='all' && !fcat) data = await getAllRecords();
    const h = '\uFEFF类型,金额,分类,详细说明,亲属卡,时间\n';
    const rows = data.map(r=>{
      const t=r.type==='income'?'收入':'支出';
      const fc=r.type==='expense'?(r.is_family_card?'是':'否'):'-';
      return [t,r.amount.toFixed(2),r.category,r.detail||'',fc,formatDate(r.timestamp)+' '+formatTime(r.timestamp)].join(',');
    }).join('\n');
    const blob=new Blob([h+rows],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`财政记录_${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
    setExporting(false);
  }

  async function exportJSON() {
    setExporting(true);
    let data = filtered;
    if (!ds && !de && ft==='all' && !fcat) data = await getAllRecords();
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`财政记录_${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(url);
    setExporting(false);
  }

  return (
    <div className="fade-in px-4 pt-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold">所有明细</h2>
        <div className="flex gap-2">
          <button onClick={exportCSV} disabled={exporting} className="text-xs bg-blue-50 text-blue-500 px-3 py-1.5 rounded-lg font-medium">{exporting?'导出中...':'CSV'}</button>
          <button onClick={exportJSON} disabled={exporting} className="text-xs bg-gray-100 text-gray-500 px-3 py-1.5 rounded-lg font-medium">JSON</button>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm mb-4 space-y-3">
        <div className="flex gap-2">
          {(['all','expense','income']as const).map(t=>(<button key={t} onClick={()=>setFt(t)} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${ft===t?'bg-blue-500 text-white':'bg-gray-100 text-gray-600'}`}>{t==='all'?'全部':t==='expense'?'支出':'收入'}</button>))}
        </div>
        <div className="flex gap-2"><select value={fcat} onChange={e=>setFcat(e.target.value)} className="bg-gray-50 rounded-lg px-3 py-2 text-xs outline-none flex-1"><option value="">全部分类</option>{allCats.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
        <div className="flex gap-2 items-center text-xs"><input type="date" value={ds} onChange={e=>setDs(e.target.value)} className="bg-gray-50 rounded-lg px-3 py-2 outline-none flex-1" /><span className="text-gray-400">至</span><input type="date" value={de} onChange={e=>setDe(e.target.value)} className="bg-gray-50 rounded-lg px-3 py-2 outline-none flex-1" /></div>
      </div>

      <div className="space-y-1">
        {filtered.length===0?<div className="text-center py-8 text-gray-400 text-sm">暂无匹配记录</div>:filtered.map(r=><RecRow key={r.id} r={r} onDelete={onDelete} />)}
      </div>
    </div>
  );
}

// ==================== 设置页 ====================

function SettingsPage({ settings, onSetBalance, onLogout }: any) {
  const [bal, setBal] = useState(settings?.initial_balance?.toString()||'0');
  const [saved, setSaved] = useState(false);

  async function save() {
    const n=parseFloat(bal);
    if (isNaN(n)||n<0) return;
    await onSetBalance(n);
    setSaved(true); setTimeout(()=>setSaved(false),1500);
  }

  return (
    <div className="fade-in px-4 pt-6">
      <h2 className="text-lg font-bold mb-4">⚙️ 设置</h2>

      <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
        <div className="text-sm font-semibold text-gray-500 mb-3">初始余额</div>
        <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-3 mb-3">
          <span className="text-gray-400">¥</span>
          <input type="number" value={bal} onChange={e=>setBal(e.target.value)} className="flex-1 font-bold outline-none bg-transparent amount-font" />
        </div>
        <button onClick={save} className="w-full py-2.5 rounded-xl bg-blue-500 text-white text-sm font-bold">{saved?'✅ 已保存':'保存'}</button>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
        <div className="text-sm text-gray-500 mb-3">账号：{supabase.auth.getSession&&'已登录'}</div>
        <button onClick={onLogout} className="w-full py-2.5 rounded-xl bg-red-50 text-red-500 text-sm font-medium">退出登录</button>
      </div>
    </div>
  );
}

// ==================== 底部导航 ====================

function BottomNav({ page, onPage }: { page: Page; onPage: (p: Page) => void }) {
  const tabs: { key: Page; icon: string; label: string }[] = [
    { key:'home', icon:'🏠', label:'首页' },
    { key:'records', icon:'📋', label:'明细' },
    { key:'add', icon:'+', label:'记账' },
    { key:'amazon', icon:'📦', label:'亚马逊' },
    { key:'stats', icon:'📊', label:'统计' },
  ];

  return (
    <div className="bg-white border-t border-gray-100 flex justify-around items-center px-2 safe-bottom" style={{paddingTop:8,paddingBottom:'max(8px,env(safe-area-inset-bottom))'}}>
      {tabs.map(t=>(
        <button key={t.key} onClick={()=>onPage(t.key)} className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl transition-all ${page===t.key?'text-blue-500':'text-gray-400'}`}>
          {t.key==='add'?(
            <div className={`w-11 h-11 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-lg ${page==='add'?'bg-blue-600':'bg-blue-500'}`}>+</div>
          ):<><span className="text-xl">{t.icon}</span><span className="text-[10px] font-medium">{t.label}</span></>}
        </button>
      ))}
    </div>
  );
}

// ==================== 弹窗 ====================

function SetupModal({ onSubmit }: { onSubmit: (v: number) => Promise<void> | void }) {
  const [v, setV] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const h = async () => { 
    const n=parseFloat(v); 
    if(n>=0) { 
      setSubmitting(true); 
      await onSubmit(n); 
      setSubmitting(false); 
    } 
  };
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm slide-up shadow-xl">
        <div className="text-3xl mb-3">💰</div>
        <h2 className="text-lg font-bold mb-1">设置初始余额</h2>
        <p className="text-sm text-gray-400 mb-4">请输入您当前的个人总余额</p>
        <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-3 mb-4"><span className="text-lg text-gray-400">¥</span><input type="number" inputMode="decimal" placeholder="0.00" value={v} onChange={e=>setV(e.target.value)} className="flex-1 text-xl font-bold outline-none bg-transparent amount-font" autoFocus onKeyDown={e=>e.key==='Enter'&&h()} /></div>
        <button onClick={h} disabled={v===''||submitting} className="w-full py-3 rounded-xl bg-blue-500 text-white font-bold disabled:bg-gray-300 flex items-center justify-center gap-2">{submitting&&<div className="spinner" />}确认</button>
      </div>
    </div>
  );
}

function TargetModal({ year, month, onSubmit }: { year: number; month: number; onSubmit: (v: number) => Promise<void> | void }) {
  const [v, setV] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const h = async () => { 
    const n=parseFloat(v); 
    if(n>=0) { 
      setSubmitting(true); 
      await onSubmit(n); 
      setSubmitting(false); 
    } 
  };
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm slide-up shadow-xl">
        <div className="text-3xl mb-3">🎯</div>
        <h2 className="text-lg font-bold mb-1">设置本月结余目标</h2>
        <p className="text-sm text-gray-400 mb-4">{year}年{month}月</p>
        <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-3 mb-4"><span className="text-lg text-gray-400">¥</span><input type="number" inputMode="decimal" placeholder="0.00" value={v} onChange={e=>setV(e.target.value)} className="flex-1 text-xl font-bold outline-none bg-transparent amount-font" autoFocus onKeyDown={e=>e.key==='Enter'&&h()} /></div>
        <div className="flex gap-2"><button onClick={()=>onSubmit(0)} className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-500 font-medium text-sm">跳过</button><button onClick={h} disabled={v===''||submitting} className="flex-1 py-3 rounded-xl bg-blue-500 text-white font-bold disabled:bg-gray-300 flex items-center justify-center gap-2">{submitting&&<div className="spinner" />}设置</button></div>
      </div>
    </div>
  );
}
