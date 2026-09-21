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

async function main() {
  const { data: bookings } = await supabase.from('bookings').select('*');
  console.log(`Total bookings: ${bookings.length}`);
  
  // Sort by updated_at or created_at descending
  bookings.sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));

  console.log('\n=== LAST 15 MODIFIED/CREATED BOOKINGS ===');
  bookings.slice(0, 15).forEach((b, idx) => {
    console.log(`${idx + 1}. [${b.id}] Dog: ${b.dog_name}, Owner: ${b.owner_name}, Phone: ${b.owner_phone}, Dates: ${b.start_date} to ${b.end_date}, Total: ${b.total_price}, Deposit: ${b.deposit_amount}, Status: ${b.stay_status}, Payment: ${b.payment_status}, Created: ${b.created_at}, Updated: ${b.updated_at}`);
    if (b.notes) console.log(`   Notes: ${b.notes}`);
  });

  // Check ALL bookings with 0 deposit
  const zeroDeposit = bookings.filter(b => {
    const deposit = Number(b.deposit_amount) || 0;
    const price = Number(b.total_price) || 0;
    const isFree = b.data?.isFreeStay || (b.notes && b.notes.includes('חינם'));
    return deposit === 0 && price > 0 && !isFree;
  });

  console.log(`\n=== ALL BOOKINGS WITH 0 DEPOSIT & PRICE > 0 (${zeroDeposit.length}) ===`);
  zeroDeposit.forEach(b => {
    console.log(`- [${b.id}] ${b.dog_name} (${b.owner_name}, ${b.owner_phone}): ${b.start_date} to ${b.end_date} | Total: ${b.total_price}, Deposit: ${b.deposit_amount} | Status: ${b.stay_status} | Created: ${b.created_at}`);
  });

  // Check bookings with date issues (end < start or invalid)
  const dateIssues = bookings.filter(b => {
    return !b.start_date || !b.end_date || b.end_date < b.start_date;
  });
  console.log(`\n=== BOOKINGS WITH DATE ISSUES (${dateIssues.length}) ===`);
  dateIssues.forEach(b => {
    console.log(`- [${b.id}] ${b.dog_name} (${b.owner_name}): ${b.start_date} to ${b.end_date}`);
  });

  // Check intake requests and how they map to bookings
  const { data: settingsData } = await supabase.from('settings').select('data');
  const sData = settingsData && settingsData[0] ? settingsData[0].data : {};
  const intakes = sData.intakeRequests || [];
  console.log(`\n=== INTAKE REQUESTS ANALYSIS (Total ${intakes.length}) ===`);
  
  // Check intakes with date problems
  const intakeDateIssues = intakes.filter(i => !i.startDate || !i.endDate || i.endDate < i.startDate);
  console.log(`Intakes with date issues: ${intakeDateIssues.length}`);
  intakeDateIssues.forEach(i => console.log(`- Intake ID: ${i.id}, Dog: ${i.dogName}, Dates: ${i.startDate} - ${i.endDate}`));

  // Check approved intakes that have or don't have bookings
  const approvedIntakes = intakes.filter(i => i.status === 'approved');
  console.log(`Approved intakes count: ${approvedIntakes.length}`);
  approvedIntakes.forEach(ai => {
    const matchingBooking = bookings.find(b => 
      (b.dog_name && ai.dogName && b.dog_name.trim().toLowerCase() === ai.dogName.trim().toLowerCase()) ||
      (b.owner_phone && ai.ownerPhone && b.owner_phone.replace(/\D/g,'') === ai.ownerPhone.replace(/\D/g,''))
    );
    console.log(`- Approved Intake: ${ai.dogName} (${ai.ownerName}, ${ai.ownerPhone}) | Dates: ${ai.startDate} to ${ai.endDate} | Booking in DB? ${matchingBooking ? `YES (id: ${matchingBooking.id}, dates: ${matchingBooking.start_date} to ${matchingBooking.end_date}, deposit: ${matchingBooking.deposit_amount})` : 'NO BOOKING'}`);
  });
}

main().catch(console.error);
