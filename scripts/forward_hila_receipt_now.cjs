const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

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

async function inspectAndForwardReceipt() {
  const { data: settingsRows } = await supabase.from('settings').select('*').limit(1);
  const sRow = settingsRows?.[0] || {};
  const settings = { ...sRow, ...(sRow.data || {}) };
  const greenId = settings.greenApiIdInstance;
  const greenToken = settings.greenApiToken;
  const receipts = settings.trainerReceipts || [];

  console.log('Total trainer receipts:', receipts.length);
  console.log('Latest receipt:', receipts[0]);

  const latest = receipts[0];
  if (latest && latest.receiptImageUrl) {
    const MANAGER_CHAT_ID = '972543200007@c.us';
    console.log(`Forwarding receipt image to Manager (${MANAGER_CHAT_ID}): ${latest.receiptImageUrl}`);
    
    const sendFileUrl = `https://api.green-api.com/waInstance${greenId}/sendFileByUrl/${greenToken}`;
    const caption = `📄 *תמונת קבלה מהילה המאלפת (Halodog)*\nסכום: ₪${latest.totalAmount || 1000} | תאריך: ${latest.receiptDate}\n\nנא לאשר האם שולם בפועל בביט כדי שאתייק ואסגור.`;
    
    const fileRes = await fetch(sendFileUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId: MANAGER_CHAT_ID,
        urlFile: latest.receiptImageUrl,
        fileName: 'receipt_hila.jpg',
        caption: caption
      })
    });
    
    const resData = await fileRes.json();
    console.log('Send file response:', resData);
  } else {
    console.log('No receipt image URL found or no receipts.');
  }
}

inspectAndForwardReceipt();
