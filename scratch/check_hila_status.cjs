const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envContent = fs.readFileSync('c:/Projects/הריזורט לכלב/.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || '').trim().replace(/^['"]|['"]$/g, '');
    env[match[1]] = val;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function checkHilaStatus() {
  console.log('=== CHECKING HILA TRAINER PAYMENTS & BOOKINGS ===');
  
  // 1. Fetch settings for stored trainerReceipts or vouchers
  const { data: sRows } = await supabase.from('settings').select('*');
  const s = sRows?.[0] || {};
  const sData = s.data || {};
  console.log('Settings trainerReceipts count:', sData.trainerReceipts?.length || 0);
  if (sData.trainerReceipts) {
    console.log('Stored trainerReceipts:');
    sData.trainerReceipts.forEach(r => {
      console.log(`- Receipt ${r.receiptNumber} (${r.receiptDate}): ₪${r.totalAmount}, paid: ${r.isPaidActually !== false}, notes: ${r.paymentConfirmationNotes || r.rawLineText}`);
    });
  }

  // 2. Fetch active training bookings
  const { data: bookings } = await supabase.from('bookings').select('*');
  console.log(`\nTotal bookings in DB: ${bookings?.length || 0}`);
  
  const trainingBookings = (bookings || []).filter(b => {
    const isTr = b.service_type === 'training' || b.service_type === 'day_training' || b.serviceType === 'training' || b.serviceType === 'day_training';
    const notes = (b.notes || '') + ' ' + (b.data?.notes || '');
    return isTr || notes.includes('אילוף') || notes.includes('הילה');
  });

  console.log(`\nFound ${trainingBookings.length} training / Hila bookings:`);
  trainingBookings.forEach(b => {
    const bData = b.data || {};
    const stages = b.trainerStages || bData.trainerStages;
    console.log(`\nID: ${b.id} | Dog: ${b.dog_name || b.dogName} (${b.owner_name || b.ownerName})`);
    console.log(`Status: ${b.stay_status || b.stayStatus} | Dates: ${b.start_date || b.startDate} -> ${b.end_date || b.endDate} | Service: ${b.service_type || b.serviceType}`);
    if (stages) {
      console.log('Stages:', JSON.stringify(stages));
    } else {
      console.log('No stages defined explicitly');
    }
  });
}

checkHilaStatus().catch(console.error);
