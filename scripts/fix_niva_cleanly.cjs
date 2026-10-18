const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = {};
fs.readFileSync('.env', 'utf8').split('\n').forEach(line => {
  const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) env[m[1]] = (m[2] || '').trim().replace(/^[\'\"]|[\'\"]$/g, '');
});
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function fixNivaCleanly() {
  const { data: b } = await supabase.from('bookings').select('*').eq('id', 'b-1791125093705').single();
  console.log('Current b:', b);

  const cleanNotes = 'המקום משוריין לשטוץ ודודו. שולמה מקדמה ₪360 ב-Bit דרך Grow בתאריך 18.10.26 (יתרה בכניסה: ₪3,420). [אסמכתא Grow: grow_niva_181026_1440]';
  const updatedData = {
    ...(b.data || {}),
    notes: cleanNotes,
    depositAmount: 360,
    deposit_amount: 360,
    totalPrice: 3780,
    total_price: 3780,
    paymentStatus: 'deposit_paid',
    payment_status: 'deposit_paid',
    paymentMethod: 'bit',
    growPaymentVerified: true,
    lastPaymentReceivedAt: '2026-10-18T11:54:08.926Z'
  };

  const { data: updated, error } = await supabase.from('bookings').update({
    deposit_amount: 360,
    payment_status: 'deposit_paid',
    notes: cleanNotes,
    data: updatedData,
    updated_at: new Date().toISOString()
  }).eq('id', 'b-1791125093705').select();

  console.log('Updated Niva booking:', updated, 'Error:', error);
}

fixNivaCleanly();
