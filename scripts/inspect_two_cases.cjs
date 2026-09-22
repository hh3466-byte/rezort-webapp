const { createClient } = require('@supabase/supabase-js');
const https = require('https');

const SUPABASE_URL = 'https://ydlynqqmulojhrxbfjsc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkbHlucXFtdWxvamhyeGJmanNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MTMxNDIsImV4cCI6MjEwMzA4OTE0Mn0.FbnWI1tIP6r52hKOK--yENROgLZFHJbH4dK0MrrgiIQ';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const GREEN_API_ID = '710722735421';
const GREEN_API_TOKEN = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

function fetchGreenApi(endpoint, method = 'POST', body = {}) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body);
    const options = {
      hostname: 'api.green-api.com',
      path: `/waInstance${GREEN_API_ID}/${endpoint}/${GREEN_API_TOKEN}`,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
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
    req.write(postData);
    req.end();
  });
}

async function run() {
  console.log('=== CASE 1: MICHAEL BEN HAR (058-6275554) CHAT HISTORY ===');
  const chatMsgs = await fetchGreenApi('GetChatHistory', 'POST', {
    chatId: '972586275554@c.us',
    count: 30
  });

  if (Array.isArray(chatMsgs)) {
    console.log(`Found ${chatMsgs.length} messages in Michael chat:`);
    for (const m of chatMsgs) {
      const time = new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
      console.log(`[${m.type}] ${time} (${m.typeMessage}):`);
      console.log(`   Text: ${m.textMessage || m.caption || ''}`);
    }
  }

  console.log('\n=== CASE 2: EYAL BERKOVICH INTAKE REQUESTS ===');
  const { data: sRow } = await supabase.from('settings').select('*').eq('id', 'resort_config').single();
  const intakes = sRow?.data?.intakeRequests || [];
  
  const eyalIntakes = intakes.filter(r => r.ownerPhone?.includes('0556694789') || r.ownerName?.includes('ברקובי'));
  console.log(`Found ${eyalIntakes.length} intake requests for Eyal:`);
  eyalIntakes.forEach((r, idx) => {
    console.log(`\n[${idx}] ID: ${r.id}, Dog: ${r.dogName}, Created: ${r.createdAt}, Status: ${r.status}`);
    console.log('Additional dogs:', r.additionalDogs);
    console.log('Deposit requested:', r.depositRequested);
    console.log('Full record:', JSON.stringify(r, null, 2));
  });
}

run().catch(console.error);
