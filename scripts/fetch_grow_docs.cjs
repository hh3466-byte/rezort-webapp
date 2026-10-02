const https = require('https');
const http = require('http');

function get(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, {
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
        console.log(`Redirecting from ${url} to ${redirectUrl}`);
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
    'https://grow-il.readme.io/reference/payment-link',
    'https://grow-il.readme.io/reference/create-payment-process',
    'https://grow-il.readme.io/reference/server-response',
    'https://grow-il.readme.io/reference/approve-transaction'
  ];

  for (const u of urls) {
    try {
      const res = await get(u);
      console.log(`Final URL: ${res.url} -> Status: ${res.status}, Length: ${res.body.length}`);
      
      // Look for react initialState or openapi spec data inside the HTML
      const match = res.body.match(/window\.__INITIAL_STATE__\s*=\s*({.*?});/s) ||
                    res.body.match(/data-json="([^"]+)"/) ||
                    res.body.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/) ||
                    res.body.match(/<script id="config"[^>]*data-json="([^"]+)"/);
      
      if (match) {
        console.log(`Matched state/config for ${u}!`);
      }
    } catch (err) {
      console.error(`Error for ${u}:`, err.message);
    }
  }
}

run();
