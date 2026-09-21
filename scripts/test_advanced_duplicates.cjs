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

function formatDateIL(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length >= 3) {
    return `${parts[2].substring(0, 2)}.${parts[1]}.${parts[0].slice(2)}`;
  }
  return dateStr;
}

function detectDuplicateDogsAdvanced(activeBookings) {
  const duplicateAlerts = [];

  for (let i = 0; i < activeBookings.length; i++) {
    for (let j = i + 1; j < activeBookings.length; j++) {
      const b1 = activeBookings[i];
      const b2 = activeBookings[j];

      const dog1 = (b1.dog_name || b1.dogName || '').trim().toLowerCase();
      const dog2 = (b2.dog_name || b2.dogName || '').trim().toLowerCase();
      if (!dog1 || !dog2 || dog1 !== dog2) continue;

      const s1 = b1.start_date || b1.startDate;
      const e1 = b1.end_date || b1.endDate;
      const s2 = b2.start_date || b2.startDate;
      const e2 = b2.end_date || b2.endDate;

      // Check date overlap
      const hasOverlap = (s1 <= e2 && e1 >= s2);
      if (!hasOverlap) continue;

      const phone1 = (b1.owner_phone || b1.ownerPhone || '').replace(/\D/g, '');
      const phone2 = (b2.owner_phone || b2.ownerPhone || '').replace(/\D/g, '');
      const owner1 = b1.owner_name || b1.ownerName || 'בעלים 1';
      const owner2 = b2.owner_name || b2.ownerName || 'בעלים 2';

      // Case A: Exact same owner / phone
      if (phone1 && phone1 === phone2) {
        duplicateAlerts.push({
          type: 'EXACT_PHONE_DUPLICATE',
          severity: 'HIGH',
          message: `כפילות זהה ביומן: הכלב "${b1.dog_name || b1.dogName}" (${owner1}) מופיע פעמיים בתאריכים חופפים (${formatDateIL(s1)}-${formatDateIL(e1)} מול ${formatDateIL(s2)}-${formatDateIL(e2)})`
        });
        continue;
      }

      // Case B: Different owners / phones, but same dog name and overlapping dates!
      // Like Boss (Ariel Shraiber) vs Boss (Itay Aaronson)
      const dep1 = Number(b1.deposit_amount || b1.depositAmount) || 0;
      const dep2 = Number(b2.deposit_amount || b2.depositAmount) || 0;
      const sType1 = b1.service_type || b1.serviceType || '';
      const sType2 = b2.service_type || b2.serviceType || '';

      const isSingleDay1 = s1 === e1;
      const isSingleDay2 = s2 === e2;

      // If one has 0 deposit and 1-day, or same start date
      const isSuspiciousGhost = (dep1 === 0 && isSingleDay1) || (dep2 === 0 && isSingleDay2) || (s1 === s2);

      if (isSuspiciousGhost) {
        duplicateAlerts.push({
          type: 'PARTNER_OR_GHOST_DUPLICATE',
          severity: 'CRITICAL',
          message: `🚨 *חשד לכפילות שותפים / רשומת רפאים:* הכלב "${b1.dog_name || b1.dogName}" מופיע באותו תאריך תחת שני בעלים שונים!\n      - רשומה 1: ${owner1} (📞 ${b1.owner_phone || b1.ownerPhone}) | 📅 ${formatDateIL(s1)}-${formatDateIL(e1)} | מקדמה: ₪${dep1}\n      - רשומה 2: ${owner2} (📞 ${b2.owner_phone || b2.ownerPhone}) | 📅 ${formatDateIL(s2)}-${formatDateIL(e2)} | מקדמה: ₪${dep2}`
        });
      } else {
        // Genuine two different dogs with same name staying at same time
        duplicateAlerts.push({
          type: 'SAME_NAME_DIFFERENT_DOGS',
          severity: 'INFO',
          message: `💡 שימו לב: 2 כלבים שונים בשם "${b1.dog_name || b1.dogName}" נמצאים במקביל (${owner1} מול ${owner2})`
        });
      }
    }
  }

  return duplicateAlerts;
}

async function test() {
  const { data: bookings } = await supabase.from('bookings').select('*');
  const activeUpcoming = (bookings || []).filter(b => {
    const st = b.stay_status || b.stayStatus;
    const end = b.end_date || b.endDate;
    return st !== 'cancelled' && st !== 'checked_out' && end >= '2026-09-19';
  });

  console.log('Active upcoming bookings:', activeUpcoming.length);
  const alerts = detectDuplicateDogsAdvanced(activeUpcoming);
  console.log('Duplicate alerts:', JSON.stringify(alerts, null, 2));

  // Now simulate if Ariel Shraiber's Boss was still there!
  const simulatedWithGhost = [
    ...activeUpcoming,
    {
      id: 'sim-boss',
      dog_name: 'בוס',
      owner_name: 'אריאל שרייבר',
      owner_phone: '0544452521',
      start_date: '2026-10-02',
      end_date: '2026-10-02',
      service_type: 'training',
      deposit_amount: 0,
      total_price: 6500,
      stay_status: 'booked'
    }
  ];

  console.log('\n--- SIMULATION TEST: If ghost Ariel Shraiber booking existed ---');
  const simAlerts = detectDuplicateDogsAdvanced(simulatedWithGhost);
  console.log(simAlerts.map(a => a.message).join('\n'));
}

test();
