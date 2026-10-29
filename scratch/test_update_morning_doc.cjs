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

async function testUpdateDoc() {
  const token = await getToken();
  const docId = '3e40160d-aefd-49ff-a5b1-b4003c5b16a1';
  
  // Try getting document details
  const getRes = await fetch(`https://api.greeninvoice.co.il/api/v1/documents/${docId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('Get Doc Status:', getRes.status);
  const doc = await getRes.json();
  console.log('Doc Details:', JSON.stringify(doc, null, 2).substring(0, 1000));

  // Try updating remarks or description
  const updateRes = await fetch(`https://api.greeninvoice.co.il/api/v1/documents/${docId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      description: 'הריזורט לכלב עבור שירות אילוף ואימון קולר אלקטרוני',
      remarks: 'הריזורט לכלב עבור שירות אילוף ואימון קולר אלקטרוני - ליאו'
    })
  });
  console.log('Update Status:', updateRes.status);
  const uText = await updateRes.text();
  console.log('Update Body:', uText);
}

testUpdateDoc();
