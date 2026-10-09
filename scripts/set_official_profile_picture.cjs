const https = require('https');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
});

async function run() {
  const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY);
  const { data: sRows } = await supabase.from('settings').select('*');
  const settings = sRows?.[0]?.data || {};

  const greenId = settings.greenApiIdInstance;
  const greenToken = settings.greenApiToken;

  console.log('Using Green-API ID:', greenId);

  // 1. First get current avatar
  const getAvatarRes = await fetch(`https://api.green-api.com/waInstance${greenId}/getAvatar/${greenToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: '972548765888@c.us' })
  });
  const avatarData = await getAvatarRes.json();
  console.log('Current Avatar Data for 972548765888@c.us:', avatarData);

  // Also check instance info
  const getInstRes = await fetch(`https://api.green-api.com/waInstance${greenId}/getSettings/${greenToken}`);
  console.log('Instance Settings status:', getInstRes.status);

  // 2. Upload official logo to setProfilePicture
  const logoPath = './public/resort-official-logo.jpg';
  if (!fs.existsSync(logoPath)) {
    console.error('Logo file not found!');
    return;
  }

  const boundary = '----WebKitFormBoundary' + Math.random().toString(16).slice(2);
  const fileData = fs.readFileSync(logoPath);

  let header = `--${boundary}\r\n`;
  header += `Content-Disposition: form-data; name="file"; filename="resort-official-logo.jpg"\r\n`;
  header += `Content-Type: image/jpeg\r\n\r\n`;

  const footer = `\r\n--${boundary}--\r\n`;

  const payload = Buffer.concat([
    Buffer.from(header, 'utf8'),
    fileData,
    Buffer.from(footer, 'utf8')
  ]);

  const options = {
    hostname: 'api.green-api.com',
    port: 443,
    path: `/waInstance${greenId}/setProfilePicture/${greenToken}`,
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': payload.length
    }
  };

  const uploadResult = await new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        console.log(`setProfilePicture HTTP status: ${res.statusCode}`);
        console.log('setProfilePicture Response body:', body);
        resolve({ status: res.statusCode, body });
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });

  // Also verify after 2 seconds
  setTimeout(async () => {
    const afterRes = await fetch(`https://api.green-api.com/waInstance${greenId}/getAvatar/${greenToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: '972548765888@c.us' })
    });
    const afterData = await afterRes.json();
    console.log('After update Avatar Data:', afterData);
  }, 2000);
}

run().catch(console.error);
