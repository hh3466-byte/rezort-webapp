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

  const logoPath = './public/resort-official-logo.jpg';
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

  const req = https.request(options, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      console.log('Result Status:', res.statusCode);
      console.log('Result Body:', body);
    });
  });
  req.on('error', (e) => console.error(e));
  req.write(payload);
  req.end();
}

run();
