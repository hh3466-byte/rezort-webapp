const https = require('https');
const http = require('http');

const API_KEY = 'hfBND9mlC28BGvUkwQBls9hypPUIoJIj4Sy6LyUH';
const USER_ID = 'e1ceee55b717e60b';
const PAGE_CODE = '538cbf6f8827';

async function testCreatePaymentLink() {
  const payload = {
    userId: USER_ID,
    pageCode: PAGE_CODE,
    paymentLinkType: 2,
    isActive: 1,
    title: 'הריזורט לכלב - שריון ופנסיון',
    chargeType: 1,
    products: {
      data: [
        {
          name: 'אירוח ופנסיון - בלו (ישראל ישראלי)',
          price: 750,
          quantity: 1,
          vatType: 1
        }
      ]
    },
    pageFieldSettings: {
      fullName: { value: 'ישראל ישראלי' },
      phone: { value: '0501234567' },
      email: { value: 'hh3466@gmail.com' }
    },
    paymentTypes: [
      {
        type: 'payments',
        payments: {
          paymentsPaymentNum: 1
        }
      }
    ],
    transactionType: [1, 6, 13, 14, 15, 5],
    successUrl: 'https://rezort-webapp.vercel.app/payment-success',
    notifyUrl: 'https://rezort-webapp.vercel.app/api/grow-webhook',
    cField1: 'b-test-12345',
    cField2: '0501234567'
  };

  const dataString = JSON.stringify(payload);

  const endpoints = [
    { proto: 'https', host: 'sandbox.meshulam.co.il', path: '/api/light/server/1.0/CreatePaymentLink' },
    { proto: 'https', host: 'sandbox.meshulam.co.il', path: '/api/light/server/1.0/createPaymentLink' },
    { proto: 'https', host: 'sandboxapi.grow.link', path: '/api/light/server/1.0/CreatePaymentLink' },
    { proto: 'http', host: 'sandboxapi.grow.link', path: '/api/light/server/1.0/CreatePaymentLink' },
    { proto: 'https', host: 'meshulam.co.il', path: '/api/light/server/1.0/CreatePaymentLink' }
  ];

  for (const ep of endpoints) {
    console.log(`\nTesting ${ep.proto}://${ep.host}${ep.path}...`);
    try {
      const res = await makeRequest(ep.proto, ep.host, ep.path, dataString);
      console.log('Status Code:', res.statusCode);
      console.log('Response Body:', res.body);
    } catch (err) {
      console.error('Request error:', err.message);
    }
  }
}

function makeRequest(proto, host, path, dataString) {
  return new Promise((resolve, reject) => {
    const client = proto === 'https' ? https : http;
    const req = client.request({
      hostname: host,
      port: proto === 'https' ? 443 : 80,
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

testCreatePaymentLink();
