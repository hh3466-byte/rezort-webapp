export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  // If JSON request
  if (req.url && req.url.includes('json=true')) {
    res.setHeader('Content-Type', 'application/json');
    try {
      const cluster = '7107';
      const idInstance = '710722735421';
      const token = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);

      const [stateRes, qrRes] = await Promise.all([
        fetch(`https://${cluster}.api.greenapi.com/waInstance${idInstance}/getStateInstance/${token}`, { signal: controller.signal }).then(r => r.json()).catch(() => ({})),
        fetch(`https://${cluster}.api.greenapi.com/waInstance${idInstance}/qr/${token}`, { signal: controller.signal }).then(r => r.json()).catch(() => ({}))
      ]);
      clearTimeout(timeout);

      return res.status(200).json({
        state: stateRes.stateInstance || 'notAuthorized',
        qrBase64: qrRes.message || null,
        qrType: qrRes.type || null
      });
    } catch (e) {
      return res.status(200).json({ state: 'notAuthorized', qrBase64: null });
    }
  }

  // Serve fast HTML
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
    .qr-box { background: #ffffff; border-radius: 20px; padding: 14px; display: inline-block; margin-bottom: 20px; box-shadow: 0 8px 25px rgba(0,0,0,0.4); min-width: 240px; min-height: 240px; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px auto; }
    .qr-img { width: 220px; height: 220px; display: block; border-radius: 10px; }
    .steps { background: #0f172a; border-radius: 18px; padding: 16px 14px; text-align: right; margin-bottom: 18px; font-size: 14px; color: #cbd5e1; line-height: 1.8; border: 1px solid #334155; }
    .steps ol { padding-right: 20px; }
    .steps li { margin-bottom: 6px; }
    .steps strong { color: #38bdf8; font-weight: 700; }
    .pulse-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
    .spinner { border: 3px solid rgba(255,255,255,0.1); border-top: 3px solid #38bdf8; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="card">
    <div id="statusBadge" class="badge badge-disconnected">
      <span id="pulseDot" class="pulse-dot" style="background: #ef4444;"></span>
      <span id="badgeText">טוען נתוני חיבור...</span>
    </div>
    
    <h1>חיבור וואטסאפ הריזורט 🐾</h1>
    <p class="sub">טלפון הריזורט: <strong style="color:#ffffff;">054-8765888</strong></p>

    <div id="connectedView" style="display: none; padding: 40px 0;">
      <div style="font-size: 72px; margin-bottom: 16px;">🎉</div>
      <h2 style="color: #4ade80; font-size: 22px; margin-bottom: 8px;">הוואטסאפ מקושר ופעיל!</h2>
      <p style="color: #94a3b8; font-size: 14px;">כל ההודעות האוטומטיות והדוחות יוצאים כסדרם.</p>
    </div>

    <div id="scanView" style="display: block;">
      <div class="qr-box">
        <div id="loadingSpinner" class="spinner"></div>
        <img id="qrImage" class="qr-img" style="display:none;" alt="QR Code" />
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
        const pulseDot = document.getElementById('pulseDot');

        badge.className = 'badge ' + (isAuth ? 'badge-connected' : 'badge-disconnected');
        badgeText.textContent = isAuth ? 'הוואטסאפ מחובר בהצלחה!' : 'ממתין לסריקת ברקוד';
        pulseDot.style.background = isAuth ? '#22c55e' : '#ef4444';

        if (isAuth) {
          document.getElementById('scanView').style.display = 'none';
          document.getElementById('connectedView').style.display = 'block';
        } else {
          document.getElementById('scanView').style.display = 'block';
          document.getElementById('connectedView').style.display = 'none';
          if (data.qrBase64) {
            const qrImg = document.getElementById('qrImage');
            qrImg.src = 'data:image/png;base64,' + data.qrBase64;
            qrImg.style.display = 'block';
            document.getElementById('loadingSpinner').style.display = 'none';
          }
        }
      } catch (e) {}
    }
    checkStatus();
    setInterval(checkStatus, 3500);
  </script>
</body>
</html>`;

  return res.status(200).send(html);
}
