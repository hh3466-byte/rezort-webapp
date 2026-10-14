const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = {};
fs.readFileSync('.env', 'utf8').split('\n').forEach(l => {
  const m = l.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) env[m[1]] = (m[2]||'').trim().replace(/^['"]|['"]$/g, '');
});

const s = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function main() {
  console.log('1. Cleaning up duplicate grow_6506_manual_sync...');
  const { error: delErr } = await s
    .from('grow_incoming_payments')
    .delete()
    .eq('id', 'grow_6506_manual_sync');
  console.log('Delete grow_6506_manual_sync result:', delErr ? delErr.message : 'OK');

  console.log('2. Updating booking b-1791271522477 (Leo / Lee Daluoya)...');
  const { data: currentBk } = await s
    .from('bookings')
    .select('*')
    .eq('id', 'b-1791271522477')
    .single();

  if (currentBk) {
    const curData = currentBk.data || {};
    const cleanNotes = "בריא לחלוטין (אין תרופות או צרכים מיוחדים) | [💎 לקוח חוזר מוכר: לי דלויה (1 ביקורים)] | [🎁 הטבה שנבחרה: סשן משחקי חשיבה, רחרוח והעשרה מנטלית (Brain Games)] | [📜 תקנון הריזורט אושר כחוק] | שולם ₪2,000 מקדמה (ApplePay אסמכתא 4947561974) | שולמה יתרה ₪4,000 ב-2 תשלומים (ApplePay אסמכתא 4961553619: ₪2,000 ב-10.11 ו-₪2,000 ב-10.12) - שולם 100% במלואו ✅";
    
    curData.depositAmount = 6000;
    curData.totalPrice = 6000;
    curData.paymentStatus = 'fully_paid';
    curData.notes = cleanNotes;

    const { error: bkErr } = await s
      .from('bookings')
      .update({
        deposit_amount: 6000,
        total_price: 6000,
        payment_status: 'fully_paid',
        notes: cleanNotes,
        data: curData,
        updated_at: new Date().toISOString()
      })
      .eq('id', 'b-1791271522477');
    console.log('Update booking result:', bkErr ? bkErr.message : 'OK');
  }

  // Also check grow_4961553619 snippet to make sure it mentions 2 installments
  const { data: leeGrow } = await s
    .from('grow_incoming_payments')
    .select('*')
    .eq('id', 'grow_4961553619')
    .single();
  console.log('Current grow_4961553619:', JSON.stringify(leeGrow, null, 2));
}

main().catch(console.error);
