import { Booking, IntakeRequest, ResortSettings } from '../types';
import { cleanPhoneNumber } from '../utils/whatsappUtils';

export interface WhatsAppChat {
  id: string; // e.g. "972543200007@c.us"
  name: string;
  type: 'user' | 'group';
  unreadCount?: number;
  lastMessage?: string;
  timestamp?: number;
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
 * Fetch active chats list from Green-API
 */
export async function fetchGreenApiChats(settings?: ResortSettings): Promise<WhatsAppChat[]> {
  const { id, token } = getCredentials(settings);
  if (!id || !token) return [];

  const url = `https://api.green-api.com/waInstance${id}/getChats/${token}`;
  const response = await fetch(url, { method: 'GET' });
  if (!response.ok) {
    throw new Error(`Failed to fetch chats: ${response.status} ${response.statusText}`);
  }

  const rawChats: any[] = await response.json();
  if (!Array.isArray(rawChats)) return [];

  // Filter only direct user chats (not groups or broadcasts unless needed)
  return rawChats
    .filter(c => c.type === 'user' && !c.id.includes('@g.us') && !c.id.includes('@broadcast'))
    .map(c => ({
      id: c.id,
      name: c.name || extractPhoneFromChatId(c.id),
      type: c.type || 'user',
      unreadCount: c.unreadCount || 0,
      lastMessage: '',
      timestamp: Date.now()
    }));
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
 * Cross-references a WhatsApp chat with existing bookings and intake requests
 * to classify the lead and extract dog details.
 */
export function enrichChatWithSystemData(
  chat: WhatsAppChat,
  bookings: Booking[] = [],
  intakeRequests: IntakeRequest[] = []
): EnrichedWhatsAppChat {
  const cleanPhone = extractPhoneFromChatId(chat.id);
  const normalizedPhone = cleanPhoneNumber(cleanPhone);

  // 1. Check if matches an existing booking in the calendar
  const matchedBooking = bookings.find(b => {
    if (b.stayStatus === 'cancelled') return false;
    const bClean = cleanPhoneNumber(b.ownerPhone);
    return bClean && (bClean === normalizedPhone || bClean.includes(normalizedPhone) || normalizedPhone.includes(bClean));
  });

  if (matchedBooking) {
    return {
      ...chat,
      cleanPhone,
      classification: 'customer_with_booking',
      matchedDogName: matchedBooking.dogName,
      matchedBooking
    };
  }

  // 2. Check if matches an intake request
  const matchedIntake = intakeRequests.find(r => {
    const rClean = cleanPhoneNumber(r.ownerPhone);
    return rClean && (rClean === normalizedPhone || rClean.includes(normalizedPhone) || normalizedPhone.includes(rClean));
  });

  if (matchedIntake) {
    return {
      ...chat,
      cleanPhone,
      classification: 'intake_submitted',
      matchedDogName: matchedIntake.dogName,
      matchedIntake
    };
  }

  // 3. New WhatsApp lead
  return {
    ...chat,
    cleanPhone,
    classification: 'new_lead'
  };
}
