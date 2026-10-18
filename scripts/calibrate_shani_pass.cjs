const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
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

async function calibratePass() {
  const { data: sRow, error: fetchErr } = await supabase.from('settings').select('*').eq('id', 'resort_config').single();
  if (fetchErr || !sRow) {
    console.error('Fetch error:', fetchErr);
    return;
  }
  const data = sRow.data || {};
  let passes = data.daycare_passes || [];

  passes = passes.map(p => {
    if (p.passCode === '8935') {
      return {
        ...p,
        totalDays: 21,
        usedDays: 8, // 3 trial + 2 weekend 1 + 3 weekend 2
        paymentStatus: 'paid',
        paymentMethod: 'credit_card',
        paidAt: '2026-10-18T14:06:00.000Z',
        growTransactionId: '36202567',
        usageHistory: [
          {
            date: '2026-10-15',
            bookingId: 'trial_15_18_oct',
            deductedBy: 'shmulik',
            notes: 'שהיית ניסיון (חמישי 15.10 עד ראשון 18.10) ע"ח הכרטיסייה',
            daysDeducted: 3
          },
          {
            date: '2026-10-23',
            bookingId: 'b-1792341775847',
            deductedBy: 'shmulik',
            notes: 'סופ"ש פנסיון VIP (23.10–25.10) לריקו',
            daysDeducted: 2
          },
          {
            date: '2026-10-29',
            bookingId: 'b-1792341838421',
            deductedBy: 'shmulik',
            notes: 'סופ"ש פנסיון VIP (29.10–01.11) לריקו',
            daysDeducted: 3
          }
        ]
      };
    }
    return p;
  });

  const { error: updateErr } = await supabase.from('settings').update({
    data: { ...data, daycare_passes: passes },
    updated_at: new Date().toISOString()
  }).eq('id', 'resort_config');

  if (updateErr) {
    console.error('Update error:', updateErr);
  } else {
    console.log('Pass #8935 calibrated successfully! Total: 21, Used: 8 (3 trial + 5 future booked), Remaining: 13 days.');
  }
}

calibratePass();
