/**
 * Power Saving & Battery Optimization Utility - הריזורט לכלב
 * 
 * Automatically pauses timers, network polling and background loops
 * when the phone screen is locked or the browser tab is hidden.
 * Resumes and triggers instant fresh sync the moment the app becomes visible.
 */

export function isTabVisible(): boolean {
  if (typeof document === 'undefined') return true;
  return document.visibilityState === 'visible';
}

/**
 * Creates a battery-aware interval that:
 * 1. Only runs when the device screen is active and tab is visible.
 * 2. Completely clears the interval when the screen is locked or tab is hidden,
 *    allowing the device CPU to enter deep sleep (saving battery).
 * 3. Immediately fires an update when the app wakes up / becomes visible.
 */
export function createPowerAwareInterval(
  callback: () => void | Promise<void>,
  intervalMs: number,
  runOnWake: boolean = true
): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }

  let timerId: any = null;

  const startTimer = () => {
    if (timerId) clearInterval(timerId);
    timerId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        try {
          callback();
        } catch (e) {
          console.warn('Power-aware interval error:', e);
        }
      }
    }, intervalMs);
  };

  const stopTimer = () => {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  };

  const handleVisibility = () => {
    if (document.visibilityState === 'visible') {
      if (runOnWake) {
        try {
          callback();
        } catch (e) {
          console.warn('Power-aware onWake error:', e);
        }
      }
      startTimer();
    } else {
      stopTimer();
    }
  };

  document.addEventListener('visibilitychange', handleVisibility);
  window.addEventListener('pageshow', handleVisibility);
  window.addEventListener('focus', handleVisibility);

  // Initial start if currently visible
  if (document.visibilityState === 'visible') {
    startTimer();
  }

  return () => {
    stopTimer();
    document.removeEventListener('visibilitychange', handleVisibility);
    window.removeEventListener('pageshow', handleVisibility);
    window.removeEventListener('focus', handleVisibility);
  };
}
