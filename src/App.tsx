import { useState, useEffect, useCallback } from 'react';
import {
  supabase,
  addRecord,
  deleteRecord,
  getRecords,
  getUserSettings,
  upsertUserSettings,
  getMonthTargets,
  upsertMonthTarget,
} from './supabase';
import type { Record as FinRecord, MonthTarget, UserSettings } from './supabase';
import AuthPage from './pages/AuthPage';
import HomePage from './pages/HomePage';
import AddPage from './pages/AddPage';
import RecordsPage from './pages/RecordsPage';
import StatsPage from './pages/StatsPage';
import AmazonPage from './pages/AmazonPage';
import SettingsPage from './pages/SettingsPage';

type Page = 'home' | 'add' | 'amazon' | 'stats' | 'records' | 'settings';

const SIDEBAR_ITEMS: { key: Page; icon: string; label: string }[] = [
  { key: 'home', icon: '💰', label: '总览' },
  { key: 'records', icon: '📋', label: '明细' },
  { key: 'stats', icon: '📊', label: '统计' },
  { key: 'amazon', icon: '📦', label: '亚马逊' },
  { key: 'settings', icon: '⚙️', label: '设置' },
];

const MOBILE_TABS: { key: Page; icon: string; label: string }[] = [
  { key: 'home', icon: '🏠', label: '首页' },
  { key: 'records', icon: '📋', label: '明细' },
  { key: 'add', icon: '+', label: '记账' },
  { key: 'amazon', icon: '📦', label: '亚马逊' },
  { key: 'stats', icon: '📊', label: '统计' },
];

const PAGE_TITLES: Record<Page, string> = {
  home: '总览',
  add: '记一笔',
  amazon: '亚马逊',
  stats: '统计',
  records: '明细',
  settings: '设置',
};

export default function App() {
  const [page, setPage] = useState<Page>('home');
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [records, setRecords] = useState<FinRecord[]>([]);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [targets, setTargets] = useState<MonthTarget[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
      if (sess) loadUserData();
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, sess) => {
      setSession(sess);
      if (sess) loadUserData();
      else setDataLoaded(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadUserData() {
    try {
      const [recs, stgs, tgs] = await Promise.all([
        getRecords(500),
        getUserSettings(),
        getMonthTargets(),
      ]);
      setRecords(recs);
      setSettings(stgs);
      setTargets(tgs);
      setDataLoaded(true);
    } catch (e) {
      console.error(e);
    }
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

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setDataLoaded(false);
  }, []);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--apple-bg)]">
        <div className="spinner" />
      </div>
    );
  }

  if (!session) {
    return <AuthPage onLogin={() => { loadUserData(); }} />;
  }

  if (!dataLoaded) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--apple-bg)]">
        <div className="spinner" />
      </div>
    );
  }

  const userEmail = session.user?.email || '';

  function renderPage() {
    switch (page) {
      case 'home':
        return <HomePage records={records} settings={settings} targets={targets} onSetBalance={handleSetBalance} onSetTarget={handleSetTarget} onDelete={handleDelete} />;
      case 'add':
        return <AddPage onAdd={handleAdd} />;
      case 'records':
        return <RecordsPage records={records} onDelete={handleDelete} />;
      case 'stats':
        return <StatsPage records={records} targets={targets} />;
      case 'amazon':
        return <AmazonPage records={records} settings={settings} />;
      case 'settings':
        return <SettingsPage settings={settings} onSetBalance={handleSetBalance} onLogout={handleLogout} />;
      default:
        return null;
    }
  }

  return (
    <>
      {/* 桌面端 */}
      <div className="hidden md:flex h-screen bg-[var(--apple-bg)]">
        <aside className="w-[240px] flex-shrink-0 flex flex-col glass-strong border-r border-white/60">
          <div className="px-6 py-7">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xl shadow-md">💰</div>
              <span className="text-lg font-bold tracking-tight">财政记录</span>
            </div>
          </div>

          <nav className="flex-1 px-4 space-y-1">
            {SIDEBAR_ITEMS.map(item => (
              <button
                key={item.key}
                onClick={() => setPage(item.key)}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[15px] font-medium transition-all
                  ${page === item.key
                    ? 'bg-blue-500 text-white shadow-md shadow-blue-200'
                    : 'text-gray-600 hover:bg-white/60'
                  }
                `}
              >
                <span className="text-lg">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>

          <div className="p-4 border-t border-gray-200/60">
            <div className="text-xs text-gray-500 truncate mb-2 px-2">{userEmail}</div>
            <button onClick={handleLogout} className="w-full text-left px-4 py-2.5 rounded-xl text-sm text-red-500 hover:bg-red-50 transition-colors">
              退出登录
            </button>
          </div>
        </aside>

        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <header className="h-[70px] flex items-center justify-between px-8 glass border-b border-white/40 flex-shrink-0">
            <h1 className="text-xl font-bold tracking-tight">{PAGE_TITLES[page]}</h1>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-sm">👤</div>
              <span className="text-sm text-gray-600 hidden lg:block">{userEmail}</span>
            </div>
          </header>
          <div className="flex-1 overflow-auto">
            {renderPage()}
          </div>
        </main>
      </div>

      {/* 移动端 */}
      <div className="flex flex-col h-screen md:hidden bg-[var(--apple-bg)]">
        <main className="flex-1 overflow-auto pb-24">
          {renderPage()}
        </main>
        <nav className="fixed bottom-0 left-0 right-0 z-40 glass-strong border-t border-white/60 safe-bottom">
          <div className="flex items-center justify-around px-2" style={{ paddingTop: 8, paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}>
            {MOBILE_TABS.map(item => (
              <button
                key={item.key}
                onClick={() => setPage(item.key)}
                className={`flex flex-col items-center gap-1 py-2 px-3 rounded-xl transition-all ${page === item.key ? 'text-blue-500' : 'text-gray-400'}`}
              >
                {item.key === 'add' ? (
                  <div className="w-12 h-12 -mt-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-2xl font-bold shadow-lg shadow-blue-300/50">
                    +
                  </div>
                ) : (
                  <>
                    <span className="text-xl">{item.icon}</span>
                    <span className="text-[10px] font-medium">{item.label}</span>
                  </>
                )}
              </button>
            ))}
          </div>
        </nav>
      </div>
    </>
  );
}
