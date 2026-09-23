import { Booking } from '../types';
import { getTodayStr } from '../utils/dateUtils';
import { playNotificationChime } from '../utils/soundUtils';

export interface FeedingReminderEvent {
  dogName: string;
  kennelNumber?: number | 'home' | string;
  timeStr: string;
  type: 'food' | 'meds';
  details: string;
}

let reminderInterval: any = null;
const notifiedKeys = new Set<string>();

/**
 * Extracts time strings like "08:00", "8:30", "18:00" from text
 */
export function extractTimesFromText(text?: string): string[] {
  if (!text) return [];
  const regex = /\b([01]?\d|2[0-3]):([0-5]\d)\b/g;
  const matches: string[] = [];
  let m;
  while ((m = regex.exec(text)) !== null) {
    // Normalize to HH:MM (e.g., 8:00 -> 08:00)
    const [hh, mm] = m[0].split(':');
    matches.push(`${hh.padStart(2, '0')}:${mm}`);
  }
  return Array.from(new Set(matches));
}

/**
 * Checks if current time in Israel matches any feeding or medication reminders
 */
export function checkUpcomingReminders(
  bookings: Booking[],
  todayStr: string = getTodayStr(),
  now: Date = new Date()
): FeedingReminderEvent[] {
  // Get current HH:MM in Israel
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jerusalem',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false
  });

  const parts = dtf.formatToParts(now);
  let curHour = 0;
  let curMinute = 0;
  for (const p of parts) {
    if (p.type === 'hour') curHour = parseInt(p.value, 10);
    if (p.type === 'minute') curMinute = parseInt(p.value, 10);
  }

  const curTimeStr = `${String(curHour).padStart(2, '0')}:${String(curMinute).padStart(2, '0')}`;

  const activeToday = bookings.filter(b => {
    if (b.stayStatus === 'cancelled') return false;
    return b.startDate <= todayStr && b.endDate >= todayStr;
  });

  const matchedReminders: FeedingReminderEvent[] = [];

  activeToday.forEach(b => {
    const kNum = b.kennelNumber;
    const dogName = b.dogName || 'כלב';

    // 1. Check Feeding Schedule
    const feedingTimes = extractTimesFromText(b.feedingSchedule);
    feedingTimes.forEach(t => {
      if (t === curTimeStr) {
        matchedReminders.push({
          dogName,
          kennelNumber: kNum,
          timeStr: t,
          type: 'food',
          details: b.foodPortion || b.specialDiet || 'האכלה מתוזמנת',
        });
      }
    });

    // 2. Check Medication Schedule
    const medText = b.medicationSchedule || b.medications || '';
    const medTimes = extractTimesFromText(medText);
    medTimes.forEach(t => {
      if (t === curTimeStr) {
        matchedReminders.push({
          dogName,
          kennelNumber: kNum,
          timeStr: t,
          type: 'meds',
          details: medText,
        });
      }
    });
  });

  return matchedReminders;
}

/**
 * Initializes the background reminder scheduler (runs every 30 seconds)
 */
export function initFeedingReminderScheduler(
  getBookings: () => Booking[],
  onReminder?: (event: FeedingReminderEvent) => void
): () => void {
  if (reminderInterval) {
    clearInterval(reminderInterval);
  }

  const check = () => {
    try {
      const todayStr = getTodayStr();
      const bookings = getBookings();
      const reminders = checkUpcomingReminders(bookings, todayStr);

      reminders.forEach(r => {
        const key = `${todayStr}_${r.dogName}_${r.timeStr}_${r.type}`;
        if (notifiedKeys.has(key)) return;
        notifiedKeys.add(key);

        // Play chime
        playNotificationChime();

        // Browser Desktop Notification
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          const title = r.type === 'food'
            ? `🥣 תזכורת האכלה: ${r.dogName} ${r.kennelNumber ? `(תא ${r.kennelNumber})` : ''}`
            : `💊 תזכורת תרופה: ${r.dogName} ${r.kennelNumber ? `(תא ${r.kennelNumber})` : ''}`;
          const body = `השעה ${r.timeStr}! הנחיה: ${r.details}`;
          try {
            new Notification(title, {
              body,
              icon: '/favicon.ico',
            });
          } catch {}
        }

        // Trigger callback for UI toast
        if (onReminder) {
          onReminder(r);
        }
      });
    } catch (e) {
      console.warn('Feeding reminder scheduler error:', e);
    }
  };

  // Run initial check and set interval
  check();
  reminderInterval = setInterval(check, 30000);

  return () => {
    if (reminderInterval) {
      clearInterval(reminderInterval);
      reminderInterval = null;
    }
  };
}
