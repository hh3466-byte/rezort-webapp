const https = require('https');

function check() {
  https.get('https://rezort-webapp.vercel.app/?t=' + Date.now(), res => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
      const m = data.match(/src="(\/assets\/index-[^"]+\.js)"/);
      if (!m) {
        console.log('No script tag found yet, retrying...');
        setTimeout(check, 3000);
        return;
      }
      const scriptUrl = 'https://rezort-webapp.vercel.app' + m[1];
      https.get(scriptUrl, res2 => {
        let js = '';
        res2.on('data', c => js += c);
        res2.on('end', () => {
          const hasTransfer = js.includes('ניוד ימים בין כרטיסיות');
          console.log(`Live script: ${m[1]} | Has transfer feature: ${hasTransfer}`);
          if (hasTransfer) {
            console.log('🎉 Production has the latest feature live!');
            process.exit(0);
          } else {
            console.log('Waiting for Vercel deploy...');
            setTimeout(check, 4000);
          }
        });
      });
    });
  });
}

check();
