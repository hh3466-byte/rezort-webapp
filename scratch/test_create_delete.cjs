const fetch = globalThis.fetch || require('node-fetch');

const KEY = 'd68c364d-278a-4f95-93ba-818f4a015ca4';
const SECRET = 'I@_[,oLTTTS07;6(6AvJ7eBXDFd@gT?9';

async function testCreateClient() {
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

  // Test creating a client
  const clientPayload = {
    name: 'בדיקת מערכת ריזורט',
    emails: ['test@resort.co.il'],
    phone: '0501234567',
    mobile: '0501234567',
    country: 'IL',
    remarks: 'בדיקת אינטגרציה - הריזורט לכלב'
  };

  const createRes = await fetch('https://api.greeninvoice.co.il/api/v1/clients', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify(clientPayload)
  });

  console.log('Create client status:', createRes.status);
  const data = await createRes.json();
  console.log('Created client response:', JSON.stringify(data, null, 2));

  // If created, delete it so we leave the account clean
  if (data && data.id) {
    console.log('Cleaning up test client ID:', data.id);
    const delRes = await fetch(`https://api.greeninvoice.co.il/api/v1/clients/${data.id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      }
    });
    console.log('Delete status:', delRes.status);
  }
}

testCreateClient();
