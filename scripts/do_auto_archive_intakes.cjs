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

function getTodayIsraelStr() {
  const now = new Date();
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return dtf.format(now);
}

function cleanPhoneNumber(phone) {
  if (!phone) return '';
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('972')) cleaned = '0' + cleaned.slice(3);
  else if (cleaned.length === 9 && cleaned.startsWith('5')) cleaned = '0' + cleaned;
  return cleaned;
}

async function autoArchivePastIntakes() {
  const todayStr = getTodayIsraelStr();
  console.log('Running auto-archive for past unfulfilled intake requests as of:', todayStr);

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

  const archivedIds = new Set();

  intakeMap.forEach((r, id) => {
    if (r.status === 'archived' || r.status === 'rejected') return;

    const rDog = (r.dogName || r.dog_name || '').trim().toLowerCase();
    const rPhone = cleanPhoneNumber(r.ownerPhone || r.owner_phone || '');
    const sDate = r.startDate || r.start_date || '';
    const eDate = r.endDate || r.end_date || '';

    const hasBooking = (bookings || []).some(b => {
      if (b.stay_status === 'cancelled' || b.stayStatus === 'cancelled') return false;
      const bDog = (b.dog_name || b.dogName || '').trim().toLowerCase();
      const bPhone = cleanPhoneNumber(b.owner_phone || b.ownerPhone || '');
      return (rDog && bDog && rDog === bDog && (bPhone.slice(-7) === rPhone.slice(-7) || !rPhone));
    });

    const isPast = (eDate && eDate < todayStr) || (sDate && sDate < todayStr);

    if (!hasBooking && isPast) {
      r.status = 'archived';
      r.archivedAt = new Date().toISOString();
      r.archiveReason = `Auto-archived: dates passed (${sDate} to ${eDate}) without booking transaction`;
      archivedIds.add(id);
      console.log(`Archived: ${r.dogName || r.dog_name} (${r.ownerName || r.owner_name}) - ${sDate} to ${eDate}`);
    }
  });

  console.log(`Total items marked as archived: ${archivedIds.size}`);

  // 1. Update intake_requests table in batches
  for (const id of archivedIds) {
    const updatedItem = intakeMap.get(id);
    await supabase.from('intake_requests').update({
      status: 'archived',
      updated_at: new Date().toISOString()
    }).eq('id', id);
  }

  // 2. Update settings.data.intakeRequests
  const updatedList = Array.from(intakeMap.values());
  const curData = sRow.data || {};
  await supabase.from('settings').update({
    data: {
      ...curData,
      intakeRequests: updatedList
    },
    updated_at: new Date().toISOString()
  }).eq('id', sRow.id || 'resort_config');

  console.log('Successfully updated Supabase settings and intake_requests table!');
}

autoArchivePastIntakes();
