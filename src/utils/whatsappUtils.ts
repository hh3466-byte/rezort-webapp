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
    case 'daycare': return 'יום כיף / שהות יומית';
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
  msg += `💳 *לתשלום מאובטח (כולל Bit, Apple Pay, Google Pay וכרטיסי אשראי):*\n`;
  msg += `👉 ${paymentLink}\n`;

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

  msg += `\n⏰ *שעות פעילות הריזורט לכלב בימים א-ה הן 09:00 - 19:00*\n`;
  msg += `• בשישי וערב חג: עד שעה 14:00, ובצאת השבת / החג (למחרת השבת / חג) משעה 09:00\n`;
  msg += `• מעבר לשעות הפעילות (לפני 09:00 ואחרי 19:00), ובסופי שבוע וחגים על הבעלים להתגבר ולהתאפק! בשעות אלו אנו לא עוסקים בהולכים על 2, אלא מתמקדים אך ורק בטיפול וברווחה של מי שיש לו 4 רגליים וזנב 🐾\n`;
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
