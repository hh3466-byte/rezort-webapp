const https = require('https');

https.get('https://rezort-webapp.vercel.app/', res => {
  let html = '';
  res.on('data', c => html += c);
  res.on('end', () => {
    const match = html.match(/src="(\/assets\/index-[^"]+\.js)"/);
    if (!match) {
      console.log('no js asset match in html');
      return;
    }
    const jsUrl = 'https://rezort-webapp.vercel.app' + match[1];
    console.log('Fetching JS bundle:', jsUrl);
    https.get(jsUrl, jsRes => {
      let js = '';
      jsRes.on('data', c => js += c);
      jsRes.on('end', () => {
        console.log('JS bundle length:', js.length);
        console.log('Contains agreement=training:', js.includes('agreement=training'));
        console.log('Contains הסכם:', js.includes('הסכם'));
      });
    });
  });
});
