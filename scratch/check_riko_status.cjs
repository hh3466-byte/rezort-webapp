const { createClient } = require('@supabase/supabase-js');
const url = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(url, key);

async function checkRiko() {
  console.log('=== CHECKING RIKO IN BOOKINGS ===');
  const { data: bookings } = await supabase
    .from('bookings')
    .select('*')
    .or('dog_name.ilike.%ריקו%,owner_name.ilike.%שני%,owner_phone.ilike.%0546474151%,owner_phone.ilike.%054-6474151%');
  console.log(`Found ${bookings?.length || 0} bookings:`);
  bookings?.forEach(b => {
    console.log(`- ID: ${b.id} | Dog: ${b.dog_name} | Owner: ${b.owner_name} | Dates: ${b.start_date} -> ${b.end_date} | Status: ${b.stay_status} | Price: ${b.total_price} | Notes: ${b.notes || ''}`);
    console.log('  Data keys:', Object.keys(b.data || {}));
    if (b.data?.passCode || b.data?.punchPassCode) {
      console.log('  Pass code:', b.data?.passCode || b.data?.punchPassCode);
    }
  });

  console.log('\n=== CHECKING RIKO IN INTAKE REQUESTS ===');
  const { data: intakes } = await supabase
    .from('intake_requests')
    .select('*')
    .or('dog_name.ilike.%ריקו%,owner_name.ilike.%שני%,owner_phone.ilike.%0546474151%,owner_phone.ilike.%054-6474151%');
  console.log(`Found ${intakes?.length || 0} intake requests:`);
  intakes?.forEach(i => {
    console.log(`- ID: ${i.id} | Dog: ${i.dog_name} | Owner: ${i.owner_name} | Dates: ${i.start_date} -> ${i.end_date} | Status: ${i.status} | Created: ${i.created_at}`);
    console.log('  Notes:', i.notes || i.internal_notes || i.data?.internalNotes || '');
  });

  console.log('\n=== CHECKING DIGITAL PASSES (CUSTOMER PASSES) ===');
  const { data: passes } = await supabase
    .from('customer_passes')
    .select('*')
    .or('owner_phone.ilike.%0546474151%,owner_name.ilike.%שני%');
  console.log(`Found ${passes?.length || 0} passes:`);
  passes?.forEach(p => {
    console.log(`- Pass ID: ${p.id} | Code: ${p.pass_code || p.code} | Total: ${p.total_days} | Remaining: ${p.remaining_days} | Used: ${p.used_days} | Valid: ${p.valid_until}`);
  });

  // Also check settings.data.customerPasses or settings.data.intakeRequests
  const { data: sRows } = await supabase.from('settings').select('*').limit(1);
  const sData = sRows?.[0]?.data || {};
  if (sData.customerPasses) {
    console.log('\nCustomer passes in settings.data:');
    sData.customerPasses.filter(p => String(p.ownerPhone || '').includes('6474151') || String(p.passCode).includes('8935')).forEach(p => {
      console.log(`- Pass code: ${p.passCode} | Owner: ${p.ownerName} | Remaining: ${p.remainingDays || p.remaining}`);
    });
  }
}

checkRiko().catch(console.error);
