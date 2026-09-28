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

async function syncAllIntakesToTable() {
  const { data: settingsRows } = await supabase.from('settings').select('*').limit(1);
  const { data: tableRows } = await supabase.from('intake_requests').select('*');

  const sRow = settingsRows?.[0] || {};
  const settingsList = (sRow.data && Array.isArray(sRow.data.intakeRequests)) ? sRow.data.intakeRequests : [];
  const existingTableIds = new Set((tableRows || []).map(r => r.id));

  console.log(`Settings intakes count: ${settingsList.length}`);
  console.log(`Table intakes count: ${existingTableIds.size}`);

  let insertedCount = 0;
  for (const r of settingsList) {
    if (!existingTableIds.has(r.id)) {
      console.log(`Inserting missing intake to table: ${r.id} - ${r.dogName} (${r.ownerName})`);
      const { error } = await supabase.from('intake_requests').upsert({
        id: r.id,
        created_at: r.createdAt || new Date().toISOString(),
        status: r.status || 'pending',
        owner_name: r.ownerName,
        owner_phone: r.ownerPhone,
        owner_email: r.ownerEmail || '',
        owner_address: r.ownerAddress || '',
        dog_name: r.dogName,
        dog_breed: r.dogBreed || '',
        dog_age: r.dogAge || '',
        dog_gender: r.dogGender || 'male',
        dog_size: r.dogSize || 'medium',
        service_type: r.serviceType || 'boarding',
        start_date: r.startDate,
        end_date: r.endDate,
        is_friendly_with_dogs: r.isFriendlyWithDogs || 'yes',
        is_neutered: Boolean(r.isNeutered),
        is_vaccinated: Boolean(r.isVaccinated),
        is_house_trained: Boolean(r.isHouseTrained),
        is_treated_parasites: Boolean(r.isTreatedParasites),
        special_needs: r.specialNeeds || '',
        notes: r.notes || '',
        calculated_price: Number(r.calculatedPrice) || 0,
        deposit_requested: Number(r.depositRequested) || 0,
        internal_notes: r.internalNotes || '',
        data: r
      });
      if (error) {
        console.error(`Error inserting ${r.id}:`, error);
      } else {
        insertedCount++;
      }
    }
  }

  console.log(`\nSuccessfully synced ${insertedCount} missing intake requests to table!`);
}

syncAllIntakesToTable();
