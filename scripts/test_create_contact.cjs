async function testEditContact() {
  const cluster = '7107';
  const idInstance = '710722735421';
  const token = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

  const phone = '0543200007'; // Manager test
  const clean = phone.replace(/\D/g, '');
  const intl = clean.startsWith('972') ? clean : '972' + (clean.startsWith('0') ? clean.slice(1) : clean);
  const chatId = `${intl}@c.us`;

  console.log('Testing editContact for', chatId);
  const res = await globalThis.fetch(`https://${cluster}.api.greenapi.com/waInstance${idInstance}/editContact/${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chatId,
      firstName: 'חגי',
      lastName: 'הילמן',
      saveInAddressbook: true
    })
  }).then(async r => ({ status: r.status, body: await r.text() })).catch(e => ({ error: e.message }));

  console.log('editContact result:', res);
}

testEditContact();
