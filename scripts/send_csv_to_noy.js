import fs from 'fs';

const GREEN_API_ID = '710722735421';
const GREEN_API_TOKEN = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
const NOY_PHONE = '0528766215';
const NOY_CHAT_ID = '972528766215@c.us';

const STAFF_NUMBERS = [
  '972543200007', '972506336896', '972543180407', '972524467314', '972526109227', '972548765888',
  '0543200007', '0506336896', '0543180407', '0524467314', '0526109227', '0548765888'
];

function formatLocalPhone(intl) {
  if (intl.startsWith('972')) {
    const without972 = intl.slice(3);
    if (without972.startsWith('5')) {
      return '0' + without972.slice(0, 2) + '-' + without972.slice(2);
    }
    return '0' + without972;
  }
  return intl;
}

async function sendCsvToNoy() {
  console.log('1. Fetching all chats from Green-API...');
  const res = await fetch(`https://api.green-api.com/waInstance${GREEN_API_ID}/getChats/${GREEN_API_TOKEN}`);
  const chats = await res.json();

  if (!Array.isArray(chats)) {
    console.error('Failed to load chats:', chats);
    return;
  }

  const customerList = [];
  for (const c of chats) {
    const id = c.id || '';
    if (!id.endsWith('@c.us')) continue;

    const phone = id.replace('@c.us', '');
    if (STAFF_NUMBERS.includes(phone)) continue;

    const name = (c.name || '').trim() || 'ללא שם שמור';
    const localPhone = formatLocalPhone(phone);
    let category = 'נייד ישראלי';
    if (phone.startsWith('972') && !phone.startsWith('9725')) {
      category = 'קווי ישראלי';
    } else if (!phone.startsWith('972')) {
      category = 'בינלאומי';
    }

    customerList.push({
      name,
      localPhone,
      intlPhone: phone,
      chatId: id,
      category,
      unread: c.unreadCount || 0
    });
  }

  console.log(`2. Processed ${customerList.length} individual customer records.`);

  // Build CSV with UTF-8 BOM so Excel opens Hebrew cleanly
  const csvHeaders = ['שם איש קשר / לקוח', 'מספר טלפון', 'טלפון בינלאומי', 'מזהה וואטסאפ', 'סוג מספר', 'הודעות שלא נקראו'];
  const csvRows = [csvHeaders.map(h => `"${h}"`).join(',')];

  for (const item of customerList) {
    const safeName = item.name.replace(/"/g, '""');
    csvRows.push([
      `"${safeName}"`,
      `"${item.localPhone}"`,
      `"${item.intlPhone}"`,
      `"${item.chatId}"`,
      `"${item.category}"`,
      item.unread
    ].join(','));
  }

  const csvContent = '\uFEFF' + csvRows.join('\r\n');
  const fileName = 'רשימת_לקוחות_וואטסאפ_הריזורט_לכלב.csv';
  const filePath = `./${fileName}`;
  fs.writeFileSync(filePath, csvContent, 'utf8');
  console.log(`3. CSV saved locally (${(csvContent.length / 1024).toFixed(1)} KB).`);

  // Prepare Multipart Form Data
  const form = new FormData();
  form.append('chatId', NOY_CHAT_ID);
  form.append('fileName', fileName);
  form.append('caption', `שלום נוי 🐾\nמצורף קובץ CSV עם רשימת כל ${customerList.length.toLocaleString()} מספרי הטלפון של לקוחות הריזורט לכלב שהתכתבו בוואטסאפ.`);

  const fileBlob = new Blob([Buffer.from(csvContent, 'utf8')], { type: 'text/csv; charset=utf-8' });
  form.append('file', fileBlob, fileName);

  console.log(`4. Sending CSV file to Noy at ${NOY_CHAT_ID} (${NOY_PHONE})...`);
  const sendRes = await fetch(`https://api.green-api.com/waInstance${GREEN_API_ID}/sendFileByUpload/${GREEN_API_TOKEN}`, {
    method: 'POST',
    body: form
  });

  const sendData = await sendRes.json();
  console.log('Green-API sendFileByUpload response:', sendRes.status, sendData);

  if (sendRes.ok && sendData.idMessage) {
    console.log(`✅ File sent successfully to Noy! Message ID: ${sendData.idMessage}`);
  } else {
    console.warn('Upload method response:', sendData);
  }
}

sendCsvToNoy().catch(console.error);
