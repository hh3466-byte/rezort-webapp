const MORNING_API_KEY = process.env.MORNING_API_KEY || 'd68c364d-278a-4f95-93ba-818f4a015ca4';
const MORNING_SECRET = process.env.MORNING_SECRET || 'I@_[,oLTTTS07;6(6AvJ7eBXDFd@gT?9';

async function testDocCreateSchema() {
  const tokenRes = await fetch('https://api.morning.co/idp/v1/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credentials', client_id: MORNING_API_KEY, client_secret: MORNING_SECRET })
  });
  const data = await tokenRes.json();
  const token = data.token || data.access_token || data.accessToken;
  
  // Test create draft document (type 320: tax invoice receipt)
  const res = await fetch('https://api.greeninvoice.co.il/api/v1/documents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({
      type: 320,
      draft: true,
      lang: 'he',
      currency: 'ILS',
      vatType: 0,
      description: 'הריזורט לכלב',
      client: {
        name: 'בדיקה זמנית'
      },
      income: [
        {
          description: 'הריזורט לכלב',
          quantity: 1,
          price: 0,
          vatType: 1
        },
        {
          description: 'בעבור אילוף ל "ליאו"',
          quantity: 1,
          price: 1000,
          vatType: 1
        }
      ],
      payment: [
        {
          type: 10, appType: 1,
          price: 1000,
          date: '2026-10-24'
        }
      ]
    })
  });
  console.log('Doc create status:', res.status);
  const body = await res.json();
  console.log('Response body:', JSON.stringify(body, null, 2));

  // If created, delete the draft
  if (body.id) {
    const delRes = await fetch(`https://api.greeninvoice.co.il/api/v1/documents/${body.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    console.log('Draft cleanup status:', delRes.status);
  }
}
testDocCreateSchema();
