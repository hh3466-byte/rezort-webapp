import { IntakeRequest, Booking, ResortSettings } from '../types';
import { cleanPhoneNumber, getServiceTypeHebrew } from '../utils/whatsappUtils';

/**
 * Format automated intake request notification to the Resort team
 */
export function formatIntakeNotification(request: IntakeRequest): string {
  const serviceName = getServiceTypeHebrew(request.serviceType);
  const friendlyLabel = 
    request.isFriendlyWithDogs === 'yes' ? 'כן 🟢' :
    request.isFriendlyWithDogs === 'no' ? 'לא 🔴' : 'תלוי בסיטואציה 🟡';

  const neuteredLabel = request.isNeutered ? 'כן ✂️' : 'לא';
  const vaccinatedLabel = request.isVaccinated ? 'כן בתוקף 💉' : 'חסר/לא ידוע ⚠️';

  return `🐾 *בקשת קליטה חדשה בריזורט לכלב!*
--------------------------------
👤 *בעלים:* ${request.ownerName}
📞 *טלפון:* ${request.ownerPhone}
🐶 *כלב:* ${request.dogName} (${request.dogBreed || 'מעורב'})
🎂 *גיל/גודל:* ${request.dogAge || 'לא צוין'} | ${request.dogSize === 'small' ? 'קטן' : request.dogSize === 'medium' ? 'בינוני' : request.dogSize === 'large' ? 'גדול' : 'ענק'}
🏨 *שירות מבוקש:* ${serviceName}
📅 *תאריכים:* מ-${request.startDate} עד ${request.endDate}
🐕 *מסתדר עם כלבים:* ${friendlyLabel}
✂️ *מסורס/מעוקרת:* ${neuteredLabel}
💉 *חיסונים בתוקף:* ${vaccinatedLabel}
${request.specialNeeds ? `🩺 *צרכים מיוחדים:* ${request.specialNeeds}\n` : ''}${request.notes ? `📝 *הערות:* ${request.notes}\n` : ''}--------------------------------
💡 *לטיפול, חיוג ללקוח ומשלוח קישור תשלום:* פתח את מסך "בקשות קליטה" ביומן הריזורט.`;
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
🐶 *כלב:* ${booking.dogName} (${booking.dogBreed || 'מעורב'})
👤 *בעלים:* ${booking.ownerName} (${booking.ownerPhone})
🏨 *שירות:* ${serviceName}
📅 *תאריכים:* מ-${booking.startDate} עד ${booking.endDate}
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
  settings: ResortSettings
): string {
  const paymentLink = 
    settings.growPaymentLink || 
    'https://pay.grow.link/MjcyNjk~3d59a40e0ae26ce0d41b50b4eebdff04-MzczNjYzMg';

  return `היי ${request.ownerName}, שמחנו לשוחח! 🐾🐶
שמחים לעדכן שהמקום עבור *${request.dogName}* נשמר בריזורט לכלב בין התאריכים ${request.startDate} עד ${request.endDate}.

להשלמת השריון הסופי, מצורף הקישור המאובטח לתשלום המקדמה:
👉 ${paymentLink}

(אפשר לשלם בנוחות גם בביט למספר: ${settings.bitNumber || settings.managerPhone})

בברכה חמה,
צוות הריזורט לכלב 🐕🤍`;
}

/**
 * Send automated WhatsApp alert to the Resort phone (autonomous background CallMeBot or direct link)
 */
export async function sendResortWhatsAppNotification(
  message: string,
  settings: ResortSettings
): Promise<{ success: boolean; directUrl: string }> {
  const phone = cleanPhoneNumber(settings.whatsappNotificationPhone || settings.managerPhone || '0548889900');
  
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
      'גזע': request.dogBreed || 'מעורב',
      'גיל / גודל': `${request.dogAge || 'לא צוין'} | ${request.dogSize || 'בינוני'}`,
      'סוג שירות': serviceName,
      'תאריכים': `${request.startDate} עד ${request.endDate}`,
      'מסתדר עם כלבים': request.isFriendlyWithDogs === 'yes' ? 'כן' : request.isFriendlyWithDogs === 'no' ? 'לא' : 'תלוי בסיטואציה',
      'מסורס/מעוקרת': request.isNeutered ? 'כן' : 'לא',
      'חיסונים בתוקף': request.isVaccinated ? 'כן' : 'לא בטוח',
      'צרכים מיוחדים/תרופות': request.specialNeeds || 'אין',
      'הודעה / טקסט חופשי': customMessage || request.notes || 'אין',
      'חיוג מהיר ללקוח': `tel:${request.ownerPhone}`
    };

    fetch(`https://formsubmit.co/ajax/${targetEmail}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    }).catch(err => console.warn('Email fetch error:', err));

    return true;
  } catch (err) {
    console.warn('Email notification sending exception:', err);
    return false;
  }
}
