const fs = require('fs');

const id = '710722735421';
const tok = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

async function run() {
  const url = `https://api.green-api.com/waInstance${id}/getChats/${tok}`;
  try {
    const res = await fetch(url);
    const chats = await res.json();
    console.log(`Total chats from Green API: ${chats.length}`);
    chats.slice(25, 60).forEach((c, i) => {
      console.log(`[${i+26}] ID: ${c.id} | Name: ${c.name}`);
    });
  } catch (err) {
    console.error(err);
  }
}

run();
