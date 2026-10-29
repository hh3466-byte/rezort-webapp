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
const greenId = env.VITE_GREEN_API_ID || '710722735421';
const greenToken = env.VITE_GREEN_API_TOKEN || env.GREEN_API_TOKEN;
const cluster = greenId.length >= 4 ? greenId.slice(0, 4) : '7107';

async function check() {
  const res = await fetch(`https://${cluster}.api.greenapi.com/waInstance${greenId}/getChatHistory/${greenToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: '972543200007@c.us', count: 6 })
  });
  const data = await res.json();
  if (!Array.isArray(data)) {
    console.log('Error/non-array:', data);
    return;
  }
  data.reverse().forEach(m => {
    console.log('=== MSG (' + m.type + ' at ' + new Date(m.timestamp * 1000).toLocaleString('he-IL') + ') ===');
    console.log(m.textMessage || m.extendedTextMessage?.text || '[media]');
  });
}
check();
