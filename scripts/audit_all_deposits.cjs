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

async function auditAllBookingDeposits() {
  const { data: bookings } = await supabase.from('bookings').select('*');
  console.log(`\n=== בדיקת תקינות פיננסית כוללת לכל ההזמנות (${bookings.length} הזמנות) ===\n`);

  bookings.forEach(b => {
    const total = b.total_price || b.totalPrice || 0;
    const deposit = b.deposit_amount || b.depositAmount || 0;
    const notes = b.notes || '';
    const ratio = total > 0 ? (deposit / total) : 0;
    
    // Check if deposit looks like theoretical formula (36%, 30%) without receipt
    const isFormula36 = Math.abs(ratio - 0.36) < 0.01;
    const isFormula30 = Math.abs(ratio - 0.30) < 0.01;

    console.log(`- ${b.owner_name} (${b.dog_name}): סה"כ ₪${total}, מקדמה ₪${deposit}, יתרה ₪${total - deposit} | סטטוס תשלום: ${b.payment_status} ${isFormula36 ? '[⚠️ 36% נוסחה]' : ''}`);
    if (notes) {
      console.log(`  הערות: ${notes.slice(0, 100)}...`);
    }
  });
}

auditAllBookingDeposits();
