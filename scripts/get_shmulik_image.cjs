const id = '710722735421';
const tok = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

async function getImage() {
  const url = `https://api.green-api.com/waInstance${id}/getChatHistory/${tok}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: '972506336896@c.us', count: 5 })
  });
  const msgs = await res.json();
  console.log('Shmulik msgs:', JSON.stringify(msgs, null, 2));
}

getImage();
