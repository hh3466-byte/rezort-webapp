const fs = require('fs');

async function run() {
  const url = 'https://api.green-api.com/waInstance710722735421/getChatHistory/ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
  const resp = await globalThis.fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: '972543200007@c.us', count: 2 })
  });
  const msgs = await resp.json();
  console.log(JSON.stringify(msgs[0], null, 2));
}

run();
