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
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[match[1]] = val;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
  console.log('--- FETCHING GAL BOOKING ---');
  const { data: bList, error: bErr } = await supabase.from('bookings').select('*').eq('id', 'b-1788370908724');
  if (bErr) {
    console.error('Fetch error:', bErr);
    return;
  }
  console.log('Found booking in bookings table:', bList);

  if (bList && bList.length > 0) {
    const existing = bList[0];
    const updatedData = {
      ...(existing.data || {}),
      stayStatus: 'cancelled',
      refundAmount: 288,
      refundDate: '2026-09-20',
      refundReason: 'הזמנה בוטלה יותר משבוע לפני הקליטה',
      refundNotes: 'בוצע ביטול והחזר כספי מלא (288 ₪) של גל שבת'
    };

    const { error: uErr } = await supabase
      .from('bookings')
      .update({
        stay_status: 'cancelled',
        notes: (existing.notes || '') + ' [בוצע ביטול והחזר כספי מלא 288 ₪ ב-20/09/2026 - הזמנה בוטלה יותר משבוע לפני הקליטה]',
        data: updatedData,
        updated_at: new Date().toISOString()
      })
      .eq('id', 'b-1788370908724');
    
    if (uErr) console.error('Error updating bookings table:', uErr);
    else console.log('Successfully updated booking in bookings table!');
  }

  // Check settings.data.bookings as well
  const { data: sRows } = await supabase.from('settings').select('*');
  if (sRows && sRows[0]?.data) {
    const sDoc = sRows[0];
    const dataObj = sDoc.data;
    if (Array.isArray(dataObj.bookings)) {
      const gIdx = dataObj.bookings.findIndex(b => b.id === 'b-1788370908724' || b.dogName === 'אוניל');
      if (gIdx !== -1) {
        console.log('Found Gal booking in settings.data.bookings at index:', gIdx);
        dataObj.bookings[gIdx] = {
          ...dataObj.bookings[gIdx],
          stayStatus: 'cancelled',
          refundAmount: 288,
          refundDate: '2026-09-20',
          refundReason: 'הזמנה בוטלה יותר משבוע לפני הקליטה',
          refundNotes: 'בוצע ביטול והחזר כספי מלא (288 ₪) של גל שבת'
        };
        const { error: sUpErr } = await supabase.from('settings').update({ data: dataObj, updated_at: new Date().toISOString() }).eq('id', sDoc.id);
        if (sUpErr) console.error('Error updating settings.data.bookings:', sUpErr);
        else console.log('Successfully updated settings.data.bookings!');
      }
    }
  }

  console.log('Done.');
}

run();
