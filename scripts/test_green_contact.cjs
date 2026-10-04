async function testAddContact() {
  const cluster = '7107';
  const idInstance = '710722735421';
  const token = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

  // Test checking contact info for manager or dummy
  const res = await globalThis.fetch(`https://${cluster}.api.greenapi.com/waInstance${idInstance}/getContactInfo/${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId: '972543200007@c.us' })
  }).then(r => r.json()).catch(e => e);

  console.log('ContactInfo Result:', res);
}

testAddContact();
