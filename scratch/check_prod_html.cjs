async function run() {
  for (let i = 0; i < 15; i++) {
    const res = await fetch('https://rezort-webapp.vercel.app/?t=' + Date.now(), {
      headers: { 'Cache-Control': 'no-cache, no-store', 'Pragma': 'no-cache' }
    });
    const cache = res.headers.get('x-vercel-cache');
    const age = res.headers.get('age');
    const html = await res.text();
    const m = html.match(/src="(\/assets\/index-[^"]+\.js)"/);
    const script = m ? m[1] : 'not found';
    console.log(`[${i+1}] Cache: ${cache}, Age: ${age}, Script: ${script}`);
    if (script !== '/assets/index-zgS1kBjs.js') {
      console.log('LIVE ON EDGE PRODUCTION!');
      process.exit(0);
    }
    await new Promise(r => setTimeout(r, 4000));
  }
}
run();
