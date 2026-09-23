const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables from .env
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

function cleanPhoneNumber(phone) {
  if (!phone) return '';
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('972')) cleaned = '0' + cleaned.slice(3);
  else if (cleaned.length === 9 && cleaned.startsWith('5')) cleaned = '0' + cleaned;
  return cleaned;
}

async function runCleanup() {
  console.log('Fetching settings and bookings from Supabase...');
  const { data: settingsRows } = await supabase.from('settings').select('*').limit(1);
  const { data: bookings } = await supabase.from('bookings').select('*');

  if (!settingsRows || settingsRows.length === 0) {
    console.error('No settings row found in DB!');
    return;
  }

  const sRow = settingsRows[0];
  const settingsData = sRow.data || sRow;
  const intakes = settingsData.intakeRequests || [];
  const activeBookings = (bookings || []).filter(b => (b.stay_status || b.stayStatus) !== 'cancelled');

  console.log(`Found ${intakes.length} intake requests in DB.`);

  let approvedCount = 0;
  let abandonedCount = 0;
  let untouchedCount = 0;

  const updatedIntakes = intakes.map(req => {
    const rPhone = cleanPhoneNumber(req.ownerPhone || req.owner_phone || '');
    const rDog = (req.dogName || req.dog_name || '').trim().toLowerCase();

    // Check if there is an active matching booking in calendar
    const matchedBooking = activeBookings.find(b => {
      const bPhone = cleanPhoneNumber(b.owner_phone || b.ownerPhone || '');
      const bDog = (b.dog_name || b.dogName || '').trim().toLowerCase();
      const phoneMatch = bPhone && rPhone && (bPhone === rPhone || bPhone.slice(-7) === rPhone.slice(-7));
      const dogMatch = bDog && rDog && (bDog === rDog || bDog.includes(rDog) || rDog.includes(bDog));
      return phoneMatch || (dogMatch && phoneMatch);
    });

    if (matchedBooking) {
      approvedCount++;
      return {
        ...req,
        status: 'approved',
        internalNotes: req.internalNotes || 'נקלט לשריון ביומן'
      };
    }

    // If currently pending and not matched to an active upcoming booking, mark as abandoned (archived)
    if (req.status === 'pending' || !req.status) {
      abandonedCount++;
      return {
        ...req,
        status: 'abandoned',
        internalNotes: req.internalNotes || 'ננטש והועבר לארכיון כהנחיית שמוליק'
      };
    }

    untouchedCount++;
    return req;
  });

  console.log(`Summary: ${approvedCount} marked approved, ${abandonedCount} marked abandoned (archived), ${untouchedCount} kept existing status.`);

  // Save back to settings table
  const updatedData = {
    ...settingsData,
    intakeRequests: updatedIntakes
  };

  const { error } = await supabase
    .from('settings')
    .update({
      data: updatedData,
      updated_at: new Date().toISOString()
    })
    .eq('id', sRow.id);

  if (error) {
    console.error('Error updating settings in DB:', error);
  } else {
    console.log('✅ Successfully updated intakeRequests in Supabase settings table!');
  }
}

runCleanup();
