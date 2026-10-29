const idInstance = '710722735421';
const apiTokenInstance = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
const baseUrl = 'https://7107.api.greenapi.com';

async function scanOutgoingToHagai() {
  // 14 days = 20160 minutes
  const res = await fetch(`${baseUrl}/waInstance${idInstance}/lastOutgoingMessages/${apiTokenInstance}?minutes=20160`);
  const data = await res.json();
  console.log(`Total outgoing messages in last 14 days: ${data?.length}`);
  
  let teacherRights = [];
  data?.forEach(m => {
    const text = m.textMessage || '';
    if (text.includes('זכויות המורה') || text.includes('מורה') || text.includes('אתי')) {
      teacherRights.push({
        chatId: m.chatId,
        time: new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }),
        text: text
      });
    }
  });

  console.log(`\n--- FOUND ${teacherRights.length} TEACHER RIGHTS MESSAGES ---`);
  teacherRights.forEach((t, i) => {
    console.log(`\n[${i+1}] ${t.time} to ${t.chatId}:\n${t.text}`);
  });
}
scanOutgoingToHagai();
