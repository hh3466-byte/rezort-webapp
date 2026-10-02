const fs = require('fs');

const content = fs.readFileSync('create-payment-process.html', 'utf8') + fs.readFileSync('payment-link.html', 'utf8') + fs.readFileSync('approve-transaction.html', 'utf8');

// Find all JSON properties with description
const propRegex = /"([a-zA-Z0-9_]+)":\s*\{\s*"type":\s*"([^"]+)"(?:,\s*"description":\s*"([^"]*)")?(?:,\s*"example":\s*([^,}\]]+))?/g;
let match;
const found = {};
while ((match = propRegex.exec(content)) !== null) {
  const [, key, type, desc, example] = match;
  if (!found[key]) {
    found[key] = { type, desc: desc ? desc.replace(/\\n/g, ' ') : '', example };
  }
}

console.log('Discovered API fields:');
console.log(JSON.stringify(found, null, 2));
