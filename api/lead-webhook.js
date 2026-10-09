/**
 * =========================================================================
 * Meta / Google Sheets Lead Webhook Handler - הריזורט לכלב
 * Vercel Serverless Function: /api/lead-webhook
 * 
 * Logic:
 * 1. Receives incoming lead payload (from Google Sheets Apps Script, Zapier, Make, or Meta Webhook).
 * 2. Extracts and standardizes: First Name, Last Name, Phone Number, Source/Campaign.
 * 3. Formats Israeli phone number (e.g. 052-1234567 -> 972521234567@c.us).
 * 4. Checks 24-hour cooldown / idempotency to prevent duplicate messaging.
 * 5. Creates/Updates contact in Green-API as "[חדש] {שם הבעלים}" (Rule 17 in AGENTS.md).
 * 6. Generates personalized intake link: https://rezort-webapp.vercel.app/?request=true&phone=...&name=...
 * 7. Sends initial warm WhatsApp greeting + intake questionnaire via Green-API (Rule 16).
 * 8. Records lead in Supabase and sets cooldown in resort_config settings.
 * =========================================================================
 */

import { createClient } from '@supabase/supabase-js';
import { sendMetaLeadEvent } from './meta-capi.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://ydlynqqmulojhrxbfjsc.supabase.co";
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ";
const GREEN_API_ID = "710722735421";
const GREEN_API_TOKEN = "ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const CLOSED_WEEKEND_HOLIDAY_MSG = `תודה על פנייתך, בחגים וסופי שבוע שירות הלקוחות שלנו סגור משעה 14:00 בשישי/ערב החג ועד למחרת השבת/או החג בשעה 09:30. כמובן שהמקום מאוייש והכלבים מקבלים טיפול מלא ומפנק. רק הבעלים שלהם צריכים להתגבר ולהתאפק עד ששרות הלקוחות יחזור לפעילות.תודה על ההבנה.`;

function cleanPhoneNumber(phone) {
  if (!phone) return '';
  let cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.startsWith('972')) cleaned = '0' + cleaned.slice(3);
  else if (cleaned.length === 9 && cleaned.startsWith('5')) cleaned = '0' + cleaned;
  return cleaned;
}

function getIntlPhone(cleanLocalPhone) {
  if (!cleanLocalPhone) return '';
  if (cleanLocalPhone.startsWith('0')) {
    return '972' + cleanLocalPhone.slice(1);
  }
  if (cleanLocalPhone.startsWith('972')) {
    return cleanLocalPhone;
  }
  return '972' + cleanLocalPhone;
}

async function checkIsShabbatOrHoliday(israelDateStr) {
  try {
    const hebcalUrl = `https://www.hebcal.com/converter?cfg=json&date=${israelDateStr}&g2h=1`;
    const res = await fetch(hebcalUrl);
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.events) && data.events.length > 0) {
        const eventsStr = data.events.join(' ').toLowerCase();
        return eventsStr.includes('rosh hashana') || 
               eventsStr.includes('yom kippur') || 
               eventsStr.includes('sukkot') || 
               eventsStr.includes('shmini atzeret') || 
               eventsStr.includes('simchat torah') || 
               eventsStr.includes('pesach') || 
               eventsStr.includes('shavuot') || 
               eventsStr.includes('erev');
      }
    }
  } catch (e) {
    console.warn('Hebcal check error:', e);
  }
  return false;
}

function getIntakeFormMessage(phone, firstName, fullName) {
  const cleanPhone = cleanPhoneNumber(phone);
  const nameParam = fullName ? `&name=${encodeURIComponent(fullName.trim())}` : '';
  const phoneParam = cleanPhone ? `&phone=${encodeURIComponent(cleanPhone)}` : '';
  const link = `https://rezort-webapp.vercel.app/?request=true${phoneParam}${nameParam}`;
  const greeting = firstName ? `שלום ${firstName}! ` : 'שלום! ';

  return `${greeting}תודה שפניתם לריזורט לכלב! 🐾🐶
כדי שנוכל לבדוק זמינות, להתאים את השירות המדויק לכלבכם ולחסוך לכם זמן יקר, אנא מלאו שאלון קליטה קצר (דקה אחת בלבד):
👉 \u200E${link}

⏰ *שימו לב:* אנחנו נמצאים כרגע במתחם ומטפלים במסירות בכלבים, ולא נשכח אתכם! 🐾
מיד שנתפנה נעבור על פרטי השאלון ונחזור אליכם לשיחה בנוגע לתשובות לתיאום סופי. 🐕🤍`;
}

function getClosedHoursNewLeadMessage(phone, firstName, fullName) {
  const cleanPhone = cleanPhoneNumber(phone);
  const nameParam = fullName ? `&name=${encodeURIComponent(fullName.trim())}` : '';
  const phoneParam = cleanPhone ? `&phone=${encodeURIComponent(cleanPhone)}` : '';
  const link = `https://rezort-webapp.vercel.app/?request=true${phoneParam}${nameParam}`;

  return `${CLOSED_WEEKEND_HOLIDAY_MSG}

🐶 במידה ופניתם לבדיקת זמינות וקליטת כלב חדש, נשמח אם תמלאו בינתיים שאלון קליטה קצר (דקה אחת):
👉 \u200E${link}
וניצור איתכם קשר מיד עם פתיחת שירות הלקוחות! 🐾🤍`;
}

async function canSendAutoReplyToClient(cleanPhone) {
  try {
    const { data: sData } = await supabase.from('settings').select('data').eq('id', 'resort_config');
    const curData = sData?.[0]?.data || {};
    const autoReplyHistory = curData.autoReplyHistory || {};

    const lastSentMs = autoReplyHistory[cleanPhone];
    const nowMs = Date.now();

    // 24 hours cooldown (86,400,000 ms)
    if (lastSentMs && (nowMs - lastSentMs) < 24 * 60 * 60 * 1000) {
      return false;
    }

    // Clean old history entries (> 7 days) and save current
    const cleanedHistory = {};
    for (const [p, ts] of Object.entries(autoReplyHistory)) {
      if (nowMs - ts < 7 * 24 * 60 * 60 * 1000) {
        cleanedHistory[p] = ts;
      }
    }
    cleanedHistory[cleanPhone] = nowMs;

    await supabase.from('settings').update({
      data: { ...curData, autoReplyHistory: cleanedHistory }
    }).eq('id', 'resort_config');

    return true;
  } catch (err) {
    console.warn('Error in canSendAutoReplyToClient:', err);
    return true;
  }
}

async function updateGreenApiContact(chatId, fullName) {
  try {
    const url = `https://api.green-api.com/waInstance${GREEN_API_ID}/editContact/${GREEN_API_TOKEN}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId,
        firstName: `[חדש] ${fullName || ''}`.trim(),
        lastName: '',
        saveInAddressbook: true
      })
    });
    return res.ok;
  } catch (err) {
    console.warn('Error updating Green API contact name:', err);
    return false;
  }
}

async function sendWhatsAppMessage(chatId, message) {
  try {
    const url = `https://api.green-api.com/waInstance${GREEN_API_ID}/sendMessage/${GREEN_API_TOKEN}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, message })
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error('Green API error sending message:', res.status, errText);
      return { ok: false, error: errText };
    }
    const data = await res.json();
    return { ok: true, idMessage: data.idMessage };
  } catch (err) {
    console.error('Error sending WhatsApp message via Green-API:', err);
    return { ok: false, error: err.message };
  }
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET Health Check
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      service: 'Resort Lead Webhook API',
      status: 'active',
      timestamp: new Date().toISOString()
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const body = req.body || {};
    console.log('--- Incoming Lead Webhook Payload ---', JSON.stringify(body));

    // Flexible key extraction for single Full Name or split names (Meta, Google Sheets, Zapier, Make)
    let rawFullName = body.fullName || body.full_name || body.name || body['שם מלא'] || body['שם'] || body['שם הלקוח'] || body['שם הבעלים'] || body['שם_מלא'] || body.owner_name || '';
    const rawFirstName = body.firstName || body.first_name || body['שם פרטי'] || body['שם_פרטי'] || body.fname || '';
    const rawLastName = body.lastName || body.last_name || body['שם משפחה'] || body['שם_משפחה'] || body.lname || '';

    let fullName = String(rawFullName || '').trim();
    let firstName = String(rawFirstName || '').trim();
    let lastName = String(rawLastName || '').trim();

    if (!fullName) {
      fullName = `${firstName} ${lastName}`.trim();
    }

    if (!fullName) {
      fullName = 'לקוח יקר';
    }

    // Extract first name for greeting if not explicitly passed
    if (!firstName && fullName && fullName !== 'לקוח יקר') {
      const parts = fullName.split(/\s+/);
      firstName = parts[0] || fullName;
      lastName = parts.slice(1).join(' ') || '';
    }

    const rawPhone = body.phone || body.phoneNumber || body.phone_number || body.mobile || body.tel || body['טלפון'] || body['נייד'] || body['מספר טלפון'] || body['מספר_טלפון'] || '';
    const cleanPhone = cleanPhoneNumber(rawPhone);

    if (!cleanPhone || cleanPhone.length < 9) {
      console.warn('❌ Invalid phone number received in lead webhook:', rawPhone);
      return res.status(400).json({
        ok: false,
        error: 'Invalid or missing phone number',
        receivedPhone: rawPhone
      });
    }

    const intlPhone = getIntlPhone(cleanPhone);
    const chatId = `${intlPhone}@c.us`;
    const source = body.source || body.campaign || body['מקור'] || body['קמפיין'] || 'Meta Lead Campaign';
    const email = body.email || body['אימייל'] || body['מייל'] || '';
    const notes = body.notes || body['הערות'] || '';

    // Check Cooldown / Duplicate prevention (24 hours)
    const canSend = await canSendAutoReplyToClient(cleanPhone);
    if (!canSend) {
      console.log(`⚠️ Lead ${cleanPhone} (${fullName}) is within 24h cooldown - skipping duplicate message`);
      return res.status(200).json({
        ok: true,
        skipped: true,
        reason: 'cooldown_active_24h',
        lead: { fullName, cleanPhone, chatId }
      });
    }

    // 1. Create / Update Contact in Green-API Address Book with "[חדש] {שם מלא}" (Rule 17)
    await updateGreenApiContact(chatId, fullName);

    // 2. Check Closed Hours (Friday 14:00 - Sunday 09:30 or Shabbat / Jewish Holiday)
    const now = new Date();
    const israelDateStr = now.toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
    const israelTimeStr = now.toLocaleTimeString("en-GB", { timeZone: "Asia/Jerusalem", hour: '2-digit', minute: '2-digit' });
    const [hour, minute] = israelTimeStr.split(':').map(Number);
    const timeInMinutes = hour * 60 + minute;
    const israelDay = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jerusalem" })).getDay();

    const isFridayAfternoon = (israelDay === 5 && timeInMinutes >= 14 * 60);
    const isSaturday = (israelDay === 6);
    const isSundayMorning = (israelDay === 0 && timeInMinutes < 9 * 60 + 30);
    const isWeekendClosed = isFridayAfternoon || isSaturday || isSundayMorning;
    const isHolidayClosed = await checkIsShabbatOrHoliday(israelDateStr);
    const isClosedHours = isWeekendClosed || isHolidayClosed;

    // 3. Prepare Message & Intake Form Link
    let outgoingMessage = '';
    if (isClosedHours) {
      outgoingMessage = getClosedHoursNewLeadMessage(cleanPhone, firstName, fullName);
    } else {
      outgoingMessage = getIntakeFormMessage(cleanPhone, firstName, fullName);
    }

    // 4. Send WhatsApp Message via Green-API
    const sendResult = await sendWhatsAppMessage(chatId, outgoingMessage);

    // 5. Save Lead Record in Supabase (intake_requests or settings)
    const leadId = `lead_${Date.now()}_${cleanPhone.slice(-4)}`;
    try {
      await supabase.from('intake_requests').insert({
        id: leadId,
        created_at: new Date().toISOString(),
        status: 'lead_received',
        owner_name: fullName,
        owner_phone: cleanPhone,
        owner_email: email,
        internal_notes: `שאלון קליטה נשלח אוטומטית בוואטסאפ (${sendResult.idMessage ? `מזהה הודעה: ${sendResult.idMessage}` : 'נשלח'})`
      });
    } catch (dbErr) {
      console.warn('Could not insert lead to intake_requests table (non-blocking):', dbErr?.message || dbErr);
    }

    // 6. Report Lead Conversion to Meta Conversions API (CAPI)
    sendMetaLeadEvent({
      phone: cleanPhone,
      fullName,
      firstName,
      lastName,
      email,
      source,
      eventId: leadId,
      eventSourceUrl: `https://rezort-webapp.vercel.app/?request=true&phone=${encodeURIComponent(cleanPhone)}&name=${encodeURIComponent(fullName)}`
    }).catch(capiErr => console.warn('Non-blocking Meta CAPI lead event warning:', capiErr));

    console.log(`✅ Lead processed successfully for ${fullName} (${cleanPhone})! Message ID: ${sendResult.idMessage || 'sent'}`);

    return res.status(200).json({
      ok: true,
      success: true,
      messageId: sendResult.idMessage || null,
      lead: {
        id: leadId,
        firstName,
        lastName,
        fullName,
        phone: cleanPhone,
        intlPhone,
        chatId,
        source
      },
      intakeUrl: `https://rezort-webapp.vercel.app/?request=true&phone=${encodeURIComponent(cleanPhone)}&name=${encodeURIComponent(fullName)}`,
      mode: isClosedHours ? 'closed_hours_lead' : 'open_hours_lead',
      sentAt: new Date().toISOString()
    });

  } catch (err) {
    console.error('❌ Server error handling lead webhook:', err);
    return res.status(500).json({
      ok: false,
      error: err?.message || 'Internal Server Error'
    });
  }
}
