export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  const cluster = '7107';
  const idInstance = '710722735421';
  const token = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

  // Handle Logout Action
  if (req.url && (req.url.includes('action=logout') || req.url.includes('logout=true'))) {
    try {
      const logoutRes = await fetch(`https://${cluster}.api.greenapi.com/waInstance${idInstance}/logout/${token}`, {
        method: 'GET'
      }).then(r => r.json()).catch(() => ({}));
      
      if (req.url.includes('json=true')) {
        res.setHeader('Content-Type', 'application/json');
        return res.status(200).json({ success: true, logoutRes });
      }
      return res.redirect('/api/link-device');
    } catch (e) {
      if (req.url.includes('json=true')) {
        res.setHeader('Content-Type', 'application/json');
        return res.status(500).json({ error: e.message });
      }
    }
  }

  // If JSON request
  if (req.url && req.url.includes('json=true')) {
    res.setHeader('Content-Type', 'application/json');
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const stateRes = await fetch(`https://${cluster}.api.greenapi.com/waInstance${idInstance}/getStateInstance/${token}`, { signal: controller.signal })
        .then(r => r.json())
        .catch(() => ({}));

      let connectedPhone = null;
      let isResortPhone = false;

      if (stateRes && stateRes.stateInstance === 'authorized') {
        const waSettings = await fetch(`https://${cluster}.api.greenapi.com/waInstance${idInstance}/getWaSettings/${token}`, { signal: controller.signal })
          .then(r => r.json())
          .catch(() => ({}));
        clearTimeout(timeout);
        connectedPhone = waSettings.phone || (waSettings.wid ? waSettings.wid.replace('@c.us', '') : null);
        isResortPhone = connectedPhone ? connectedPhone.includes('548765888') : false;

        // STRICT GUARD: If someone connected with Shmulik's phone or any other phone that is NOT 054-8765888, FORCIBLY LOGOUT IMMEDIATELY!
        if (!isResortPhone) {
          console.warn(`Unauthorized phone ${connectedPhone} detected! Executing immediate forced logout.`);
          await fetch(`https://${cluster}.api.greenapi.com/waInstance${idInstance}/logout/${token}`).catch(() => ({}));
          
          const qrRes = await fetch(`https://${cluster}.api.greenapi.com/waInstance${idInstance}/qr/${token}`).then(r => r.json()).catch(() => ({}));
          return res.status(200).json({
            state: 'notAuthorized',
            connectedPhone: null,
            isResortPhone: false,
            blockedPhone: connectedPhone,
            error: 'חיבור ממספר פרטי נחסם! מותר לחבר אך ורק את טלפון הריזורט (054-8765888)',
            qrBase64: qrRes.message || null,
            qrType: qrRes.type || null
          });
        }

        return res.status(200).json({
          state: 'authorized',
          connectedPhone,
          isResortPhone: true,
          qrBase64: null,
          qrType: null
        });
      }

      // If not authorized, fetch QR code
      const qrRes = await fetch(`https://${cluster}.api.greenapi.com/waInstance${idInstance}/qr/${token}`, { signal: controller.signal })
        .then(r => r.json())
        .catch(() => ({}));
      clearTimeout(timeout);

      return res.status(200).json({
        state: stateRes.stateInstance || 'notAuthorized',
        connectedPhone: null,
        isResortPhone: false,
        qrBase64: qrRes.message || null,
        qrType: qrRes.type || null
      });
    } catch (e) {
      return res.status(200).json({ state: 'unknown', qrBase64: null });
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
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 28px; box-shadow: 0 20px 50px rgba(0,0,0,0.5); width: 100%; max-width: 440px; padding: 28px 20px; text-align: center; }
    .badge { display: inline-flex; align-items: center; gap: 8px; padding: 8px 18px; border-radius: 999px; font-weight: 700; font-size: 15px; margin-bottom: 20px; }
    .badge-connected { background: rgba(34, 197, 94, 0.2); color: #4ade80; border: 1px solid #22c55e; }
    .badge-warning { background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid #f59e0b; }
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
    .btn-logout { background: #ef4444; color: #ffffff; border: none; padding: 12px 20px; border-radius: 14px; font-weight: 700; font-size: 14px; cursor: pointer; transition: 0.2s; display: inline-flex; align-items: center; gap: 8px; margin-top: 15px; text-decoration: none; }
    .btn-logout:hover { background: #dc2626; transform: scale(1.02); }
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
    <p class="sub">טלפון הריזורט הרשמי בלבד: <strong style="color:#ffffff;">054-8765888</strong></p>

    <div id="connectedView" style="display: none; padding: 25px 0;">
      <div style="font-size: 56px; margin-bottom: 12px;" id="connectedEmoji">🎉</div>
      <h2 id="connectedTitle" style="color: #4ade80; font-size: 20px; margin-bottom: 8px;">וואטסאפ הריזורט מקושר ופעיל!</h2>
      <p id="connectedDesc" style="color: #cbd5e1; font-size: 14px; margin-bottom: 20px;">כל ההודעות האוטומטיות והדוחות יוצאים כסדרם ממספר 054-8765888.</p>
      
      <button onclick="logoutDevice()" class="btn-logout">
        <span>🔄 נתק מכשיר זה וסרוק מחדש את 054-8765888</span>
      </button>
    </div>

    <div id="scanView" style="display: block;">
      <div class="qr-box">
        <div id="loadingSpinner" class="spinner"></div>
        <img id="qrImage" class="qr-img" style="display:none;" alt="QR Code" />
      </div>

      <div class="steps">
        <strong>מה עושים ב-10 שניות:</strong>
        <ol>
          <li>פותחים WhatsApp בטלפון הריזורט <strong>054-8765888</strong> בלבד</li>
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
    async function logoutDevice() {
      if (!confirm('האם ברצונך לנתק את המכשיר ולפתוח סריקת ברקוד חדשה לטלפון הריזורט (054-8765888)?')) return;
      document.getElementById('badgeText').textContent = 'מנתק מכשיר...';
      try {
        await fetch('/api/link-device?action=logout&json=true');
        setTimeout(checkStatus, 1500);
      } catch (e) {
        alert('שגיאה בניתוק המכשיר: ' + e.message);
      }
    }

    async function checkStatus() {
      try {
        const res = await fetch('/api/link-device?json=true');
        const data = await res.json();
        const isAuth = data.state === 'authorized';
        
        const badge = document.getElementById('statusBadge');
        const badgeText = document.getElementById('badgeText');
        const pulseDot = document.getElementById('pulseDot');

        if (isAuth && data.isResortPhone) {
          badge.className = 'badge badge-connected';
          badgeText.textContent = 'מחובר לטלפון הריזורט (054-8765888) ✅';
          pulseDot.style.background = '#22c55e';
          document.getElementById('connectedEmoji').textContent = '🎉';
          document.getElementById('connectedTitle').textContent = 'וואטסאפ הריזורט מקושר ופעיל!';
          document.getElementById('connectedTitle').style.color = '#4ade80';

          document.getElementById('scanView').style.display = 'none';
          document.getElementById('connectedView').style.display = 'block';
        } else {
          badge.className = 'badge badge-disconnected';
          badgeText.textContent = 'ממתין לסריקת ברקוד ל-054-8765888';
          pulseDot.style.background = '#ef4444';
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
