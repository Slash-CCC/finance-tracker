import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// ====== 注册 Service Worker ======
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.log('[PWA] Service Worker 注册成功:', registration.scope);

        // 监听 SW 更新
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // 新版本已安装，通知用户刷新
              console.log('[PWA] 新版本已就绪，刷新页面以更新');
              // 可在这里触发 UI 提示
            }
          });
        });
      })
      .catch((err) => {
        console.error('[PWA] Service Worker 注册失败:', err);
      });
  });

  // 网络恢复后自动重新加载数据
  window.addEventListener('online', () => {
    console.log('[PWA] 网络已恢复');
    // 通知 App 重新加载数据
    window.dispatchEvent(new CustomEvent('app:online'));
  });

  window.addEventListener('offline', () => {
    console.log('[PWA] 网络已断开');
    window.dispatchEvent(new CustomEvent('app:offline'));
  });
}

createRoot(document.getElementById('root')!).render(<App />)
