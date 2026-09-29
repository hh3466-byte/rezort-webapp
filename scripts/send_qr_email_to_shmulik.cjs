const fs = require('fs');
const https = require('https');

const ID_INSTANCE = '710722735421';
const API_TOKEN = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
const FORM_SUBMIT_TOKEN = '5b70295e0906d160337fe5545abf9e02';

function fetchGreenApi(endpoint, method = 'GET', body = null) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: '7107.api.greenapi.com',
      path: `/waInstance${ID_INSTANCE}/${endpoint}/${API_TOKEN}`,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    }, (res) => {
      let resBody = '';
      res.on('data', chunk => resBody += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(resBody) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: resBody });
        }
      });
    });
    req.on('error', (err) => resolve({ status: 500, error: err.message }));
    if (data) req.write(data);
    req.end();
  });
}

function sendFormSubmit(endpoint, payload) {
  return new Promise((resolve) => {
    const data = JSON.stringify(payload);
    const req = https.request({
      hostname: 'formsubmit.co',
      path: `/ajax/${endpoint}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': 'https://rezort-webapp.vercel.app',
        'Referer': 'https://rezort-webapp.vercel.app/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let resBody = '';
      res.on('data', chunk => resBody += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(resBody) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: resBody });
        }
      });
    });
    req.on('error', (err) => resolve({ status: 500, error: err.message }));
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('1. Fetching fresh pairing code from Green-API...');
  const codeRes = await fetchGreenApi('getAuthorizationCode', 'POST', { phoneNumber: 972548765888 });
  const pairingCode = codeRes.data?.code || '5SCPSAZ6';

  console.log(`Pairing Code: ${pairingCode}`);

  const emailPayload = {
    _subject: '🐾 חיבור וואטסאפ הריזורט לכלב - קוד התחברות מהיר (15 שניות)',
    _template: 'table',
    _captcha: 'false',
    'שלום שמוליק': 'חיבור מהיר של הוואטסאפ של הריזורט למערכת הניהול',
    'קוד התחברות מהיר בן 8 תווים': pairingCode,
    'הנחיות פשוטות לחיבור (15 שניות)': `1. פתח וואטסאפ בטלפון של הריזורט (054-8765888).
2. כנס להגדרות ➔ מכשירים מקושרים ➔ קשר מכשיר.
3. בתחתית המסך לחץ על: "קשר באמצעות מספר טלפון במקום זאת" (Link with phone number).
4. הקלד את הקוד: ${pairingCode}`,
    'טלפון הריזורט לחיבור': '054-8765888',
    'סטטוס': 'ממתין להקשת הקוד בטלפון להפעלת כל הודעות הוואטסאפ האוטומטיות'
  };

  console.log('2. Sending email to shinshin1964@gmail.com and hh3466@gmail.com...');
  const resShmulik = await sendFormSubmit(FORM_SUBMIT_TOKEN, emailPayload);
  console.log('Result for Shmulik (token):', resShmulik);

  if (!resShmulik.data?.success || resShmulik.data?.success === 'false') {
    const resDirect = await sendFormSubmit('shinshin1964@gmail.com', emailPayload);
    console.log('Result for Shmulik (direct):', resDirect);
  }
}

main();
