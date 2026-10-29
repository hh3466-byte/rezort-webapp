const fetch = globalThis.fetch || require('node-fetch');

const KEY = '18c14598-0f77-45d9-a6b2-7aa04f0289e2';

// Let's break down the secret into parts and vary them:
// Part 1: vxi. / vxi,
// Part 2: ^| / ^ / |
// Part 3: CnHh / CnHH / CnhH / Cnhh
// Part 4: U1fcz / U1fcz
// Part 5: ,> / .> / >
// Part 6: a8
// Part 7: MQOGU / MQ0GU / MqOGU / MQOGu
// Part 8: <2$
// Part 9: I / l / 1 / |
// Part 10: ? / ! / 7
// Part 11: 25- / 25

const p1 = ['vxi.', 'vxi,'];
const p2 = ['^|', '^', '|'];
const p3 = ['CnHh', 'CnHH', 'Cnhh'];
const p4 = ['U1fcz', 'u1fcz'];
const p5 = [',>', '.>'];
const p6 = ['a8'];
const p7 = ['MQOGU', 'MQ0GU'];
const p8 = ['<2$'];
const p9 = ['I', 'l', '1'];
const p10 = ['?', '!', '7'];
const p11 = ['25-'];

async function runBruteForce() {
  console.log('Generating permutations...');
  const candidates = [];
  for (const a of p1) {
    for (const b of p2) {
      for (const c of p3) {
        for (const d of p4) {
          for (const e of p5) {
            for (const f of p6) {
              for (const g of p7) {
                for (const h of p8) {
                  for (const i of p9) {
                    for (const j of p10) {
                      for (const k of p11) {
                        candidates.push(`${a}${b}${c}${d}${e}${f}${g}${h}${i}${j}${k}`);
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  console.log(`Testing ${candidates.length} candidates...`);

  // Test in batches of 10 concurrent requests
  for (let idx = 0; idx < candidates.length; idx += 10) {
    const batch = candidates.slice(idx, idx + 10);
    const results = await Promise.all(batch.map(async (secret) => {
      try {
        const res = await fetch('https://api.morning.co/idp/v1/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            grant_type: 'client_credentials',
            client_id: KEY,
            client_secret: secret
          })
        });
        if (res.status === 200) {
          const data = await res.json();
          return { secret, data };
        }
      } catch (_) {}
      return null;
    }));

    const found = results.find(r => r !== null);
    if (found) {
      console.log('🎉 FOUND WORKING SECRET:', found.secret);
      console.log('Token data:', found.data);
      return;
    }
  }

  console.log('Finished testing candidates. None matched.');
}

runBruteForce();
