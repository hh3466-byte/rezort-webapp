const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || '').trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    env[match[1]] = val;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

function formatDateIL(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length >= 3) {
    return `${parts[2].substring(0, 2)}.${parts[1]}.${parts[0].slice(2)}`;
  }
  return dateStr;
}

function runSanityAudit(bookings, settings, intakes, payments, todayStr = '2026-09-19') {
  const anomalies = {
    unpaidReservations: [],
    dateOrServiceTypos: [],
    pricingAnomalies: [],
    duplicateDogs: [],
    capacityOverbooked: [],
    unmatchedPayments: [],
    staleIntakes: []
  };

  const active = (bookings || []).filter(b => {
    const st = b.stay_status || b.stayStatus;
    return st !== 'cancelled' && st !== 'checked_out';
  });

  const maxCapacity = Number(settings?.max_capacity || settings?.maxCapacity) || 10;

  // 1. Unpaid reservations (0 deposit)
  active.forEach(b => {
    const end = b.end_date || b.endDate;
    const price = Number(b.total_price || b.totalPrice) || 0;
    const deposit = Number(b.deposit_amount || b.depositAmount) || 0;
    const isFree = b.is_free_stay || b.isFreeStay || (b.data && b.data.isFreeStay);
    if (end >= todayStr && price > 0 && deposit === 0 && !isFree) {
      anomalies.unpaidReservations.push({
        id: b.id,
        dog: b.dog_name || b.dogName,
        owner: b.owner_name || b.ownerName,
        phone: b.owner_phone || b.ownerPhone,
        dates: `${formatDateIL(b.start_date || b.startDate)} עד ${formatDateIL(end)}`,
        price,
        notes: b.notes || ''
      });
    }
  });

  // 2. Typos in dates or services
  active.forEach(b => {
    const start = b.start_date || b.startDate;
    const end = b.end_date || b.endDate;
    const sType = b.service_type || b.serviceType || '';
    const dog = b.dog_name || b.dogName;
    const owner = b.owner_name || b.ownerName;

    if (!start || !end) {
      anomalies.dateOrServiceTypos.push(`🐶 ${dog} (${owner}): חסר תאריך כניסה או יציאה`);
    } else if (end < start) {
      anomalies.dateOrServiceTypos.push(`🐶 ${dog} (${owner}): תאריך יציאה (${formatDateIL(end)}) קודם לתאריך כניסה (${formatDateIL(start)})!`);
    } else if (sType.includes('training') && start === end) {
      anomalies.dateOrServiceTypos.push(`🐶 ${dog} (${owner}): תהליך אילוף הוגדר ליום בודד בלבד (${formatDateIL(start)})`);
    }
  });

  // 3. Pricing anomalies
  active.forEach(b => {
    const price = Number(b.total_price || b.totalPrice) || 0;
    const deposit = Number(b.deposit_amount || b.depositAmount) || 0;
    const dog = b.dog_name || b.dogName;
    const owner = b.owner_name || b.ownerName;
    const isFree = b.is_free_stay || b.isFreeStay || (b.data && b.data.isFreeStay);

    if (price <= 0 && !isFree) {
      anomalies.pricingAnomalies.push(`🐶 ${dog} (${owner}): סך הכל לתשלום הינו ₪0 ללא סימון אירוח חינם`);
    }
    if (deposit > price && price > 0) {
      anomalies.pricingAnomalies.push(`🐶 ${dog} (${owner}): מקדמה ששולמה (₪${deposit}) גדולה מסך כל ההזמנה (₪${price})`);
    }
  });

  // 4. Duplicate dogs
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const b1 = active[i];
      const b2 = active[j];
      const phone1 = (b1.owner_phone || b1.ownerPhone || '').replace(/\D/g, '');
      const phone2 = (b2.owner_phone || b2.ownerPhone || '').replace(/\D/g, '');
      const dog1 = (b1.dog_name || b1.dogName || '').trim().toLowerCase();
      const dog2 = (b2.dog_name || b2.dogName || '').trim().toLowerCase();

      if (phone1 && phone1 === phone2 && dog1 && dog1 === dog2) {
        const s1 = b1.start_date || b1.startDate;
        const e1 = b1.end_date || b1.endDate;
        const s2 = b2.start_date || b2.startDate;
        const e2 = b2.end_date || b2.endDate;
        // Check overlap
        if (s1 <= e2 && e1 >= s2) {
          anomalies.duplicateDogs.push(`🐶 ${b1.dog_name || b1.dogName} (${b1.owner_name || b1.ownerName}): כפילות הזמנות חופפות (${formatDateIL(s1)}-${formatDateIL(e1)} מול ${formatDateIL(s2)}-${formatDateIL(e2)})`);
        }
      }
    }
  }

  // 5. Overbooking capacity in next 14 days
  for (let d = 0; d < 14; d++) {
    const curDate = new Date(todayStr + 'T00:00:00');
    curDate.setDate(curDate.getDate() + d);
    const y = curDate.getFullYear();
    const m = String(curDate.getMonth() + 1).padStart(2, '0');
    const day = String(curDate.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${day}`;

    // Overnights on dateStr (start <= dateStr && end > dateStr)
    const overnights = active.filter(b => {
      const s = b.start_date || b.startDate;
      const e = b.end_date || b.endDate;
      return s <= dateStr && e > dateStr;
    });

    if (overnights.length > maxCapacity) {
      anomalies.capacityOverbooked.push(`📅 ${formatDateIL(dateStr)}: ${overnights.length} כלבים ללינה (מעל התפוסה המירבית של ${maxCapacity})`);
    }
  }

  // 6. Unmatched Grow payments
  (payments || []).forEach(p => {
    if (p.status === 'pending') {
      anomalies.unmatchedPayments.push(`💳 ₪${p.amount} מ-${p.customer_name || 'לקוח'} (${formatDateIL(p.created_at?.split('T')[0])}) טרם שויך להזמנה`);
    }
  });

  return anomalies;
}

async function testAudit() {
  const { data: bookings } = await supabase.from('bookings').select('*');
  const { data: settingsData } = await supabase.from('settings').select('*');
  const { data: intakes } = await supabase.from('intake_requests').select('*');
  const { data: payments } = await supabase.from('grow_incoming_payments').select('*');

  const sRow = settingsData[0] || {};
  const settings = { ...sRow, ...(sRow.data || {}) };

  const results = runSanityAudit(bookings, settings, intakes, payments, '2026-09-19');
  console.log('Sanity Audit Results:', JSON.stringify(results, null, 2));
}

testAudit();
