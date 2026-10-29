const https = require('https');

function fetchHtml(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
  });
}

async function test() {
  const html1 = await fetchHtml('https://rezort-webapp-qyqg5u0l9-hh3466-1830s-projects.vercel.app/');
  const m1 = html1.match(/src="(\/assets\/index-[^"]+\.js)"/);
  console.log('Script in target_url:', m1 ? m1[1] : 'not found');

  const html2 = await fetchHtml('https://rezort-webapp.vercel.app/');
  const m2 = html2.match(/src="(\/assets\/index-[^"]+\.js)"/);
  console.log('Script in main production url:', m2 ? m2[1] : 'not found');

  const v1 = await fetchHtml('https://rezort-webapp-qyqg5u0l9-hh3466-1830s-projects.vercel.app/version.json');
  console.log('version.json in target_url:', v1);

  const v2 = await fetchHtml('https://rezort-webapp.vercel.app/version.json');
  console.log('version.json in main production url:', v2);
}

test();
