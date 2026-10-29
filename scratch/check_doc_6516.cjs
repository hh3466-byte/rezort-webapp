const MORNING_API_KEY = process.env.MORNING_API_KEY || 'd68c364d-278a-4f95-93ba-818f4a015ca4';
const MORNING_SECRET = process.env.MORNING_SECRET || 'I@_[,oLTTTS07;6(6AvJ7eBXDFd@gT?9';

async function checkMorningAPI() {
  const tokenRes = await fetch('https://api.morning.co/idp/v1/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: MORNING_API_KEY,
      client_secret: MORNING_SECRET
    })
  });
  const { accessToken } = await tokenRes.json();

  // Check document 6516 details again
  const docId = '3e40160d-aefd-49ff-a5b1-b4003c5b16a1';
  const getDoc = await fetch(`https://api.greeninvoice.co.il/api/v1/documents/${docId}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  const docData = await getDoc.json();
  console.log('Doc 6516 client:', JSON.stringify(docData.client, null, 2));
  console.log('Doc 6516 remarks:', docData.remarks);
  console.log('Doc 6516 description:', docData.description);
}

checkMorningAPI();
