import { IntakeRequest, Booking, ResortSettings } from '../types';
import { cleanPhoneNumber, getServiceTypeHebrew, getFirstName } from '../utils/whatsappUtils';
import { formatDateIL } from '../utils/dateUtils';

/**
 * Format automated intake request notification to the Resort team
 */
export function formatIntakeNotification(request: IntakeRequest): string {
  const serviceName = getServiceTypeHebrew(request.serviceType);
  const friendlyLabel = 
    request.isFriendlyWithDogs === 'yes' ? 'כן 🟢' :
    request.isFriendlyWithDogs === 'no' ? 'לא / תוקפני / חייב בידוד 🔴' : 'תלוי בסיטואציה 🟡';

  const neuteredLabel = request.isNeutered ? 'כן ✂️' : 'לא';
  const vaccinatedLabel = request.isVaccinated ? 'כן בתוקף 💉' : 'חסר/לא ידוע ⚠️';
  const houseTrainedLabel = request.isHouseTrained !== false ? 'כן 🚽' : 'לא ⚠️';
  const parasitesLabel = request.isTreatedParasites !== false ? 'כן 🛡️' : 'לא ⚠️';

  const datesLine = request.serviceType === 'training'
    ? `📅 *תאריך כניסה מבוקש לאילוף:* החל מ-${formatDateIL(request.startDate)} (משך יסוכם בשיחה)`
    : `📅 *תאריכים:* מ-${formatDateIL(request.startDate)} עד ${formatDateIL(request.endDate)}`;

  const additionalDogsText = request.additionalDogs && request.additionalDogs.length > 0
    ? '\n🐾 *כלבים נוספים באותה בקשה:*\n' + request.additionalDogs.map((d, i) => 
        `  ${i + 2}. *${d.dogName}* (${d.dogBreed}) | ${d.sameDatesAsPrimary ? 'אותם תאריכים' : `${formatDateIL(d.startDate || '')} - ${formatDateIL(d.endDate || '')}`}`
      ).join('\n') + '\n'
    : '';

  return `🐾 *בקשת קליטה חדשה בריזורט לכלב!*
--------------------------------
👤 *בעלים:* ${request.ownerName}
📞 *טלפון:* ${request.ownerPhone}
${request.ownerAddress ? `🏠 *כתובת מגורים:* ${request.ownerAddress}\n` : ''}🐶 *כלב:* ${request.dogName} (${request.dogBreed || 'מעורב'}) | *מין:* ${request.dogGender === 'female' ? 'נקבה ♀️' : 'זכר ♂️'}
🎂 *גיל/גודל:* ${request.dogAge || 'לא צוין'} | ${request.dogSize === 'small' ? 'קטן' : request.dogSize === 'medium' ? 'בינוני' : request.dogSize === 'large' ? 'גדול' : 'ענק'}
🏨 *שירות מבוקש:* ${serviceName}
${datesLine}
🐕 *מסתדר עם כלבים:* ${friendlyLabel}
✂️ *${request.dogGender === 'female' ? 'מעוקרת:' : 'מסורס:'}* ${neuteredLabel}
💉 *חיסונים בתוקף:* ${vaccinatedLabel}
🚽 *מחונך לצרכים:* ${houseTrainedLabel}
🛡️ *טיפול נגד קרציות ופשפשים:* ${parasitesLabel}
${additionalDogsText}${request.specialNeeds ? `🩺 *צרכים מיוחדים:* ${request.specialNeeds}\n` : ''}${request.notes ? `📝 *הערות:* ${request.notes}\n` : ''}--------------------------------
💡 *לטיפול, חיוג ללקוח ומשלוח קישור לתשלום:* פתח את מסך "בקשות קליטה" ביומן הריזורט.`;
}

/**
 * Format booking confirmed notification to the Resort team
 */
export function formatBookingConfirmedNotification(booking: Booking): string {
  const serviceName = getServiceTypeHebrew(booking.serviceType);
  const paidStatus = 
    booking.paymentStatus === 'fully_paid' ? 'שולם במלואו 🟢' :
    booking.depositAmount > 0 ? `מקדמה שולמה (₪${booking.depositAmount}) 🟡` : 'ממתין לתשלום ⚪';

  return `🎉 *הזמנה חדשה נקלטה ביומן הריזורט לכלב!*
--------------------------------
👤 *בעלים:* ${booking.ownerName}
📞 *טלפון:* ${booking.ownerPhone}
${booking.ownerAddress ? `🏠 *כתובת מגורים:* ${booking.ownerAddress}\n` : ''}🐶 *כלב:* ${booking.dogName} (${booking.dogBreed || 'מעורב'})
🏨 *שירות:* ${serviceName}
📅 *תאריכים:* מ-${formatDateIL(booking.startDate)} עד ${formatDateIL(booking.endDate)}
💰 *סה״כ לתשלום:* ₪${booking.totalPrice}
💳 *סטטוס תשלום:* ${paidStatus}
--------------------------------
צוות הריזורט לכלב 🐾`;
}

/**
 * Format manual payment link message to send to the client via WhatsApp
 */
export function formatClientPaymentLinkMessage(
  request: IntakeRequest,
  settings: ResortSettings,
  amount?: number,
  customLink?: string
): string {
  let paymentLink = 
    customLink?.trim() ||
    settings.growPaymentLink || 
    'https://pay.grow.link/MjcyNjk~3d59a40e0ae26ce0d41b50b4eebdff04-MzczNjYzMg';

  if (paymentLink.startsWith('//')) {
    paymentLink = 'https:' + paymentLink;
  } else if (!paymentLink.startsWith('http://') && !paymentLink.startsWith('https://')) {
    paymentLink = 'https://' + paymentLink;
  }

  const agreedAmount = amount !== undefined ? amount : (request.depositRequested || 0);
  const isFree = request.isFreeStay || agreedAmount === 0;

  const stayText = request.serviceType === 'training'
    ? `לתכנית אילוף בריזורט לכלב החל מתאריך ${formatDateIL(request.startDate)}`
    : `בריזורט לכלב בין התאריכים ${formatDateIL(request.startDate)} עד ${formatDateIL(request.endDate)}`;

  const firstName = getFirstName(request.ownerName);

  if (isFree) {
    return `היי ${firstName}, שמחנו לשוחח! 🐾🐶
שמחים לעדכן שהאירוח של *${request.dogName}* ${stayText} אושר ושוריין בהצלחה בריזורט לכלב! ✨
האירוח אושר ללא צורך בתשלום נוסף (הסדר מיוחד / תשלום מרוכז).

⏰ *שעות פעילות הריזורט לכלב בימים א-ה הן 09:30 - 18:30*
• בשישי וערב חג: עד שעה 14:00, ובצאת השבת / החג (למחרת השבת / חג) משעה 09:30
• מעבר לשעות הפעילות (לפני 09:30 ואחרי 18:30), ובסופי שבוע וחגים על הבעלים להתגבר ולהתאפק! בשעות אלו אנו לא עוסקים בהולכים על 2, אלא מתמקדים אך ורק בטיפול וברווחה של מי שיש לו 4 רגליים וזנב 🐾

נשמח לראותכם בריזורט! 🐕🤍
צוות הריזורט לכלב`;
  }

  const isLocked = paymentLink.includes('sandbox.grow.link') || (paymentLink.includes('pay.grow.link') && !paymentLink.includes('MjcyNjk')) || paymentLink.includes('grow.link/c');
  const amountInstruction = isLocked 
    ? ` (הסכום ₪${agreedAmount.toLocaleString('he-IL')} מעודכן ונעול לתשלום)` 
    : (agreedAmount > 0 ? ` (סכום מוסכם: ₪${agreedAmount.toLocaleString('he-IL')})` : '');

  return `היי ${firstName}, שמחנו לשוחח! 🐾🐶
שמחים לעדכן שהמקום עבור *${request.dogName}* נשמר ${stayText}.${agreedAmount > 0 ? ` (סכום מוסכם: ₪${agreedAmount.toLocaleString('he-IL')})` : ''}
להשלמת השריון, יש ללחוץ על הקישור המאובטח${amountInstruction}:
👉 \u200E${paymentLink}

💡 *לתשלום ב-Bit, Apple Pay, Google Pay, PayBox, אשראי או העברה בנקאית:* פשוט לוחצים על הקישור למעלה ובוחרים באמצעי התשלום הרצוי (התשלום נקלט ומעדכן את המערכת אוטומטית עם קבלה וחשבונית מס מיידית למייל ולטלפון!).

⏰ *שעות פעילות הריזורט לכלב בימים א-ה הן 09:30 - 18:30*
• בשישי וערב חג: עד שעה 14:00, ובצאת השבת / החג (למחרת השבת / חג) משעה 09:30
• מעבר לשעות הפעילות (לפני 09:30 ואחרי 18:30), ובסופי שבוע וחגים על הבעלים להתגבר ולהתאפק! בשעות אלו אנו לא עוסקים בהולכים על 2, אלא מתמקדים אך ורק בטיפול וברווחה של מי שיש לו 4 רגליים וזנב 🐾

בברכה חמה,
שמוליק וצוות הריזורט לכלב 🐕🤍`;
}

/**
 * Format polite rejection message to send to the client via WhatsApp
 */
export function formatClientRejectionMessage(
  request: IntakeRequest,
  settings: ResortSettings
): string {
  const datesText = request.serviceType === 'training'
    ? `החל מתאריך ${formatDateIL(request.startDate)}`
    : `בתאריכים אלו (${formatDateIL(request.startDate)} עד ${formatDateIL(request.endDate)})`;

  const firstName = getFirstName(request.ownerName);

  return `היי ${firstName}, תודה רבה על פנייתך ל${settings.resortName} 🐾
לצערי ${datesText} אנו בתפוסה מלאה ולא נוכל לקלוט את ${request.dogName}.
נשמח מאוד לעמוד לשירותכם במועד אחר! 🙏🐕

בברכה חמה,
${settings.managerName || 'שמוליק'} - ${settings.resortName}`;
}

/**
 * Send automated WhatsApp alert to the Resort phone (autonomous background CallMeBot or direct link)
 */
export async function sendResortWhatsAppNotification(
  message: string,
  settings: ResortSettings
): Promise<{ success: boolean; directUrl: string }> {
  const phone = cleanPhoneNumber(settings.whatsappNotificationPhone || '0506336896');
  
  // Format Israeli international phone (05... -> 9725...)
  const intlPhone = phone.startsWith('0') ? '972' + phone.substring(1) : phone;
  const encodedText = encodeURIComponent(message);
  const directUrl = `https://wa.me/${intlPhone}?text=${encodedText}`;

  // 1. If Green-API is configured (recommended, dedicated instance), send via Green-API
  if (settings.greenApiIdInstance && settings.greenApiToken) {
    try {
      const greenApiUrl = `https://api.green-api.com/waInstance${settings.greenApiIdInstance.trim()}/sendMessage/${settings.greenApiToken.trim()}`;
      const chatId = `${intlPhone}@c.us`;
      
      fetch(greenApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, message })
      }).catch(err => {
        console.warn('Green-API notification background error:', err);
      });
      return { success: true, directUrl };
    } catch (err) {
      console.warn('Green-API send error:', err);
    }
  }

  // 2. If CallMeBot API key is configured, send via CallMeBot
  if (settings.callmebotApiKey && settings.callmebotApiKey.trim()) {
    try {
      const callmebotUrl = `https://api.callmebot.com/whatsapp.php?phone=+${intlPhone}&text=${encodedText}&apikey=${encodeURIComponent(settings.callmebotApiKey.trim())}`;
      
      // Fire and forget via fetch
      fetch(callmebotUrl, { mode: 'no-cors' }).catch(err => {
        console.warn('CallMeBot notification background error:', err);
      });
      return { success: true, directUrl };
    } catch (err) {
      console.warn('CallMeBot send error:', err);
    }
  }

  return { success: true, directUrl };
}

/**
 * Send automated email notification to shinshin1964@gmail.com
 */
export async function sendResortEmailNotification(
  subject: string,
  request: IntakeRequest,
  customMessage?: string
): Promise<boolean> {
  // FormSubmit verified endpoint token for shinshin1964@gmail.com
  const formSubmitToken = '5b70295e0906d160337fe5545abf9e02';
  const targetEmail = 'shinshin1964@gmail.com';
  const serviceName = getServiceTypeHebrew(request.serviceType);

  try {
    const payload = {
      _subject: subject,
      _template: 'table',
      _captcha: 'false',
      'שם הלקוח': request.ownerName,
      'טלפון': request.ownerPhone,
      'שם הכלב': request.dogName || 'לא צוין',
      'מין': request.dogGender === 'female' ? 'נקבה' : 'זכר',
      'גזע': request.dogBreed || 'מעורב',
      'גיל / גודל': `${request.dogAge || 'לא צוין'} | ${request.dogSize || 'בינוני'}`,
      'סוג שירות': serviceName,
      'תאריכים': `${request.startDate} עד ${request.endDate}`,
      'מסתדר עם כלבים': request.isFriendlyWithDogs === 'yes' ? 'כן' : request.isFriendlyWithDogs === 'no' ? 'לא' : 'תלוי בסיטואציה',
      'מסורס/מעוקרת': request.isNeutered ? 'כן' : 'לא',
      'חיסונים בתוקף': request.isVaccinated ? 'כן' : 'לא בטוח',
      'מחונך לצרכים': request.isHouseTrained !== false ? 'כן' : 'לא',
      'מטופל נגד קרציות ופשפשים': request.isTreatedParasites !== false ? 'כן' : 'לא',
      'כלבים נוספים בטופס': request.additionalDogs && request.additionalDogs.length > 0 
        ? request.additionalDogs.map((d, i) => `${i + 2}. ${d.dogName} (${d.dogBreed || 'מעורב'}) - ${d.sameDatesAsPrimary ? 'אותם תאריכים' : `${d.startDate} עד ${d.endDate}`}`).join(' | ') 
        : 'אין',
      'צרכים מיוחדים/תרופות': request.specialNeeds || 'אין',
      'הודעה / טקסט חופשי': customMessage || request.notes || 'אין',
      'חיוג מהיר ללקוח': `tel:${request.ownerPhone}`
    };

    fetch(`https://formsubmit.co/ajax/${formSubmitToken}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    }).catch(err => {
      console.warn('Email fetch error with token, trying direct email:', err);
      fetch(`https://formsubmit.co/ajax/${targetEmail}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(e => console.warn('Email fallback error:', e));
    });

    return true;
  } catch (err) {
    console.warn('Email notification sending exception:', err);
    return false;
  }
}

export const DEFAULT_GREEN_API_ID = '710722735421';
export const DEFAULT_GREEN_API_TOKEN = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

import { isCustomerMessagingRestrictedNow } from '../utils/jewishCalendar';

const recentSentHashes = new Map<string, number>();

function isRecentDuplicate(chatId: string, message: string): boolean {
  const now = Date.now();
  const key = `${chatId}::${message.trim()}`;
  const lastTime = recentSentHashes.get(key);
  if (lastTime && (now - lastTime) < 45000) { // 45 seconds anti-flood guard
    return true;
  }
  recentSentHashes.set(key, now);
  if (recentSentHashes.size > 200) {
    for (const [k, t] of recentSentHashes.entries()) {
      if (now - t > 300000) recentSentHashes.delete(k);
    }
  }
  return false;
}

/**
 * Send direct message via Green-API and return result
 */
export async function sendGreenApiDirectMessage(
  phone: string,
  message: string,
  idInstance?: string,
  apiToken?: string,
  options?: { skipHolidayCheck?: boolean }
): Promise<{ success: boolean; error?: string }> {
  // כלל ברזל של שמוליק: מיום שישי ב-14:00 וכל השבת והחג – שקט מוחלט ללקוחות עד 40 דקות לאחר צאת השבת/חג!
  if (!options?.skipHolidayCheck) {
    const restriction = isCustomerMessagingRestrictedNow();
    if (restriction.isRestricted) {
      console.warn(`[Blocked Customer Message] ${restriction.reason} -> ${phone}`);
      return {
        success: false,
        error: `הודעה נחסמה אוטומטית (כלל ברזל): ${restriction.reason}. ${restriction.allowedSendTime ? `השליחה תתאפשר אוטומטית: ${restriction.allowedSendTime}.` : ''}`
      };
    }
  }

  const cleanId = (idInstance || '').trim() || DEFAULT_GREEN_API_ID;
  const cleanTok = (apiToken || '').trim() || DEFAULT_GREEN_API_TOKEN;
  if (!cleanId || !cleanTok) {
    return { success: false, error: 'חסרים פרטי חיבור Green-API' };
  }

  const cleanP = cleanPhoneNumber(phone);
  if (!cleanP || cleanP.length < 9) {
    return { success: false, error: `מספר הטלפון שנמסר (${phone}) אינו תקין` };
  }

  let intlPhone = cleanP;
  if (intlPhone.startsWith('0')) {
    intlPhone = '972' + intlPhone.substring(1);
  } else if (intlPhone.startsWith('5') && intlPhone.length === 9) {
    intlPhone = '972' + intlPhone;
  }

  const chatId = `${intlPhone}@c.us`;

  // Anti-duplicate protection: Ignore identical duplicate sends within 45 seconds
  if (isRecentDuplicate(chatId, message)) {
    console.warn(`[Anti-Flood] Blocked duplicate identical message to ${chatId}`);
    return { success: true };
  }

  const clusterPrefix = cleanId.length >= 4 ? cleanId.slice(0, 4) : '';
  const stateUrl = clusterPrefix 
    ? `https://${clusterPrefix}.api.greenapi.com/waInstance${cleanId}/getStateInstance/${cleanTok}`
    : `https://api.green-api.com/waInstance${cleanId}/getStateInstance/${cleanTok}`;

  // Pre-flight check: Make sure Green-API WhatsApp session is actually authorized
  try {
    const stateController = new AbortController();
    const stateTimer = setTimeout(() => stateController.abort(), 6000);
    const stateRes = await fetch(stateUrl, { signal: stateController.signal });
    clearTimeout(stateTimer);
    if (stateRes.ok) {
      const stateData = await stateRes.json();
      const state = stateData?.stateInstance;
      if (state && state !== 'authorized') {
        return {
          success: false,
          error: `חשבון הוואטסאפ (Green-API) אינו מחובר כרגע (סטטוס: ${state}). יש להשתמש בכפתור "פתח בוואטסאפ 📱" או לסרוק מחדש קוד QR בהגדרות.`
        };
      }
    }
  } catch (stateErr) {
    // If state check times out, proceed to send attempt
    console.warn('[Green-API Pre-flight] Could not verify instance state:', stateErr);
  }

  const primaryUrl = clusterPrefix 
    ? `https://${clusterPrefix}.api.greenapi.com/waInstance${cleanId}/sendMessage/${cleanTok}`
    : `https://api.green-api.com/waInstance${cleanId}/sendMessage/${cleanTok}`;
  const fallbackUrl = `https://api.green-api.com/waInstance${cleanId}/sendMessage/${cleanTok}`;

  async function trySend(url: string, timeoutMs = 25000): Promise<{ success: boolean; error?: string }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, message }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        return { success: true };
      }
      const errText = await res.text();
      return { success: false, error: `שגיאה מ-Green-API (${res.status}): ${errText}` };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { success: false, error: 'זמן ההמתנה לשרת אזל (Timeout)' };
      }
      return { success: false, error: err.message || String(err) };
    }
  }

  // Try primary cluster host first
  const firstAttempt = await trySend(primaryUrl, 25000);
  if (firstAttempt.success) return firstAttempt;

  // If primary timed out / failed, try fallback gateway
  if (primaryUrl !== fallbackUrl) {
    const fallbackAttempt = await trySend(fallbackUrl, 25000);
    if (fallbackAttempt.success) return fallbackAttempt;
  }

  return firstAttempt;
}

/**
 * Get QR code base64 from Green-API to reconnect WhatsApp
 */
export async function getGreenApiQrCode(
  idInstance?: string,
  apiToken?: string
): Promise<{ success: boolean; qrBase64?: string; message?: string }> {
  const cleanId = (idInstance || '').trim() || DEFAULT_GREEN_API_ID;
  const cleanTok = (apiToken || '').trim() || DEFAULT_GREEN_API_TOKEN;
  if (!cleanId || !cleanTok) {
    return { success: false, message: 'חסרים פרטי חיבור Green-API' };
  }

  const clusterPrefix = cleanId.length >= 4 ? cleanId.slice(0, 4) : '';
  const qrUrl = clusterPrefix 
    ? `https://${clusterPrefix}.api.greenapi.com/waInstance${cleanId}/qr/${cleanTok}`
    : `https://api.green-api.com/waInstance${cleanId}/qr/${cleanTok}`;

  try {
    const res = await fetch(qrUrl);
    if (!res.ok) {
      return { success: false, message: `שגיאה בקבלת QR (קוד ${res.status})` };
    }
    const data = await res.json();
    if (data.type === 'qrCode' && data.message) {
      return { success: true, qrBase64: `data:image/png;base64,${data.message}` };
    } else if (data.type === 'alreadyLogged') {
      return { success: true, message: 'החשבון כבר מחובר ומאושר בוואטסאפ (alreadyLogged) 🟢' };
    }
    return { success: false, message: data.message || 'לא התקבל קוד QR' };
  } catch (err: any) {
    return { success: false, message: 'שגיאת תקשורת: ' + (err.message || String(err)) };
  }
}

/**
 * Test Green-API credentials and instance state
 */
export async function testGreenApiConnection(
  idInstance: string,
  apiToken: string,
  testPhone?: string
): Promise<{ success: boolean; state?: string; message: string }> {
  const cleanId = (idInstance || '').trim();
  const cleanTok = (apiToken || '').trim();
  if (!cleanId || !cleanTok) {
    return { success: false, message: 'נא להזין idInstance ו-apiTokenInstance' };
  }

  try {
    const stateUrl = `https://api.green-api.com/waInstance${cleanId}/getStateInstance/${cleanTok}`;
    const res = await fetch(stateUrl);
    if (!res.ok) {
      return { success: false, message: `שגיאה בגישה ל-Green-API (קוד ${res.status}). בדוק את ה-id וה-Token שהזנת.` };
    }
    const data = await res.json();
    const state = data.stateInstance || 'unknown';

    if (state !== 'authorized') {
      return {
        success: false,
        state,
        message: `האינסטנס קיים, אך טרם מקושר לוואטסאפ (סטטוס: ${state}). יש לסרוק QR באתר Green-API.`
      };
    }

    // Send test message if testPhone provided
    if (testPhone) {
      const sendRes = await sendGreenApiDirectMessage(
        testPhone,
        '🐾 בדיקת חיבור Green-API – הריזורט לכלב! החיבור פועל בצורה מושלמת.',
        cleanId,
        cleanTok,
        { skipHolidayCheck: true }
      );
      if (sendRes.success) {
        return { success: true, state: 'authorized', message: 'מעולה! Green-API מחובר ומאושר, ונשלחה הודעת בדיקה בהצלחה!' };
      }
    }

    return { success: true, state: 'authorized', message: 'מעולה! החיבור ל-Green-API מאושר ותקין (authorized) 🟢' };
  } catch (err: any) {
    return { success: false, message: 'שגיאת תקשורת: ' + (err.message || String(err)) };
  }
}

export const RESORT_COMMUNITY_GROUP_ID = '120363412850948636@g.us';

/**
 * Adds a participant directly to a WhatsApp Group via Green-API
 */
export async function addGreenApiGroupParticipant(
  groupId: string,
  phoneNumber: string,
  idInstance: string,
  apiToken: string
): Promise<{ success: boolean; error?: string }> {
  const cleanId = (idInstance || '').trim();
  const cleanTok = (apiToken || '').trim();
  if (!cleanId || !cleanTok) {
    return { success: false, error: 'Missing Green-API credentials' };
  }

  const cleanP = cleanPhoneNumber(phoneNumber);
  if (!cleanP) return { success: false, error: 'Invalid phone number' };

  let intlPhone = cleanP;
  if (intlPhone.startsWith('0')) {
    intlPhone = '972' + intlPhone.substring(1);
  } else if (intlPhone.startsWith('5') && intlPhone.length === 9) {
    intlPhone = '972' + intlPhone;
  }
  const participantChatId = `${intlPhone}@c.us`;

  const clusterPrefix = cleanId.length >= 4 ? cleanId.slice(0, 4) : '';
  const url = clusterPrefix 
    ? `https://${clusterPrefix}.api.greenapi.com/waInstance${cleanId}/addGroupParticipant/${cleanTok}`
    : `https://api.green-api.com/waInstance${cleanId}/addGroupParticipant/${cleanTok}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        groupId: groupId || RESORT_COMMUNITY_GROUP_ID,
        participantChatId
      })
    });
    if (res.ok) {
      return { success: true };
    }
    const errText = await res.text();
    return { success: false, error: `Failed to add to group (${res.status}): ${errText}` };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Automatically creates or updates a contact in WhatsApp & device phonebook via Green-API
 * Formats:
 * - New intake lead: "🆕 [Owner Name]" (last name: "([Dog Name])")
 * - Confirmed booking: "[Owner Name]" (last name: "([Dog Name])")
 */
export async function saveOrUpdateGreenApiContact(
  phoneNumber: string,
  ownerName: string,
  dogName?: string,
  isNew: boolean = true,
  idInstance?: string,
  apiToken?: string
): Promise<{ success: boolean; error?: string }> {
  const cleanId = (idInstance || '710722735421').trim();
  const cleanTok = (apiToken || 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b').trim();
  
  const cleanP = cleanPhoneNumber(phoneNumber);
  if (!cleanP) return { success: false, error: 'Invalid phone number' };

  let intlPhone = cleanP;
  if (intlPhone.startsWith('0')) {
    intlPhone = '972' + intlPhone.substring(1);
  } else if (intlPhone.startsWith('5') && intlPhone.length === 9) {
    intlPhone = '972' + intlPhone;
  }
  const chatId = `${intlPhone}@c.us`;

  const cleanOwner = (ownerName || '').trim();
  const cleanDog = (dogName || '').trim();

  // Prefix 🆕 for new leads, clean name for confirmed/returning
  const firstName = isNew ? `🆕 ${cleanOwner}` : cleanOwner;
  const lastName = cleanDog ? `(${cleanDog})` : '';

  const clusterPrefix = cleanId.length >= 4 ? cleanId.slice(0, 4) : '7107';
  const addUrl = `https://${clusterPrefix}.api.greenapi.com/waInstance${cleanId}/addContact/${cleanTok}`;
  const editUrl = `https://${clusterPrefix}.api.greenapi.com/waInstance${cleanId}/editContact/${cleanTok}`;

  try {
    const addRes = await fetch(addUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId,
        firstName,
        lastName,
        saveInAddressbook: true
      })
    });

    if (addRes.ok) {
      return { success: true };
    }

    // If addContact returned 400 (contact already exists), update contact details
    const editRes = await fetch(editUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId,
        firstName,
        lastName,
        saveInAddressbook: true
      })
    });

    if (editRes.ok) {
      return { success: true };
    }

    const errText = await editRes.text();
    return { success: false, error: errText };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}


