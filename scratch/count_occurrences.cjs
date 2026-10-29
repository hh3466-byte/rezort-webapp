async function countOccurrences() {
  const r = await fetch('https://rezort-webapp.vercel.app/assets/index-zgS1kBjs.js');
  const t = await r.text();
  const count = (t.match(/ערוך מחדש הזמנה/g) || []).length;
  console.log('Total count of "ערוך מחדש הזמנה" in bundle:', count);
  let pos = 0;
  while ((pos = t.indexOf('ערוך מחדש הזמנה', pos)) !== -1) {
    console.log('Found at pos', pos, ':', t.slice(Math.max(0, pos - 100), pos + 100));
    pos += 'ערוך מחדש הזמנה'.length;
  }
}
countOccurrences();
