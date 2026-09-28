const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || '').trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[match[1]] = val;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const SHMULIK_PHONE = '0506336896';
const SHMULIK_CHAT_ID = '972506336896@c.us';
const MANAGER_PHONE = '0543200007';

function formatShmulikQuestionMessage(q) {
  const lines = [
    `🐾 *מערכת ניהול הריזורט שואלת אותך:*`,
    '',
    `${q.questionText}`,
    ''
  ];

  if (q.type === 'yes_no') {
    lines.push(`1️⃣ כן`);
    lines.push(`2️⃣ לא`);
    lines.push('');
    lines.push(`*(השב 1 או 2, או "כן" / "לא")*`);
  } else if (q.type === 'options' && q.options && q.options.length > 0) {
    q.options.forEach((opt, idx) => {
      lines.push(`${idx + 1}️⃣ ${opt}`);
    });
    lines.push('');
    lines.push(`*(השב את מספר האפשרות או את התשובה)*`);
  } else {
    lines.push(`ענה בשפה חופשית את התשובה.`);
  }

  return lines.join('\n');
}

async function askQuestion(questionData) {
  const { data: rows } = await supabase.from('settings').select('*').limit(1);
  const sRow = rows?.[0] || {};
  const settings = { ...sRow, ...(sRow.data || {}) };
  const greenId = settings.greenApiIdInstance;
  const greenToken = settings.greenApiToken;

  if (!greenId || !greenToken) {
    console.error('Missing Green-API settings');
    return;
  }

  const questionId = `sq-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const fullQuestion = {
    ...questionData,
    id: questionId,
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  const text = formatShmulikQuestionMessage(fullQuestion);
  console.log(`Sending question to Shmulik:\n${text}\n`);

  const res = await fetch(`https://api.green-api.com/waInstance${greenId}/sendMessage/${greenToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: SHMULIK_CHAT_ID, message: text })
  });
  const resData = await res.json();
  console.log('Send result:', resData);

  // Persist question state in Supabase
  const curData = sRow.data || {};
  const pending = Array.isArray(curData.shmulikPendingQuestions) ? curData.shmulikPendingQuestions : [];
  pending.push(fullQuestion);

  await supabase.from('settings').update({
    data: {
      ...curData,
      shmulikPendingQuestions: pending,
      lastShmulikQuestionSent: fullQuestion
    },
    updated_at: new Date().toISOString()
  }).eq('id', sRow.id || 'resort_config');

  console.log('Question state saved in Supabase.');
}

module.exports = {
  formatShmulikQuestionMessage,
  askQuestion
};
