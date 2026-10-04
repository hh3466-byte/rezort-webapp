async function check() {
  const cluster = '7107';
  const idInstance = '710722735421';
  const token = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
  
  const state = await globalThis.fetch(`https://${cluster}.api.greenapi.com/waInstance${idInstance}/getStateInstance/${token}`).then(r => r.json()).catch(e => e);
  console.log('State:', state);
  
  const settings = await globalThis.fetch(`https://${cluster}.api.greenapi.com/waInstance${idInstance}/getSettings/${token}`).then(r => r.json()).catch(e => e);
  console.log('Settings:', settings);
  
  const waSettings = await globalThis.fetch(`https://${cluster}.api.greenapi.com/waInstance${idInstance}/getWaSettings/${token}`).then(r => r.json()).catch(e => e);
  console.log('WaSettings:', waSettings);
}
check();
