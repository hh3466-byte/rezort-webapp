const https = require('https');
https.get('https://rezort-webapp.vercel.app/?t=' + Date.now(), res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    const lines = data.split('\n').filter(l => l.includes('script') || l.includes('link'));
    console.log('Script and link tags:\n', lines.join('\n'));
  });
});
