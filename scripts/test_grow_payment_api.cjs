const https = require('https');

const API_KEY = 'hfBND9mlC28BGvUkwQBls9hypPUIoJIj4Sy6LyUH';
const USER_ID = 'e1ceee55b717e60b';
const PAGE_CODE = '538cbf6f8827';

async function testVariations() {
  const variations = [
    { sum: '50' },
    { sum: '50.00' },
    { sum: 50 },
    { sum: 50.0 },
    { sum: '100' },
    { sum: 100 }
  ];

  for (const v of variations) {
    const payload = {
      pageCode: PAGE_CODE,
      userId: USER_ID,
      sum: v.sum,
      description: 'בדיקת תשלום ריזורט לכלב',
      fullName: 'ישראל ישראלי',
      payerPhone: '0501234567',
      payerEmail: 'hh3466@gmail.com',
      paymentNum: 1,
      chargeType: 1,
      successUrl: 'https://rezort-webapp.vercel.app/payment-success',
      cancelUrl: 'https://rezort-webapp.vercel.app/payment-cancel',
      notifyUrl: 'https://rezort-webapp.vercel.app/api/grow-webhook',
      cField1: 'b-test-12345'
    };

    const dataString = JSON.stringify(payload);
    console.log(`\nTesting sum: ${JSON.stringify(v.sum)}...`);
    const res = await makeRequest('sandbox.meshulam.co.il', '/api/light/server/1.0/createPaymentProcess', dataString);
    console.log('Status Code:', res.statusCode);
    console.log('Response Body:', res.body);
    if (res.body.includes('"status":1') || res.body.includes('"status":"1"')) {
      console.log('SUCCESS! Found working format:', v);
      break;
    }
  }
}

function makeRequest(host, path, dataString) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: host,
      port: 443,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'Content-Length': Buffer.byteLength(dataString)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, body }));
    });

    req.on('error', reject);
    req.write(dataString);
    req.end();
  });
}

testVariations();
