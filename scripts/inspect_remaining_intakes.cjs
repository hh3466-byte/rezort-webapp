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

function cleanPhoneNumber(phone) {
  if (!phone) return '';
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('972')) cleaned = '0' + cleaned.slice(3);
  else if (cleaned.length === 9 && cleaned.startsWith('5')) cleaned = '0' + cleaned;
  return cleaned;
}

async function inspectThe18() {
  const { data: bookings } = await supabase.from('bookings').select('*');
  const { data: settingsRows } = await supabase.from('settings').select('*').limit(1);
  const { data: intakesRows } = await supabase.from('intake_requests').select('*');

  const sRow = settingsRows?.[0] || {};
  const settings = { ...sRow, ...(sRow.data || {}) };

  const rawFromSettings = (sRow && sRow.data && Array.isArray(sRow.data.intakeRequests)) ? sRow.data.intakeRequests : [];
  const intakeMap = new Map();
  [...rawFromSettings, ...(intakesRows || [])].forEach(item => {
    if (item && item.id) {
      intakeMap.set(item.id, item);
    }
  });
  const allIntakes = Array.from(intakeMap.values());

  const active = allIntakes.filter(r => r.status !== 'archived' && r.status !== 'rejected');

  console.log(`Total non-archived non-rejected intakes: ${active.length}\n`);

  active.forEach((r, idx) => {
    const rDog = (r.dogName || r.dog_name || '').trim().toLowerCase();
    const rPhone = cleanPhoneNumber(r.ownerPhone || r.owner_phone || '');
    const sDate = r.startDate || r.start_date || '';
    const eDate = r.endDate || r.end_date || '';
    const created = r.createdAt || r.created_at || '';

    const hasBooking = (bookings || []).some(b => {
      if (b.stay_status === 'cancelled' || b.stayStatus === 'cancelled') return false;
      const bDog = (b.dog_name || b.dogName || '').trim().toLowerCase();
      const bPhone = cleanPhoneNumber(b.owner_phone || b.ownerPhone || '');
      return (rDog && bDog && rDog === bDog && (bPhone.slice(-7) === rPhone.slice(-7) || !rPhone));
    });

    console.log(`[${idx + 1}] ID: ${r.id}`);
    console.log(`    Dog: ${r.dogName || r.dog_name} | Owner: ${r.ownerName || r.owner_name} (📞 ${r.ownerPhone || r.owner_phone})`);
    console.log(`    Status: "${r.status}" | Created: ${created}`);
    console.log(`    Dates: ${sDate} to ${eDate}`);
    console.log(`    Has Booking in calendar: ${hasBooking}`);
    console.log(`    Deposit Paid/Req: ${r.depositPaid || r.depositRequested || 0}`);
    console.log(`    Notes/Internal: ${r.notes || r.internalNotes || '(none)'}`);
    console.log('----------------------------------------------------');
  });
}

inspectThe18();
