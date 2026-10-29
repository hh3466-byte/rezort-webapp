const https = require('https');

const GREEN_API_ID = '710722735421';
const GREEN_API_TOKEN = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
const MARKETING_GROUP_ID = '120363409177098951@g.us';

const clarificationMessage = `דיוק וחידוד חשוב לצוות השיווק (רז ושירן) 🐾
אנא הסירו כל אזכור של ספא / מקלחת / רחצה / חפיפה מכלל התכנים, הפוסטים והקמפיינים!
בריזורט מתמקדים אך ורק במה שקיים בפועל ונותן חוויה מעולה לכלבים:
מרחבי דשא ענקיים, בריכות שכשוך ומשחקי מים, פעילות חברתית מבוקרת, אילוף מקצועי ופינוקי גורמה.

כל שאר ההטבות שצוינו ברשימה (100 ₪ הנחה, יום כיף VIP מתנה, צ'ק-אאוט מוצ"ש ללא עלות, שיחת ייעוץ 1-על-1 עם שמוליק, בוק צילומים, Brain Games, כרטיסיות יומיות ובנק 21 יממות) – פעילות, מוטמעות ומאושרות ב-100%!

שמוליק וצוות הריזורט לכלב 🐾`;

function sendMessage() {
  const postData = JSON.stringify({
    chatId: MARKETING_GROUP_ID,
    message: clarificationMessage
  });

  const req = https.request({
    hostname: '7107.api.greenapi.com',
    port: 443,
    path: `/waInstance${GREEN_API_ID}/sendMessage/${GREEN_API_TOKEN}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  }, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      console.log('Response status:', res.statusCode);
      console.log('Response body:', body);
    });
  });

  req.on('error', (e) => {
    console.error('Request error:', e);
  });

  req.write(postData);
  req.end();
}

sendMessage();
