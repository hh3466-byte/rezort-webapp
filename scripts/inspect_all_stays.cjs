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

async function inspectAllStays() {
  const { data: bookings, error } = await supabase.from('bookings').select('*');
  if (error) {
    console.error('Error fetching bookings:', error);
    return;
  }

  const todayStr = '2026-10-08';
  console.log(`Total bookings in DB: ${bookings.length}`);

  const pastOrCheckedOut = bookings.filter(b => {
    const end = b.end_date || b.endDate || b.data?.endDate || '';
    const status = b.stay_status || b.stayStatus || b.data?.stayStatus;
    return status === 'checked_out' || end < todayStr;
  });

  console.log(`\nFound ${pastOrCheckedOut.length} past or checked_out bookings.`);

  const needsFix = [];

  pastOrCheckedOut.forEach(b => {
    const d = b.data || {};
    const price = Number(b.total_price ?? b.totalPrice ?? d.totalPrice ?? 0);
    const deposit = Number(b.deposit_amount ?? b.depositAmount ?? d.depositAmount ?? 0);
    const payStatus = b.payment_status || b.paymentStatus || d.paymentStatus || 'unpaid';
    const isFree = Boolean(b.is_free_stay ?? b.isFreeStay ?? d.isFreeStay ?? false);
    const dog = b.dog_name || b.dogName || d.dogName;
    const owner = b.owner_name || b.ownerName || d.ownerName;
    const start = b.start_date || b.startDate || d.startDate;
    const end = b.end_date || b.endDate || d.endDate;
    const status = b.stay_status || b.stayStatus || d.stayStatus;

    // A past or checked out booking is considered settled if deposit == price and payStatus == 'fully_paid'
    const isMismatch = deposit !== price || payStatus !== 'fully_paid';
    if (isMismatch) {
      needsFix.push({
        id: b.id,
        dog,
        owner,
        start,
        end,
        status,
        price,
        deposit,
        payStatus,
        isFree
      });
    }
  });

  console.log(`\nBookings needing fix (${needsFix.length}):`);
  needsFix.forEach(n => {
    console.log(`- [${n.id}] ${n.dog} (${n.owner}): price=₪${n.price}, deposit=₪${n.deposit}, status='${n.payStatus}', stayStatus='${n.status}', dates=${n.start} to ${n.end}`);
  });

  // Also check active/future stays
  const activeFuture = bookings.filter(b => {
    const end = b.end_date || b.endDate || b.data?.endDate || '';
    const status = b.stay_status || b.stayStatus || b.data?.stayStatus;
    return status !== 'checked_out' && end >= todayStr;
  });
  console.log(`\nActive & Future bookings count: ${activeFuture.length}`);
  activeFuture.forEach(b => {
    const d = b.data || {};
    const price = Number(b.total_price ?? b.totalPrice ?? d.totalPrice ?? 0);
    const deposit = Number(b.deposit_amount ?? b.depositAmount ?? d.depositAmount ?? 0);
    const payStatus = b.payment_status || b.paymentStatus || d.paymentStatus || 'unpaid';
    const dog = b.dog_name || b.dogName || d.dogName;
    const owner = b.owner_name || b.ownerName || d.ownerName;
    const start = b.start_date || b.startDate || d.startDate;
    const end = b.end_date || b.endDate || d.endDate;
    const status = b.stay_status || b.stayStatus || d.stayStatus;
    console.log(`  * [${b.id}] ${dog} (${owner}) [${start} -> ${end}] status='${status}', price=₪${price}, deposit=₪${deposit}, payStatus='${payStatus}'`);
  });
}

inspectAllStays();
