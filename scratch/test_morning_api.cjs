const fetch = globalThis.fetch || require('node-fetch');

const MORNING_API_KEY = '18c14598-0f77-45d9-a6b2-7aa04f0289e2';
const MORNING_SECRET = 'vxi.^|CnHhU1fcz,>a8MQOGU<2$I?25-';

async function testCombination() {
  const tests = [
    {
      name: 'id + secret + grant_type',
      url: 'https://api.morning.co/idp/v1/oauth/token',
      body: {
        id: MORNING_API_KEY,
        secret: MORNING_SECRET,
        grant_type: 'client_credentials'
      }
    },
    {
      name: 'id + secret + client_id + client_secret + grant_type',
      url: 'https://api.morning.co/idp/v1/oauth/token',
      body: {
        id: MORNING_API_KEY,
        secret: MORNING_SECRET,
        client_id: MORNING_API_KEY,
        client_secret: MORNING_SECRET,
        grant_type: 'client_credentials'
      }
    }
  ];

  for (const t of tests) {
    try {
      const res = await fetch(t.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(t.body)
      });
      console.log(`[${t.name}] Status: ${res.status}`);
      const txt = await res.text();
      console.log(`Body: ${txt}`);
    } catch (e) {
      console.log(`Error: ${e.message}`);
    }
  }
}

testCombination();
