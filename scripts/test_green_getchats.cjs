const id = '710722735421';
const token = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

async function run() {
  const res = await fetch(`https://api.green-api.com/waInstance${id}/getChats/${token}`);
  const list = await res.json();
  console.log(`Total chats from getChats: ${list.length}`);
  console.log('Sample 10 chats:', JSON.stringify(list.slice(0, 10), null, 2));
}

run();
