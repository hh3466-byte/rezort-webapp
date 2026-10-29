const https = require('https');

https.get('https://rezort-webapp.vercel.app/version.json?t=' + Date.now(), res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    console.log('Live version.json:', data.trim());
    https.get('https://rezort-webapp.vercel.app/index.html?t=' + Date.now(), res2 => {
      let html = '';
      res2.on('data', c => html += c);
      res2.on('end', () => {
        const match = html.match(/src="(\/assets\/index-[^"]+\.js)"/);
        console.log('Script bundle:', match ? match[1] : 'not found');
        if (match) {
          https.get('https://rezort-webapp.vercel.app' + match[1], res3 => {
            let js = '';
            res3.on('data', c => js += c);
            res3.on('end', () => {
              console.log('Has compactLabel:', js.includes('compactLabel'));
              console.log('Has ratio pattern /totalDays:', js.includes('/${totalDays}') || js.includes('/totalDays') || js.includes('נותרו'));
              console.log('Bundle length:', js.length);
            });
          });
        }
      });
    });
  });
});
