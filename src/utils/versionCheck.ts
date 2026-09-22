// Automatic Live App Freshness & Version Watcher
// Ensures that whenever Shmulik opens or returns to the app (on PC, mobile, PWA, or browser tab),
// the app is always 100% refreshed with the latest data and code.

declare const __APP_BUILD_TIME__: number;

const CURRENT_BUILD_TIME: number = typeof __APP_BUILD_TIME__ !== 'undefined' ? __APP_BUILD_TIME__ : Date.now();
const LOCAL_VERSION_KEY = 'resort_last_loaded_build_time';

let isChecking = false;

/**
 * Purges legacy service workers and browser caches to prevent stale bundles
 */
export async function purgeStaleCaches(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.unregister();
      }
    }
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      for (const name of cacheNames) {
        await caches.delete(name);
      }
    }
  } catch (err) {
    console.warn('Error purging stale caches:', err);
  }
}

/**
 * Checks server for a new build deployment. If newer version exists, reloads page cleanly.
 */
export async function checkForNewVersion(): Promise<boolean> {
  if (isChecking || typeof window === 'undefined') return false;
  isChecking = true;

  try {
    const res = await fetch(`/version.json?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });

    if (!res.ok) return false;

    const data = await res.json();
    const serverBuildTime = Number(data.buildTime) || 0;

    const savedBuildTime = Number(localStorage.getItem(LOCAL_VERSION_KEY)) || CURRENT_BUILD_TIME;

    if (serverBuildTime > 0 && serverBuildTime > savedBuildTime) {
      console.log(`[VersionCheck] New version detected on server (${serverBuildTime} > ${savedBuildTime}). Refreshing app...`);
      localStorage.setItem(LOCAL_VERSION_KEY, String(serverBuildTime));
      await purgeStaleCaches();
      window.location.reload();
      return true;
    } else if (serverBuildTime > 0) {
      localStorage.setItem(LOCAL_VERSION_KEY, String(serverBuildTime));
    }
  } catch (err) {
    // Network errors or offline - ignore silently
  } finally {
    isChecking = false;
  }
  return false;
}

/**
 * Initializes the automatic freshness and version watcher across all devices.
 */
export function initAppFreshnessWatcher(onDataRefresh?: () => void): () => void {
  if (typeof window === 'undefined') return () => {};

  // 1. Initial cleanup of stale service workers
  purgeStaleCaches();

  // 2. Handler when user returns to app (focus, visibility change, unlock mobile screen, pageshow)
  const handleAppAwake = async () => {
    // Check if new version was deployed
    const isReloading = await checkForNewVersion();
    if (!isReloading) {
      // Trigger instant data refresh
      onDataRefresh?.();
      window.dispatchEvent(new CustomEvent('app-focus-refreshed'));
    }
  };

  window.addEventListener('focus', handleAppAwake);
  window.addEventListener('pageshow', handleAppAwake);

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      handleAppAwake();
    }
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // 3. Periodic check every 60 seconds
  const interval = setInterval(handleAppAwake, 60000);

  return () => {
    window.removeEventListener('focus', handleAppAwake);
    window.removeEventListener('pageshow', handleAppAwake);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    clearInterval(interval);
  };
}
