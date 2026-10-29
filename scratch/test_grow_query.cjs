const https = require('https');
https.get('https://pay.grow.link/MjcyNjk~3d59a40e0ae26ce0d41b50b4eebdff04-MzczNjYzMg?sum=1000&amount=1000&fullName=test', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const nextDataMatch = data.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (nextDataMatch) {
      const json = JSON.parse(nextDataMatch[1]);
      console.log('query:', json.query);
      console.log('pageProps query:', json.props?.pageProps?.query);
    }
  });
});
