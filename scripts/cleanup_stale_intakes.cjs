const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const env = {};
fs.readFileSync('.env', 'utf-8').split('\n').forEach(line => {
  const p = line.split('=');
  if (p.length >= 2) env[p[0].trim()] = p.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
});

const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY);

function cleanPhoneNumber(phone) {
  if (!phone) return '';
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('972')) cleaned = '0' + cleaned.slice(3);
  else if (cleaned.length === 9 && cleaned.startsWith('5')) cleaned = '0' + cleaned;
  return cleaned;
}

async function run() {
  const { data: sRows, error: sErr } = await sb.from('settings').select('*');
  if (sErr) {
    console.error('Settings fetch error:', sErr);
    return;
  }
  const sRow = sRows?.[0] || {};
  const curData = sRow.data || {};
  const intakes = Array.isArray(curData.intakeRequests) ? curData.intakeRequests : [];

  const { data: bookings } = await sb.from('bookings').select('*');
  const activeBookings = (bookings || []).filter(b => (b.stay_status || b.stayStatus) !== 'cancelled');

  console.log(`Starting cleanup of ${intakes.length} intake requests...`);
  const nowMs = Date.now();
  let modifiedCount = 0;

  const updatedIntakes = intakes.map(req => {
    const rDog = (req.dogName || req.dog_name || '').trim().toLowerCase();
    const rPhone = cleanPhoneNumber(req.ownerPhone || req.owner_phone || '');
    const cTime = req.created_at || req.createdAt || req.submittedAt;
    const ageDays = cTime ? (nowMs - new Date(cTime).getTime()) / (1000 * 60 * 60 * 24) : 0;

    // 1. Check if there's an active booking for this intake
    const matchingBooking = activeBookings.find(b => {
      const bDog = (b.dog_name || b.dogName || '').trim().toLowerCase();
      const bPhone = cleanPhoneNumber(b.owner_phone || b.ownerPhone || '');
      return (rDog && bDog && (rDog === bDog || bDog.includes(rDog) || rDog.includes(bDog))) &&
             (rPhone && bPhone && (rPhone.slice(-7) === bPhone.slice(-7)));
    });

    if (matchingBooking && req.status !== 'approved') {
      console.log(`[APPROVE] Intake ${req.id} for "${req.dogName}" matched with booking ${matchingBooking.id}. Updating status to 'approved'.`);
      modifiedCount++;
      return {
        ...req,
        status: 'approved',
        internalNotes: req.internalNotes ? `${req.internalNotes} | [הוזמן בהצלחה ביומן ${matchingBooking.id}]` : `[הוזמן בהצלחה ביומן ${matchingBooking.id}]`
      };
    }

    // 2. Check if intake is older than 14 days without booking and still pending/in_progress
    if (!matchingBooking && (req.status === 'pending' || req.status === 'in_progress') && ageDays > 14) {
      console.log(`[ABANDON] Intake ${req.id} for "${req.dogName}" is ${Math.round(ageDays)} days old (submitted ${cTime?.slice(0, 10)}) without booking. Marking 'abandoned'.`);
      modifiedCount++;
      return {
        ...req,
        status: 'abandoned',
        internalNotes: req.internalNotes ? `${req.internalNotes} | [סגירה אוטומטית: שאלון ישן מעל 14 יום ללא שריון]` : `[סגירה אוטומטית: שאלון ישן מעל 14 יום ללא שריון]`
      };
    }

    return req;
  });

  if (modifiedCount > 0) {
    const { error: updErr } = await sb.from('settings').update({
      data: {
        ...curData,
        intakeRequests: updatedIntakes
      },
      updated_at: new Date().toISOString()
    }).eq('id', sRow.id || 'resort_config');

    if (updErr) {
      console.error('Update failed:', updErr);
    } else {
      console.log(`Successfully updated ${modifiedCount} intake requests in Supabase!`);
    }
  } else {
    console.log('No intake requests required modification.');
  }
}

run();
