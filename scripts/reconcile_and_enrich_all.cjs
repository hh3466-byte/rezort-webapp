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

function cleanPhone(p) {
  if (!p) return '';
  const d = p.replace(/\D/g, '');
  if (d.startsWith('972') && d.length >= 12) return '0' + d.slice(3);
  return d;
}

async function run() {
  console.log('=== STEP 1: Updating the 6 Bookings entered from memory ===\n');

  const updates = [
    // 1. לונה (יניב אלעד)
    {
      id: 'b-1789658379677',
      dog_name: 'לונה',
      dog_breed: 'פיטבול',
      dog_gender: 'female_spayed',
      owner_name: 'יניב אלעד',
      owner_phone: '0545443222',
      owner_email: 'yanivelad175@gmail.com',
      notes: "הגיעה יחד עם ג'נגו | עסקת Grow (אסמכתא: 516703080) | שאלון קליטה מאומת"
    },
    // 2. ג'נגו (יניב אלעד)
    {
      id: 'b-1789658321673',
      dog_name: "ג'נגו",
      dog_breed: 'מעורב',
      dog_gender: 'male_neutered',
      owner_name: 'יניב אלעד',
      owner_phone: '0545443222',
      owner_email: 'yanivelad175@gmail.com',
      notes: "הגיע יחד עם לונה | עסקת Grow (אסמכתא: 516703080) | שאלון קליטה מאומת"
    },
    // 3. זומה (מהדי)
    {
      id: 'b-1789658048280',
      dog_name: 'זומה',
      dog_breed: 'מעורב',
      owner_name: 'מהדי (Mahdi Motors)',
      owner_phone: '0506363114',
      notes: "סוכם בוואטסאפ ובטלפון מול מהדי (Mahdi Motors) | טיסה לחו״ל (5-6 ימים) | שולם במלואו ₪1080"
    },
    // 4. נולי (אור נברי / ניזרי)
    {
      id: 'b-1789657981741',
      dog_name: 'נולי',
      dog_breed: 'מעורב',
      owner_name: 'אור נברי',
      owner_phone: '0527777787',
      owner_email: 'navri38@gmail.com',
      notes: "עסקת Grow (אסמכתא: 509363691 שולם ₪2,550) | איש קשר בוואטסאפ: אורן הכלבה נולי"
    },
    // 5. ג'וי (ירוס ביקאיה)
    {
      id: 'b-1789657778767',
      dog_name: "ג'וי",
      dog_breed: 'פיטבול מעורב',
      owner_name: 'ירוס ביקאיה',
      owner_phone: '0556646093',
      owner_email: 'yerusbikaya54@gmail.com',
      notes: "אילוף בתנאי פנסיון (שמוליק והילה) | עסקאות Grow (אסמכתאות: 507810263, 507807309, 4792995703, 507806497 - סה״כ שולם ₪6,500)"
    },
    // 6. לואי (שיין ביטי)
    {
      id: 'b-1789657624250',
      dog_name: 'לואי',
      dog_breed: 'כנעני מעורב',
      owner_name: 'שיין ביטי',
      owner_phone: '0526113780',
      owner_email: 'shanebt449@gmail.com',
      emergency_contact: 'מיכה (0526113780)',
      notes: "הגיע יחד עם ג'ולי | הובאו ע״י מיכה | שולם במזומן ₪825 לפי אישור בוואטסאפ"
    },
    // 7. ג'ולי (שיין ביטי)
    {
      id: 'b-1789657548070',
      dog_name: "ג'ולי",
      dog_breed: 'מעורב',
      owner_name: 'שיין ביטי',
      owner_phone: '0526113780',
      owner_email: 'shanebt449@gmail.com',
      emergency_contact: 'מיכה (0526113780)',
      notes: "הגיעה יחד עם לואי | הובאו ע״י מיכה | שולם במזומן ₪825 לפי אישור בוואטסאפ"
    }
  ];

  for (const u of updates) {
    const { data: existing } = await supabase.from('bookings').select('*').eq('id', u.id).single();
    if (existing) {
      const existingData = existing.data || {};
      const mergedData = {
        ...existingData,
        dogName: u.dog_name,
        dogBreed: u.dog_breed || existingData.dogBreed,
        dogGender: u.dog_gender || existingData.dogGender,
        ownerName: u.owner_name,
        ownerPhone: u.owner_phone,
        ownerEmail: u.owner_email || existingData.ownerEmail,
        emergencyContact: u.emergency_contact || existingData.emergencyContact,
        notes: u.notes
      };

      const updatePayload = {
        dog_name: u.dog_name,
        dog_breed: u.dog_breed || existing.dog_breed,
        owner_name: u.owner_name,
        owner_phone: u.owner_phone,
        owner_email: u.owner_email || existing.owner_email,
        notes: u.notes,
        data: mergedData,
        updated_at: new Date().toISOString()
      };
      if (u.dog_gender) updatePayload.dog_gender = u.dog_gender;
      if (u.emergency_contact) updatePayload.emergency_contact = u.emergency_contact;

      const { error: updErr } = await supabase.from('bookings').update(updatePayload).eq('id', u.id);
      if (updErr) {
        console.error(`Error updating booking ${u.id}:`, updErr.message);
      } else {
        console.log(`✅ Booking ${u.id} (${u.dog_name} של ${u.owner_name}) updated successfully.`);
      }
    } else {
      console.log(`Booking ${u.id} not found.`);
    }
  }

  console.log('\n=== STEP 2: Auto-closing Intake Requests that already have Bookings ===\n');

  const { data: bData } = await supabase.from('bookings').select('*');
  const { data: sData } = await supabase.from('settings').select('data').eq('id', 'resort_config').single();
  const intakeRequests = sData?.data?.intakeRequests || [];

  let closedCount = 0;
  const updatedIntakeRequests = intakeRequests.map(req => {
    const rPhone = cleanPhone(req.ownerPhone);
    const rDog = (req.dogName || '').trim();

    const matched = bData.find(b => {
      const d = b.data || {};
      const bPhone = cleanPhone(b.owner_phone || d.ownerPhone);
      const bDog = (b.dog_name || d.dogName || '').trim();
      const phoneMatch = bPhone && rPhone && (bPhone.slice(-7) === rPhone.slice(-7));
      const dogMatch = bDog && rDog && (bDog === rDog || bDog.includes(rDog) || rDog.includes(bDog));
      return phoneMatch || (dogMatch && req.ownerName && (b.owner_name || d.ownerName || '').includes(req.ownerName));
    });

    if (matched && req.status !== 'approved') {
      console.log(`Closing intake request [${req.id}] ${req.dogName} (${req.ownerName}) -> matched booking ${matched.id}`);
      closedCount++;
      return {
        ...req,
        status: 'approved',
        internalNotes: req.internalNotes ? `${req.internalNotes} | [סגירה אוטומטית: קיימת הזמנה פעילה ביומן ${matched.id}]` : `[סגירה אוטומטית: קיימת הזמנה פעילה ביומן ${matched.id}]`
      };
    }
    return req;
  });

  if (closedCount > 0) {
    const updatedSettingsData = {
      ...sData.data,
      intakeRequests: updatedIntakeRequests
    };
    const { error: sUpdErr } = await supabase
      .from('settings')
      .update({ data: updatedSettingsData, updated_at: new Date().toISOString() })
      .eq('id', 'resort_config');

    if (sUpdErr) {
      console.error('Error updating settings intakeRequests:', sUpdErr.message);
    } else {
      console.log(`✅ Successfully closed and approved ${closedCount} intake requests in Supabase settings.`);
    }
  } else {
    console.log('No pending intake requests needed closing.');
  }

  console.log('\n=== STEP 3: Upserting / Syncing Customers Table ===\n');

  const customerUpdates = [
    { phone: '0545443222', name: 'יניב אלעד', email: 'yanivelad175@gmail.com', dogs: [{ name: "ג'נגו", breed: 'מעורב' }, { name: 'לונה', breed: 'פיטבול' }] },
    { phone: '0526113780', name: 'שיין ביטי', email: 'shanebt449@gmail.com', dogs: [{ name: 'לואי', breed: 'כנעני מעורב' }, { name: "ג'ולי", breed: 'מעורב' }] },
    { phone: '0556646093', name: 'ירוס ביקאיה', email: 'yerusbikaya54@gmail.com', dogs: [{ name: "ג'וי", breed: 'פיטבול מעורב' }] },
    { phone: '0527777787', name: 'אור נברי', email: 'navri38@gmail.com', dogs: [{ name: 'נולי', breed: 'מעורב' }] },
    { phone: '0506363114', name: 'מהדי (Mahdi Motors)', email: '', dogs: [{ name: 'זומה', breed: 'מעורב' }] }
  ];

  for (const c of customerUpdates) {
    const cleanP = cleanPhone(c.phone);
    const { data: existingC } = await supabase.from('customers').select('*').eq('phone', c.phone).maybeSingle();
    if (existingC) {
      const { error: cErr } = await supabase.from('customers').update({
        name: c.name,
        email: c.email || existingC.email,
        dogs: c.dogs,
        updated_at: new Date().toISOString()
      }).eq('id', existingC.id);
      if (!cErr) console.log(`✅ Customer ${c.name} (${c.phone}) updated.`);
    } else {
      const { error: cErr } = await supabase.from('customers').insert({
        id: `c-${cleanP}`,
        name: c.name,
        phone: c.phone,
        email: c.email,
        dogs: c.dogs,
        total_visits: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      if (!cErr) console.log(`✅ Customer ${c.name} (${c.phone}) created.`);
    }
  }

  console.log('\nAll Supabase synchronizations complete!');
}

run();
