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

async function checkWhy() {
  const { data: bookings } = await supabase.from('bookings').select('*');
  const { data: settingsRows } = await supabase.from('settings').select('*').limit(1);
  const sRow = settingsRows?.[0] || {};
  const settings = { ...sRow, ...(sRow.data || {}) };
  const { data: intakes } = await supabase.from('intake_requests').select('*');
  const { data: growPayments } = await supabase.from('grow_incoming_payments').select('*');

  console.log('Total bookings:', bookings?.length);
  console.log('Total growPayments:', growPayments?.length);

  // Check which bookings are being evaluated in dailySanity1830Service or cron-sanity-check
  const todayStr = '2026-10-08';

  // In dailySanity1830Service:
  // const activeBookings = (bookings || []).filter(b => b.stayStatus !== 'cancelled');
  // const activeAndFutureStays = activeBookings.filter(b => b.endDate >= todayStr && b.stayStatus !== 'checked_out');

  // But what if the input bookings in Supabase have snake_case keys (e.g. b.end_date instead of b.endDate)?
  // Notice in Supabase: columns are `end_date`, `stay_status`, `total_price`, `deposit_amount`!
  // In typescript `dailySanity1830Service.ts`:
  // it accesses `b.endDate`, `b.stayStatus`, `b.totalPrice`, `b.depositAmount`!

  bookings.forEach(b => {
    // If an object from Supabase has `end_date` and NO `endDate`, then `b.endDate` is UNDEFINED!
    // If `b.endDate` is undefined, what is `b.endDate >= todayStr`? false!
    // But what if b has `endDate` in `b.data` or b is mapped or unmapped?
  });
}

checkWhy();
