const https = require('https');

const GREEN_API_ID = '710722735421';
const GREEN_API_TOKEN = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

function callGreenApi(endpoint, data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data || {});
    const options = {
      hostname: 'api.green-api.com',
      port: 443,
      path: `/waInstance${GREEN_API_ID}/${endpoint}/${GREEN_API_TOKEN}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function main() {
  console.log('--- 1. Creating WhatsApp Group "הריזורט לכלב" ---');
  const groupName = 'הריזורט לכלב';
  const razPhone = '972543180407@c.us';
  const managerPhone = '972543200007@c.us';

  const createRes = await callGreenApi('createGroup', {
    groupName: groupName,
    chatIds: [razPhone, managerPhone]
  });

  console.log('Create Group Result:', JSON.stringify(createRes, null, 2));

  if (!createRes.data || !createRes.data.chatId) {
    console.error('Failed to create group or no chatId returned.');
    return;
  }

  const groupId = createRes.data.chatId;
  console.log(`\nGroup created successfully! Group ID: ${groupId}`);

  // 2. Set Raz as Admin
  console.log('\n--- 2. Setting Raz as Admin ---');
  const adminRazRes = await callGreenApi('setGroupAdmin', {
    groupId: groupId,
    participantChatId: razPhone
  });
  console.log('Set Admin Raz Result:', JSON.stringify(adminRazRes, null, 2));

  // 3. Set Manager as Admin
  console.log('\n--- 3. Setting Manager as Admin ---');
  const adminMgrRes = await callGreenApi('setGroupAdmin', {
    groupId: groupId,
    participantChatId: managerPhone
  });
  console.log('Set Admin Manager Result:', JSON.stringify(adminMgrRes, null, 2));

  // 4. Get Group Invite Link
  console.log('\n--- 4. Getting Group Invite Link ---');
  const linkRes = await callGreenApi('getGroupInviteLink', {
    groupId: groupId
  });
  console.log('Invite Link Result:', JSON.stringify(linkRes, null, 2));

  // 5. Get Group Info
  console.log('\n--- 5. Getting Group Data ---');
  const dataRes = await callGreenApi('getGroupData', {
    groupId: groupId
  });
  console.log('Group Data:', JSON.stringify(dataRes, null, 2));
}

main().catch(console.error);
