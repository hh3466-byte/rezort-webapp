/**
 * =========================================================================
 * Meta Conversions API (CAPI) Integration - הריזורט לכלב
 * Handles server-side tracking of Leads, CompleteRegistration & Purchases
 * to Meta Ads Manager (Facebook & Instagram)
 * =========================================================================
 */

import crypto from 'crypto';

export const META_PIXEL_ID = process.env.META_PIXEL_ID || "2288868861985256";
export const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN || "EAAHaHJ2C7IkBSmE8YhpnIzMxjKFK1vztH2dUagcExUDhpLOFn2zUZBwxFPGBHoz8XsqFDzZCFekdQCA0CEmylhO4XmZBBbGZBsF72jzpwCFUS7AStC6xoMNEUxTvyDbWQSJwDKjOzwiHgrB0xIOO4ksXXpDy4KdZCwXLMWpnsJnp1tG5EhcrxPIRvQKFZBrkwS9wZDZD";
export const META_GRAPH_VERSION = "v19.0";

/**
 * SHA-256 hash helper for Meta CAPI privacy compliance
 */
function hashMetaField(value) {
  if (!value) return undefined;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return undefined;
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Clean Israeli phone and convert to E.164 without leading plus (e.g. 9725XXXXXXXX)
 */
function normalizeMetaPhone(phone) {
  if (!phone) return undefined;
  let digits = String(phone).replace(/\D/g, '');
  if (!digits) return undefined;

  if (digits.startsWith('972')) {
    // Already international
    return digits;
  }
  if (digits.startsWith('0')) {
    return '972' + digits.slice(1);
  }
  if (digits.length === 9 && digits.startsWith('5')) {
    return '972' + digits;
  }
  return digits;
}

/**
 * Main Dispatcher: Send Event to Meta Conversions API
 */
export async function sendMetaConversionEvent({
  eventName,
  phone,
  firstName,
  lastName,
  email,
  value,
  currency = 'ILS',
  eventId,
  eventSourceUrl,
  customData = {},
  actionSource = 'system_generated',
  clientIp,
  userAgent
}) {
  try {
    const normPhone = normalizeMetaPhone(phone);
    const hashedPhone = normPhone ? hashMetaField(normPhone) : undefined;
    const hashedFn = firstName ? hashMetaField(firstName) : undefined;
    const hashedLn = lastName ? hashMetaField(lastName) : undefined;
    const hashedEmail = email ? hashMetaField(email) : undefined;

    const userData = {
      ...(hashedPhone ? { ph: [hashedPhone] } : {}),
      ...(hashedFn ? { fn: [hashedFn] } : {}),
      ...(hashedLn ? { ln: [hashedLn] } : {}),
      ...(hashedEmail ? { em: [hashedEmail] } : {}),
      ...(clientIp ? { client_ip_address: clientIp } : {}),
      ...(userAgent ? { client_user_agent: userAgent } : {})
    };

    // If no user identifier at all, abort gracefully
    if (Object.keys(userData).length === 0) {
      console.warn('⚠️ Meta CAPI: No user identifiers provided for event:', eventName);
      return { ok: false, reason: 'no_user_data' };
    }

    const eventPayload = {
      event_name: eventName,
      event_time: Math.floor(Date.now() / 1000),
      action_source: actionSource,
      user_data: userData,
      custom_data: {
        ...(value !== undefined ? { value: Number(value), currency } : {}),
        ...customData
      },
      ...(eventId ? { event_id: String(eventId) } : {}),
      ...(eventSourceUrl ? { event_source_url: eventSourceUrl } : {})
    };

    const endpointUrl = `https://graph.facebook.com/${META_GRAPH_VERSION}/${META_PIXEL_ID}/events?access_token=${META_ACCESS_TOKEN}`;

    const res = await fetch(endpointUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [eventPayload] })
    });

    const resData = await res.json();

    if (res.ok) {
      console.log(`✅ Meta CAPI event "${eventName}" tracked successfully! (trace: ${resData.fbtrace_id || 'ok'})`);
      return { ok: true, data: resData };
    } else {
      console.warn(`❌ Meta CAPI error for "${eventName}":`, res.status, resData);
      return { ok: false, error: resData };
    }
  } catch (err) {
    console.error(`❌ Meta CAPI exception for "${eventName}":`, err?.message || err);
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * Convenience helper: Send "Lead" event
 */
export async function sendMetaLeadEvent({
  phone,
  fullName,
  firstName,
  lastName,
  email,
  source = 'Google Sheets / Meta Lead Gen',
  eventId,
  eventSourceUrl
}) {
  let fn = firstName;
  let ln = lastName;
  if (!fn && fullName) {
    const parts = String(fullName).trim().split(/\s+/);
    fn = parts[0] || '';
    ln = parts.slice(1).join(' ') || '';
  }

  return sendMetaConversionEvent({
    eventName: 'Lead',
    phone,
    firstName: fn,
    lastName: ln,
    email,
    eventId: eventId || `lead_${Date.now()}_${String(phone).slice(-4)}`,
    eventSourceUrl: eventSourceUrl || 'https://rezort-webapp.vercel.app/?request=true',
    customData: {
      lead_source: source,
      content_name: 'Resort Intake Lead'
    }
  });
}

/**
 * Convenience helper: Send "Purchase" / Deposit Paid event
 */
export async function sendMetaPurchaseEvent({
  phone,
  customerName,
  amount,
  transactionId,
  currency = 'ILS',
  eventSourceUrl
}) {
  let firstName = '';
  let lastName = '';
  if (customerName) {
    const parts = String(customerName).trim().split(/\s+/);
    firstName = parts[0] || '';
    lastName = parts.slice(1).join(' ') || '';
  }

  return sendMetaConversionEvent({
    eventName: 'Purchase',
    phone,
    firstName,
    lastName,
    value: amount,
    currency,
    eventId: transactionId ? `grow_${transactionId}` : `purchase_${Date.now()}`,
    eventSourceUrl: eventSourceUrl || 'https://rezort-webapp.vercel.app/',
    customData: {
      content_type: 'product',
      content_name: 'Dog Resort Stay / Deposit',
      num_items: 1
    }
  });
}

/**
 * Convenience helper: Send "CompleteRegistration" / Intake Form Submitted event
 */
export async function sendMetaCompleteRegistrationEvent({
  phone,
  ownerName,
  dogName,
  serviceType = 'boarding',
  eventId,
  eventSourceUrl
}) {
  let firstName = '';
  let lastName = '';
  if (ownerName) {
    const parts = String(ownerName).trim().split(/\s+/);
    firstName = parts[0] || '';
    lastName = parts.slice(1).join(' ') || '';
  }

  return sendMetaConversionEvent({
    eventName: 'CompleteRegistration',
    phone,
    firstName,
    lastName,
    eventId: eventId || `intake_${Date.now()}`,
    eventSourceUrl: eventSourceUrl || 'https://rezort-webapp.vercel.app/?request=true',
    customData: {
      status: 'intake_completed',
      dog_name: dogName || '',
      service_type: serviceType
    }
  });
}

export default {
  META_PIXEL_ID,
  META_ACCESS_TOKEN,
  sendMetaConversionEvent,
  sendMetaLeadEvent,
  sendMetaPurchaseEvent,
  sendMetaCompleteRegistrationEvent
};
