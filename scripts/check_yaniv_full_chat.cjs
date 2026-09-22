const id = '710722735421';
const token = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

async function run() {
  const url = `https://api.green-api.com/waInstance${id}/getChatHistory/${token}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: '972545443222@c.us', count: 30 })
  });
  const history = await res.json();
  console.log(`Chat history with Yaniv Elad (${history.length} messages):`);
  history.reverse().forEach(m => {
    const dt = new Date((m.timestamp || 0) * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
    const dir = m.type === 'incoming' ? '📥 יניב' : '📤 שמוליק/ריזורט';
    const text = m.textMessage || (m.extendedTextMessage?.text) || '[מדיה/קובץ]';
    console.log(`[${dt}] ${dir}: ${text}`);
  });
}

run();
