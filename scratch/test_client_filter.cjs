const fetch = globalThis.fetch || require('node-fetch');

const KEY = 'd68c364d-278a-4f95-93ba-818f4a015ca4';
const SECRET = 'I@_[,oLTTTS07;6(6AvJ7eBXDFd@gT?9';

async function testFilter() {
  const tokenRes = await fetch('https://api.morning.co/idp/v1/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: KEY,
      client_secret: SECRET
    })
  });
  const { accessToken } = await tokenRes.json();

  const attempts = [
    { query: 'Elías' },
    { name: 'Elías' },
    { phone: '0538807573' },
    { email: 'elibruckman@gmail.com' },
    { search: 'Elías' }
  ];

  for (const a of attempts) {
    const res = await fetch('https://api.greeninvoice.co.il/api/v1/clients/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(a)
    });
    const data = await res.json();
    console.log(`Filter ${JSON.stringify(a)}: total=${data.total}, found=${data.items?.length}`);
  }
}

testFilter();
