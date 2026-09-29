const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://ydlynqqmulojhrxbfjsc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ";
const GREEN_API_ID = "710722735421";
const GREEN_API_TOKEN = "ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b";
const GROUP_ID = "120363412850948636@g.us";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function cleanPhone(raw) {
  if (!raw) return null;
  let p = raw.replace(/\D/g, '');
  if (p.startsWith('05')) p = '972' + p.slice(1);
  if (p.startsWith('5')) p = '972' + p;
  if (!p.startsWith('972')) return null;
  if (p.length < 11 || p.length > 13) return null;
  return p;
}

async function addParticipant(chatId) {
  try {
    const res = await fetch(`https://api.green-api.com/waInstance${GREEN_API_ID}/addGroupParticipant/${GREEN_API_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        groupId: GROUP_ID,
        participantChatId: chatId
      })
    });
    const data = await res.json();
    return { ok: res.ok, data };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function main() {
  console.log('=== FORCE DIRECT ADD ALL CLIENTS & MANAGER TO COMMUNITY ===');
  
  // 1. Check Green-API state
  const stateRes = await fetch(`https://api.green-api.com/waInstance${GREEN_API_ID}/getStateInstance/${GREEN_API_TOKEN}`);
  const stateData = await stateRes.json();
  console.log('Green-API state:', stateData);
  
  if (stateData.stateInstance !== 'authorized') {
    console.error('ERROR: WhatsApp instance is not authorized yet! Please pair phone first.');
    return;
  }

  // 2. Fetch all unique clients
  const { data: bookings } = await supabase.from('bookings').select('owner_phone, owner_name, dog_name');
  const { data: customers } = await supabase.from('customers').select('phone, name');

  const phoneMap = new Map();

  // Add manager explicitly
  phoneMap.set('972543200007', { name: 'חגי מנהל', dog: '' });

  (bookings || []).forEach(b => {
    const cp = cleanPhone(b.owner_phone);
    const oName = (b.owner_name || '').trim();
    if (cp && !oName.includes('מתנה') && !phoneMap.has(cp)) {
      phoneMap.set(cp, { name: oName, dog: b.dog_name || '' });
    }
  });

  (customers || []).forEach(c => {
    const cp = cleanPhone(c.phone);
    const cName = (c.name || '').trim();
    if (cp && !cName.includes('מתנה') && !phoneMap.has(cp)) {
      phoneMap.set(cp, { name: cName, dog: '' });
    }
  });

  console.log(`Found ${phoneMap.size} unique participants to add directly to group ${GROUP_ID}`);

  let added = 0;
  let skipped = 0;
  let failed = 0;

  for (const [phone, info] of phoneMap.entries()) {
    const chatId = `${phone}@c.us`;
    process.stdout.write(`Adding ${info.name} (${phone})... `);
    const result = await addParticipant(chatId);
    if (result.ok && result.data?.addParticipant === true) {
      console.log('✅ Added');
      added++;
    } else if (result.ok && result.data?.addParticipant === false) {
      console.log('ℹ️ Invite sent / Privacy restricted');
      skipped++;
    } else {
      console.log('❌ Failed:', result);
      failed++;
    }
    // Small delay between calls
    await new Promise(r => setTimeout(r, 800));
  }

  console.log(`\nDONE: Added: ${added}, Privacy Invite Sent: ${skipped}, Failed: ${failed}`);
}

main();
