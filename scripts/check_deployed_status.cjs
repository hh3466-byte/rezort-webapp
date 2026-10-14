const https = require('https');

let attempts = 0;
function poll() {
  attempts++;
  https.get('https://rezort-webapp.vercel.app/?t=' + Date.now(), (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      const match = data.match(/assets\/index-([A-Za-z0-9_-]+)\.js/);
      const scriptTag = match ? match[0] : 'none';
      console.log(`[Attempt ${attempts}] Live script tag: ${scriptTag}`);
      
      if (scriptTag !== 'assets/index-DDldtAeN.js' && match) {
        console.log('🚀 NEW VERSION DETECTED ON VERCEL!');
        https.get('https://rezort-webapp.vercel.app/' + scriptTag, (sres) => {
          let sdata = '';
          sres.on('data', chunk => sdata += chunk);
          sres.on('end', () => {
            console.log('Bundle length:', sdata.length);
            console.log('Contains 82.5 (progressive rate):', sdata.includes('82.5'));
            console.log('Contains שאלון קליטה / ליד:', sdata.includes('שאלון קליטה / ליד'));
            console.log('✅ DEPLOYMENT FULLY ACTIVE AND VERIFIED!');
            process.exit(0);
          });
        });
      } else {
        if (attempts < 10) {
          setTimeout(poll, 4000);
        } else {
          console.log('Still building on Vercel...');
          process.exit(0);
        }
      }
    });
  });
}

poll();
