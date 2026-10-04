const id = '710722735421';
const token = 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';

async function check() {
  const [state, device, wa] = await Promise.all([
    fetch(`https://7107.api.greenapi.com/waInstance${id}/getStateInstance/${token}`).then(r => r.json()).catch(e => ({ error: e.message })),
    fetch(`https://7107.api.greenapi.com/waInstance${id}/getDeviceInfo/${token}`).then(r => r.json()).catch(e => ({ error: e.message })),
    fetch(`https://7107.api.greenapi.com/waInstance${id}/getWaSettings/${token}`).then(r => r.json()).catch(e => ({ error: e.message }))
  ]);
  console.log(JSON.stringify({ state, device, wa }, null, 2));
}

check().catch(console.error);
