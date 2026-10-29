async function checkDetails() {
  const r = await fetch('https://rezort-webapp.vercel.app/assets/index-zgS1kBjs.js');
  const t = await r.text();
  const idx = t.indexOf('ערוך מחדש הזמנה');
  console.log('Snippet around ערוך מחדש הזמנה:');
  console.log(t.slice(Math.max(0, idx - 150), idx + 150));
}
checkDetails();
