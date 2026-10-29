async function checkBundle() {
  const r = await fetch('https://rezort-webapp.vercel.app/assets/index-zgS1kBjs.js');
  const t = await r.text();
  console.log('Includes "ערוך מחדש הזמנה":', t.includes('ערוך מחדש הזמנה'));
  console.log('Includes "מסמכים קשורים":', t.includes('מסמכים קשורים'));
  console.log('Includes "הצג היסטוריית הודעות":', t.includes('הצג היסטוריית הודעות'));
}
checkBundle();
