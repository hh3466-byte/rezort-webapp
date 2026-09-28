const https = require('https');
const fs = require('fs');
const path = require('path');

const GREEN_API_ID = '710722735421';
const GREEN_API_TOKEN = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
const GROUP_ID = '120363412850948636@g.us';
const IMAGE_PATH = 'C:\\Users\\hh346\\.gemini\\antigravity-ide\\brain\\2d3d8e46-68c4-420c-82cd-80d9593cbdc7\\resort_community_logo_1790579550307.jpg';

async function setGroupPicture() {
  console.log('Uploading group picture to Green-API for group:', GROUP_ID);
  
  const boundary = '----WebKitFormBoundary' + Math.random().toString(16).slice(2);
  const fileData = fs.readFileSync(IMAGE_PATH);
  
  let header = `--${boundary}\r\n`;
  header += `Content-Disposition: form-data; name="groupId"\r\n\r\n${GROUP_ID}\r\n`;
  header += `--${boundary}\r\n`;
  header += `Content-Disposition: form-data; name="file"; filename="logo.jpg"\r\n`;
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
    path: `/waInstance${GREEN_API_ID}/setGroupPicture/${GREEN_API_TOKEN}`,
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': payload.length
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        console.log(`Response status: ${res.statusCode}`);
        console.log('Response body:', body);
        resolve({ status: res.statusCode, body });
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

setGroupPicture().catch(console.error);
