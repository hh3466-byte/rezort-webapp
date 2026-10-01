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

async function fixAllPricingModes() {
  const { data: bookings } = await supabase.from('bookings').select('*');
  if (!bookings) return;

  console.log(`Checking ${bookings.length} bookings for automatic alignment...`);
  let fixedCount = 0;

  for (const b of bookings) {
    const d = b.data || {};
    const start = b.start_date || d.startDate;
    const end = b.end_date || d.endDate;
    const days = calculateDays(start, end);
    const totalPrice = Number(b.total_price ?? d.totalPrice ?? 0);
    const depositAmount = Number(b.deposit_amount ?? d.depositAmount ?? 0);
    const dailyRate = Number(d.dailyRate ?? 0);
    const serviceType = b.service_type || d.serviceType || 'boarding';
    const isFree = Boolean(d.isFreeStay || (b.notes && (b.notes.includes('חינם') || b.notes.includes('כלב נוסף') || b.notes.includes('כלב שני'))));

    let shouldUpdate = false;
    let newPricingMode = d.pricingMode || (serviceType === 'training' ? 'period' : 'daily');
    let newDailyRate = dailyRate;

    // Condition 1: Multiple dogs in one booking (e.g. "לולה וברנדי", "סקובי וג'ינג'ס")
    const dog = b.dog_name || d.dogName || '';
    const isMultiDog = dog.includes(' ו') || dog.includes(' + ') || dog.includes(' and ');

    if (serviceType !== 'training' && !isFree && totalPrice > 0) {
      const expectedDaily = days * dailyRate;
      // If totalPrice doesn't match days * dailyRate, or if it's a multi-dog fixed price, set to 'period'
      if (Math.abs(totalPrice - expectedDaily) > 1 || isMultiDog || (dailyRate === 0 && totalPrice > 0)) {
        if (newPricingMode !== 'period') {
          newPricingMode = 'period';
          shouldUpdate = true;
        }
      }
    }

    // Fix paymentStatus if needed
    let newPaymentStatus = b.payment_status || d.paymentStatus || 'unpaid';
    if (!isFree && totalPrice > 0) {
      if (depositAmount >= totalPrice && newPaymentStatus !== 'fully_paid') {
        newPaymentStatus = 'fully_paid';
        shouldUpdate = true;
      } else if (depositAmount > 0 && depositAmount < totalPrice && newPaymentStatus !== 'deposit_paid') {
        newPaymentStatus = 'deposit_paid';
        shouldUpdate = true;
      }
    }

    if (shouldUpdate) {
      const updatedData = {
        ...d,
        pricingMode: newPricingMode,
        dailyRate: newDailyRate,
        totalPrice: totalPrice,
        depositAmount: depositAmount,
        paymentStatus: newPaymentStatus
      };

      await supabase
        .from('bookings')
        .update({
          pricing_mode: newPricingMode,
          payment_status: newPaymentStatus,
          data: updatedData
        })
        .eq('id', b.id);

      console.log(`[FIXED] ${dog} (${b.owner_name}): pricingMode -> '${newPricingMode}', paymentStatus -> '${newPaymentStatus}', total: ₪${totalPrice}`);
      fixedCount++;
    }
  }

  console.log(`\nCompleted! Fixed ${fixedCount} bookings.`);
}

fixAllPricingModes();
