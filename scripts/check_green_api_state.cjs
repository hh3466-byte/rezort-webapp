const id = '710722735421';
const token = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

async function check() {
  const url = `https://api.green-api.com/waInstance${id}/getStateInstance/${token}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  const data = await res.json();
  console.log('Green API State:', data);
}

check().catch(console.error);
