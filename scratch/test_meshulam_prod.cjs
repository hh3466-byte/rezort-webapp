const https = require('https');

async function testSum(sumVal) {
  return new Promise((resolve) => {
    const payload = {
      pageCode: '538cbf6f8827',
      userId: 'e1ceee55b717e60b',
      sum: sumVal,
      description: 'הריזורט לכלב עבור שירות בדיקה',
      fullName: 'ישראל ישראלי',
      phone: '0501234567',
      paymentNum: 1,
      chargeType: 1
    };

    const req = https.request({
      hostname: 'meshulam.co.il',
      path: '/api/light/server/1.0/createPaymentProcess',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'hfBND9mlC28BGvUkwQBls9hypPUIoJIj4Sy6LyUH'
      }
    }, (res) => {
      let d = '';
      res.on('data', chunk => d += chunk);
      res.on('end', () => {
        resolve({ sumVal, status: res.statusCode, body: d });
      });
    });
    req.write(JSON.stringify(payload));
    req.end();
  });
}

async function run() {
  for (const s of ['50.00', '50', 50, '100.00', '100', 100]) {
    const r = await testSum(s);
    console.log(s, r.body);
  }
}

run();
