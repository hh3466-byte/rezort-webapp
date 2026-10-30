/**
 * =========================================================================
 * Meta / Google Sheets Lead Webhook & Auto-Sync Handler - הריזורט לכלב
 * Vercel Serverless Function: /api/lead-webhook
 * 
 * Logic:
 * 1. Receives incoming lead payload (from Google Sheets Apps Script, Zapier, Make, or Meta Webhook)
 *    OR actively pulls & syncs the live Google Sheet CSV via syncGoogleSheetLeads()!
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
import { sendMetaLeadEvent } from './_meta-capi.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://ydlynqqmulojhrxbfjsc.supabase.co";
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ";
const GREEN_API_ID = "710722735421";
const GREEN_API_TOKEN = "ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b";
const GOOGLE_SHEET_ID = "18kDM6psejSbvpvYYj8WEzHix2HWPID6rflUk_d7xdqo";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export function cleanPhoneNumber(phone) {
  if (!phone) return '';
  let cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.startsWith('972')) cleaned = '0' + cleaned.slice(3);
  else if (cleaned.length === 9 && cleaned.startsWith('5')) cleaned = '0' + cleaned;
  return cleaned;
}

export function getIntlPhone(cleanLocalPhone) {
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
אנחנו נמצאים כרגע במתחם עם הכלבים. כדי שהפנייה שלכם תועבר ישירות לשמוליק לבדיקת זמינות בתאריכים שלכם ולשיחת התאמה, אנא מלאו עכשיו את שאלון הקליטה הקצר (פחות מדקה):
👉 \u200E${link}

⏰ *חשוב:* מיד עם שליחת השאלון הפרטים יופיעו אצל שמוליק ונחזור אליכם טלפונית לתיאום סופי! 🐕🤍
שמוליק וצוות הריזורט לכלב`;
}

function getQuestionnaireReminderMessage(phone, firstName, fullName) {
  const cleanPhone = cleanPhoneNumber(phone);
  const nameParam = fullName ? `&name=${encodeURIComponent(fullName.trim())}` : '';
  const phoneParam = cleanPhone ? `&phone=${encodeURIComponent(cleanPhone)}` : '';
  const link = `https://rezort-webapp.vercel.app/?request=true${phoneParam}${nameParam}`;
  const greeting = firstName ? `היי ${firstName}! ` : 'היי! ';

  return `${greeting}ראינו שפנית אלינו בפייסבוק/אינסטגרם לגבי הריזורט לכלב, אך טרם התקבל שאלון ההתאמה הקצר שלך 🐾🐶
כדי שהבקשה תועבר לשמוליק לבדיקת מקום פנוי ולשיחה אישית, נשמח שתשלים/י אותו כאן (לוקח פחות מדקה):
👉 \u200E${link}

תודה רבה,
שמוליק וצוות הריזורט לכלב 🐕🤍`;
}

function getClosedHoursNewLeadMessage(phone, firstName, fullName) {
  const cleanPhone = cleanPhoneNumber(phone);
  const nameParam = fullName ? `&name=${encodeURIComponent(fullName.trim())}` : '';
  const phoneParam = cleanPhone ? `&phone=${encodeURIComponent(cleanPhone)}` : '';
  const link = `https://rezort-webapp.vercel.app/?request=true${phoneParam}${nameParam}`;

  const greeting = firstName ? `שלום ${firstName}! ` : 'שלום! ';
  return `${greeting}תודה על פנייתך לריזורט לכלב! 🐾🐶
שירות הלקוחות והתיאומים שלנו סגור כרגע (בערב / בסופ״ש). המתחם כמובן מאויש 24/7 והכלבים מקבלים טיפול מלא, אוהב ומפנק! 🐕🤍

כדי שנוכל לבדוק זמינות עבור כלבך ולחסוך לך זמן, אנא מלא/י את שאלון הקליטה הקצר (דקה אחת בלבד):
👉 \u200E${link}

עם פתיחת שירות הלקוחות בשעות הפעילות, שמוליק והצוות יעברו על השאלון ונחזור אליך בהקדם לתיאום סופי! 🐾`;
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

function getGreenApiUrl(id, endpoint, token) {
  const cleanId = String(id || '').trim();
  const clusterPrefix = cleanId.length >= 4 ? cleanId.slice(0, 4) : '';
  const domain = clusterPrefix ? `${clusterPrefix}.api.greenapi.com` : 'api.greenapi.com';
  return `https://${domain}/waInstance${cleanId}/${endpoint}/${token}`;
}

async function updateGreenApiContact(chatId, fullName) {
  try {
    const url = getGreenApiUrl(GREEN_API_ID, 'editContact', GREEN_API_TOKEN);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId,
        firstName: `NEW ${fullName || ''}`.trim(),
        lastName: '',
        saveInAddressbook: true
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    return res.ok;
  } catch (err) {
    console.warn('Error updating Green API contact name:', err);
    return false;
  }
}

async function sendWhatsAppMessage(chatId, message) {
  try {
    const url = getGreenApiUrl(GREEN_API_ID, 'sendMessage', GREEN_API_TOKEN);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, message }),
      signal: controller.signal
    });
    clearTimeout(timeout);
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

/**
 * Simple CSV line parser that handles quoted fields
 */
function parseCsvLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

/**
 * Actively pulls the Google Sheet CSV and syncs any new leads from the last N days
 * Immune to Row 1 header shifting by inspecting each row directly!
 */
export async function syncGoogleSheetLeads(lookbackDays = 5) {
  try {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/export?format=csv`;
    const res = await fetch(csvUrl, { redirect: 'follow' });
    if (!res.ok) {
      return { ok: false, error: `Google Sheet HTTP ${res.status}` };
    }
    const csvText = await res.text();
    const lines = csvText.split(/\r?\n/).filter(l => l.trim().length > 0);

    const { data: sRow } = await supabase
      .from('settings')
      .select('data')
      .eq('id', 'resort_config')
      .single();
    const curData = sRow?.data || {};
    const curIntakes = Array.isArray(curData.intakeRequests) ? [...curData.intakeRequests] : [];
    const autoReplyHistory = { ...(curData.autoReplyHistory || {}) };
    const syncedSheetPhones = new Set(Array.isArray(curData.syncedSheetPhones) ? curData.syncedSheetPhones : []);

    const cutoffMs = Date.now() - lookbackDays * 24 * 60 * 60 * 1000;
    const newlySynced = [];
    let modified = false;

    for (const line of lines) {
      const cols = parseCsvLine(line);
      if (cols.length < 2) continue;

      // Skip test/dummy leads or header rows
      const firstCell = String(cols[0] || '').trim();
      if (line.includes('<test lead:') || line.includes('נוי בודקת')) continue;

      // Find phone column across ALL columns (either col 13 where Meta writes p:+972..., or scan all cols for p:+972 / 05...)
      const phoneCellRegex = /^(?:p:)?(?:\+?972|0)5\d[- ]?\d{7}$/;
      let rawPhone = '';
      let rawName = '';
      if (cols[13] && phoneCellRegex.test(String(cols[13]).trim())) {
        rawPhone = String(cols[13]).trim();
        rawName = String(cols[12] || '').trim();
      } else {
        for (let c = 0; c < cols.length; c++) {
          const val = String(cols[c] || '').trim();
          if (phoneCellRegex.test(val)) {
            rawPhone = val;
            if (c > 0) rawName = String(cols[c - 1] || '').trim();
            break;
          }
        }
      }

      if (!rawPhone) continue;
      const cleanPhone = cleanPhoneNumber(rawPhone);
      if (!cleanPhone || cleanPhone.length < 9 || !cleanPhone.startsWith('05')) continue;

      // Parse created_time in col 1
      const rawCreated = String(cols[1] || '').trim();
      const createdDate = rawCreated ? new Date(rawCreated) : null;
      const createdMs = createdDate && !isNaN(createdDate.getTime()) ? createdDate.getTime() : Date.now();
      if (createdMs < cutoffMs) continue;

      const campaignName = String(cols[7] || '').trim();
      const formName = String(cols[9] || '').trim();
      const adName = String(cols[3] || '').trim();
      const isTraining = (campaignName + ' ' + formName + ' ' + adName).includes('אילוף');
      const phoneNorm = cleanPhone.slice(-7);

      // Check if already exists in intakeRequests
      const existingIdx = curIntakes.findIndex(r => cleanPhoneNumber(r.ownerPhone || '').slice(-7) === phoneNorm);
      if (existingIdx !== -1) {
        const ex = curIntakes[existingIdx];
        // If it was wrongly marked abandoned despite being from recent lookback window, or wrongly marked boarding when from training campaign, fix it!
        let exChanged = false;
        if (ex.status === 'abandoned' && (Date.now() - createdMs) < 7 * 86400000 && !(ex.internalNotes || '').includes('לא רלוונטי')) {
          ex.status = 'pending';
          exChanged = true;
        }
        if (isTraining && ex.serviceType !== 'training') {
          ex.serviceType = 'training';
          exChanged = true;
        }
        if (rawName && (!ex.ownerName || ex.ownerName === 'אבי')) {
          ex.ownerName = rawName;
          exChanged = true;
        }
        if (exChanged) {
          curIntakes[existingIdx] = { ...ex };
          modified = true;
        }

        // Rule 6: One-time gentle follow-up reminder during business hours (after 3h-24h) if lead hasn't filled out the questionnaire yet!
        const ageMs = Date.now() - createdMs;
        const isUnfilled = String(ex.dogName || '').includes('ממתין לבירור');
        if (isUnfilled && ex.status === 'pending' && !ex.questionnaireReminderSentAt && ageMs >= 3 * 3600 * 1000 && ageMs <= 24 * 3600 * 1000) {
          const now = new Date();
          const ilDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
          const ilTimeStr = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit' });
          const [hh, mm] = ilTimeStr.split(':').map(Number);
          const mins = hh * 60 + mm;
          const ilDay = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' })).getDay();
          const isOpenHours = (ilDay >= 0 && ilDay <= 4 && mins >= 9 * 60 && mins <= 19 * 60) || (ilDay === 5 && mins >= 9 * 60 && mins <= 13 * 60 + 30);
          const isHoliday = await checkIsShabbatOrHoliday(ilDateStr);
          if (isOpenHours && !isHoliday) {
            const fullName = ex.ownerName || rawName || '';
            const firstName = fullName.split(/\s+/)[0] || '';
            const chatId = `${getIntlPhone(cleanPhone)}@c.us`;
            const remMsg = getQuestionnaireReminderMessage(cleanPhone, firstName, fullName);
            const remRes = await sendWhatsAppMessage(chatId, remMsg);
            curIntakes[existingIdx] = {
              ...curIntakes[existingIdx],
              questionnaireReminderSentAt: new Date().toISOString(),
              internalNotes: `${curIntakes[existingIdx].internalNotes || ''} [נשלחה תזכורת אוטומטית למילוי שאלון: ${remRes.idMessage || 'נשלח'}]`.trim()
            };
            modified = true;
          }
        }
        continue;
      }

      if (syncedSheetPhones.has(cleanPhone)) continue;

      const fullName = rawName || 'לקוח יקר';
      const firstName = fullName.split(/\s+/)[0] || fullName;
      const intlPhone = getIntlPhone(cleanPhone);
      const chatId = `${intlPhone}@c.us`;

      // Check if we haven't sent auto-reply in last 24h AND lead is recent (within last 72h, never spam old historical leads)
      const isRecentForAutoWhatsApp = (Date.now() - createdMs) <= 72 * 60 * 60 * 1000;
      const isOlderThan7Days = (Date.now() - createdMs) > 7 * 24 * 60 * 60 * 1000;
      const lastSentMs = autoReplyHistory[cleanPhone] || 0;
      let sendRes = { ok: false, skipped: true };
      if (isRecentForAutoWhatsApp && Date.now() - lastSentMs >= 24 * 60 * 60 * 1000) {
        await updateGreenApiContact(chatId, fullName);
        const msg = getIntakeFormMessage(cleanPhone, firstName, fullName);
        sendRes = await sendWhatsAppMessage(chatId, msg);
        autoReplyHistory[cleanPhone] = Date.now();
      }

      const createdIso = createdDate && !isNaN(createdDate.getTime()) ? createdDate.toISOString() : new Date().toISOString();
      const startStr = new Date(Date.now() + 3 * 86400000).toISOString().substring(0, 10);
      const endStr = new Date(Date.now() + 10 * 86400000).toISOString().substring(0, 10);
      const leadId = `lead_${createdMs}_${cleanPhone.slice(-4)}`;

      const newLeadItem = {
        id: leadId,
        createdAt: createdIso,
        status: isOlderThan7Days ? 'abandoned' : 'pending',
        ownerName: fullName,
        ownerPhone: cleanPhone,
        ownerEmail: '',
        dogName: 'ממתין לבירור בשיחה 🐶',
        dogBreed: '',
        dogAge: '',
        serviceType: isTraining ? 'training' : 'boarding',
        startDate: startStr,
        endDate: endStr,
        clientOrigin: 'meta_lead',
        notes: `[📢 ליד מקמפיין ממומן במטא - ${isTraining ? 'אילוף' : 'פנסיון'}] | קמפיין: ${campaignName || formName || 'גוגל שיטס'}`,
        internalNotes: `הליד נקלט אוטומטית מגיליון Google Sheets של הקמפיין (${firstCell}). נשלחה הודעת פתיחה עם שאלון קליטה בוואטסאפ (${sendRes.idMessage ? `מזהה: ${sendRes.idMessage}` : 'נשלח'}). ממתין לשיחה של שמוליק.`,
        termsAccepted: false
      };

      curIntakes.unshift(newLeadItem);
      syncedSheetPhones.add(cleanPhone);
      newlySynced.push({ fullName, cleanPhone, serviceType: newLeadItem.serviceType, createdIso, messageSent: Boolean(sendRes.ok) });
      modified = true;
    }

    if (modified) {
      await supabase
        .from('settings')
        .update({
          data: {
            ...curData,
            intakeRequests: curIntakes,
            autoReplyHistory,
            syncedSheetPhones: Array.from(syncedSheetPhones)
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', 'resort_config');
    }

    return {
      ok: true,
      syncedCount: newlySynced.length,
      newlySynced
    };
  } catch (err) {
    console.error('Error in syncGoogleSheetLeads:', err);
    return { ok: false, error: err.message };
  }
}

/**
 * Mandatory Daily Sanity Check Audit for the Google Sheets Meta Leads File
 * 1. Auto-syncs any missed leads from the sheet first.
 * 2. Verifies sheet accessibility, row structure, and 100% sync presence in Supabase.
 */
export async function auditGoogleSheetsLeadsHealth(existingIntakes = [], existingBookings = [], lookbackDays = 30) {
  const issues = [];
  let totalSheetLeads = 0;
  let recentSheetLeads = 0;
  let autoHealedCount = 0;
  const missingLeads = [];
  const unparseableRows = [];

  try {
    // Step 1: Run auto-sync first so any new lead is immediately pulled into Supabase
    const syncRes = await syncGoogleSheetLeads(lookbackDays);
    if (!syncRes.ok) {
      issues.push(`🚨 תקלת גישה או סנכרון לגיליון הלידים (Google Sheets): ${syncRes.error || 'שגיאה לא ידועה'}`);
      return {
        healthy: false,
        totalSheetLeads: 0,
        recentSheetLeads: 0,
        autoHealedCount: 0,
        missingLeads,
        unparseableRows,
        issues
      };
    }
    autoHealedCount = syncRes.syncedCount || 0;

    // Step 2: Re-fetch latest intakes from Supabase if auto-healed, or combine with existingIntakes
    let currentIntakes = Array.isArray(existingIntakes) ? [...existingIntakes] : [];
    if (autoHealedCount > 0 || currentIntakes.length === 0) {
      try {
        const { data: sRow } = await supabase
          .from('settings')
          .select('data')
          .eq('id', 'resort_config')
          .single();
        if (sRow?.data?.intakeRequests) {
          currentIntakes = sRow.data.intakeRequests;
        }
      } catch (_) {}
    }

    // Step 3: Fetch and audit the Google Sheet CSV directly
    const csvUrl = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/export?format=csv`;
    const res = await fetch(csvUrl, { redirect: 'follow' });
    if (!res.ok) {
      issues.push(`🚨 גיליון הלידים של מטא (Google Sheets) אינו זמין! קוד שגיאה: HTTP ${res.status}`);
      return {
        healthy: false,
        totalSheetLeads,
        recentSheetLeads,
        autoHealedCount,
        missingLeads,
        unparseableRows,
        issues
      };
    }

    const csvText = await res.text();
    const lines = csvText.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length === 0) {
      issues.push(`🚨 גיליון הלידים של מטא (Google Sheets) חזר ריק לחלוטין!`);
      return {
        healthy: false,
        totalSheetLeads: 0,
        recentSheetLeads: 0,
        autoHealedCount,
        missingLeads,
        unparseableRows,
        issues
      };
    }

    const cutoffMs = Date.now() - lookbackDays * 24 * 60 * 60 * 1000;
    const recent7DaysMs = Date.now() - 7 * 24 * 60 * 60 * 1000;

    for (let rowIdx = 0; rowIdx < lines.length; rowIdx++) {
      const line = lines[rowIdx];
      if (line.includes('<test lead:') || line.includes('נוי בודקת')) continue;

      const cols = parseCsvLine(line);
      if (cols.length < 2) continue;

      // Skip header rows
      const firstCell = String(cols[0] || '').trim();
      const secondCell = String(cols[1] || '').trim();
      const isHeaderRow = firstCell.toLowerCase() === 'id' || secondCell.toLowerCase() === 'created_time' || line.includes('phone_number,');
      if (isHeaderRow && !firstCell.startsWith('l:')) continue;

      // Find phone across all columns
      const phoneCellRegex = /^(?:p:)?(?:\+?972|0)5\d[- ]?\d{7}$/;
      const foreignPhoneRegex = /^(?:p:)?\+(?!972)\d{7,15}$/;
      let rawPhone = '';
      let rawName = '';
      let isForeignPhone = false;
      for (let c = 0; c < cols.length; c++) {
        const val = String(cols[c] || '').trim();
        if (phoneCellRegex.test(val)) {
          rawPhone = val;
          if (c > 0) rawName = String(cols[c - 1] || '').trim();
          break;
        }
        if (foreignPhoneRegex.test(val)) {
          isForeignPhone = true;
        }
      }

      const createdDate = secondCell ? new Date(secondCell) : null;
      const createdMs = createdDate && !isNaN(createdDate.getTime()) ? createdDate.getTime() : 0;

      // Skip foreign non-Israeli phone numbers cleanly (e.g. +970, +7, +32)
      if (!rawPhone && isForeignPhone) {
        continue;
      }

      // If this row looks like a real Meta lead (starts with l: or has valid created_time) but has NO recognizable phone number!
      if (!rawPhone) {
        if (firstCell.startsWith('l:') || (createdMs > cutoffMs)) {
          const rowDateStr = secondCell ? secondCell.slice(0, 10) : `שורה ${rowIdx + 1}`;
          unparseableRows.push(rowDateStr);
          issues.push(`🚨 שורת ליד בגיליון Google Sheets (${rowDateStr}, מזהה ${firstCell || 'ללא'}) חסרה מספר טלפון תקין או שהעמודות השתבשו!`);
        }
        continue;
      }

      const cleanPhone = cleanPhoneNumber(rawPhone);
      if (!cleanPhone || cleanPhone.length < 9 || !cleanPhone.startsWith('05')) continue;

      totalSheetLeads++;
      if (createdMs >= recent7DaysMs) {
        recentSheetLeads++;
      }

      // Verify that every lead from the last lookbackDays exists in intakeRequests or bookings
      if (createdMs >= cutoffMs) {
        const phoneNorm = cleanPhone.slice(-7);
        const inIntakes = currentIntakes.some(r => cleanPhoneNumber(r.ownerPhone || r.owner_phone || '').slice(-7) === phoneNorm);
        const inBookings = (existingBookings || []).some(b => cleanPhoneNumber(b.ownerPhone || b.owner_phone || '').slice(-7) === phoneNorm);

        if (!inIntakes && !inBookings) {
          const leadDate = secondCell ? secondCell.slice(0, 10) : 'לא ידוע';
          missingLeads.push({ name: rawName || 'ליד', phone: cleanPhone, date: leadDate });
          issues.push(`🚨 ליד מגיליון Google Sheets לא נקלט במערכת: *${rawName || 'לקוח'}* (📞 ${cleanPhone}, מתאריך ${leadDate}) אינו מופיע בשאלוני הקליטה או ביומן!`);
        }
      }
    }

    return {
      healthy: issues.length === 0,
      totalSheetLeads,
      recentSheetLeads,
      autoHealedCount,
      missingLeads,
      unparseableRows,
      issues
    };
  } catch (err) {
    issues.push(`🚨 שגיאה בבדיקת גיליון הלידים (Google Sheets): ${err.message}`);
    return {
      healthy: false,
      totalSheetLeads,
      recentSheetLeads,
      autoHealedCount,
      missingLeads,
      unparseableRows,
      issues
    };
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

  // GET Health Check & Active Sheet Sync
  if (req.method === 'GET') {
    const shouldSync = req.query?.sync === 'true' || req.query?.sync_sheet === 'true';
    const syncResult = shouldSync ? await syncGoogleSheetLeads(Number(req.query?.days) || 5) : null;
    return res.status(200).json({
      ok: true,
      service: 'Resort Lead Webhook API',
      status: 'active',
      timestamp: new Date().toISOString(),
      ...(syncResult ? { syncResult } : {})
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
    // Weekday evening/night closure: Sunday-Thursday from 19:30 to 08:30
    const isWeekdayNight = (israelDay >= 0 && israelDay <= 4) && (timeInMinutes >= 19 * 60 + 30 || timeInMinutes < 8 * 60 + 30);
    const isClosedHours = isWeekendClosed || isHolidayClosed || isWeekdayNight;

    // 3. Prepare Message & Intake Form Link
    let outgoingMessage = '';
    if (isClosedHours) {
      outgoingMessage = getClosedHoursNewLeadMessage(cleanPhone, firstName, fullName);
    } else {
      outgoingMessage = getIntakeFormMessage(cleanPhone, firstName, fullName);
    }

    // 4. Send WhatsApp Message via Green-API
    const sendResult = await sendWhatsAppMessage(chatId, outgoingMessage);

    // 5. Save Lead Record in Supabase settings.data.intakeRequests
    const leadId = `lead_${Date.now()}_${cleanPhone.slice(-4)}`;
    try {
      const { data: sRow } = await supabase
        .from('settings')
        .select('data')
        .eq('id', 'resort_config')
        .single();
      const curData = sRow?.data || {};
      const curIntakes = Array.isArray(curData.intakeRequests) ? curData.intakeRequests : [];

      const phoneNorm = cleanPhone.replace(/\D/g, '').slice(-7);
      const exists = curIntakes.some(r => (r.ownerPhone || '').replace(/\D/g, '').includes(phoneNorm));
      if (!exists) {
        const nowIso = new Date().toISOString();
        const in3Days = new Date(Date.now() + 3 * 86400000).toISOString().substring(0, 10);
        const in10Days = new Date(Date.now() + 10 * 86400000).toISOString().substring(0, 10);
        const isTraining = (source || '').includes('אילוף') || !((source || '').includes('פנסיון'));

        const newLeadItem = {
          id: leadId,
          createdAt: nowIso,
          status: 'pending',
          ownerName: fullName,
          ownerPhone: cleanPhone,
          ownerEmail: email || '',
          dogName: 'ממתין לבירור בשיחה 🐶',
          dogBreed: '',
          dogAge: '',
          serviceType: isTraining ? 'training' : 'boarding',
          startDate: in3Days,
          endDate: in10Days,
          clientOrigin: 'meta_lead',
          notes: `[📢 ליד מקמפיין ממומן במטא] | מקור: ${source}`,
          internalNotes: `הליד נקלט מקמפיין ממומן. נשלח שאלון קליטה אישי בוואטסאפ (${sendResult.idMessage ? `מזהה הודעה: ${sendResult.idMessage}` : 'נשלח'}). ממתין לשיחה של שמוליק.`,
          termsAccepted: false
        };
        curIntakes.unshift(newLeadItem);
        await supabase
          .from('settings')
          .update({
            data: { ...curData, intakeRequests: curIntakes },
            updated_at: nowIso
          })
          .eq('id', 'resort_config');
        console.log(`✅ Saved new lead ${leadId} (${fullName} - ${cleanPhone}) to settings.data.intakeRequests`);
      }
    } catch (dbErr) {
      console.warn('Could not save lead to settings.data.intakeRequests:', dbErr?.message || dbErr);
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
