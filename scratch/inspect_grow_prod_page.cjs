const https = require('https');

https.get('https://pay.grow.link/MjcyNjk~3d59a40e0ae26ce0d41b50b4eebdff04-MzczNjYzMg', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const nextDataMatch = data.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (nextDataMatch) {
      const json = JSON.parse(nextDataMatch[1]);
      const is = json.props?.pageProps?.initialState || {};
      console.log('pageData:', JSON.stringify(is.pageData, null, 2));
      console.log('pageSettings:', JSON.stringify(is.pageSettings, null, 2));
      console.log('linkData:', JSON.stringify(is.linkData, null, 2));
      console.log('userData:', JSON.stringify(is.userData, null, 2));
    }
  });
});
