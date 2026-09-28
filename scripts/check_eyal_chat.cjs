const fs = require('fs');
const dotenv = require('dotenv');
if (fs.existsSync('.env.local')) dotenv.config({ path: '.env.local' });
else if (fs.existsSync('.env')) dotenv.config({ path: '.env' });

const id = process.env.VITE_GREEN_API_ID_INSTANCE || '7105260173';
const token = process.env.VITE_GREEN_API_API_TOKEN || 'a71e16f7ec05481788cf5d50fc19d45e64bb4c78d49a405a81';

async function check() {
  const url = `https://api.green-api.com/waInstance${id}/getChatHistory/${token}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: '972556694789@c.us', count: 50 })
  });
  const data = await res.json();
  console.log('Total messages in chat:', data.length);
  data.reverse().forEach(m => {
    const time = new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
    const sender = m.type === 'outgoing' ? 'שמוליק/ריזורט' : 'אייל ברקוביץ';
    const text = m.textMessage || m.caption || (m.extendedTextMessage?.text) || '';
    console.log(`[${time}] [${sender}]: ${text}`);
  });
}
check();
