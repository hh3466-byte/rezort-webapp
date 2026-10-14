const idInstance = '710722735421';
const apiTokenInstance = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
const baseUrl = 'https://7107.api.greenapi.com';

async function testFetch() {
  const res = await fetch(`${baseUrl}/waInstance${idInstance}/lastIncomingMessages/${apiTokenInstance}?minutes=1440`);
  const data = await res.json();
  if (data?.length > 0) {
    console.log('Sample message keys:', Object.keys(data[0]));
    console.log('Sample message:', JSON.stringify(data[0], null, 2));
  }
}
testFetch();
