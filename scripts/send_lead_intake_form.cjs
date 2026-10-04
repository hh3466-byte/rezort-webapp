const fs = require('fs');

const GREEN_API_ID = '710722735421';
const GREEN_API_TOKEN = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

const targetPhone = '052-610-9227';
const cleanPhone = '972526109227';
const chatId = `${cleanPhone}@c.us`;
const intakeUrl = `https://rezort-webapp.vercel.app/?request=true&phone=0526109227`;

const messageText = `שלום ותודה שפניתם לריזורט לכלב! 🐾🐶
כדי שנוכל לבדוק זמינות, להתאים את השירות המדויק לכלבכם ולחסוך לכם זמן יקר, אנא מלאו שאלון קליטה קצר (דקה אחת בלבד):
👉 ${intakeUrl}

⏰ *שימו לב:* אנחנו נמצאים כרגע במתחם ומטפלים במסירות בכלבים, ולא נשכח אתכם! 🐾
מיד שנתפנה נעבור על פרטי השאלון ונחזור אליכם לשיחה בנוגע לתשובות לתיאום סופי. 🐕🤍`;

async function sendIntake() {
  console.log(`Sending intake questionnaire to ${chatId} (${targetPhone})...`);
  
  const sendUrl = `https://api.green-api.com/waInstance${GREEN_API_ID}/sendMessage/${GREEN_API_TOKEN}`;
  const response = await fetch(sendUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chatId: chatId,
      message: messageText
    })
  });

  const result = await response.json();
  console.log('Green API Response:', response.status, result);

  if (response.ok && result.idMessage) {
    console.log(`✅ Intake form sent successfully! Message ID: ${result.idMessage}`);
  } else {
    console.error('❌ Failed to send intake form:', result);
  }
}

sendIntake().catch(err => console.error('Error:', err));
