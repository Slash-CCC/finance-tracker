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

// ==================== ç±»å ====================

type Page = 'home' | 'add' | 'amazon' | 'stats' | 'records' | 'settings';

// ==================== å¯¼èªéç½® ====================

const SIDEBAR_ITEMS: { key: Page; icon: string; label: string }[] = [
  { key: 'home', icon: 'ð°', label: 'æ»è§' },
  { key: 'records', icon: 'ð', label: 'æç»' },
  { key: 'stats', icon: 'ð', label: 'ç»è®¡' },
  { key: 'amazon', icon: 'ð¦', label: 'äºé©¬é?' },
  { key: 'settings', icon: 'âï¸', label: 'è®¾ç½®' },
];

const MOBILE_TABS: { key: Page; icon: string; label: string }[] = [
  { key: 'home', icon: 'ð ', label: 'é¦é¡µ' },
  { key: 'records', icon: 'ð', label: 'æç»' },
  { key: 'add', icon: '+', label: 'è®°è´¦' },
  { key: 'amazon', icon: 'ð¦', label: 'äºé©¬é?' },
  { key: 'stats', icon: 'ð', label: 'ç»è®¡' },
];

const PAGE_TITLES: Record<Page, string> = {
  home: 'æ»è§',
  add: 'è®°è´¦',
  amazon: 'äºé©¬é?',
  stats: 'ç»è®¡',
  records: 'æç»',
  settings: 'è®¾ç½®',
};

// ==================== App ====================

export default function App() {
  const [page, setPage] = useState<Page>('home');
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // æ°æ®
  const [records, setRecords] = useState<FinRecord[]>([]);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [targets, setTargets] = useState<MonthTarget[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  // è®¤è¯ç¶æ?
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
      if (sess) {
        loadUserData();
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, sess) => {
      setSession(sess);
      if (sess) {
        loadUserData();
      } else {
        setDataLoaded(false);
      }
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
      console.error('Failed to load user data:', e);
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

  // å è½½ä¸?
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--apple-bg)]">
        <div className="spinner" />
      </div>
    );
  }

  // æªç»å½?
  if (!session) {
    return <AuthPage onLogin={loadUserData} />;
  }

  // æ°æ®å è½½ä¸?
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
      {/* ===== æ¡é¢ç«¯å¸å± ===== */}
      <div className="hidden md:flex h-screen bg-[var(--apple-bg)]">
        {/* ä¾§è¾¹æ ? */}
        <aside className="w-[220px] flex-shrink-0 flex flex-col glass-strong border-r border-white/50">
          {/* Logo */}
          <div className="px-6 py-6">
            <div className="flex items-center gap-3">
              <span className="text-2xl">ð°</span>
              <span className="text-[17px] font-bold text-[var(--apple-text)]">è´¢æ¿è®°å½</span>
            </div>
          </div>

          {/* å¯¼èª */}
          <nav className="flex-1 px-3">
            {SIDEBAR_ITEMS.map(item => (
              <button
                key={item.key}
                onClick={() => setPage(item.key)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-[15px] font-medium transition-all mb-1 ${
                  page === item.key
                    ? 'bg-[var(--apple-blue)] text-white'
                    : 'text-[var(--apple-text-secondary)] hover:bg-[var(--apple-gray-1)]'
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          {/* åºé¨ç¨æ·ä¿¡æ¯ */}
          <div className="px-4 py-4 border-t border-[var(--apple-gray-2)]">
            <div className="text-[13px] text-[var(--apple-text-secondary)] truncate mb-2">
              {userEmail}
            </div>
            <button
              onClick={handleLogout}
              className="text-[13px] text-[var(--apple-red)] hover:bg-red-50 px-2 py-1 rounded-lg transition-colors"
            >
              éåºç»å½?
            </button>
          </div>
        </aside>

        {/* ä¸»åå®¹åº */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Header */}
          <header className="h-14 flex-shrink-0 glass-subtle border-b border-white/50 flex items-center justify-between px-6">
            <h1 className="text-[17px] font-semibold text-[var(--apple-text)]">
              {PAGE_TITLES[page]}
            </h1>
            <div className="flex items-center gap-3">
              <span className="text-[13px] text-[var(--apple-text-secondary)]">{userEmail}</span>
              <button
                onClick={handleLogout}
                className="btn-ghost text-[13px]"
              >
                éå?
              </button>
            </div>
          </header>

          {/* åå®¹å? */}
          <main className="flex-1 overflow-auto">
            {renderPage()}
          </main>
        </div>
      </div>

      {/* ===== ç§»å¨ç«¯å¸å± ===== */}
      <div className="flex flex-col h-screen md:hidden bg-[var(--apple-bg)]">
        {/* åå®¹å? */}
        <main className="flex-1 overflow-auto safe-bottom">
          {renderPage()}
        </main>

        {/* åºé¨å¯¼èª */}
        <BottomNav page={page} onPage={setPage} />
      </div>
    </>
  );
}

// ==================== åºé¨å¯¼èª ====================

function BottomNav({ page, onPage }: { page: Page; onPage: (p: Page) => void }) {
  return (
    <nav className="glass-strong border-t border-white/50 flex justify-around items-center px-2 safe-bottom"
      style={{ paddingTop: 8, paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
      {MOBILE_TABS.map(tab => (
        <button
          key={tab.key}
          onClick={() => onPage(tab.key)}
          className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl transition-all ${
            page === tab.key ? 'text-[var(--apple-blue)]' : 'text-[var(--apple-text-secondary)]'
          }`}
        >
          {tab.key === 'add' ? (
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-lg transition-all ${
              page === 'add' ? 'bg-[var(--apple-blue)] scale-110' : 'bg-[var(--apple-blue)]'
            }`}>
              +
            </div>
          ) : (
            <>
              <span className="text-xl">{tab.icon}</span>
              <span className="text-[10px] font-medium">{tab.label}</span>
            </>
          )}
        </button>
      ))}
    </nav>
  );
}
