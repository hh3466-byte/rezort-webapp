/**
 * Audio chime and web notification utilities for Shmulik's Resort.
 * Uses native Web Audio API (zero external assets, 100% reliable offline).
 */

export function playNotificationChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    // Pleasant 3-tone notification chord: C5 (523.25Hz), E5 (659.25Hz), G5 (783.99Hz)
    const playTone = (freq: number, startTime: number, duration: number, volume: number = 0.25) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(volume, startTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const now = ctx.currentTime;
    playTone(523.25, now, 0.22, 0.25);        // C5
    playTone(659.25, now + 0.12, 0.22, 0.25); // E5
    playTone(783.99, now + 0.24, 0.45, 0.3);  // G5
  } catch (e) {
    console.warn('Notification chime audio error:', e);
  }
}

/**
 * Request notification permissions and dispatch a test alert with sound
 */
export async function testSystemNotification(): Promise<{
  permission: NotificationPermission;
  soundPlayed: boolean;
  notificationSent: boolean;
}> {
  // Always play sound first
  playNotificationChime();

  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { permission: 'denied', soundPlayed: true, notificationSent: false };
  }

  let perm = Notification.permission;
  if (perm === 'default') {
    try {
      perm = await Notification.requestPermission();
    } catch (e) {
      console.warn('Error requesting permission:', e);
    }
  }

  let sent = false;
  if (perm === 'granted') {
    try {
      const notif = new Notification('🐾 בדיקת התראה – הריזורט לכלב', {
        body: 'מעולה שמוליק! צליל ההתראה והתראות הפוש של שעה 11:00 פעילים ועובדים מעולה.',
        icon: '/favicon.ico',
        tag: 'test-reminder',
        requireInteraction: false
      });
      sent = true;
      setTimeout(() => notif.close(), 7000);
    } catch (err) {
      console.warn('Failed to dispatch test notification:', err);
    }
  }

  return { permission: perm, soundPlayed: true, notificationSent: sent };
}
