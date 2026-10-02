const https = require('https');
const fs = require('fs');

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7'
      }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let redirectUrl = res.headers.location;
        if (!redirectUrl.startsWith('http')) {
          const origin = new URL(url).origin;
          redirectUrl = origin + redirectUrl;
        }
        return get(redirectUrl).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data, url }));
    }).on('error', reject);
  });
}

async function run() {
  const urls = [
    'https://developers.grow.business/reference/payment-link',
    'https://developers.grow.business/reference/create-payment-process',
    'https://developers.grow.business/reference/server-response',
    'https://developers.grow.business/reference/approve-transaction'
  ];

  for (const u of urls) {
    const res = await get(u);
    const filename = u.split('/').pop() + '.html';
    fs.writeFileSync(filename, res.body);
    console.log(`Saved ${filename}`);
  }
}

run();
