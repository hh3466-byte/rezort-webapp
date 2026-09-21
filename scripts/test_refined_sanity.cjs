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

function runRefinedSanityAudit(bookings, settings, intakes, payments, todayStr = '2026-09-19') {
  const anomalies = {
    unpaidUpcoming: [],
    typos: [],
    pricingIssues: [],
    duplicateBookings: [],
    capacityAlerts: [],
    unmatchedGrowPayments: []
  };

  const activeUpcoming = (bookings || []).filter(b => {
    const st = b.stay_status || b.stayStatus;
    const end = b.end_date || b.endDate;
    return st !== 'cancelled' && st !== 'checked_out' && end >= todayStr;
  });

  const maxCapacity = Number(settings?.max_capacity || settings?.maxCapacity) || 10;

  // 1. Unpaid reservations holding capacity
  activeUpcoming.forEach(b => {
    const price = Number(b.total_price || b.totalPrice) || 0;
    const deposit = Number(b.deposit_amount || b.depositAmount) || 0;
    const isFree = b.is_free_stay || b.isFreeStay || (b.data && b.data.isFreeStay);
    const dog = b.dog_name || b.dogName || 'כלב';
    const owner = b.owner_name || b.ownerName || 'בעלים';
    const phone = b.owner_phone || b.ownerPhone || '';
    const start = b.start_date || b.startDate;
    const end = b.end_date || b.endDate;

    if (price > 0 && deposit === 0 && !isFree) {
      anomalies.unpaidUpcoming.push({
        dog,
        owner,
        phone,
        dates: `${formatDateIL(start)} עד ${formatDateIL(end)}`,
        price
      });
    }
  });

  // 2. Typos in dates or services
  activeUpcoming.forEach(b => {
    const start = b.start_date || b.startDate;
    const end = b.end_date || b.endDate;
    const sType = b.service_type || b.serviceType || '';
    const dog = b.dog_name || b.dogName || 'כלב';
    const owner = b.owner_name || b.ownerName || 'בעלים';

    if (!start || !end) {
      anomalies.typos.push(`🐶 ${dog} (${owner}): חסר תאריך כניסה/יציאה חוקי`);
    } else if (end < start) {
      anomalies.typos.push(`🐶 ${dog} (${owner}): תאריך יציאה (${formatDateIL(end)}) קודם לכניסה (${formatDateIL(start)})`);
    } else if (sType.includes('training') && start === end) {
      anomalies.typos.push(`🐶 ${dog} (${owner}): תהליך אילוף הוגדר ליום בודד (${formatDateIL(start)})`);
    }
  });

  // 3. Pricing anomalies
  activeUpcoming.forEach(b => {
    const price = Number(b.total_price || b.totalPrice) || 0;
    const deposit = Number(b.deposit_amount || b.depositAmount) || 0;
    const dog = b.dog_name || b.dogName || 'כלב';
    const owner = b.owner_name || b.ownerName || 'בעלים';
    const isFree = b.is_free_stay || b.isFreeStay || (b.data && b.data.isFreeStay);

    if (price <= 0 && !isFree) {
      anomalies.pricingIssues.push(`🐶 ${dog} (${owner}): סך הכל לתשלום ₪0 (לא סומן אירוח חינם)`);
    }
    if (deposit > price && price > 0) {
      anomalies.pricingIssues.push(`🐶 ${dog} (${owner}): מקדמה (₪${deposit}) גדולה מסך ההזמנה (₪${price})`);
    }
  });

  // 4. Duplicate dogs in active upcoming bookings
  for (let i = 0; i < activeUpcoming.length; i++) {
    for (let j = i + 1; j < activeUpcoming.length; j++) {
      const b1 = activeUpcoming[i];
      const b2 = activeUpcoming[j];
      const phone1 = (b1.owner_phone || b1.ownerPhone || '').replace(/\D/g, '');
      const phone2 = (b2.owner_phone || b2.ownerPhone || '').replace(/\D/g, '');
      const dog1 = (b1.dog_name || b1.dogName || '').trim().toLowerCase();
      const dog2 = (b2.dog_name || b2.dogName || '').trim().toLowerCase();

      if (phone1 && phone1 === phone2 && dog1 && dog1 === dog2) {
        const s1 = b1.start_date || b1.startDate;
        const e1 = b1.end_date || b1.endDate;
        const s2 = b2.start_date || b2.startDate;
        const e2 = b2.end_date || b2.endDate;
        if (s1 <= e2 && e1 >= s2) {
          anomalies.duplicateBookings.push(`🐶 ${b1.dog_name || b1.dogName} (${b1.owner_name || b1.ownerName}): כפילות תאריכים חופפים (${formatDateIL(s1)}-${formatDateIL(e1)})`);
        }
      }
    }
  }

  // 5. Overbooking capacity in next 7 days
  for (let d = 0; d < 7; d++) {
    const curDate = new Date(todayStr + 'T00:00:00');
    curDate.setDate(curDate.getDate() + d);
    const y = curDate.getFullYear();
    const m = String(curDate.getMonth() + 1).padStart(2, '0');
    const day = String(curDate.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${day}`;

    const overnights = activeUpcoming.filter(b => {
      const s = b.start_date || b.startDate;
      const e = b.end_date || b.endDate;
      return s <= dateStr && e > dateStr;
    });

    if (overnights.length > maxCapacity) {
      anomalies.capacityAlerts.push(`📅 ${formatDateIL(dateStr)}: ${overnights.length} כלבים ללינה (חריגה מ-${maxCapacity})`);
    }
  }

  // 6. Unmatched Grow payments
  (payments || []).forEach(p => {
    if (p.status === 'pending') {
      anomalies.unmatchedGrowPayments.push(`💳 ₪${p.amount} מ-${p.customer_name || 'לקוח'} (${formatDateIL(p.created_at?.split('T')[0])})`);
    }
  });

  return anomalies;
}

function formatSanitySectionForShmulik(anomalies) {
  const parts = [];
  const hasIssues = 
    anomalies.unpaidUpcoming.length > 0 ||
    anomalies.typos.length > 0 ||
    anomalies.pricingIssues.length > 0 ||
    anomalies.duplicateBookings.length > 0 ||
    anomalies.capacityAlerts.length > 0 ||
    anomalies.unmatchedGrowPayments.length > 0;

  if (!hasIssues) {
    return `\n\n🛡️ *בדיקת שפיות יומן (18:30):* ✅ כל הנתונים תקינים! אין כפילויות, אין חריגות תפוסה ואין טעויות הקלדה.`;
  }

  parts.push(`\n\n🛡️ *ממצאי בדיקת שפיות וחריגות ביומן (הופק ב-18:30):*`);

  if (anomalies.unpaidUpcoming.length > 0) {
    parts.push(`🚨 *שיריוני מקום ללא מקדמה (${anomalies.unpaidUpcoming.length} כלבים):*`);
    anomalies.unpaidUpcoming.forEach(u => {
      parts.push(`   • 🔴 *${u.dog}* (${u.owner} - ${u.phone}) | ${u.dates} | ₪0 מקדמה (חוב: ₪${u.price.toLocaleString()})`);
    });
  }

  if (anomalies.typos.length > 0) {
    parts.push(`⚠️ *חשד לטעויות הקלדה:*`);
    anomalies.typos.forEach(t => parts.push(`   • ${t}`));
  }

  if (anomalies.duplicateBookings.length > 0) {
    parts.push(`👥 *כפילויות כלבים ביומן:*`);
    anomalies.duplicateBookings.forEach(d => parts.push(`   • ${d}`));
  }

  if (anomalies.pricingIssues.length > 0) {
    parts.push(`💰 *אי-התאמות במחירים:*`);
    anomalies.pricingIssues.forEach(p => parts.push(`   • ${p}`));
  }

  if (anomalies.capacityAlerts.length > 0) {
    parts.push(`📈 *ימים בעומס תפוסה (מעל 10 מקומות):*`);
    anomalies.capacityAlerts.forEach(c => parts.push(`   • ${c}`));
  }

  if (anomalies.unmatchedGrowPayments.length > 0) {
    parts.push(`💳 *תשלומי Grow ממתינים לשיוך:*`);
    anomalies.unmatchedGrowPayments.forEach(p => parts.push(`   • ${p}`));
  }

  return parts.join('\n');
}

async function test() {
  const { data: bookings } = await supabase.from('bookings').select('*');
  const { data: settingsData } = await supabase.from('settings').select('*');
  const { data: intakes } = await supabase.from('intake_requests').select('*');
  const { data: payments } = await supabase.from('grow_incoming_payments').select('*');

  const sRow = settingsData[0] || {};
  const settings = { ...sRow, ...(sRow.data || {}) };

  const anomalies = runRefinedSanityAudit(bookings, settings, intakes, payments, '2026-09-19');
  const text = formatSanitySectionForShmulik(anomalies);
  console.log('--- FORMATTED SANITY SECTION FOR 19:00 REPORT ---');
  console.log(text);
}

test();
