async function updateContactNameToHagai() {
  const cluster = '7107';
  const idInstance = '710722735421';
  const token = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

  const chatId = '972543200007@c.us';

  console.log('Updating contact for', chatId, 'to חגי הילמן');
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

  console.log('Result:', res);
}

updateContactNameToHagai();
