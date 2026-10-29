const fetch = globalThis.fetch || require('node-fetch');

const KEY = 'd68c364d-278a-4f95-93ba-818f4a015ca4';
const SECRET = 'I@_[,oLTTTS07;6(6AvJ7eBXDFd@gT?9';

async function testEndpoints() {
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
  console.log('Got accessToken.');

  // Test endpoints for clients
  const endpoints = [
    { url: 'https://api.greeninvoice.co.il/api/v1/clients/search', method: 'POST', body: {} },
    { url: 'https://api.morning.co/api/v1/clients/search', method: 'POST', body: {} },
    { url: 'https://api.greeninvoice.co.il/api/v1/clients', method: 'GET' },
    { url: 'https://api.morning.co/api/v1/clients', method: 'GET' }
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep.url, {
        method: ep.method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: ep.body ? JSON.stringify(ep.body) : undefined
      });
      console.log(`[${ep.method} ${ep.url}] Status: ${res.status}`);
      const txt = await res.text();
      console.log(`Response: ${txt.slice(0, 200)}`);
    } catch (e) {
      console.log(`Error ${ep.url}:`, e.message);
    }
  }
}

testEndpoints();
