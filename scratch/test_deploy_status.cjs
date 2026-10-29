async function test() {
  const r = await fetch('https://api.github.com/repos/hh3466-byte/rezort-webapp/deployments/7279998113/statuses', {
    headers: { 'User-Agent': 'Node' }
  });
  const data = await r.json();
  console.log(JSON.stringify(data, null, 2));
}
test();
