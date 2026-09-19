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
${request.specialNeeds ? `🩺 *צרכים מיוחדים:* ${request.specialNeeds}\n` : ''}${request.notes ? `📝 *הערות:* ${request.notes}\n` : ''}--------------------------------
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

⏰ *שעות פעילות הריזורט לכלב בימים א-ה הן 09:00 - 19:00*
• בשישי וערב חג: עד שעה 14:00, ובצאת השבת / החג (למחרת השבת / חג) משעה 09:00
• מעבר לשעות הפעילות (לפני 09:00 ואחרי 19:00), ובסופי שבוע וחגים על הבעלים להתגבר ולהתאפק! בשעות אלו אנו לא עוסקים בהולכים על 2, אלא מתמקדים אך ורק בטיפול וברווחה של מי שיש לו 4 רגליים וזנב 🐾

נשמח לראותכם בריזורט! 🐕🤍
צוות הריזורט לכלב`;
  }

  const amountSection = `\n💰 *הסכום שסוכם הוא:* ₪${agreedAmount}\n`;
  const amountInstruction = ` (יש להזין ₪${agreedAmount} בעמוד התשלום)`;

  return `היי ${firstName}, שמחנו לשוחח! 🐾🐶
שמחים לעדכן שהמקום עבור *${request.dogName}* נשמר ${stayText}.${amountSection}
להשלמת השריון, מצורף הקישור המאובטח לתשלום${amountInstruction}:
👉 \u200E${paymentLink}

(בתוך הקישור ניתן לשלם בנוחות ב-Bit, Apple Pay, Google Pay או כרטיס אשראי)

⏰ *שעות פעילות הריזורט לכלב בימים א-ה הן 09:00 - 19:00*
• בשישי וערב חג: עד שעה 14:00, ובצאת השבת / החג (למחרת השבת / חג) משעה 09:00
• מעבר לשעות הפעילות (לפני 09:00 ואחרי 19:00), ובסופי שבוע וחגים על הבעלים להתגבר ולהתאפק! בשעות אלו אנו לא עוסקים בהולכים על 2, אלא מתמקדים אך ורק בטיפול וברווחה של מי שיש לו 4 רגליים וזנב 🐾

בברכה חמה,
צוות הריזורט לכלב 🐕🤍`;
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
  const phone = cleanPhoneNumber(settings.whatsappNotificationPhone || settings.managerPhone || '0548765888');
  
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

  const greenApiUrl = `https://api.green-api.com/waInstance${cleanId}/sendMessage/${cleanTok}`;
  const chatId = `${intlPhone}@c.us`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(greenApiUrl, {
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
