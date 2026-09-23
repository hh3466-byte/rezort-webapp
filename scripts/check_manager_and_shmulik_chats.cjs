const fs = require('fs');
const https = require('https');
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

const GREEN_API_ID = "710722735421";
const GREEN_API_TOKEN = "ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b";

function getChatHistory(chatId) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ chatId, count: 20 });
    const req = https.request({
      hostname: 'api.green-api.com',
      path: `/waInstance${GREEN_API_ID}/GetChatHistory/${GREEN_API_TOKEN}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve(body);
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function run() {
  console.log('=== Checking Shmulik chat history (972506336896@c.us) ===');
  const shmulikHistory = await getChatHistory('972506336896@c.us');
  if (Array.isArray(shmulikHistory)) {
    console.log(`Retrieved ${shmulikHistory.length} messages for Shmulik:`);
    shmulikHistory.slice(0, 10).forEach(m => {
      const date = new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
      console.log(`[${date}] ${m.type} (${m.typeMessage}): ${m.textMessage ? m.textMessage.slice(0, 80) : ''}`);
    });
  } else {
    console.log('Shmulik history response:', shmulikHistory);
  }

  console.log('\n=== Checking Manager chat history (972543200007@c.us) ===');
  const managerHistory = await getChatHistory('972543200007@c.us');
  if (Array.isArray(managerHistory)) {
    console.log(`Retrieved ${managerHistory.length} messages for Manager:`);
    managerHistory.slice(0, 10).forEach(m => {
      const date = new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
      console.log(`[${date}] ${m.type} (${m.typeMessage}): ${m.textMessage ? m.textMessage.slice(0, 80) : ''}`);
    });
  } else {
    console.log('Manager history response:', managerHistory);
  }
}

run();
