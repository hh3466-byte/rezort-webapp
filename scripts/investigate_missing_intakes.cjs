const { createClient } = require('@supabase/supabase-js');
const https = require('https');

const SUPABASE_URL = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const GREEN_API_ID = '710722735421';
const GREEN_API_TOKEN = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

function fetchGreenApi(endpoint, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'api.green-api.com',
      path: `/waInstance${GREEN_API_ID}/${endpoint}/${GREEN_API_TOKEN}`,
      method: method,
      headers: {
        ...(postData ? {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        } : {})
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function run() {
  console.log('=== 1. SEARCHING SUPABASE SETTINGS FOR INTAKE REQUESTS ===');
  const { data: sRow } = await supabase.from('settings').select('*').eq('id', 'resort_config').single();
  const intakeRequests = sRow?.data?.intakeRequests || [];
  console.log(`Total intake requests in settings: ${intakeRequests.length}`);

  const searchTerms = ['מיכאל', 'בן הר', 'חיימי', 'חימי', 'אייל', 'ברקובי', 'ברנדי', 'לולה', 'לונה'];
  
  console.log('\n--- Matched intake requests in settings.data.intakeRequests ---');
  intakeRequests.forEach((req, idx) => {
    const text = JSON.stringify(req);
    const match = searchTerms.some(t => text.includes(t));
    if (match) {
      console.log(`[${idx}] ID: ${req.id} | Dog: ${req.dogName} | Owner: ${req.ownerName} | Phone: ${req.ownerPhone} | Created: ${req.createdAt} | Status: ${req.status}`);
      console.log('   Full req:', JSON.stringify(req, null, 2));
    }
  });

  console.log('\n=== 2. SEARCHING INTAKE_REQUESTS TABLE (IF EXISTS) ===');
  try {
    const { data: directIntakes, error: directErr } = await supabase.from('intake_requests').select('*');
    if (directErr) {
      console.log('Table intake_requests query result:', directErr.message);
    } else {
      console.log(`Found ${directIntakes.length} in intake_requests table`);
      directIntakes.forEach(r => {
        const text = JSON.stringify(r);
        if (searchTerms.some(t => text.includes(t))) {
          console.log('Direct intake match:', r);
        }
      });
    }
  } catch (e) {
    console.log('Error checking intake_requests table:', e.message);
  }

  console.log('\n=== 3. SEARCHING BOOKINGS TABLE ===');
  const { data: allBookings } = await supabase.from('bookings').select('*');
  allBookings.forEach(b => {
    const text = JSON.stringify(b);
    if (searchTerms.some(t => text.includes(t))) {
      console.log(`Booking ID: ${b.id} | Dog: ${b.dog_name} | Owner: ${b.owner_name} | Phone: ${b.owner_phone} | Dates: ${b.start_date}->${b.end_date}`);
    }
  });

  console.log('\n=== 4. SEARCHING GREEN API LAST INCOMING MESSAGES ===');
  const inc = await fetchGreenApi('lastIncomingMessages', 'GET');
  if (Array.isArray(inc)) {
    inc.forEach((m, idx) => {
      const text = JSON.stringify(m);
      if (searchTerms.some(t => text.includes(t))) {
        console.log(`[${idx}] Chat: ${m.chatId} | Sender: ${m.senderName || m.senderId} | Text: ${m.textMessage || m.caption || ''}`);
      }
    });
  }
}

run().catch(console.error);
