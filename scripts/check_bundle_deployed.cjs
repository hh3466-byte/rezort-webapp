const https = require('https');

https.get('https://rezort-webapp.vercel.app', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('HTML length:', data.length);
    const scriptMatch = data.match(/assets\/index-[^\"']+\.js/);
    console.log('Script match:', scriptMatch ? scriptMatch[0] : 'none');
    if (scriptMatch) {
      https.get('https://rezort-webapp.vercel.app/' + scriptMatch[0], (sres) => {
        let sdata = '';
        sres.on('data', chunk => sdata += chunk);
        sres.on('end', () => {
          console.log('Bundle length:', sdata.length);
          console.log('Contains agreement=training:', sdata.includes('agreement=training'));
          console.log('Contains הסכם:', sdata.includes('הסכם'));
        });
      });
    }
  });
});
