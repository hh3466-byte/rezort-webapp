/**
 * One-Click WhatsApp Device Linker for Resort Staff
 * Endpoint: /api/link-device
 */

const GREEN_API_ID = "710722735421";
const GREEN_API_TOKEN = "ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b";

module.exports = async (req, res) => {
  // If JSON request, return current live state & QR
  if (req.query.json === 'true' || req.headers.accept?.includes('application/json')) {
    try {
      const cluster = GREEN_API_ID.slice(0, 4);
      const baseUrl = `https://${cluster}.api.greenapi.com/waInstance${GREEN_API_ID}`;
      
      const [stateRes, qrRes] = await Promise.all([
        fetch(`${baseUrl}/getStateInstance/${GREEN_API_TOKEN}`).then(r => r.json()).catch(() => ({})),
        fetch(`${baseUrl}/qr/${GREEN_API_TOKEN}`).then(r => r.json()).catch(() => ({}))
      ]);

      return res.status(200).json({
        state: stateRes.stateInstance || 'unknown',
        qrBase64: qrRes.message || null,
        qrType: qrRes.type || null
      });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // Fetch initial data for HTML render
  let state = 'notAuthorized';
  let qrBase64 = '';
  try {
    const cluster = GREEN_API_ID.slice(0, 4);
    const baseUrl = `https://${cluster}.api.greenapi.com/waInstance${GREEN_API_ID}`;
    const [stateRes, qrRes] = await Promise.all([
      fetch(`${baseUrl}/getStateInstance/${GREEN_API_TOKEN}`).then(r => r.json()).catch(() => ({})),
      fetch(`${baseUrl}/qr/${GREEN_API_TOKEN}`).then(r => r.json()).catch(() => ({}))
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
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>חיבור וואטסאפ - הריזורט לכלב 🐾</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    body { background: #f0f4f8; color: #1e293b; display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 16px; }
    .card { background: white; border-radius: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.08); width: 100%; max-width: 440px; padding: 28px 24px; text-align: center; }
    .badge { display: inline-block; padding: 6px 16px; border-radius: 999px; font-weight: 700; font-size: 14px; margin-bottom: 16px; }
    .badge-connected { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
    .badge-disconnected { background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; }
    h1 { font-size: 22px; font-weight: 800; color: #0f172a; margin-bottom: 8px; }
    p.sub { font-size: 14px; color: #64748b; margin-bottom: 24px; line-height: 1.5; }
    .qr-container { background: #ffffff; border: 3px solid #e2e8f0; border-radius: 20px; padding: 16px; display: inline-block; margin-bottom: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .qr-img { width: 240px; height: 240px; display: block; border-radius: 12px; margin: 0 auto; }
    .steps { background: #f8fafc; border-radius: 16px; padding: 18px 16px; text-align: right; margin-bottom: 20px; font-size: 14px; color: #334155; line-height: 1.8; border: 1px solid #e2e8f0; }
    .steps ol { padding-right: 20px; }
    .steps li { margin-bottom: 8px; }
    .steps strong { color: #0f172a; }
    .btn-refresh { background: #0284c7; color: white; border: none; border-radius: 12px; padding: 12px 24px; font-weight: 700; font-size: 15px; cursor: pointer; width: 100%; transition: background 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px; }
    .btn-refresh:hover { background: #0369a1; }
    .live-dot { width: 8px; height: 8px; background: #22c55e; border-radius: 50%; display: inline-block; animation: pulse 1.5s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(1.3); } }
  </style>
</head>
<body>
  <div class="card">
    <div id="statusBadge" class="badge ${isConnected ? 'badge-connected' : 'badge-disconnected'}">
      ${isConnected ? '🟢 הוואטסאפ מחובר בהצלחה!' : '🔴 ממתין לסריקת ברקוד'}
    </div>
    
    <h1>חיבור וואטסאפ הריזורט 🐾</h1>
    <p class="sub">מספר הטלפון של הריזורט: <strong>054-8765888</strong></p>

    <div id="connectedView" style="display: ${isConnected ? 'block' : 'none'}; padding: 30px 0;">
      <div style="font-size: 64px; margin-bottom: 16px;">🎉</div>
      <h2 style="color: #16a34a; font-size: 20px; margin-bottom: 8px;">הוואטסאפ מקושר ופעיל!</h2>
      <p style="color: #64748b; font-size: 14px;">כל ההודעות האוטומטיות והדוחות יוצאים כסדרם.</p>
    </div>

    <div id="scanView" style="display: ${isConnected ? 'none' : 'block'};">
      <div class="qr-container">
        <img id="qrImage" class="qr-img" src="${qrBase64 ? 'data:image/png;base64,' + qrBase64 : ''}" alt="QR Code" />
      </div>

      <div class="steps">
        <strong>מה לעשות (בדיוק 10 שניות):</strong>
        <ol>
          <li>פותחים WhatsApp בטלפון <strong>054-8765888</strong></li>
          <li>לוחצים על <strong>3 נקודות</strong> ➔ <strong>מכשירים מקושרים</strong></li>
          <li>לוחצים <strong>"קשר מכשיר"</strong> ומכוונים את המצלמה לברקוד שלמעלה!</li>
        </ol>
      </div>

      <div style="font-size: 12px; color: #94a3b8; margin-bottom: 12px; display: flex; align-items: center; justify-content: center; gap: 6px;">
        <span class="live-dot"></span> מתעדכן אוטומטית בזמן אמת כל 5 שניות
      </div>

      <button class="btn-refresh" onclick="fetchLiveState()">🔄 רענן ברקוד עכשיו</button>
    </div>
  </div>

  <script>
    async function fetchLiveState() {
      try {
        const res = await fetch('/api/link-device?json=true');
        const data = await res.json();
        
        const isAuth = data.state === 'authorized';
        document.getElementById('statusBadge').className = 'badge ' + (isAuth ? 'badge-connected' : 'badge-disconnected');
        document.getElementById('statusBadge').textContent = isAuth ? '🟢 הוואטסאפ מחובר בהצלחה!' : '🔴 ממתין לסריקת ברקוד';

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
      } catch (e) {
        console.warn('Live poll error:', e);
      }
    }

    // Auto-poll every 5 seconds
    setInterval(fetchLiveState, 5000);
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(html);
};
