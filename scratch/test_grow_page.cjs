const https = require('https');

https.get('https://pay.grow.link/MjcyNjk~3d59a40e0ae26ce0d41b50b4eebdff04-MzczNjYzMg', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const nextDataMatch = data.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (nextDataMatch) {
      try {
        const json = JSON.parse(nextDataMatch[1]);
        console.log('Page Props:', JSON.stringify(json.props?.pageProps, null, 2).substring(0, 1000));
      } catch(e) {
        console.log('JSON parse error');
      }
    } else {
      console.log('No next data found');
    }
  });
});
