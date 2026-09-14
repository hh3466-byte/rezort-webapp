import { Booking, IntakeRequest, ResortSettings } from '../types';
import { cleanPhoneNumber } from '../utils/whatsappUtils';

export interface WhatsAppChat {
  id: string; // e.g. "972543200007@c.us"
  name: string;
  type: 'user' | 'group';
  unreadCount?: number;
  lastMessage?: string;
  timestamp?: number;
  lastMessageType?: 'incoming' | 'outgoing';
  incomingCount?: number;
  outgoingCount?: number;
  isOngoingDialogue?: boolean;
}

export interface WhatsAppMessage {
  idMessage: string;
  type: 'incoming' | 'outgoing';
  timestamp: number;
  textMessage: string;
  senderName?: string;
  statusMessage?: string;
}

export type LeadClassification = 'customer_with_booking' | 'intake_submitted' | 'new_lead';

export interface EnrichedWhatsAppChat extends WhatsAppChat {
  cleanPhone: string;
  classification: LeadClassification;
  matchedDogName?: string;
  matchedBooking?: Booking;
  matchedIntake?: IntakeRequest;
  whatsappPushName?: string;
  isCustomName?: boolean;
}

const DEFAULT_GREEN_API_ID = '710722735421';
const DEFAULT_GREEN_API_TOKEN = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

function getCredentials(settings?: ResortSettings): { id: string; token: string } {
  const id = settings?.greenApiIdInstance?.trim() || DEFAULT_GREEN_API_ID;
  const token = settings?.greenApiToken?.trim() || DEFAULT_GREEN_API_TOKEN;
  return { id, token };
}

/**
 * Extracts phone digits from Green-API chatId (e.g. 972543200007@c.us -> 0543200007)
 */
export function extractPhoneFromChatId(chatId: string): string {
  const digits = chatId.replace(/@.*$/, '').replace(/\D/g, '');
  if (digits.startsWith('972') && digits.length >= 12) {
    return '0' + digits.substring(3);
  }
  return digits;
}

/**
 * Fetch active chats list from Green-API from the last 7 days only (שיחות מהשבוע האחרון בלבד)
 * and filter out system/self and Shmulik's private phone.
 */
export async function fetchGreenApiChats(settings?: ResortSettings): Promise<WhatsAppChat[]> {
  const { id, token } = getCredentials(settings);
  if (!id || !token) return [];

  const managerPhoneClean = settings?.managerPhone ? cleanPhoneNumber(settings.managerPhone) : '0506816001';
  const notificationPhoneClean = settings?.whatsappNotificationPhone ? cleanPhoneNumber(settings.whatsappNotificationPhone) : '0548765888';

  try {
    // 1. Fetch last incoming & outgoing messages from the last 7 days (10080 minutes)
    const [incomingRes, outgoingRes] = await Promise.all([
      fetch(`https://api.green-api.com/waInstance${id}/lastIncomingMessages/${token}?minutes=10080`).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(`https://api.green-api.com/waInstance${id}/lastOutgoingMessages/${token}?minutes=10080`).then(r => r.ok ? r.json() : []).catch(() => [])
    ]);

    const incoming: any[] = Array.isArray(incomingRes) ? incomingRes : [];
    const outgoing: any[] = Array.isArray(outgoingRes) ? outgoingRes : [];

    // Optional: get basic contact names from getChats if available
    const nameMap: Record<string, string> = {};
    try {
      const getChatsRes = await fetch(`https://api.green-api.com/waInstance${id}/getChats/${token}`);
      if (getChatsRes.ok) {
        const rawList: any[] = await getChatsRes.json();
        if (Array.isArray(rawList)) {
          for (const c of rawList) {
            if (c.id && c.name) nameMap[c.id] = c.name;
          }
        }
      }
    } catch {}

    const chatMap = new Map<string, WhatsAppChat>();

    const processMessage = (m: any, direction: 'incoming' | 'outgoing') => {
      if (!m || !m.chatId) return;
      const chatId: string = m.chatId;

      // Filter out groups, broadcasts, status
      if (chatId.includes('@g.us') || chatId.includes('@broadcast') || chatId === 'status@broadcast') return;

      const phone = extractPhoneFromChatId(chatId);
      const cleanP = cleanPhoneNumber(phone);

      // Exclude Shmulik's private phone and resort notification bot self-chat
      if (
        cleanP === managerPhoneClean || 
        cleanP === notificationPhoneClean ||
        cleanP === '0506816001' || 
        cleanP === '0548765888' ||
        chatId.includes('506816001') || 
        chatId.includes('548765888')
      ) {
        return;
      }

      const msgTime = (m.timestamp || 0) * 1000;
      const msgText = m.textMessage || (m.extendedTextMessage?.text) || '';

      if (!chatMap.has(chatId)) {
        chatMap.set(chatId, {
          id: chatId,
          name: m.senderName || nameMap[chatId] || phone,
          type: 'user',
          unreadCount: direction === 'incoming' && !m.isRead ? 1 : 0,
          lastMessage: msgText,
          timestamp: msgTime || Date.now(),
          lastMessageType: direction,
          incomingCount: direction === 'incoming' ? 1 : 0,
          outgoingCount: direction === 'outgoing' ? 1 : 0
        });
      } else {
        const existing = chatMap.get(chatId)!;
        if (!existing.name || existing.name === phone) {
          if (m.senderName) existing.name = m.senderName;
          else if (nameMap[chatId]) existing.name = nameMap[chatId];
        }
        if (direction === 'incoming') {
          existing.incomingCount = (existing.incomingCount || 0) + 1;
          if (!m.isRead) {
            existing.unreadCount = (existing.unreadCount || 0) + 1;
          }
        } else {
          existing.outgoingCount = (existing.outgoingCount || 0) + 1;
        }
        if (msgTime > (existing.timestamp || 0)) {
          existing.timestamp = msgTime;
          existing.lastMessageType = direction;
          if (msgText) existing.lastMessage = msgText;
        }
      }
    };

    incoming.forEach(m => processMessage(m, 'incoming'));
    outgoing.forEach(m => processMessage(m, 'outgoing'));

    // Set isOngoingDialogue for each chat:
    // מתבצעת התכתבות = יש מעל הודעה נכנסת אחת או שהתפתח דו-שיח בין שני הצדדים
    for (const chat of chatMap.values()) {
      chat.isOngoingDialogue = (chat.incomingCount || 0) > 1 || ((chat.incomingCount || 0) >= 1 && (chat.outgoingCount || 0) > 1);
    }

    // Convert map to array sorted by latest message, excluding non-business emoji contacts
    const result = Array.from(chatMap.values())
      .filter(c => c.name !== '♥️' && c.name !== '❤️')
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    return result;
  } catch (err) {
    console.warn('Error fetching 7-day Green-API chats:', err);
    return [];
  }
}

/**
 * Fetch messages history for a specific chat
 */
export async function fetchGreenApiChatHistory(
  chatId: string,
  count = 40,
  settings?: ResortSettings
): Promise<WhatsAppMessage[]> {
  const { id, token } = getCredentials(settings);
  if (!id || !token) return [];

  const url = `https://api.green-api.com/waInstance${id}/getChatHistory/${token}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, count })
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch chat history: ${response.status} ${response.statusText}`);
  }

  const rawMessages: any[] = await response.json();
  if (!Array.isArray(rawMessages)) return [];

  // Green-API returns messages newest first; we reverse to show oldest first in chat
  return rawMessages
    .filter(m => m.typeMessage === 'textMessage' || m.typeMessage === 'extendedTextMessage' || m.textMessage)
    .map(m => ({
      idMessage: m.idMessage || String(Math.random()),
      type: (m.type === 'incoming' ? 'incoming' : 'outgoing') as 'incoming' | 'outgoing',
      timestamp: (m.timestamp || Date.now() / 1000) * 1000,
      textMessage: m.textMessage || '',
      senderName: m.senderName,
      statusMessage: m.statusMessage
    }))
    .reverse();
}

/**
 * Send a WhatsApp text message via Green-API
 */
export async function sendGreenApiChatMessage(
  chatId: string,
  message: string,
  settings?: ResortSettings
): Promise<{ idMessage: string }> {
  const { id, token } = getCredentials(settings);
  if (!id || !token) {
    throw new Error('Green-API credentials not configured');
  }

  const url = `https://api.green-api.com/waInstance${id}/sendMessage/${token}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, message })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to send message: ${errText}`);
  }

  return await response.json();
}

/**
 * Formats a timestamp into Hebrew Day name, DD/MM and HH:MM
 * Format: "יום שני | 14/09 | 22:46"
 */
export function formatFullMessageDateIL(timestamp?: number): string {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return '';
  const days = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'יום שבת'];
  const dayName = days[d.getDay()];
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dayName} | ${dd}/${mm} | ${hh}:${min}`;
}

/**
 * Detects if a message text contains a self-identification pattern in Hebrew
 * e.g. "היי שמי עדי", "שלום קוראים לי דני", "מדברת שירה", "כאן יואב"
 */
export function extractSelfIdentifiedName(text: string): string | null {
  if (!text) return null;
  const clean = text.trim();
  const patterns = [
    /(?:שמי|קוראים לי|מדבר|מדברת|כאן)\s+([א-ת\w]+(?:\s+[א-ת\w]+)?)/i,
    /(?:היי|שלום|ערב טוב|בוקר טוב|צהריים טובים)[\s,]+(?:אני|זה|זאת)\s+([א-ת\w]+(?:\s+[א-ת\w]+)?)/i
  ];
  for (const regex of patterns) {
    const match = clean.match(regex);
    if (match && match[1]) {
      const candidate = match[1].trim();
      const stopWords = ['רוצה', 'מעוניין', 'מעוניינת', 'פנסיון', 'לשאול', 'לדעת', 'לגבי', 'אילוף', 'בסדר', 'טוב', 'הכלב', 'הכלבה', 'בנוגע'];
      if (!stopWords.includes(candidate.toLowerCase()) && candidate.length >= 2 && candidate.length <= 25) {
        return candidate;
      }
    }
  }
  return null;
}

/**
 * Generates a warm, friendly follow-up message for leads who received an intake link but haven't replied
 */
export function generateFollowUpReminderText(ownerName?: string, dogName?: string): string {
  const greeting = ownerName && ownerName !== 'לקוח' && !ownerName.startsWith('05') ? `היי ${ownerName}! 🐾` : 'היי! 🐾';
  const dogPart = dogName ? ` את ${dogName}` : '';
  return `${greeting}
רצינו לבדוק אם הסתדרתם עם מילוי שאלון הקליטה, או אם יש שאלות לגבי הפנסיון והתאריכים שלכם?
אנחנו ממש נשמח לארח${dogPart} אצלנו בריזורט ולדאוג לו מכל הלב 🐶❤️
מזכירים שהקישור זמין כאן תמיד, ואנחנו כאן לכל שאלה!`;
}

/**
 * Generates a comprehensive, premium marketing message for leads detailing:
 * 1. The boutique boarding resort and its luxury amenities (מרחבי דשא, סוויטות מרווחות ומאווררות, עדכונים יומיים).
 * 2. The professional dog training program led by Shmulik (משמעת, פנסיון אילוף, חינוך גורים, הדרכת בעלים).
 * 3. Warm CTA and intake questionnaire link.
 */
export function generateResortMarketingValueText(
  ownerName?: string,
  dogName?: string,
  intakeUrl?: string
): string {
  const firstName = ownerName && ownerName !== 'לקוח' && !ownerName.startsWith('05')
    ? ownerName.trim().split(' ')[0]
    : '';
  const greeting = firstName ? `היי ${firstName}! 🐾` : 'היי! 🐾';
  const dogMention = dogName ? ` עבור ${dogName}` : '';

  let text = `${greeting}
שמחים שפנית אלינו ל"ריזורט לכלב" (מגדל דנילוב)! 🐶👑
רצינו לשתף אתכם בכמה מילים על החוויה המיוחדת שמחכה${dogMention} אצלנו בריזורט:

🏡 **פנסיון בוטיק בתנאי VIP:**
• סוויטות שינה אישיות, מרווחות ומאווררות – ללא כלובים!
• מדשאות ענק ירוקות, מוצלות ומאובטחות למשחקים חופשיים ולהוצאת אנרגיה
• טיולי טבע יומיים מודרכים באוויר הפתוח
• השגחה צמודה, יחס אישי חם והמון אהבה מסביב לשעון
• עדכון יומי מפורט בוואטסאפ בכל ערב (כולל תמונות וסרטונים) – כדי שתוכלו לבלות בראש שקט ב-100%!
• התאמה מלאה לאופי הכלב (כלבים חברותיים בקבוצות משחק / כלבים שקטים ביחס VIP פרטי 1-על-1)

🎓 **אילוף מקצועי וחינוך משמעת בהובלת שמוליק:**
• שילוב אילוף במהלך השהות בפנסיון (Board & Train) או בתהליכים ממוקדים
• עבודה על פקודות משמעת, הליכה רגועה ברצועה, גבולות בבית ומחוצה לו
• חינוך גורים ופתרון בעיות התנהגות מורכבות בשיטות חיוביות ומתקדמות
• ליווי והדרכה מעשית לבעלים בסיום התהליך להצלחה מובטחת גם בבית!

`;

  if (intakeUrl) {
    text += `📋 **לשריון מקום ובדיקת התאמה, מלאו כאן את שאלון הקליטה הקצר:**\n${intakeUrl}\n\n`;
  }

  text += `נשמח לעמוד לרשותכם לכל שאלה ולתת לכם ול${dogName || 'חבר על 4'} את החוויה המושלמת ביותר! ❤️🐾`;
  return text;
}

/**
 * Generates marketing message focused specifically on dog training (אילוף מקצועי)
 */
export function generateTrainingOnlyMarketingText(
  ownerName?: string,
  dogName?: string,
  intakeUrl?: string
): string {
  const firstName = ownerName && ownerName !== 'לקוח' && !ownerName.startsWith('05')
    ? ownerName.trim().split(' ')[0]
    : '';
  const greeting = firstName ? `היי ${firstName}! 🐾` : 'היי! 🐾';
  const dogMention = dogName ? ` של ${dogName}` : '';

  let text = `${greeting}
שמחים שפנית אלינו לגבי תוכנית האילוף בריזורט לכלב! 🎓🐶
שמוליק, מאלף כלבים מקצועי ומנוסה, מוביל אצלנו תהליכי אילוף מותאמים אישית:

🌟 **מה כוללת תוכנית האילוף שלנו?**
• פנסיון אילוף (Board & Train): תהליך מעמיק שבו הכלב מתגורר בתנאי ריזורט מפנקים ומתרגל יום-יום
• משמעת בסיסית ומתקדמת (פקודות "אליי", "שב", "ארצה", "הישאר", גבולות)
• הליכה רגועה ברצועה ללא משיכות וטיולים מהנים בנחת
• חינוך גורים, גמילה מצרכים ומניעת הרגלים לא רצויים
• פתרון בעיות התנהגות (חרדות, ריאקטיביות, קפיצות, הרס בבית)
• מפגשי הדרכה מעשיים עם הבעלים לקבלת כלים ושימור ההצלחה בבית!

`;

  if (intakeUrl) {
    text += `📋 **לתיאום והתחלת תהליך${dogMention}, מוזמנים למלא שאלון קצר:**\n${intakeUrl}\n\n`;
  }

  text += `נשמח לדבר ולהתאים ל${dogName || 'כלב שלכם'} את התוכנית המדויקת ביותר! 🐕✨`;
  return text;
}

/**
 * Generates marketing message focused specifically on luxury boarding (פנסיון בוטיק)
 */
export function generateBoardingOnlyMarketingText(
  ownerName?: string,
  dogName?: string,
  intakeUrl?: string
): string {
  const firstName = ownerName && ownerName !== 'לקוח' && !ownerName.startsWith('05')
    ? ownerName.trim().split(' ')[0]
    : '';
  const greeting = firstName ? `היי ${firstName}! 🐾` : 'היי! 🐾';
  const dogMention = dogName ? ` עבור ${dogName}` : '';

  let text = `${greeting}
שמחים שפנית אלינו לגבי אירוח בריזורט לכלב! 🏡🐶👑
אצלנו הכלב שלכם לא "מוחזק" – הוא יוצא לחופשה אמיתית בתנאי VIP:

✨ **היתרונות הייחודיים של הריזורט שלנו:**
• סוויטות אישיות נקיות, מוצלות ומרווחות (ללא כלובים!)
• מדשאות ענק ירוקות ומגודרות למשחקי כדור וריצה חופשית
• טיולי טבע יומיים מודרכים באוויר הצלול
• צוות מקצועי ומסור שנמצא עם הכלבים סביב השעון
• עדכון יומי מפורט בוואטסאפ בכל ערב עם תמונות וסרטונים – כדי שתוכלו לנסוע בראש שקט
• הפרדה קפדנית לפי גודל, אופי ורמת אנרגיה (כולל אגף שקט לכלבים שזקוקים למרחב פרטי 1-על-1)

`;

  if (intakeUrl) {
    text += `📋 **לשריון מקום ובדיקת זמינות${dogMention}:**\n${intakeUrl}\n\n`;
  }

  text += `מחכים לכם ול${dogName || 'חבר על 4'} באהבה גדולה! ❤️🐾`;
  return text;
}


/**
 * Cross-references a WhatsApp chat with existing bookings and intake requests
 * to classify the lead, extract dog details, and resolve the real customer name
 * instead of just the WhatsApp nickname/pushname.
 */
export function enrichChatWithSystemData(
  chat: WhatsAppChat,
  bookings: Booking[] = [],
  intakeRequests: IntakeRequest[] = [],
  nameOverrides: Record<string, string> = {}
): EnrichedWhatsAppChat {
  const cleanPhone = extractPhoneFromChatId(chat.id);
  const normalizedPhone = cleanPhoneNumber(cleanPhone);
  const rawPushName = chat.name && chat.name !== cleanPhone && chat.name !== chat.id ? chat.name.trim() : '';

  // 0. Manual name override by phone (e.g. edited by user)
  const manualName = nameOverrides[cleanPhone] || nameOverrides[normalizedPhone];

  // 1. Check if matches an existing booking in the calendar
  const matchedBooking = bookings.find(b => {
    if (b.stayStatus === 'cancelled') return false;
    const bClean = cleanPhoneNumber(b.ownerPhone);
    return bClean && (bClean === normalizedPhone || bClean.includes(normalizedPhone) || normalizedPhone.includes(bClean));
  });

  if (matchedBooking) {
    const verifiedName = manualName || matchedBooking.ownerName?.trim();
    const displayName = verifiedName || rawPushName || cleanPhone;
    return {
      ...chat,
      name: displayName,
      whatsappPushName: rawPushName && rawPushName !== displayName ? rawPushName : undefined,
      isCustomName: Boolean(manualName || (verifiedName && verifiedName !== rawPushName)),
      cleanPhone,
      classification: 'customer_with_booking',
      matchedDogName: matchedBooking.dogName,
      matchedBooking
    };
  }

  // 2. Check if matches an intake request (הלקוח הזדהה בשאלון קליטה)
  const matchedIntake = intakeRequests.find(r => {
    const rClean = cleanPhoneNumber(r.ownerPhone);
    return rClean && (rClean === normalizedPhone || rClean.includes(normalizedPhone) || normalizedPhone.includes(rClean));
  });

  if (matchedIntake) {
    const verifiedName = manualName || matchedIntake.ownerName?.trim();
    const displayName = verifiedName || rawPushName || cleanPhone;
    return {
      ...chat,
      name: displayName,
      whatsappPushName: rawPushName && rawPushName !== displayName ? rawPushName : undefined,
      isCustomName: Boolean(manualName || (verifiedName && verifiedName !== rawPushName)),
      cleanPhone,
      classification: 'intake_submitted',
      matchedDogName: matchedIntake.dogName,
      matchedIntake
    };
  }

  // 3. New WhatsApp lead
  const displayName = manualName || rawPushName || cleanPhone;
  return {
    ...chat,
    name: displayName,
    whatsappPushName: rawPushName && rawPushName !== displayName ? rawPushName : undefined,
    isCustomName: Boolean(manualName),
    cleanPhone,
    classification: 'new_lead'
  };
}
