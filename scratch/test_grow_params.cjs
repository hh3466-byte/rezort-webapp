const https = require('https');
const desc = encodeURIComponent('הריזורט לכלב עבור שירות פנסיון ואירוח ללייקה בתאריכים 29.10.2026 עד 01.11.2026');
const url = `https://pay.grow.link/MjcyNjk~3d59a40e0ae26ce0d41b50b4eebdff04-MzczNjYzMg?sum=540&amount=540&phone=0506280038&fullName=Gaston&description=${desc}`;

https.get(url, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const nextDataMatch = data.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (nextDataMatch) {
      const json = JSON.parse(nextDataMatch[1]);
      console.log('query:', json.query);
      console.log('pageProps.query:', json.props?.pageProps?.query);
      console.log('initialState.paymentForm:', json.props?.pageProps?.initialState?.paymentForm);
    }
  });
});
