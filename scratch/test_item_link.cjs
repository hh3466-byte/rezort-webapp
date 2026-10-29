const MORNING_API_KEY = process.env.MORNING_API_KEY || 'd68c364d-278a-4f95-93ba-818f4a015ca4';
const MORNING_SECRET = process.env.MORNING_SECRET || 'I@_[,oLTTTS07;6(6AvJ7eBXDFd@gT?9';

async function testItemLink() {
  const tokenRes = await fetch('https://api.morning.co/idp/v1/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credentials', client_id: MORNING_API_KEY, client_secret: MORNING_SECRET })
  });
  const data = await tokenRes.json();
  const token = data.token || data.access_token || data.accessToken;
  
  // Test if itemId or catalogNum links to Morning catalog item
  const res = await fetch('https://api.greeninvoice.co.il/api/v1/documents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({
      type: 305, // Proforma/Order (not a tax document, fully deletable)
      lang: 'he',
      currency: 'ILS',
      vatType: 0,
      description: 'בדיקת קישור מקט',
      client: { name: 'בדיקה' },
      income: [
        {
          itemId: '5a0cd740-9c57-4f41-9ff7-059f9ca89f6a',
          description: 'הריזורט לכלב',
          quantity: 1,
          price: 0,
          vatType: 1
        },
        {
          itemId: 'd9d15fab-bd75-4eb2-832f-72cf76c5b16d',
          description: 'בעבור אילוף ל "ליאו"',
          quantity: 1,
          price: 1000,
          vatType: 1
        }
      ]
    })
  });
  console.log('Status:', res.status);
  const doc = await res.json();
  console.log('Doc 305 created:', doc.id, doc.number);
  if (doc.id) {
    const getRes = await fetch('https://api.greeninvoice.co.il/api/v1/documents/' + doc.id, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const full = await getRes.json();
    console.log('Income result:', JSON.stringify(full.income, null, 2));
    
    // Clean up type 305
    const delRes = await fetch('https://api.greeninvoice.co.il/api/v1/documents/' + doc.id, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    console.log('Cleaned up temp doc:', delRes.status);
  }
}
testItemLink();
