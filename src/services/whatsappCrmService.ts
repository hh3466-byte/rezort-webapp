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
          lastMessageType: direction
        });
      } else {
        const existing = chatMap.get(chatId)!;
        if (!existing.name || existing.name === phone) {
          if (m.senderName) existing.name = m.senderName;
          else if (nameMap[chatId]) existing.name = nameMap[chatId];
        }
        if (direction === 'incoming' && !m.isRead) {
          existing.unreadCount = (existing.unreadCount || 0) + 1;
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
