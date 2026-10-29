const https = require('https');

async function testCreatePaymentLink(host) {
  const payload = {
    userId: 'e1ceee55b717e60b',
    pageCode: '538cbf6f8827',
    paymentLinkType: 2,
    isActive: 1,
    title: 'הריזורט לכלב עבור שירות בדיקה',
    chargeType: 1,
    products: {
      data: [{ name: 'הריזורט לכלב עבור שירות בדיקה', price: 100, quantity: 1, vatType: 1 }]
    },
    pageFieldSettings: {
      fullName: { value: 'ישראל ישראלי' },
      phone: { value: '0501234567' }
    },
    paymentTypes: [
      {
        type: 'payments',
        payments: {
          paymentsPaymentNum: 1
        }
      }
    ],
    transactionType: [1, 6, 13, 14, 5, 15]
  };

  return new Promise((resolve) => {
    const req = https.request({
      hostname: host,
      path: '/api/light/server/1.0/CreatePaymentLink',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'hfBND9mlC28BGvUkwQBls9hypPUIoJIj4Sy6LyUH'
      }
    }, (res) => {
      let d = '';
      res.on('data', chunk => d += chunk);
      res.on('end', () => {
        resolve({ host, status: res.statusCode, body: d });
      });
    });
    req.on('error', (e) => resolve({ host, error: e.message }));
    req.write(JSON.stringify(payload));
    req.end();
  });
}

async function run() {
  for (const host of ['meshulam.co.il', 'api.grow.link', 'sandboxapi.grow.link']) {
    const r = await testCreatePaymentLink(host);
    console.log(host, r.status, r.body || r.error);
  }
}

run();
