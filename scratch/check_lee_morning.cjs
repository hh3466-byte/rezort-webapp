const https = require('https');

const MORNING_API_KEY = process.env.MORNING_API_KEY || 'd68c364d-278a-4f95-93ba-818f4a015ca4';
const MORNING_SECRET = process.env.MORNING_SECRET || 'I@_[,oLTTTS07;6(6AvJ7eBXDFd@gT?9';

async function getToken() {
  const res = await fetch('https://api.morning.co/idp/v1/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: MORNING_API_KEY,
      client_secret: MORNING_SECRET
    })
  });
  const data = await res.json();
  return data.accessToken || data.token;
}

async function checkLeeInMorning() {
  try {
    const token = await getToken();
    console.log('Token acquired successfully');

    // Search client
    const searchRes = await fetch('https://api.greeninvoice.co.il/api/v1/clients/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ email: 'leedaluoya@gmail.com' })
    });
    const sData = await searchRes.json();
    console.log('Client search:', JSON.stringify(sData, null, 2));

    // Search recent documents
    const docRes = await fetch('https://api.greeninvoice.co.il/api/v1/documents/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ pageSize: 5 })
    });
    const docData = await docRes.json();
    console.log('Recent docs:', JSON.stringify(docData.items?.map(d => ({
      id: d.id,
      number: d.number,
      type: d.type,
      description: d.description,
      remarks: d.remarks,
      client: d.client,
      amount: d.amount,
      income: d.income
    })), null, 2));
  } catch(e) {
    console.error('Error:', e);
  }
}

checkLeeInMorning();
