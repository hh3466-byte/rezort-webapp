/**
 * =========================================================================
 * Vercel Serverless Cron Handler: /api/cron-hourly-sync
 * Automatically runs every hour on the hour ("0 * * * *")
 * 
 * Responsibilities:
 * 1. Reconciles incoming Grow payments from grow_incoming_payments with Resort bookings.
 * 2. Matches any unlinked payments to open bookings/intakes by phone or name.
 * 3. Enforces Rule 22: Automatically archives checked-out stays older than 72 hours.
 * 4. Enforces Rule 6: Automatically archives expired intake requests (endDate <= today).
 * 5. Pings Grow API to verify connection health & logs sync telemetry to settings.
 * =========================================================================
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://ydlynqqmulojhrxbfjsc.supabase.co";
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function cleanPhoneNumber(phone) {
  if (!phone) return '';
  let cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.startsWith('972')) cleaned = '0' + cleaned.slice(3);
  else if (cleaned.length === 9 && cleaned.startsWith('5')) cleaned = '0' + cleaned;
  return cleaned;
}

function getGreenApiUrl(id, endpoint, token) {
  const cleanId = String(id || '').trim();
  const clusterPrefix = cleanId.length >= 4 ? cleanId.slice(0, 4) : '';
  const domain = clusterPrefix ? `${clusterPrefix}.api.greenapi.com` : 'api.greenapi.com';
  return `https://${domain}/waInstance${cleanId}/${endpoint}/${token}`;
}

function getIsraelDateInfo() {
  const now = new Date();
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false
  });
  const parts = dtf.formatToParts(now);
  let y = '', m = '', d = '', h = 0, min = 0;
  for (const p of parts) {
    if (p.type === 'year') y = p.value;
    if (p.type === 'month') m = p.value;
    if (p.type === 'day') d = p.value;
    if (p.type === 'hour') h = parseInt(p.value, 10);
    if (p.type === 'minute') min = parseInt(p.value, 10);
  }
  return { dateStr: `${y}-${m}-${d}`, hour: h, minute: min };
}

export default async function handler(req, res) {
  try {
    const { dateStr: todayStr, hour, minute } = getIsraelDateInfo();
    const startTime = Date.now();

    // 1. Fetch recent Grow payments from last 7 days
    const { data: recentGrowPayments, error: growErr } = await supabase
      .from('grow_incoming_payments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    // 2. Fetch active bookings
    const { data: bookings, error: bErr } = await supabase
      .from('bookings')
      .select('*')
      .neq('stay_status', 'cancelled');

    // 3. Fetch active intakes
    const { data: intakes, error: iErr } = await supabase
      .from('intake_requests')
      .select('*')
      .neq('status', 'archived');

    // 4. Fetch passes (daycare_passes table & settings fallback)
    let allPasses = [];
    try {
      const { data: pData } = await supabase.from('daycare_passes').select('*');
      if (pData && pData.length > 0) {
        allPasses = pData.map(p => ({
          id: p.id,
          passCode: p.pass_code || p.passCode,
          ownerName: p.owner_name || p.ownerName,
          ownerPhone: p.owner_phone || p.ownerPhone,
          dogName: p.dog_name || p.dogName,
          pricePaid: Number(p.price_paid || p.pricePaid || 0),
          serviceType: p.service_type || p.serviceType,
          paymentStatus: p.payment_status || p.paymentStatus,
          status: p.status,
          ...p
        }));
      }
    } catch (_) {}

    try {
      const { data: sData } = await supabase.from('settings').select('data').eq('id', 'resort_config').maybeSingle();
      if (sData?.data?.daycare_passes && Array.isArray(sData.data.daycare_passes)) {
        for (const sp of sData.data.daycare_passes) {
          if (!allPasses.some(ap => ap.id === sp.id || ap.passCode === sp.passCode)) {
            allPasses.push(sp);
          }
        }
      }
    } catch (_) {}

    let reconciledCount = 0;
    const syncLogs = [];

    // Reconcile unlinked or pending Grow payments
    for (const payment of (recentGrowPayments || [])) {
      if (payment.status === 'dismissed' || payment.status === 'refunded' || payment.status === 'duplicate' || payment.status === 'sandbox_test' || payment.status === 'cancelled') continue;

      const pPhone = cleanPhoneNumber(payment.customer_phone);
      const pName = (payment.customer_name || '').trim().toLowerCase();
      const pAmount = Number(payment.amount) || 0;
      const pRef = String(payment.reference_id || payment.id || '');

      if (!pAmount || pAmount <= 0) continue;

      // Check if matches an unpaid pass
      const matchedPass = allPasses.find(p => {
        const pPassPhone = cleanPhoneNumber(p.ownerPhone || '');
        const isPhone = pPhone && pPassPhone && pPassPhone.endsWith(pPhone.slice(-7));
        const pPassName = (p.ownerName || '').trim().toLowerCase();
        const isName = pName && pPassName && (pPassName.includes(pName) || pName.includes(pPassName));
        const isUnpaid = p.paymentStatus !== 'fully_paid';
        return (isPhone || isName) && (isUnpaid || Number(p.pricePaid || 0) === pAmount);
      });

      if (matchedPass && matchedPass.paymentStatus !== 'fully_paid') {
        try {
          await supabase.from('daycare_passes').update({
            payment_status: 'fully_paid',
            status: 'active',
            updated_at: new Date().toISOString()
          }).eq('id', matchedPass.id);
        } catch (_) {}

        try {
          const { data: sData } = await supabase.from('settings').select('data').eq('id', 'resort_config').maybeSingle();
          if (sData?.data?.daycare_passes) {
            const upList = sData.data.daycare_passes.map(p => {
              if (p.id === matchedPass.id || p.passCode === matchedPass.passCode) {
                return { ...p, paymentStatus: 'fully_paid', status: 'active', updatedAt: new Date().toISOString() };
              }
              return p;
            });
            await supabase.from('settings').update({ data: { ...sData.data, daycare_passes: upList } }).eq('id', 'resort_config');
          }
        } catch (_) {}

        // Reconcile associated bookings
        const passBookings = (bookings || []).filter(b => {
          const bData = b.data || {};
          const isDirect = b.daycare_pass_id === matchedPass.id || b.daycare_pass_code === matchedPass.passCode || bData.daycarePassId === matchedPass.id || bData.daycarePassCode === matchedPass.passCode;
          const bPhone = cleanPhoneNumber(b.owner_phone || b.ownerPhone || '');
          const isPhone = pPhone && bPhone && bPhone.endsWith(pPhone.slice(-7));
          const hasDebt = (b.notes || '').includes('חוב כרטיסייה') || bData.daycarePassPaid === false || b.payment_status !== 'fully_paid';
          return isDirect || (isPhone && hasDebt);
        });

        for (const pb of passBookings) {
          const curData = pb.data || {};
          const cleanedNotes = (pb.notes || '')
            .replace(/\|\s*\[⚠️ חוב כרטיסייה טרם שולם - אושר בהקפה\]/g, '')
            .replace(/\[⚠️ חוב כרטיסייה טרם שולם - אושר בהקפה\]/g, '')
            .replace(/\[⚠️ חוב כרטיסייה\]/g, '')
            .trim();
          await supabase.from('bookings').update({
            payment_status: 'fully_paid',
            notes: cleanedNotes ? `${cleanedNotes} | כרטיסייה שולמה ב-Grow (אסמכתא ${pRef})` : `כרטיסייה שולמה ב-Grow (אסמכתא ${pRef})`,
            data: { ...curData, daycarePassPaid: true, paymentStatus: 'fully_paid' },
            updated_at: new Date().toISOString()
          }).eq('id', pb.id);
        }

        await supabase.from('grow_incoming_payments').update({ status: 'completed' }).eq('id', payment.id);
        matchedPass.paymentStatus = 'fully_paid';
        reconciledCount++;
        syncLogs.push(`Reconciled pass ₪${pAmount} for ${matchedPass.dogName} (${matchedPass.ownerName})`);
        continue;
      }

      // Find matching booking
      const match = (bookings || []).find(b => {
        const bPhone = cleanPhoneNumber(b.owner_phone || b.ownerPhone || '');
        if (pPhone && pPhone.length >= 7 && bPhone && bPhone.endsWith(pPhone.slice(-7))) return true;
        const bName = (b.owner_name || b.ownerName || '').trim().toLowerCase();
        if (pName && bName && (bName.includes(pName) || pName.includes(bName))) return true;
        const notes = (b.notes || '') + (b.data?.notes || '');
        if (pRef && notes.includes(pRef)) return true;
        return false;
      });

      if (match) {
        const curDeposit = Number(match.deposit_amount || match.depositAmount || 0);
        const totalPrice = Number(match.total_price || match.totalPrice || 0);
        const curData = match.data || {};
        const notes = (match.notes || '');

        // If booking does not yet have this payment recorded
        if (!notes.includes(pRef) && curDeposit < totalPrice) {
          const newDeposit = Math.min(totalPrice, curDeposit + pAmount);
          const isFullyPaid = totalPrice > 0 && newDeposit >= totalPrice;
          const newNotes = (notes ? notes + ' ' : '') + `[Grow אסמכתא ${pRef} (₪${pAmount})]`;

          await supabase.from('bookings').update({
            deposit_amount: newDeposit,
            payment_status: isFullyPaid ? 'fully_paid' : 'deposit_paid',
            notes: newNotes,
            data: {
              ...curData,
              depositAmount: newDeposit,
              paymentStatus: isFullyPaid ? 'fully_paid' : 'deposit_paid',
              notes: newNotes
            },
            updated_at: new Date().toISOString()
          }).eq('id', match.id);

          reconciledCount++;
          syncLogs.push(`Reconciled ₪${pAmount} (ref: ${pRef}) for ${match.dog_name} (${match.owner_name})`);
        }
      }
    }

    // 4. Rule 22 Enforcement: Auto-archive checked_out stays older than 72 hours
    const seventyTwoHoursAgoMs = Date.now() - (72 * 60 * 60 * 1000);
    let autoArchivedStaysCount = 0;

    for (const b of (bookings || [])) {
      if (b.stay_status === 'checked_out') {
        const checkOutTime = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        const endTime = b.end_date ? new Date(`${b.end_date}T23:59:59+03:00`).getTime() : 0;
        const effectiveCheckoutMs = Math.max(checkOutTime, endTime);

        if (effectiveCheckoutMs > 0 && effectiveCheckoutMs < seventyTwoHoursAgoMs) {
          await supabase.from('bookings').update({
            stay_status: 'archived',
            updated_at: new Date().toISOString()
          }).eq('id', b.id);
          autoArchivedStaysCount++;
        }
      }
    }

    // 5. Rule 6 Enforcement: Auto-archive expired intake questionnaires (endDate <= today or startDate < today)
    let autoArchivedIntakesCount = 0;
    for (const req of (intakes || [])) {
      const eDate = req.end_date || req.endDate;
      const sDate = req.start_date || req.startDate;
      const isExpired = (eDate && eDate <= todayStr) || (sDate && sDate < todayStr);
      if (isExpired && req.status !== 'archived' && req.status !== 'abandoned' && req.status !== 'approved') {
        try {
          await supabase.from('intake_requests').update({
            status: 'archived',
            updated_at: new Date().toISOString()
          }).eq('id', req.id);
          autoArchivedIntakesCount++;
        } catch (e) {}
      }
    }

    // 6. Grow API Health Ping
    let growApiHealthy = true;
    let growLatencyMs = 0;
    try {
      const pingStart = Date.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const growPingRes = await fetch('https://meshulam.co.il/api/light/server/1.0/getPaymentProcessInfo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ pageCode: '538cbf6f8827', processId: 'ping' }),
        signal: controller.signal
      });
      clearTimeout(timeout);
      growLatencyMs = Date.now() - pingStart;
      growApiHealthy = growPingRes.status === 200;
    } catch (e) {
      growApiHealthy = false;
    }

    // 7. Save telemetry and auto-archive in settings.data.intakeRequests (primary storage)
    const { data: sRows } = await supabase.from('settings').select('*').limit(1);
    const sRow = sRows?.[0] || {};
    const curSettingsData = sRow.data || {};

    if (Array.isArray(curSettingsData.intakeRequests)) {
      curSettingsData.intakeRequests = curSettingsData.intakeRequests.map(req => {
        const eDate = req.endDate || req.end_date;
        const sDate = req.startDate || req.start_date;
        const isExpired = (eDate && eDate <= todayStr) || (sDate && sDate < todayStr);
        const hasIrrelevantNote = req.internalNotes && (req.internalNotes.includes('לא רלוונטי') || req.internalNotes.includes('הוסר מהרשימה') || req.internalNotes.includes('בוטל'));
        
        const reqDog = (req.dogName || req.dog_name || '').trim().toLowerCase();
        const reqPhone = cleanPhoneNumber(req.ownerPhone || req.owner_phone || '');
        const hasBooking = (bookings || []).some(b => {
          const bDog = (b.dog_name || b.dogName || '').trim().toLowerCase();
          const bPhone = cleanPhoneNumber(b.owner_phone || b.ownerPhone || '');
          return (reqDog && bDog && reqDog === bDog && (bPhone.slice(-7) === reqPhone.slice(-7) || !reqPhone));
        });

        if ((isExpired || hasIrrelevantNote) && req.status !== 'archived' && req.status !== 'abandoned' && (!hasBooking || req.status !== 'approved')) {
          autoArchivedIntakesCount++;
          return {
            ...req,
            status: 'abandoned',
            internalNotes: (req.internalNotes || '') + `\n[הועבר לארכיון אוטומטית לפי חוק 6 ב-${todayStr}]`
          };
        }
        return req;
      });
    }

    // 8. WATCHDOG: Self-healing check for missed critical daily reports
    const watchdogLogs = [];
    const baseUrl = 'https://rezort-webapp.vercel.app';

    // A. 18:30 Sanity Report watchdog (runs if Israel hour >= 18:35 and not yet sent today)
    if (hour > 18 || (hour === 18 && minute >= 35)) {
      const alreadySent1830 = curSettingsData.last1830SanitySentDate === todayStr;
      if (!alreadySent1830) {
        try {
          console.log('[WATCHDOG] Triggering missed 18:30 Sanity Report...');
          const sanityRes = await fetch(`${baseUrl}/api/cron-sanity-check?force=true`);
          const sJson = await sanityRes.json();
          watchdogLogs.push({ task: '1830_sanity', triggered: true, status: sJson.status });
        } catch (we) {
          watchdogLogs.push({ task: '1830_sanity', triggered: true, error: we.message });
        }
      }
    }

    // B. 19:00 Tomorrow Overview watchdog (runs if Israel hour >= 19:15 and not yet sent today)
    if (hour > 19 || (hour === 19 && minute >= 15)) {
      const alreadySent1900 = curSettingsData.lastTomorrowOverviewSentDate === todayStr;
      if (!alreadySent1900) {
        try {
          console.log('[WATCHDOG] Triggering missed 19:00 Evening Report...');
          const eveRes = await fetch(`${baseUrl}/api/cron-evening-report?force=true`);
          const eJson = await eveRes.json();
          watchdogLogs.push({ task: '1900_evening_report', triggered: true, status: eJson.status });
        } catch (we) {
          watchdogLogs.push({ task: '1900_evening_report', triggered: true, error: we.message });
        }
      }
    }

    // C. 20:00 Daily Regards watchdog (runs if Israel hour >= 20:15 and not yet sent today)
    if (hour > 20 || (hour === 20 && minute >= 15)) {
      const alreadySent2000 = curSettingsData.last2000DailyUpdateSentDate === todayStr;
      if (!alreadySent2000) {
        try {
          console.log('[WATCHDOG] Triggering missed 20:00 Daily Update...');
          const duRes = await fetch(`${baseUrl}/api/cron-daily-update?force=true`);
          const duJson = await duRes.json();
          watchdogLogs.push({ task: '2000_daily_update', triggered: true, status: duJson.status });
        } catch (we) {
          watchdogLogs.push({ task: '2000_daily_update', triggered: true, error: we.message });
        }
      }
    }

    await supabase.from('settings').update({
      data: {
        ...curSettingsData,
        lastHourlyGrowSync: {
          timestamp: new Date().toISOString(),
          dateStr: todayStr,
          time: `${hour}:${String(minute).padStart(2, '0')}`,
          reconciledCount,
          autoArchivedStaysCount,
          autoArchivedIntakesCount,
          growApiHealthy,
          growLatencyMs,
          durationMs: Date.now() - startTime,
          watchdogLogs
        }
      },
      updated_at: new Date().toISOString()
    }).eq('id', sRow.id || 'resort_config');

    return res.status(200).json({
      status: 'success',
      timestamp: new Date().toISOString(),
      reconciledCount,
      autoArchivedStaysCount,
      autoArchivedIntakesCount,
      growApiHealthy,
      growLatencyMs,
      durationMs: Date.now() - startTime,
      watchdogLogs,
      syncLogs
    });
  } catch (err) {
    console.error('Error in cron-hourly-sync:', err);
    try {
      const emergencyUrl = getGreenApiUrl('710722735421', 'sendMessage', 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b');
      await fetch(emergencyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: '972543200007@c.us',
          message: `🚨 *התראת כשל מערכת בסנכרון שעתי (cron-hourly-sync)*\nשגיאה: ${err.message}\nנא לבדוק את התקלה באופן מיידי!`
        })
      });
    } catch (_) {}
    return res.status(500).json({ error: err.message });
  }
}
