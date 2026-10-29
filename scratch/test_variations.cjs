const fetch = globalThis.fetch || require('node-fetch');

const KEY = '18c14598-0f77-45d9-a6b2-7aa04f0289e2';

// Let's test combinations of possible ambiguous characters in the secret:
// vxi.^|CnHhU1fcz,>a8M[Q/O/0][G/6]U<2$[I/l/1][?][2][5][-]
const secrets = [
  'vxi.^|CnHhU1fcz,>a8MQOGU<2$I?25-',
  'vxi.^|CnHhU1fcz,>a8MQ0GU<2$I?25-',
  'vxi.^|CnHhU1fcz,>a8MQOGU<2$l?25-',
  'vxi.^|CnHhU1fcz,>a8MQ0GU<2$l?25-',
  'vxi.^|CnHhU1fcz,>a8MQOGU<2$1?25-',
  'vxi.^|CnHhU1fcz,>a8MQOGU<2$I!25-',
  'vxi.^|CnHhU1fcz,>a8MQ0GU<2$I!25-'
];

async function trySecrets() {
  for (const s of secrets) {
    try {
      const res = await fetch('https://api.morning.co/idp/v1/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'client_credentials',
          client_id: KEY,
          client_secret: s
        })
      });
      const txt = await res.text();
      if (res.status === 200) {
        console.log('FOUND MATCHING SECRET! Token:', txt.slice(0, 50));
        return;
      }
    } catch (_) {}
  }
  console.log('None of the variations worked yet. User might not have clicked סיום yet.');
}

trySecrets();
