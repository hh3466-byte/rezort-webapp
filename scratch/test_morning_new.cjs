const fetch = globalThis.fetch || require('node-fetch');

const KEY = 'd68c364d-278a-4f95-93ba-818f4a015ca4';
const SECRET = 'I@_[,oLTTTS07;6(6AvJ7eBXDFd@gT?9';

async function testAuth() {
  console.log('Testing Morning API with copied credentials...');
  
  const attempts = [
    {
      name: 'idp/v1/oauth/token with client_id/client_secret',
      url: 'https://api.morning.co/idp/v1/oauth/token',
      body: {
        grant_type: 'client_credentials',
        client_id: KEY,
        client_secret: SECRET
      }
    },
    {
      name: 'idp/v1/oauth/token with id/secret',
      url: 'https://api.morning.co/idp/v1/oauth/token',
      body: {
        grant_type: 'client_credentials',
        id: KEY,
        secret: SECRET
      }
    }
  ];

  for (const a of attempts) {
    try {
      const res = await fetch(a.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(a.body)
      });
      console.log(`[${a.name}] Status: ${res.status}`);
      const data = await res.json();
      console.log('Response:', data);

      if (data.token || data.accessToken) {
        const token = data.token || data.accessToken;
        console.log('🎉 SUCCESS! Access token received.');

        // Test searching clients
        const cRes = await fetch('https://api.greeninvoice.co.il/api/v1/clients/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ page: 0, pageSize: 2 })
        });
        console.log('Clients search status:', cRes.status);
        const cData = await cRes.json();
        console.log('Total clients in Morning:', cData.total);
        console.log('Sample clients:', JSON.stringify(cData.items?.map(c => ({ id: c.id, name: c.name }))));
        return;
      }
    } catch (e) {
      console.error(`Error:`, e.message);
    }
  }
}

testAuth();
