const fs = require('fs');

const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || '').trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    env[match[1]] = val;
  }
});

const GREEN_API_ID = env.VITE_GREEN_API_ID || '710722735421';
const GREEN_API_TOKEN = env.VITE_GREEN_API_TOKEN || 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

const messageText = `היי שמוליק יקר! 🐾
הנה נוסח ההודעה המעודכן (ללא "בשיטות חיוביות") לשליחה ללקוחות מתעניינים / שיחות שלא נענו:

━━━━━━━━━━━━━━━━━━━━
היי! 🐾
ניסינו לתפוס אתכם בטלפון בהמשך לפנייתכם ל"ריזורט לכלב" 🐕🤍

רצינו לשתף אתכם בכמה מילים על החוויה המיוחדת ועל מה שאנחנו עושים אצלנו בריזורט:

🏡 **פנסיון בוטיק בתנאי VIP:**
• סוויטות שינה אישיות, מרווחות ומאווררות – ללא כלובים!
• מדשאות ענק ירוקות, מוצלות ומאובטחות למשחקים חופשיים ולהוצאת אנרגיה
• טיולי טבע יומיים מודרכים באוויר הפתוח
• השגחה צמודה, יחס אישי חם והמון אהבה מסביב לשעון
• עדכון יומי בוואטסאפ על ההתאקלמות והשגרה – כדי שתוכלו לבלות בראש שקט ב-100%!
• התאמה מלאה לאופי הכלב (קבוצות משחק חברתיות / אגף שקט 1-על-1)

🎓 **אילוף מקצועי וחינוך משמעת בהובלת שמוליק:**
• שילוב אילוף במהלך השהות בפנסיון (Board & Train) או בתהליכים ממוקדים
• עבודה על פקודות משמעת, הליכה רגועה ברצועה וגבולות
• חינוך גורים ופתרון בעיות התנהגות מורכבות
• הדרכה מעשית לבעלים בסיום התהליך להצלחה מובטחת גם בבית!

🌟 **מוזמנים להתרשם מהעמודים שלנו ומהביקורות החמות של האורחים:**
📘 פייסבוק: https://www.facebook.com/profile.php?id=61576998315714&sk=reviews
📷 אינסטגרם: https://www.instagram.com/dogz.resort/

נשמח לדבר כשתהיו פנויים ולתת לכם את המענה הטוב ביותר! 🐶❤️
שמוליק וצוות הריזורט לכלב
━━━━━━━━━━━━━━━━━━━━`;

async function sendToShmulik() {
  const targetPhone = '0506336896';
  const cleanPhone = '972' + targetPhone.replace(/^0+/, '');
  const chatId = `${cleanPhone}@c.us`;

  console.log(`Sending updated template to Shmulik at ${chatId}...`);
  const url = `https://api.green-api.com/waInstance${GREEN_API_ID}/sendMessage/${GREEN_API_TOKEN}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, message: messageText })
  });

  const data = await res.json();
  console.log('Response:', data);
  if (data.idMessage) {
    console.log('✓ Successfully sent updated template to Shmulik! Message ID:', data.idMessage);
  } else {
    console.error('✗ Failed to send:', data);
  }
}

sendToShmulik().catch(console.error);
