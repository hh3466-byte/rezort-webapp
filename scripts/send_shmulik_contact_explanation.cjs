async function sendShmulikExplanation() {
  const cluster = '7107';
  const idInstance = '710722735421';
  const token = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

  const shmulikPhone = '972506336896@c.us';

  const message = `שלום שמוליק יקר 🐾

שדרגנו עבורך את המערכת כדי להקל עליך בזיהוי שיחות חדשות בוואטסאפ:

🔹 *כשמתקבל שאלון קליטה מלקוח חדש:*
המערכת תשמור אותו אוטומטית באנשי הקשר עם הסימון:
👉 *[חדש] שם הבעלים (שם הכלב)*
*(כך תדע מיד שמדובר בפנייה חדשה בשלבי בירור ולא בלקוח ותיק).*

🔹 *ברגע שתענה ללקוח ותתחיל את ההתכתבות:*
המערכת תסיר אוטומטית את התגית *[חדש]*, ואיש הקשר יישאר שמור בצורה נקייה ומסודרת:
👉 *שם הבעלים (שם הכלב)*.

לא צריך לשמור ידנית מספרים – הכל קורה אוטומטית ברקע! 🐕✨`;

  const res = await globalThis.fetch(`https://${cluster}.api.greenapi.com/waInstance${idInstance}/sendMessage/${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chatId: shmulikPhone,
      message
    })
  }).then(r => r.json()).catch(e => ({ error: e.message }));

  console.log('Send to Shmulik Result:', res);
}

sendShmulikExplanation();
