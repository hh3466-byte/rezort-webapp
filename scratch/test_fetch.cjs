async function test() {
  const r = await fetch('https://rezort-webapp.vercel.app/index.html');
  console.log('Age:', r.headers.get('age'), 'Cache:', r.headers.get('x-vercel-cache'));
  const t = await r.text();
  const m = t.match(/src="(\/assets\/index-[^"]+\.js)"/);
  console.log('Script:', m ? m[1] : 'none');
}
test();
