const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Parse .env manually
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
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

async function run() {
  const { data: bookings, error } = await supabase.from('bookings').select('*');
  if (error) {
    console.error('Error fetching bookings:', error);
    return;
  }

  console.log(`Total bookings: ${bookings.length}`);

  const withRefund = bookings.filter(b => {
    const d = b.data || {};
    const amt = Number(b.refund_amount || b.refundAmount || d.refundAmount || 0);
    return amt > 0;
  });

  console.log(`Bookings with refund: ${withRefund.length}`);
  withRefund.forEach(b => {
    const d = b.data || {};
    console.log(`ID: ${b.id} | Dog: ${b.dog_name || b.dogName || d.dogName} | Owner: ${b.owner_name || b.ownerName || d.ownerName} | Refund: ₪${b.refund_amount || b.refundAmount || d.refundAmount} | Reason: ${b.refund_reason || b.refundReason || d.refundReason} | Date: ${b.refund_date || b.refundDate || d.refundDate}`);
  });

  console.log('\n--- Searching for Yaniv Elad bookings ---');
  const yanivBookings = bookings.filter(b => {
    const d = b.data || {};
    const name = (b.owner_name || b.ownerName || d.ownerName || '') + ' ' + (b.dog_name || b.dogName || d.dogName || '') + ' ' + (b.notes || d.notes || '');
    return name.includes('יניב') || name.includes('אלעד') || name.includes('ג\'נגו') || name.includes('גנגו');
  });

  yanivBookings.forEach(b => {
    console.log('Yaniv Booking:', JSON.stringify(b, null, 2));
  });

  // Also check Gal
  console.log('\n--- Searching for Gal bookings ---');
  const galBookings = bookings.filter(b => {
    const d = b.data || {};
    const name = (b.owner_name || b.ownerName || d.ownerName || '') + ' ' + (b.dog_name || b.dogName || d.dogName || '');
    return name.includes('גל') || name.includes('שלומי');
  });
  galBookings.forEach(b => {
    const d = b.data || {};
    console.log(`ID: ${b.id} | Dog: ${b.dog_name || b.dogName || d.dogName} | Owner: ${b.owner_name || b.ownerName || d.ownerName} | Price: ${b.total_price || b.totalPrice} | Refund: ${b.refund_amount || b.refundAmount || d.refundAmount}`);
  });
}

run();
