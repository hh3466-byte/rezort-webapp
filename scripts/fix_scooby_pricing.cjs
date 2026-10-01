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

async function fix() {
  const { data: bookings } = await supabase.from('bookings').select('*').ilike('dog_name', '%סקובי%');
  if (bookings && bookings.length > 0) {
    for (const b of bookings) {
      const updatedData = {
        ...b.data,
        pricingMode: 'fixed',
        totalPrice: 1960,
        depositAmount: 1960,
        paymentStatus: 'fully_paid',
        paymentMethod: 'credit'
      };
      const { error } = await supabase
        .from('bookings')
        .update({
          total_price: 1960,
          deposit_amount: 1960,
          payment_status: 'fully_paid',
          payment_method: 'credit',
          data: updatedData
        })
        .eq('id', b.id);
      
      console.log('Updated booking', b.id, error || 'SUCCESS');
    }
  }

  // Also update resort_settings if present
  const { data: settings } = await supabase.from('resort_settings').select('*');
  if (settings && settings.length > 0) {
    for (const row of settings) {
      const d = row.data || {};
      let changed = false;
      if (d.bookings) {
        d.bookings = d.bookings.map(b => {
          if ((b.dogName || '').includes('סקובי')) {
            changed = true;
            return {
              ...b,
              pricingMode: 'fixed',
              totalPrice: 1960,
              depositAmount: 1960,
              paymentStatus: 'fully_paid',
              paymentMethod: 'credit'
            };
          }
          return b;
        });
      }
      if (changed) {
        await supabase.from('resort_settings').update({ data: d }).eq('id', row.id);
        console.log('Updated resort_settings row', row.id);
      }
    }
  }
}

fix();
