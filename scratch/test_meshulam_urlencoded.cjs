const https = require('https');

async function testUrlEncoded() {
  const params = new URLSearchParams({
    pageCode: '538cbf6f8827',
    userId: 'e1ceee55b717e60b',
    apiKey: 'hfBND9mlC28BGvUkwQBls9hypPUIoJIj4Sy6LyUH',
    sum: '540',
    description: 'הריזורט לכלב עבור שירות פנסיון ואירוח ללייקה',
    fullName: 'גסטון רנדלשטיין',
    phone: '0506280038',
    paymentNum: '1',
    chargeType: '1'
  });

  const data = params.toString();

  for (const host of ['meshulam.co.il', 'sandbox.meshulam.co.il']) {
    const req = https.request({
      hostname: host,
      path: '/api/light/server/1.0/createPaymentProcess',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let d = '';
      res.on('data', chunk => d += chunk);
      res.on('end', () => {
        console.log(host, res.statusCode, d);
      });
    });
    req.write(data);
    req.end();
  }
}

testUrlEncoded();
