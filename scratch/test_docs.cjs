const fetch = globalThis.fetch || require('node-fetch');

const KEY = 'd68c364d-278a-4f95-93ba-818f4a015ca4';
const SECRET = 'I@_[,oLTTTS07;6(6AvJ7eBXDFd@gT?9';

async function checkDocs() {
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

  const dRes = await fetch('https://api.greeninvoice.co.il/api/v1/documents/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({ pageSize: 2 })
  });
  const dData = await dRes.json();
  console.log('Total documents in Morning:', dData.total);
  if (dData.items && dData.items.length > 0) {
    console.log('Sample doc:', JSON.stringify(dData.items[0], null, 2));
  }
}

checkDocs();
