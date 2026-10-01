const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || '').trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[match[1]] = val;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

function calculateDays(start, end) {
  if (!start || !end) return 1;
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  const diff = Math.round((e - s) / (1000 * 60 * 60 * 24));
  return Math.max(1, diff);
}

async function auditAllFinancials() {
  const { data: bookings, error } = await supabase.from('bookings').select('*');
  if (error) {
    console.error('Error fetching bookings:', error);
    return;
  }

  console.log(`Auditing ${bookings.length} bookings...\n`);

  const anomalies = [];

  for (const b of bookings) {
    const d = b.data || {};
    const id = b.id;
    const dog = b.dog_name || d.dogName || 'ללא שם';
    const owner = b.owner_name || d.ownerName || 'ללא בעלים';
    const phone = b.owner_phone || d.ownerPhone || '';
    const start = b.start_date || d.startDate;
    const end = b.end_date || d.endDate;
    const days = calculateDays(start, end);
    const totalPrice = Number(b.total_price ?? d.totalPrice ?? 0);
    const depositAmount = Number(b.deposit_amount ?? d.depositAmount ?? 0);
    const dailyRate = Number(d.dailyRate ?? 0);
    const pricingMode = d.pricingMode || (d.serviceType === 'training' ? 'period' : 'daily');
    const paymentStatus = b.payment_status || d.paymentStatus || 'unpaid';
    const isFreeStay = Boolean(d.isFreeStay || (b.notes && (b.notes.includes('חינם') || b.notes.includes('כלב נוסף') || b.notes.includes('כלב שני'))));
    const serviceType = b.service_type || d.serviceType || 'boarding';

    const issues = [];

    // Issue 1: Deposit paid is greater than total price
    if (depositAmount > totalPrice && !isFreeStay && totalPrice > 0) {
      issues.push(`מקדמה/שולם (₪${depositAmount}) גדול מסה"כ לתשלום (₪${totalPrice})`);
    }

    // Issue 2: pricingMode is daily, but totalPrice does not equal days * dailyRate and totalPrice > 0
    if (pricingMode === 'daily' && serviceType !== 'training' && !isFreeStay && dailyRate > 0 && totalPrice > 0) {
      const expected = days * dailyRate;
      if (Math.abs(totalPrice - expected) > 1) {
        issues.push(`חישוב יומי לא תואם: הוגדר dailyRate ₪${dailyRate} x ${days} ימים = ₪${expected}, אך סה"כ רשום ₪${totalPrice} (דורש קיבוע למחיר פיקס / עדכון תעריף)`);
      }
    }

    // Issue 3: Inconsistent paymentStatus vs amounts
    if (!isFreeStay) {
      if (totalPrice > 0 && depositAmount >= totalPrice && paymentStatus !== 'fully_paid') {
        issues.push(`סטטוס תשלום הוא '${paymentStatus}' למרות ששולם במלואו (שולם ₪${depositAmount} מתוך ₪${totalPrice})`);
      } else if (totalPrice > 0 && depositAmount === 0 && paymentStatus === 'fully_paid') {
        issues.push(`סטטוס תשלום הוא 'fully_paid' אך סכום ששולם הוא ₪0 (וסה"כ ₪${totalPrice})`);
      } else if (totalPrice > 0 && depositAmount > 0 && depositAmount < totalPrice && paymentStatus !== 'deposit_paid') {
        issues.push(`סטטוס תשלום הוא '${paymentStatus}' למרות ששולמה מקדמה חלקית (שולם ₪${depositAmount} מתוך ₪${totalPrice})`);
      }
    }

    // Issue 4: Free stay inconsistency
    if (isFreeStay && (totalPrice > 0 || depositAmount > 0)) {
      issues.push(`סומן כאירוח חינם אך יש סכומים: סה"כ ₪${totalPrice}, שולם ₪${depositAmount}`);
    }

    // Issue 5: Multiple dogs in same booking name without period pricing
    if ((dog.includes(' ו') || dog.includes(' + ') || dog.includes(' and ')) && pricingMode !== 'period' && serviceType !== 'training') {
      issues.push(`נראה כמספר כלבים ("${dog}") אך תמחור אינו מחיר פיקס/תקופה`);
    }

    if (issues.length > 0) {
      anomalies.push({
        id,
        dog,
        owner,
        phone,
        serviceType,
        start,
        end,
        days,
        dailyRate,
        totalPrice,
        depositAmount,
        paymentStatus,
        pricingMode,
        isFreeStay,
        stayStatus: b.stay_status || d.stayStatus,
        issues
      });
    }
  }

  console.log(`=== FOUND ${anomalies.length} BOOKINGS WITH POTENTIAL FINANCIAL / PRICING ISSUES ===\n`);
  anomalies.forEach((a, i) => {
    console.log(`[${i+1}] כלב: ${a.dog} | בעלים: ${a.owner} (${a.phone}) | תאריכים: ${a.start} -> ${a.end} (${a.days} ימים) | סטטוס שהייה: ${a.stayStatus}`);
    console.log(`    סה"כ: ₪${a.totalPrice} | שולם: ₪${a.depositAmount} | תעריף יומי: ₪${a.dailyRate} | אופן תמחור: ${a.pricingMode} | סטטוס תשלום: ${a.paymentStatus}`);
    console.log(`    בעיות שנמצאו:`);
    a.issues.forEach(iss => console.log(`      - ${iss}`));
    console.log('');
  });
}

auditAllFinancials();
