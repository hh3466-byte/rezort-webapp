import { supabase } from '../utils/supabase';
import { sendGreenApiDirectMessage } from './notificationService';
import { getTodayStr } from '../utils/dateUtils';

export const SHMULIK_PHONE = '0506336896';
export const SHMULIK_CHAT_ID = '972506336896@c.us';
export const MANAGER_PHONE = '0543200007';

export interface ShmulikQuestion {
  id: string;
  questionText: string;
  type: 'yes_no' | 'free_text' | 'options';
  options?: string[];
  contextType: 'checkin' | 'checkout' | 'kennel_assignment' | 'training_status' | 'payment' | 'general';
  bookingId?: string;
  targetDogName?: string;
  targetOwnerName?: string;
  status: 'pending' | 'answered' | 'expired';
  createdAt: string;
  answeredAt?: string;
  answer?: string;
}

/**
 * Formats a question for Shmulik following strict user-defined rules:
 * - Must start with: "מערכת ניהול הריזורט שואלת אותך:"
 * - If yes/no: provides clear 1/2 buttons/options
 * - Otherwise: writes "ענה בשפה חופשית את התשובה."
 */
export function formatShmulikQuestionMessage(q: ShmulikQuestion): string {
  const lines = [
    `🐾 *מערכת ניהול הריזורט שואלת אותך:*`,
    '',
    `${q.questionText}`,
    ''
  ];

  if (q.type === 'yes_no') {
    lines.push(`1️⃣ כן`);
    lines.push(`2️⃣ לא`);
    lines.push('');
    lines.push(`*(השב 1 או 2, או "כן" / "לא")*`);
  } else if (q.type === 'options' && q.options && q.options.length > 0) {
    q.options.forEach((opt, idx) => {
      lines.push(`${idx + 1}️⃣ ${opt}`);
    });
    lines.push('');
    lines.push(`*(השב את מספר האפשרות או את התשובה)*`);
  } else {
    lines.push(`ענה בשפה חופשית את התשובה.`);
  }

  return lines.join('\n');
}

/**
 * Sends a question to Shmulik via Green-API and records it in Supabase for state tracking
 */
export async function askShmulikQuestion(
  questionData: Omit<ShmulikQuestion, 'id' | 'createdAt' | 'status'>,
  greenId?: string,
  greenToken?: string
): Promise<{ success: boolean; questionId?: string; error?: string }> {
  const questionId = `sq-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const fullQuestion: ShmulikQuestion = {
    ...questionData,
    id: questionId,
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  const messageText = formatShmulikQuestionMessage(fullQuestion);

  // Send WhatsApp message to Shmulik
  const sendRes = await sendGreenApiDirectMessage(
    SHMULIK_PHONE,
    messageText,
    greenId,
    greenToken,
    { skipHolidayCheck: true }
  );

  if (!sendRes.success) {
    return { success: false, error: sendRes.error || 'שגיאה בשליחת שאלה לשמוליק' };
  }

  // Save to Supabase settings or pending questions log
  try {
    const { data: rows } = await supabase.from('settings').select('*').limit(1);
    if (rows && rows[0]) {
      const curData = rows[0].data || {};
      const pendingQuestions = Array.isArray(curData.shmulikPendingQuestions) ? curData.shmulikPendingQuestions : [];
      // Expire older pending questions for the same booking/context
      const filtered = pendingQuestions.filter((pq: ShmulikQuestion) => {
        if (pq.bookingId && pq.bookingId === fullQuestion.bookingId) return false;
        return pq.status === 'pending';
      });

      filtered.push(fullQuestion);

      await supabase.from('settings').update({
        data: {
          ...curData,
          shmulikPendingQuestions: filtered,
          lastShmulikQuestionSent: fullQuestion
        },
        updated_at: new Date().toISOString()
      }).eq('id', rows[0].id || 'resort_config');
    }
  } catch (e) {
    console.warn('Failed to persist pending Shmulik question in Supabase:', e);
  }

  return { success: true, questionId };
}

/**
 * Parses Shmulik's incoming text answer, determines intent, and automatically updates the database
 */
export async function handleShmulikIncomingResponse(
  incomingText: string,
  greenId?: string,
  greenToken?: string
): Promise<{ handled: boolean; resultSummary?: string }> {
  const clean = incomingText.trim().toLowerCase();
  if (!clean) return { handled: false };

  // Fetch pending questions
  let pendingQuestion: ShmulikQuestion | null = null;
  let allSettingsData: any = {};
  let settingsRowId: string = 'resort_config';

  try {
    const { data: rows } = await supabase.from('settings').select('*').limit(1);
    if (rows && rows[0]) {
      settingsRowId = rows[0].id;
      allSettingsData = rows[0].data || {};
      const pendingQuestions = Array.isArray(allSettingsData.shmulikPendingQuestions) ? allSettingsData.shmulikPendingQuestions : [];
      pendingQuestion = pendingQuestions.find((pq: ShmulikQuestion) => pq.status === 'pending') || null;
    }
  } catch (e) {
    console.warn('Error querying settings for Shmulik questions:', e);
  }

  if (!pendingQuestion) {
    return { handled: false };
  }

  let isYes = clean === '1' || clean === 'כן' || clean === 'נכון' || clean === 'חיובי' || clean === 'נכנס' || clean === 'שוחרר';
  let isNo = clean === '2' || clean === 'לא' || clean === 'שלילי' || clean === 'לא נכנס' || clean === 'לא שוחרר' || clean === 'ביטל';

  let updateSummary = '';
  const bookingId = pendingQuestion.bookingId;

  if (bookingId) {
    const { data: bookingRows } = await supabase.from('bookings').select('*').eq('id', bookingId);
    const booking = bookingRows?.[0];
    const bData = booking?.data || {};

    if (pendingQuestion.contextType === 'checkin') {
      if (isYes) {
        await supabase.from('bookings').update({
          stay_status: 'checked_in',
          data: { ...bData, stayStatus: 'checked_in', startDate: getTodayStr() }
        }).eq('id', bookingId);
        updateSummary = `הכלב ${pendingQuestion.targetDogName || ''} סומן שנכנס בהצלחה לריזורט (checked_in).`;
      } else if (isNo) {
        updateSummary = `נרשם שהכלב ${pendingQuestion.targetDogName || ''} טרם נכנס.`;
      }
    } else if (pendingQuestion.contextType === 'checkout') {
      if (isYes) {
        await supabase.from('bookings').update({
          stay_status: 'checked_out',
          end_date: getTodayStr(),
          data: { ...bData, stayStatus: 'checked_out', endDate: getTodayStr(), kennelNumber: undefined }
        }).eq('id', bookingId);
        updateSummary = `הכלב ${pendingQuestion.targetDogName || ''} סומן כמשוחרר הביתה (checked_out) והחדר פונה.`;
      } else if (isNo) {
        updateSummary = `נרשם שהכלב ${pendingQuestion.targetDogName || ''} עדיין שוהה בריזורט.`;
      }
    } else if (pendingQuestion.contextType === 'kennel_assignment') {
      // Free text room parsing
      let kennelCode = '';
      if (clean.includes('סוויטה 1') || clean === '11') kennelCode = 'suite_1';
      else if (clean.includes('סוויטה 2') || clean === '12') kennelCode = 'suite_2';
      else if (clean.includes('סוויטה 3') || clean === '13') kennelCode = 'suite_3';
      else if (clean.includes('סוויטה 4') || clean === '14') kennelCode = 'suite_4';
      else if (clean.includes('חדר 1') || clean === '1') kennelCode = 'room_1';
      else if (clean.includes('חדר 2') || clean === '2') kennelCode = 'room_2';
      else if (clean.includes('חדר 3') || clean === '3') kennelCode = 'room_3';
      else if (clean.includes('חדר 4') || clean === '4') kennelCode = 'room_4';
      else if (clean.includes('חדר 5') || clean === '5') kennelCode = 'room_5';
      else if (clean.includes('חדר 6') || clean === '6') kennelCode = 'room_6';
      else if (clean.includes('חדר 7') || clean === '7') kennelCode = 'room_7';
      else if (clean.includes('בית') || clean.includes('הלנה ביתית')) kennelCode = 'home';
      else if (clean.includes('שביל מזרחי')) kennelCode = 'east_path';
      else if (clean.includes('שביל מערבי')) kennelCode = 'west_path';
      else if (clean.includes('חצר')) kennelCode = 'main_yard';

      if (kennelCode) {
        await supabase.from('bookings').update({
          stay_status: 'checked_in',
          data: { ...bData, kennelNumber: kennelCode, stayStatus: 'checked_in' }
        }).eq('id', bookingId);
        updateSummary = `הכלב ${pendingQuestion.targetDogName || ''} שובץ בהצלחה ל-${kennelCode} בלוח החדרים.`;
      } else {
        updateSummary = `נקלטה תשובת שמוליק: "${incomingText}".`;
      }
    }
  } else {
    updateSummary = `נקלטה תשובת שמוליק לשאלת המערכת: "${incomingText}".`;
  }

  // Mark question as answered in Supabase
  try {
    const pendingQuestions = Array.isArray(allSettingsData.shmulikPendingQuestions) ? allSettingsData.shmulikPendingQuestions : [];
    const updatedQuestions = pendingQuestions.map((pq: ShmulikQuestion) => {
      if (pq.id === pendingQuestion!.id) {
        return { ...pq, status: 'answered', answeredAt: new Date().toISOString(), answer: incomingText };
      }
      return pq;
    });

    await supabase.from('settings').update({
      data: {
        ...allSettingsData,
        shmulikPendingQuestions: updatedQuestions
      }
    }).eq('id', settingsRowId);
  } catch (e) {
    console.warn('Failed to update question status in Supabase:', e);
  }

  // Send confirmation back to Shmulik
  const ackMsg = `✅ *תודה שמוליק, התשובה נקלטה במערכת!* \n${updateSummary}\nהיומן עודכן בהתאם 🙏`;
  await sendGreenApiDirectMessage(SHMULIK_PHONE, ackMsg, greenId, greenToken, { skipHolidayCheck: true });

  // Send notification to Manager
  const managerMsg = `📲 *עדכון ממענה של שמוליק לשאלת מערכת:*\n• *שאלה:* ${pendingQuestion.questionText}\n• *תשובת שמוליק:* "${incomingText}"\n• *פעולה שבוצעה:* ${updateSummary}`;
  await sendGreenApiDirectMessage(MANAGER_PHONE, managerMsg, greenId, greenToken, { skipHolidayCheck: true });

  return { handled: true, resultSummary: updateSummary };
}
