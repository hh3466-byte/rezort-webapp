const https = require('https');
let attempts = 0;
function poll() {
  attempts++;
  https.get('https://rezort-webapp.vercel.app/?t=' + Date.now(), res => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
      const m = data.match(/assets\/index-([A-Za-z0-9_-]+)\.js/);
      const tag = m ? m[0] : 'none';
      console.log('[Attempt ' + attempts + '] Current live tag: ' + tag);
      if (tag !== 'assets/index-CcXlfs3A.js' && m) {
        console.log('🎉 NEW VERCEL BUILD ACTIVE:', tag);
        process.exit(0);
      } else if (attempts < 15) {
        setTimeout(poll, 4000);
      } else {
        console.log('Still waiting for Vercel...');
        process.exit(0);
      }
    });
  });
}
poll();
