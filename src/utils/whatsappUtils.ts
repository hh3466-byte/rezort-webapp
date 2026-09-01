import { Booking, ResortSettings } from '../types';
import { formatDateIL } from './dateUtils';

export function cleanPhoneNumber(phone: string): string {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
}

/**
 * Format Israeli phone number for WhatsApp international URL (e.g., 0541234567 -> 972541234567)
 */
export function formatPhoneForWhatsApp(phone: string): string {
  if (!phone) return '';
  const digitsOnly = phone.replace(/\D/g, '');
  if (digitsOnly.startsWith('972')) {
    return digitsOnly;
  }
  if (digitsOnly.startsWith('0')) {
    return '972' + digitsOnly.slice(1);
  }
  return digitsOnly;
}

export function getServiceTypeHebrew(type: string): string {
  switch (type) {
    case 'boarding': return 'פנסיון';
    case 'training': return 'תהליך אילוף (50 יום)';
    case 'day_training': return 'אילוף ביומיות (ללא לינה)';
    case 'combined': return 'פנסיון';
    case 'daycare': return 'יום כיף / שהות יומית';
    default: return 'שהות בריזורט';
  }
}

/**
 * Generate Hebrew WhatsApp payment reminder message
 */
export function generatePaymentReminderMessage(booking: Booking, settings: ResortSettings): string {
  const remainingBalance = Math.max(0, booking.totalPrice - booking.depositAmount);
  const serviceHebrew = getServiceTypeHebrew(booking.serviceType);
  const datesText = `${formatDateIL(booking.startDate)} עד ${formatDateIL(booking.endDate)}`;

  let msg = `שלום ${booking.ownerName}, כאן צוות הריזורט לכלב 🐾\n\n`;
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

  msg += `אפשרויות תשלום נוחות:\n`;
  if (settings.bitNumber) {
    msg += `🔹 *ביט (Bit) / פייבוקס:* ${settings.bitNumber}\n`;
  }
  if (settings.payboxLink) {
    msg += `🔹 *קישור PayBox ישיר:* ${settings.payboxLink}\n`;
  }
  if (settings.bankDetails) {
    msg += `🔹 *העברה בנקאית:* ${settings.bankDetails}\n`;
  }

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

  let msg = `שלום ${booking.ownerName}! 🐾\n`;
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

  msg += `\nאנא וודאו כי פנקס החיסונים בתוקף וציידו את ${booking.dogName} במזון הרגיל ובמידת הצורך בציוד אישי.\n`;
  msg += `מחכים לכם! צוות הריזורט לכלב 🐾 (${settings.managerPhone})`;

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
