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

async function run() {
  const bookingId = 'b-1789658321673';
  const { data: bList, error } = await supabase.from('bookings').select('*').eq('id', bookingId);
  if (error || !bList || bList.length === 0) {
    console.error('Error finding booking:', error);
    return;
  }
  const existing = bList[0];

  const updatedData = {
    ...(existing.data || {}),
    refundAmount: 990,
    refundDate: '2026-09-19',
    refundReason: 'כלב ברח',
    refundNotes: 'זוכה במלואו סך ₪990 עבור 2 הכלבים (ג\'נגו ולונה) עקב בריחת הכלב ג\'נגו (אסמכתא: 516703080)',
    updatedAt: new Date().toISOString()
  };

  const { error: updErr } = await supabase
    .from('bookings')
    .update({
      notes: (existing.notes || '') + ' [החזר כספי מלא ₪990 - כלב ברח]',
      data: updatedData,
      updated_at: new Date().toISOString()
    })
    .eq('id', bookingId);

  if (updErr) {
    console.error('Error updating booking in Supabase:', updErr);
  } else {
    console.log('Successfully updated Yaniv Elad booking with 990 NIS refund and reason "כלב ברח" in Supabase!');
  }

  // Also update in settings table if bookings are stored in settings
  try {
    const { data: sRows } = await supabase.from('resort_settings').select('*').eq('id', 'default');
    if (sRows && sRows.length > 0) {
      const sData = sRows[0].data || {};
      if (sData.bookings && Array.isArray(sData.bookings)) {
        const idx = sData.bookings.findIndex(b => b.id === bookingId);
        if (idx >= 0) {
          sData.bookings[idx] = {
            ...sData.bookings[idx],
            refundAmount: 990,
            refundDate: '2026-09-19',
            refundReason: 'כלב ברח',
            refundNotes: 'זוכה במלואו סך ₪990 עקב בריחת הכלב ג\'נגו'
          };
          await supabase.from('resort_settings').update({ data: sData }).eq('id', 'default');
          console.log('Updated booking in resort_settings table data.bookings too!');
        }
      }
    }
  } catch (e) {
    console.warn('Warning updating settings:', e);
  }
}

run();
