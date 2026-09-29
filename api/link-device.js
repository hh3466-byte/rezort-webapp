const https = require('https');

const GREEN_API_ID = "710722735421";
const GREEN_API_TOKEN = "ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b";

function fetchFromGreenApi(endpoint) {
  return new Promise((resolve) => {
    const cluster = GREEN_API_ID.slice(0, 4);
    const options = {
      hostname: `${cluster}.api.greenapi.com`,
      path: `/waInstance${GREEN_API_ID}/${endpoint}/${GREEN_API_TOKEN}`,
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      timeout: 8000
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve({ raw: data }); }
      });
    });
    req.on('error', () => resolve({}));
    req.on('timeout', () => { req.destroy(); resolve({}); });
    req.end();
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  // 1. JSON endpoint for live polling
  if (req.url.includes('json=true')) {
    try {
      const [stateRes, qrRes] = await Promise.all([
        fetchFromGreenApi('getStateInstance'),
        fetchFromGreenApi('qr')
      ]);
      return res.status(200).json({
        state: stateRes.stateInstance || 'notAuthorized',
        qrBase64: qrRes.message || null,
        qrType: qrRes.type || null
      });
    } catch (e) {
      return res.status(200).json({ state: 'notAuthorized', qrBase64: null });
    }
  }

  // 2. Fetch initial state for HTML render
  let state = 'notAuthorized';
  let qrBase64 = '';
  try {
    const [stateRes, qrRes] = await Promise.all([
      fetchFromGreenApi('getStateInstance'),
      fetchFromGreenApi('qr')
    ]);
    state = stateRes.stateInstance || 'notAuthorized';
    if (qrRes.type === 'qrCode') {
      qrBase64 = qrRes.message;
    }
  } catch (e) {}

  const isConnected = state === 'authorized';

  const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>חיבור וואטסאפ - הריזורט לכלב 🐾</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    body { background: #0f172a; color: #f8fafc; display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 16px; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 28px; box-shadow: 0 20px 50px rgba(0,0,0,0.5); width: 100%; max-width: 420px; padding: 28px 20px; text-align: center; }
    .badge { display: inline-flex; align-items: center; gap: 8px; padding: 8px 18px; border-radius: 999px; font-weight: 700; font-size: 15px; margin-bottom: 20px; }
    .badge-connected { background: rgba(34, 197, 94, 0.2); color: #4ade80; border: 1px solid #22c55e; }
    .badge-disconnected { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid #ef4444; }
    h1 { font-size: 22px; font-weight: 800; color: #ffffff; margin-bottom: 6px; }
    p.sub { font-size: 14px; color: #94a3b8; margin-bottom: 20px; }
    .qr-box { background: #ffffff; border-radius: 20px; padding: 14px; display: inline-block; margin-bottom: 20px; box-shadow: 0 8px 25px rgba(0,0,0,0.4); }
    .qr-img { width: 220px; height: 220px; display: block; border-radius: 10px; margin: 0 auto; }
    .steps { background: #0f172a; border-radius: 18px; padding: 16px 14px; text-align: right; margin-bottom: 18px; font-size: 14px; color: #cbd5e1; line-height: 1.8; border: 1px solid #334155; }
    .steps ol { padding-right: 20px; }
    .steps li { margin-bottom: 6px; }
    .steps strong { color: #38bdf8; font-weight: 700; }
    .pulse-dot { width: 10px; height: 10px; background: #22c55e; border-radius: 50%; display: inline-block; animation: pulse 1.5s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.3; transform: scale(1.4); } }
  </style>
</head>
<body>
  <div class="card">
    <div id="statusBadge" class="badge ${isConnected ? 'badge-connected' : 'badge-disconnected'}">
      <span class="pulse-dot" style="background: ${isConnected ? '#22c55e' : '#ef4444'};"></span>
      <span id="badgeText">${isConnected ? 'הוואטסאפ מחובר בהצלחה!' : 'ממתין לסריקת ברקוד'}</span>
    </div>
    
    <h1>חיבור וואטסאפ הריזורט 🐾</h1>
    <p class="sub">טלפון הריזורט: <strong style="color:#ffffff;">054-8765888</strong></p>

    <div id="connectedView" style="display: ${isConnected ? 'block' : 'none'}; padding: 40px 0;">
      <div style="font-size: 72px; margin-bottom: 16px;">🎉</div>
      <h2 style="color: #4ade80; font-size: 22px; margin-bottom: 8px;">הוואטסאפ מקושר ופעיל!</h2>
      <p style="color: #94a3b8; font-size: 14px;">כל ההודעות האוטומטיות והדוחות יוצאים כסדרם.</p>
    </div>

    <div id="scanView" style="display: ${isConnected ? 'none' : 'block'};">
      <div class="qr-box">
        <img id="qrImage" class="qr-img" src="${qrBase64 ? 'data:image/png;base64,' + qrBase64 : ''}" alt="QR Code" />
      </div>

      <div class="steps">
        <strong>מה עושים ב-10 שניות:</strong>
        <ol>
          <li>פותחים WhatsApp בטלפון <strong>054-8765888</strong></li>
          <li>לוחצים על <strong>3 נקודות</strong> ➔ <strong>מכשירים מקושרים</strong></li>
          <li>לוחצים <strong>"קשר מכשיר"</strong> ומכוונים את המצלמה לברקוד שלמעלה!</li>
        </ol>
      </div>

      <div style="font-size: 12px; color: #64748b;">
        🔄 הברקוד מתעדכן אוטומטית ברקע בזמן אמת
      </div>
    </div>
  </div>

  <script>
    async function checkStatus() {
      try {
        const res = await fetch('/api/link-device?json=true');
        const data = await res.json();
        const isAuth = data.state === 'authorized';
        
        const badge = document.getElementById('statusBadge');
        const badgeText = document.getElementById('badgeText');
        badge.className = 'badge ' + (isAuth ? 'badge-connected' : 'badge-disconnected');
        badgeText.textContent = isAuth ? 'הוואטסאפ מחובר בהצלחה!' : 'ממתין לסריקת ברקוד';

        if (isAuth) {
          document.getElementById('scanView').style.display = 'none';
          document.getElementById('connectedView').style.display = 'block';
        } else {
          document.getElementById('scanView').style.display = 'block';
          document.getElementById('connectedView').style.display = 'none';
          if (data.qrBase64) {
            document.getElementById('qrImage').src = 'data:image/png;base64,' + data.qrBase64;
          }
        }
      } catch (e) {}
    }
    setInterval(checkStatus, 4000);
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(html);
};
