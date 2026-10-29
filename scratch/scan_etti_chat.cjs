const idInstance = '710722735421';
const apiTokenInstance = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
const baseUrl = 'https://7107.api.greenapi.com';

async function scanEttiChat() {
  const res = await fetch(`${baseUrl}/waInstance${idInstance}/lastOutgoingMessages/${apiTokenInstance}?minutes=43200`); // 30 days
  const data = await res.json();
  console.log(`Total outgoing messages past 30 days: ${data?.length}`);
  
  const ettiMsgs = data.filter(m => m.chatId === '972524467314@c.us');
  console.log(`\n--- OUTGOING TO ETTI (052-4467314): ${ettiMsgs.length} messages ---`);
  ettiMsgs.forEach((m, idx) => {
    const time = new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
    console.log(`\n[${idx+1}] Time: ${time}\n${m.textMessage}`);
  });

  // Also check if any messages containing 'זכויות המורה' were sent to Hagai (972543200007@c.us)
  const hagaiTeacherMsgs = data.filter(m => m.chatId === '972543200007@c.us' && m.textMessage?.includes('זכויות המורה'));
  console.log(`\n--- TO HAGAI (זכויות המורה): ${hagaiTeacherMsgs.length} messages ---`);
  hagaiTeacherMsgs.forEach((m, idx) => {
    const time = new Date(m.timestamp * 1000).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
    console.log(`\n[${idx+1}] Time: ${time}\n${m.textMessage}`);
  });
}
scanEttiChat();
