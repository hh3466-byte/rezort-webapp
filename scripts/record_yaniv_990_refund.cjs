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
  const targetId = 'b-1789381758510'; // Django 990 NIS
  const { data: bList, error } = await supabase.from('bookings').select('*').eq('id', targetId);
  if (error || !bList || bList.length === 0) {
    console.error('Booking not found:', error);
    return;
  }
  const b = bList[0];
  const updatedData = {
    ...(b.data || {}),
    refundAmount: 990,
    refundDate: '2026-09-19',
    refundReason: 'כלב ברח',
    refundNotes: 'זיכוי מלא בסך ₪990 עקב בריחת הכלב ג\'נגו (אסמכתא Grow: 516703080)',
    notes: (b.notes || '') + ' [החזר כספי מלא ₪990 - כלב ברח]',
    updatedAt: new Date().toISOString()
  };

  const { error: updErr } = await supabase.from('bookings').update({
    notes: (b.notes || '') + ' [החזר כספי מלא ₪990 - כלב ברח]',
    data: updatedData,
    updated_at: new Date().toISOString()
  }).eq('id', targetId);

  if (updErr) {
    console.error('Error updating booking:', updErr);
  } else {
    console.log('Successfully recorded 990 NIS refund for Yaniv Elad on booking b-1789381758510!');
  }
}

run();
