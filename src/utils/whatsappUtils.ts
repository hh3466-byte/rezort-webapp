import { Booking, ResortSettings } from '../types';
import { formatDateIL } from './dateUtils';

export function cleanPhoneNumber(phone: string): string {
  if (!phone) return '';
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('972')) {
    digits = '0' + digits.slice(3);
  } else if (digits.length === 9 && digits.startsWith('5')) {
    digits = '0' + digits;
  }
  return digits;
}

/**
 * Validates Israeli mobile phone number (10 digits starting with 05)
 */
export function isValidIsraeliPhone(phone: string): boolean {
  if (!phone) return false;
  const cleaned = cleanPhoneNumber(phone);
  return /^05\d{8}$/.test(cleaned);
}

/**
 * Standard Israeli display format: 05X-XXXXXXX
 */
export function formatIsraeliPhoneDisplay(phone: string): string {
  const cleaned = cleanPhoneNumber(phone);
  if (cleaned.length === 10 && cleaned.startsWith('05')) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
  }
  return phone;
}

export const formatPhoneFormatted = formatIsraeliPhoneDisplay;
export const sanitizePhone = cleanPhoneNumber;

/**
 * Format Israeli phone number for WhatsApp international URL (e.g., 0541234567 -> 972541234567)
 */
export function formatPhoneForWhatsApp(phone: string): string {
  if (!phone) return '';
  const cleaned = cleanPhoneNumber(phone);
  if (cleaned.startsWith('0')) {
    return '972' + cleaned.slice(1);
  }
  if (cleaned.startsWith('972')) {
    return cleaned;
  }
  return cleaned;
}

export function getServiceTypeHebrew(type: string): string {
  switch (type) {
    case 'boarding': return 'פנסיון';
    case 'training': return 'אילוף';
    case 'day_training': return 'אילוף ביומיות (ללא לינה)';
    case 'combined': return 'פנסיון';
    case 'daycare': return 'שהייה יומית בריזורט';
    default: return 'שהות בריזורט';
  }
}

/**
 * Extract only the first name of the owner for warm, natural messages.
 * e.g., "ישראל ישראלי" -> "ישראל", "דני כהן" -> "דני", "דני ומיכל כהן" -> "דני ומיכל"
 */
export function getFirstName(fullName: string): string {
  if (!fullName) return '';
  const clean = fullName.trim().replace(/^(מר|גב'|גברת|ד"ר|דוקטור)\s+/i, '');
  const coupleMatch = clean.match(/^([\u0590-\u05FF\w]+(?:\s*(?:ו|ועם|\&|\+)\s*[\u0590-\u05FF\w]+))/);
  if (coupleMatch) {
    return coupleMatch[1];
  }
  return clean.split(/\s+/)[0] || clean;
}

/**
 * Generate Hebrew WhatsApp payment reminder message
 */
export function generatePaymentReminderMessage(booking: Booking, settings: ResortSettings): string {
  const remainingBalance = Math.max(0, booking.totalPrice - booking.depositAmount);
  const serviceHebrew = getServiceTypeHebrew(booking.serviceType);
  const datesText = `${formatDateIL(booking.startDate)} עד ${formatDateIL(booking.endDate)}`;
  const firstName = getFirstName(booking.ownerName);

  let msg = `שלום ${firstName}, כאן צוות הריזורט לכלב 🐾\n\n`;
  msg += `תזכורת ידידותית לגבי השהות של *${booking.dogName}* אצלנו:\n`;
  msg += `📌 *סוג שירות:* ${serviceHebrew}\n`;
  msg += `📅 *תאריכים:* ${datesText}\n`;
  msg += `💰 *סה״כ לתשלום:* ₪${booking.totalPrice}\n`;

  if (booking.depositAmount > 0) {
    msg += `✅ *שולם כמקדמה:* ₪${booking.depositAmount}\n`;
    msg += `💳 *יתרה לתשלום לסגירה:* *₪${remainingBalance}*\n\n`;
  } else {
    msg += `💳 *סכום פתוח לתשלום / מקדמה:* *₪${booking.totalPrice}*\n\n`;
  }

  const paymentLink = settings.growPaymentLink || settings.payboxLink || 'https://pay.grow.link/MjcyNjk~3d59a40e0ae26ce0d41b50b4eebdff04-MzczNjYzMg';
  msg += `💳 *לתשלום מאובטח בלחיצה (כולל Bit, Apple Pay וכרטיסי אשראי):*\n`;
  msg += `👉 ${paymentLink}\n\n`;
  msg += `💡 *לתשלום ב-Bit:* לוחצים על הקישור ובוחרים באפשרות Bit בעמוד (אין צורך להעביר ידנית למספר טלפון או חשבון בנק).\n`;

  msg += `\nנשמח לעמוד לרשותכם לכל שאלה. נתראה בקרוב! 🐶❤️`;

  return msg;
}

/**
 * Generate Hebrew WhatsApp booking confirmation message
 */
export function generateBookingConfirmationMessage(booking: Booking, settings: ResortSettings): string {
  const serviceHebrew = getServiceTypeHebrew(booking.serviceType);
  const datesText = `${formatDateIL(booking.startDate)} עד ${formatDateIL(booking.endDate)}`;
  const remainingBalance = Math.max(0, booking.totalPrice - booking.depositAmount);
  const firstName = getFirstName(booking.ownerName);

  let msg = `שלום ${firstName}! 🐾\n`;
  msg += `שמחים לעדכן כי המקום עבור *${booking.dogName}* שוריין בהצלחה ב${settings.resortName}!\n\n`;
  msg += `📋 *פרטי ההזמנה:*\n`;
  msg += `🐕 *שם הכלב:* ${booking.dogName} (${booking.dogBreed || 'גזע כללי'})\n`;
  msg += `🌟 *שירות:* ${serviceHebrew}\n`;
  msg += `📅 *תאריכים:* ${datesText}\n`;
  msg += `💵 *סה״כ עלות:* ₪${booking.totalPrice}\n`;
  
  if (booking.depositAmount > 0) {
    msg += `✅ *מקדמה ששולמה:* ₪${booking.depositAmount}\n`;
    if (remainingBalance > 0) {
      msg += `⏳ *יתרה בעת האיסוף:* ₪${remainingBalance}\n`;
    } else {
      msg += `🎉 *החשבון שולם במלואו!*\n`;
    }
  }

  msg += `\n⏰ *שעות פעילות הריזורט לכלב בימים א-ה הן 09:30 - 18:30*\n`;
  msg += `• בשישי וערב חג: עד שעה 14:00, ובצאת השבת / החג (למחרת השבת / חג) משעה 09:30\n`;
  msg += `• מעבר לשעות הפעילות (לפני 09:30 ואחרי 18:30), ובסופי שבוע וחגים על הבעלים להתגבר ולהתאפק! בשעות אלו אנו לא עוסקים בהולכים על 2, אלא מתמקדים אך ורק בטיפול וברווחה של מי שיש לו 4 רגליים וזנב 🐾\n`;
  msg += `\nאנא וודאו כי פנקס החיסונים בתוקף וציידו את ${booking.dogName} במזון הרגיל ובמידת הצורך בציוד אישי.\n`;
  msg += `\n📍 *מיקום והגעה בריזורט לכלב (Waze / Google Maps):*\nhttps://maps.app.goo.gl/8bm2Rdt7DtHeUS5J9\n`;
  msg += `\nמחכים לכם! צוות הריזורט לכלב 🐾 (${settings.managerPhone})`;

  return msg;
}

/**
 * Open WhatsApp directly in a new window/app
 */
export function generateWhatsAppLink(phone: string, text: string): string {
  const cleanPhone = formatPhoneForWhatsApp(phone);
  const encodedText = encodeURIComponent(text);
  return cleanPhone 
    ? `https://wa.me/${cleanPhone}?text=${encodedText}`
    : `https://wa.me/?text=${encodedText}`;
}

export function getBookingConfirmationMessage(booking: Booking, settings: ResortSettings): string {
  return generateBookingConfirmationMessage(booking, settings);
}

export function openWhatsAppMessage(phone: string, text: string): void {
  const url = generateWhatsAppLink(phone, text);
  window.open(url, '_blank');
}

/**
 * Smart classification: Does an incoming message truly require an urgent reply from Shmulik,
 * or is it just a closing remark, daily regard/photo reply ("ד״ש", "איזה חמוד"), laughing/banter ("חחח", "תתפנק 😂"),
 * gratitude, emoji, address info, or routine stay update?
 */
export function isActionableIncomingMessage(rawText: string | undefined | null): boolean {
  if (!rawText) return false;
  const text = String(rawText).trim();
  if (text.length === 0) return false;

  // 1. Immediate check for pure laughter, emojis or symbols
  if (/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\s.,!?:;"'()\-–—~`_+=\[\]{}<>]+$/gu.test(text)) {
    return false;
  }

  // Remove emojis, symbols, and punctuation for clean semantic analysis
  const clean = text
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/gu, ' ')
    .replace(/[.,!?:;"'()\-–—~`_+=\[\]{}<>/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  if (clean.length === 0) return false;

  // 2. Laughing & Banter patterns (e.g. "חחחח", "חחח אין על דילן", "תתפנק", "lol", "haha", "xd")
  if (/^(ח{2,}|ה{3,}|חה|חח|lol|haha|xd|\s)+$/i.test(clean)) return false;
  if (clean.includes('חחח') || clean.includes('חחחח') || clean.includes('תתפנק') || clean.includes('אין על') || clean.includes('מלך אתה') || clean.includes('אתה אלוף') || clean.includes('אלופים')) return false;

  // 3. Replies to Daily Updates / Regards / Photos ("ד״ש", תמונות, מחמאות לכלב)
  const regardsAndComplimentsPhrases = [
    'איזה חמוד', 'איזה חמודה', 'איזה מתוק', 'איזה מתוקה', 'איזה יופי', 'איזה יפה', 'איזה מותק',
    'איזה נסיך', 'איזה נסיכה', 'איזה מושלם', 'איזה מושלמת', 'איזה כיף', 'איזה כיף לראות', 'איזה כיף לשמוע',
    'תמונה מהממת', 'תמונות מהממות', 'תמונה יפה', 'תמונות יפות', 'סרטון מהמם', 'סרטון יפה',
    'תודה על התמונות', 'תודה על התמונה', 'תודה על הסרטון', 'תודה על הסרטונים', 'תודה על העדכון',
    'תודה שמוליק', 'תודה רבה שמוליק', 'המון תודה שמוליק', 'תודה רבה מותק', 'תודה רבה יקירי',
    'חיים שלי', 'אהבה שלי', 'הלב שלי', 'אהוב שלי', 'מתגעגעים', 'געגועים', 'נשיקות', 'חיבוקים',
    'שמור עליו', 'שמרי עליו', 'שמרו עליו', 'תמסור לו נשיקה', 'תמסור לה נשיקה', 'דש לכולם', 'דש חם',
    'שמחים לשמוע', 'כיף לראות אותו', 'כיף לראות אותה', 'נראה מאושר', 'נראית מאושרת', 'נראה שהוא נהנה',
    'נראה שהיא נהנית', 'הכל נראה מושלם', 'תודה על הטיפול המסור', 'תודה על הטיפול', 'אין עליך שמוליק'
  ];

  for (const phrase of regardsAndComplimentsPhrases) {
    if (clean === phrase || clean.includes(phrase)) {
      if (!text.includes('דחוף') && !text.includes('בעיה') && !text.includes('תקלה') && !text.includes('כמה עולה') && !text.includes('רוצה לשריין')) {
        return false;
      }
    }
  }

  // 4. Polite Closings / Acknowledgements / Gratitude / Routine coordination
  const nonActionablePhrases = [
    'תודה', 'תודה רבה', 'המון תודה', 'תודה רבה שוב', 'תודה על הכל', 'תודה ענקית', 'תודה לכם', 'תודה אחי',
    'סבבה', 'אחלה', 'מעולה', 'מצוין', 'יופי', 'בסדר גמור', 'בסדר', 'הבנתי', 'סגור', 'ברור',
    'מעולה תודה', 'סבבה תודה', 'אחלה תודה', 'יופי תודה', 'תודה ניפגש', 'תודה נתראה',
    'ניפגש', 'נתראה', 'נתראה מחר', 'נתראה בקרוב', 'להתראות', 'ביי', 'ביי ביי', 'בי',
    'לילה טוב', 'בוקר טוב', 'יום טוב', 'סופש נעים', 'סוף שבוע נעים', 'שבת שלום', 'שבוע טוב',
    'חג שמח', 'גמר חתימה טובה', 'חתימה טובה', 'שנה טובה',
    'כן בטח', 'כן תודה', 'אין בעיה', 'בשמחה', 'הכל טוב', 'תיהנו',
    'היי הגענו', 'הגענו', 'אנחנו פה', 'בחוץ', 'תחבר', 'ok', 'okay', 'sure', 'thanks', 'thx',
    'כן', 'לא', 'טוב', 'גזע מיוחד', 'אתה בסדר גמור', 'אמרת לי מראש',
    'אשלם מחר', 'אשלם באשראי', 'אשלם במזומן', 'אשלם לך באשראי או מזומן מחר', 'אעביר מחר',
    'העברתי', 'שילמתי', 'שלחתי', 'אז מגיע מחר', 'מגיע אחר הצהריים', 'בנסיעה'
  ];

  for (const phrase of nonActionablePhrases) {
    if (clean === phrase || clean.startsWith(phrase + ' ') || clean.endsWith(' ' + phrase)) {
      // If it also does not contain an explicit urgent question
      if (!text.includes('?') && !text.includes('דחוף') && !text.includes('בעיה') && !text.includes('תקלה')) {
        return false;
      }
    }
  }

  // Address and contact details sent by client (e.g. "תלפיות 5 אור עקיבא נתראה מחר ותודה")
  if ((clean.includes('@gmail') || clean.includes('@') || clean.includes('רחוב') || clean.includes('תלפיות')) && !text.includes('?')) {
    return false;
  }

  // If starts with laughter / friendly remark and includes pleasantries
  if (clean.startsWith('חח') && (clean.includes('תפגשו') || clean.includes('תודה') || clean.includes('שמח') || clean.includes('נתראה'))) {
    return false;
  }

  // 5. Short acknowledgements (1-3 words of generic acknowledgements)
  const words = clean.split(' ').filter(w => w.length > 0);
  if (words.length <= 3) {
    const isAck = words.every(w => [
      'כן', 'לא', 'טוב', 'יופי', 'אחלה', 'סבבה', 'תודה', 'מעולה', 'מצוין',
      'בסדר', 'ברור', 'הבנתי', 'אוקי', 'אוקיי', 'שלום', 'היי', 'הי', 'חח', 'חחח', 'בי', 'ביי',
      'סגור', 'בשמחה', 'הכל', 'מחר', 'היום', 'בנסיעה', 'הגענו', 'חיים', 'אהבה', 'נסיך', 'נסיכה', 'מתוק', 'חמוד'
    ].includes(w));
    if (isAck) return false;
  }

  // 6. Explicit questions (contains '?' or inquiry keywords)
  if (text.includes('?') || text.includes('؟')) {
    // Exclude routine stay questions from already staying/checked-in dogs if just casual ("אכל הבוקר?")
    if (
      clean === 'אכל הבוקר' || clean === 'אכלה הבוקר' || clean === 'איך הוא' || clean === 'איך היא' ||
      clean.includes('הכל בסדר איתו') || clean.includes('הכל בסדר איתה') || clean.includes('הוא בסדר') || clean.includes('היא בסדר')
    ) {
      return false;
    }
    return true;
  }

  // 7. Actionable keywords from potential leads/complaints
  const actionableKeywords = [
    'כמה עולה', 'כמה יעלה', 'מה המחיר', 'מה העלות', 'יש מקום', 'יש לכם מקום', 'פנוי בתאריכים',
    'רוצה לשריין', 'רוצים לשריין', 'מעוניין לשריין', 'מעוניינת לשריין', 'מעוניין בפנסיון', 'מעוניינת בפנסיון',
    'מעוניין באילוף', 'מעוניינת באילוף', 'רוצה הצעת מחיר',
    'דחוף', 'חשוב', 'טעות', 'שגוי', 'תקלה', 'בעיה', 'הבטחתם', 'מאוכזב',
    'לבטל את ההזמנה', 'לבטל הגעה', 'ביטול שריון', 'החזר כספי'
  ];

  for (const kw of actionableKeywords) {
    if (clean.includes(kw)) {
      return true;
    }
  }

  return false;
}


