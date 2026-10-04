const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

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
  const { data: bookings } = await supabase.from('bookings').select('*');
  const openDebts = (bookings || []).filter(b => {
    if (b.stay_status === 'cancelled') return false;
    if (b.is_free_stay) return false;
    if (b.payment_status === 'fully_paid') return false;
    const total = Number(b.total_price) || 0;
    const deposit = Number(b.deposit_amount) || 0;
    return total > deposit;
  });

  console.log(`=== REMAINING OPEN DEBT BOOKINGS (${openDebts.length}) ===`);
  let totalDebt = 0;
  let totalDeposit = 0;

  openDebts.forEach(b => {
    const total = Number(b.total_price) || 0;
    const deposit = Number(b.deposit_amount) || 0;
    const debt = total - deposit;
    totalDebt += debt;
    totalDeposit += deposit;
    console.log({
      dog: b.dog_name,
      owner: b.owner_name,
      phone: b.owner_phone,
      dates: `${b.start_date} to ${b.end_date}`,
      stay_status: b.stay_status,
      total_price: `₪${total}`,
      deposit_amount: `₪${deposit}`,
      remaining_debt: `₪${debt}`,
      payment_status: b.payment_status
    });
  });

  console.log(`\nSUMMARY: Total remaining open debt = ₪${totalDebt} across ${openDebts.length} bookings (Deposits paid: ₪${totalDeposit})`);
}

run();
