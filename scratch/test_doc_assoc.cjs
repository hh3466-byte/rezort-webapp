const fetch = globalThis.fetch || require('node-fetch');

const KEY = 'd68c364d-278a-4f95-93ba-818f4a015ca4';
const SECRET = 'I@_[,oLTTTS07;6(6AvJ7eBXDFd@gT?9';

async function testAssociateDoc() {
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

  const clientId = 'bb5b22d5-49b2-4904-9ccc-497e24796fd1'; // קובי חלה
  const docId = '1dbbf531-8976-42ed-813c-258f96d26792'; // doc #6514

  const attempts = [
    // 1. PUT associate-documents with id: docId, clientId
    {
      url: 'https://api.greeninvoice.co.il/api/v1/clients/associate-documents',
      method: 'PUT',
      body: { clientId: clientId, documentIds: [docId] }
    },
    {
      url: 'https://api.greeninvoice.co.il/api/v1/clients/associate-documents',
      method: 'PUT',
      body: { client: { id: clientId }, documents: [docId] }
    },
    {
      url: 'https://api.greeninvoice.co.il/api/v1/clients/associate-documents',
      method: 'PUT',
      body: { clientId: clientId, ids: [docId] }
    },
    {
      url: 'https://api.greeninvoice.co.il/api/v1/clients/associate-documents',
      method: 'PUT',
      body: { id: docId, clientId: clientId }
    },
    // 2. PUT clients/{id}/documents
    {
      url: `https://api.greeninvoice.co.il/api/v1/clients/${clientId}/documents`,
      method: 'PUT',
      body: { ids: [docId] }
    },
    // 3. PUT documents/{id} update client
    {
      url: `https://api.greeninvoice.co.il/api/v1/documents/${docId}`,
      method: 'PUT',
      body: { client: { id: clientId } }
    }
  ];

  for (const a of attempts) {
    const res = await fetch(a.url, {
      method: a.method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(a.body)
    });
    console.log(`[${a.method} ${a.url}] Status: ${res.status}`);
    const t = await res.text();
    console.log(`Response: ${t}`);
  }
}

testAssociateDoc();
