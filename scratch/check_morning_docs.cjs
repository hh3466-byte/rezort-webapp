const { getMorningToken } = require('./api/_morning-service.js');

async function checkMorning() {
  const token = await getMorningToken();
  const res = await fetch('https://api.greeninvoice.co.il/api/v1/documents/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ pageSize: 25 })
  });

  const data = await res.json();
  console.log(`Found ${data.items ? data.items.length : 0} documents in Morning:`);
  if (data.items) {
    data.items.slice(0, 15).forEach(d => {
      console.log({
        number: d.number,
        type: d.type,
        clientName: d.client?.name,
        amount: d.amount,
        currency: d.currency,
        date: d.documentDate,
        description: d.description
      });
    });
  }
}

checkMorning();
