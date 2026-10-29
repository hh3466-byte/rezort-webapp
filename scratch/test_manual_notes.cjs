const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const k = parts[0].trim();
    const v = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    env[k] = v;
  }
});

const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_KEY;
const supabase = createClient(url, key);

function hasManualStaffNotes(internalNotes) {
  if (!internalNotes || !internalNotes.trim()) return false;
  const cleaned = internalNotes
    .replace(/הליד נקלט מקמפיין[^\n|]*/g, '')
    .replace(/הלקוח השלים טופס מודעה[^\n|]*/g, '')
    .replace(/פנייה ראשונית בוואטסאפ[^\n|]*/g, '')
    .replace(/\[📢 ליד מקמפיין[^\]]*\]/g, '')
    .replace(/\[💬 פנייה חדשה מוואטסאפ[^\]]*\]/g, '')
    .replace(/\[תזכורת מעקב[^\]]*\]/g, '')
    .replace(/\[הועבר לארכיון[^\]]*\]/g, '')
    .replace(/\[מזהה הודעה:[^\]]*\]/g, '')
    .replace(/\[נשלח שאלון[^\]]*\]/g, '')
    .replace(/\[נשלח קישור לתשלום Grow\]/g, '')
    .replace(/תיאום הגעה מתוך כרטיסייה[^\n|]*/g, '')
    .replace(/שריון מתוך כרטיסייה[^\n|]*/g, '')
    .replace(/בקשת שריון[^\n|]*/g, '')
    .replace(/\[🎟️[^\]]*\]/g, '')
    .replace(/כרטיסייה[^\n|]*/g, '')
    .replace(/[|\s\-\:\.\,]+/g, '')
    .trim();
  return cleaned.length > 0;
}

async function run() {
  const { data: sRow } = await supabase.from('settings').select('data').eq('id', 'resort_config').single();
  const intakes = sRow?.data?.intakeRequests || [];
  const hadar = intakes.find(r => r.ownerPhone && r.ownerPhone.includes('5000052'));
  const eliane = intakes.find(r => r.ownerPhone && r.ownerPhone.includes('4461741'));

  console.log('Hadar internalNotes:', JSON.stringify(hadar?.internalNotes));
  console.log('Hadar hasManualStaffNotes:', hasManualStaffNotes(hadar?.internalNotes));

  console.log('Eliane internalNotes:', JSON.stringify(eliane?.internalNotes));
  console.log('Eliane hasManualStaffNotes:', hasManualStaffNotes(eliane?.internalNotes));
}
run();
