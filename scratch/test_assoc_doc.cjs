const fetch = globalThis.fetch || require('node-fetch');

const KEY = 'd68c364d-278a-4f95-93ba-818f4a015ca4';
const SECRET = 'I@_[,oLTTTS07;6(6AvJ7eBXDFd@gT?9';

async function testAssoc() {
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

  const clientId = 'bb5b22d5-49b2-4904-9ccc-497e24796fd1'; // קובי חלה
  const docId = '1dbbf531-8976-42ed-813c-258f96d26792'; // doc #6514

  const url = `https://api.greeninvoice.co.il/api/v1/clients/${clientId}/assoc`;
  console.log(`Calling ${url}...`);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      id: clientId,
      ids: [docId]
    })
  });

  console.log('Status:', res.status);
  const data = await res.text();
  console.log('Response:', data);
}

testAssoc();
