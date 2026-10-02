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

async function testSanityReportRun() {
  const { data: bookings } = await supabase.from('bookings').select('*');
  const { data: settings } = await supabase.from('settings').select('*');
  const { data: intakes } = await supabase.from('intake_requests').select('*');
  const sData = settings?.[0]?.data || {};
  const greenId = sData.greenApiIdInstance;
  const greenToken = sData.greenApiToken;

  const todayStr = '2026-10-02';
  const activeBookings = (bookings || []).filter(b => b.stay_status !== 'cancelled' && b.stayStatus !== 'cancelled');

  const getPlacement = (b) => {
    const k = b.data?.kennelNumber ?? b.kennelNumber ?? b.kennel_number ?? b.room_id ?? b.data?.room;
    if (!k && k !== 0) return null;
    return String(k);
  };

  const unassignedKennels = [];
  activeBookings.filter(b => {
    const status = b.stay_status || b.stayStatus || b.status;
    return status === 'checked_in';
  }).forEach(b => {
    const k = getPlacement(b);
    if (!k) {
      unassignedKennels.push(`🏠 *${b.dog_name || b.dogName}* (${b.owner_name || b.ownerName}) | ממתין לשיבוץ`);
    }
  });

  const zeroDepositHolding = [];
  activeBookings.filter(b => (b.end_date || b.endDate) >= todayStr).forEach(b => {
    const price = Number(b.total_price || b.totalPrice) || 0;
    const dep = Number(b.deposit_amount || b.depositAmount) || 0;
    const isFree = b.is_free_stay || b.isFreeStay || b.data?.isFreeStay || b.data?.is_free_stay;
    const payStatus = b.payment_status || b.paymentStatus || b.data?.paymentStatus;
    const dog = b.dog_name || b.dogName;
    const owner = b.owner_name || b.ownerName;

    if (price > 0 && dep === 0 && !isFree && payStatus !== 'fully_paid') {
      zeroDepositHolding.push(`🔴 *${dog}* (${owner}) | ₪0 מקדמה (חוב: ₪${price})`);
    }
  });

  console.log('Unassigned kennels count:', unassignedKennels.length);
  console.log('Zero deposit holding count:', zeroDepositHolding.length);
  console.log('Zero deposit details:', zeroDepositHolding);
}

testSanityReportRun().catch(console.error);
