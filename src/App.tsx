import { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard, ReceiptText, BarChart3, Package, Settings, CirclePlus,
} from 'lucide-react';
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

const SIDEBAR_ITEMS: { key: Page; label: string; Icon: typeof LayoutDashboard }[] = [
  { key: 'home', label: '总览', Icon: LayoutDashboard },
  { key: 'add', label: '记录', Icon: CirclePlus },
  { key: 'records', label: '明细', Icon: ReceiptText },
  { key: 'stats', label: '统计', Icon: BarChart3 },
  { key: 'amazon', label: '亚马逊', Icon: Package },
  { key: 'settings', label: '设置', Icon: Settings },
];

const MOBILE_TABS: { key: Page; label: string; Icon: typeof LayoutDashboard }[] = [
  { key: 'home', label: '首页', Icon: LayoutDashboard },
  { key: 'records', label: '明细', Icon: ReceiptText },
  { key: 'add', label: '记账', Icon: LayoutDashboard },
  { key: 'amazon', label: '亚马逊', Icon: Package },
  { key: 'stats', label: '统计', Icon: BarChart3 },
];


export default function App() {
  const [page, setPage] = useState<Page>('home');
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [records, setRecords] = useState<FinRecord[]>([]);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [targets, setTargets] = useState<MonthTarget[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  // 网络状态
  const [, setIsOnline] = useState(navigator.onLine);
  const [showOfflineBar, setShowOfflineBar] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowOfflineBar(false);
      // 恢复联网后重新获取云端数据
      if (session) loadUserData();
    };
    const handleOffline = () => {
      setIsOnline(false);
      setShowOfflineBar(true);
    };

    window.addEventListener('app:online', handleOnline);
    window.addEventListener('app:offline', handleOffline);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('app:online', handleOnline);
      window.removeEventListener('app:offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [session]);

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
    if (!navigator.onLine) {
      setDataLoaded(true); // 离线时也允许使用已缓存的数据
      return;
    }
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
      setDataLoaded(true); // 即使失败也允许使用缓存数据
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
        return <HomePage records={records} settings={settings} targets={targets} onSetBalance={handleSetBalance} onSetTarget={handleSetTarget} onDelete={handleDelete} userEmail={userEmail} onLogout={handleLogout} />;
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
      {/* 离线提示条 */}
      {showOfflineBar && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
          background: '#fef2f2', color: '#dc2626', textAlign: 'center',
          padding: '10px 16px', fontSize: 13, fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          borderBottom: '1px solid #fecaca',
        }}>
          <span style={{width:8,height:8,borderRadius:'50%',background:'#dc2626',display:'inline-block',animation:'pulse 2s infinite'}} />
          当前处于离线状态，数据可能不是最新
        </div>
      )}

      {/* 桌面端 */}
      <div className="hidden md:flex h-screen bg-[var(--apple-bg)]">
        <aside className="w-[260px] flex-shrink-0 flex flex-col bg-white border-r border-gray-100">
          <div className="px-6 py-8 flex items-center gap-3">
            <img src="/icon-192.png" alt="" style={{ width: 40, height: 40, borderRadius: 10 }} />
            <span className="text-2xl font-bold tracking-tight">财政管家</span>
          </div>

          <nav className="flex-1 px-4 space-y-0.5">
            {SIDEBAR_ITEMS.map(item => (
              <button
                key={item.key}
                onClick={() => setPage(item.key)}
                className={`
                  w-full text-left flex items-center gap-3 rounded-none text-[15px] font-medium transition-all duration-200
                  ${page === item.key
                    ? 'bg-blue-500 text-white shadow-md shadow-blue-200 scale-[1.02]'
                    : 'text-gray-600 hover:bg-blue-50 hover:text-blue-500'
                  }
                `}
                style={{ padding: '14px 20px' }}
              >
                <item.Icon size={18} strokeWidth={1.8} />
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="flex-1 overflow-auto">
            {renderPage()}
          </div>
        </main>
      </div>

      {/* 移动端 */}
      <div className="flex flex-col h-screen md:hidden bg-[var(--apple-bg)]" style={{ overflow: 'hidden' }}>
        <main className="flex-1 overflow-y-auto" style={{ paddingBottom: 64, overflowX: 'hidden', WebkitOverflowScrolling: 'touch' }}>
          {renderPage()}
        </main>
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-100" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          <div className="flex items-center justify-around px-2" style={{ paddingTop: 6, paddingBottom: 4 }}>
            {MOBILE_TABS.map(item => (
              <button
                key={item.key}
                onClick={() => setPage(item.key)}
                className={`flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-lg transition-all ${page === item.key ? 'text-blue-500' : 'text-gray-400'}`}
              >
                {item.key === 'add' ? (
                  <div className="w-12 h-12 -mt-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-2xl font-bold shadow-lg shadow-blue-300/50">
                    +
                  </div>
                ) : (
                  <>
                    <item.Icon size={20} strokeWidth={1.8} />
                    <span className="text-[11px] font-medium">{item.label}</span>
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
