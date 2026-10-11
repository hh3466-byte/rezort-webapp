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

    let reconciledCount = 0;
    const syncLogs = [];

    // Reconcile unlinked or pending Grow payments
    for (const payment of (recentGrowPayments || [])) {
      if (payment.status === 'dismissed' || payment.status === 'refunded') continue;

      const pPhone = cleanPhoneNumber(payment.customer_phone);
      const pName = (payment.customer_name || '').trim().toLowerCase();
      const pAmount = Number(payment.amount) || 0;
      const pRef = String(payment.reference_id || payment.id || '');

      if (!pAmount || pAmount <= 0) continue;

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

    // 5. Rule 6 Enforcement: Auto-archive expired intake questionnaires (endDate <= today)
    let autoArchivedIntakesCount = 0;
    for (const req of (intakes || [])) {
      const eDate = req.end_date || req.endDate;
      if (eDate && eDate <= todayStr && req.status !== 'archived') {
        await supabase.from('intake_requests').update({
          status: 'archived',
          updated_at: new Date().toISOString()
        }).eq('id', req.id);
        autoArchivedIntakesCount++;
      }
    }

    // 6. Grow API Health Ping
    let growApiHealthy = true;
    let growLatencyMs = 0;
    try {
      const pingStart = Date.now();
      const growPingRes = await fetch('https://meshulam.co.il/api/light/server/1.0/getPaymentProcessInfo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ pageCode: '538cbf6f8827', processId: 'ping' }),
        signal: AbortSignal.timeout(5000)
      });
      growLatencyMs = Date.now() - pingStart;
      growApiHealthy = growPingRes.status === 200;
    } catch (e) {
      growApiHealthy = false;
    }

    // 7. Save telemetry to settings
    const { data: sRows } = await supabase.from('settings').select('*').limit(1);
    const sRow = sRows?.[0] || {};
    const curSettingsData = sRow.data || {};

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
          durationMs: Date.now() - startTime
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
      syncLogs
    });
  } catch (err) {
    console.error('Error in cron-hourly-sync:', err);
    return res.status(500).json({ error: err.message });
  }
}
