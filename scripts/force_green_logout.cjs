async function logoutGreenApi() {
  const cluster = '7107';
  const idInstance = '710722735421';
  const token = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

  console.log('Logging out Green-API instance from Shmulik...');
  const res = await globalThis.fetch(`https://${cluster}.api.greenapi.com/waInstance${idInstance}/logout/${token}`).then(r => r.json()).catch(e => ({ error: e.message }));
  console.log('Logout result:', res);
}

logoutGreenApi();
