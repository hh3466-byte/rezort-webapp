const fetch = globalThis.fetch || require('node-fetch');

const KEY = 'd68c364d-278a-4f95-93ba-818f4a015ca4';
const SECRET = 'I@_[,oLTTTS07;6(6AvJ7eBXDFd@gT?9';

async function testMethods() {
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

  const tests = [
    { method: 'PUT', url: 'https://api.greeninvoice.co.il/api/v1/clients/associate-documents' },
    { method: 'POST', url: 'https://api.greeninvoice.co.il/api/v1/clients/dummy/associate-documents' },
    { method: 'PUT', url: 'https://api.greeninvoice.co.il/api/v1/clients/dummy/documents' },
    { method: 'POST', url: 'https://api.greeninvoice.co.il/api/v1/clients/dummy/documents' },
    { method: 'PUT', url: 'https://api.greeninvoice.co.il/api/v1/documents/dummy/client' },
    { method: 'POST', url: 'https://api.greeninvoice.co.il/api/v1/documents/dummy/client' }
  ];

  for (const t of tests) {
    try {
      const res = await fetch(t.url, {
        method: t.method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ id: 'dummy', ids: ['dummy'] })
      });
      console.log(`[${t.method} ${t.url}] status=${res.status}`);
    } catch (_) {}
  }
}

testMethods();
