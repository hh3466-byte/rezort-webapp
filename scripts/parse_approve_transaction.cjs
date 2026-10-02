const fs = require('fs');

const content = fs.readFileSync('approve-transaction-1.html', 'utf8');

const propRegex = /"([a-zA-Z0-9_]+)":\s*\{\s*"type":\s*"([^"]+)"(?:,\s*"description":\s*"([^"]*)")?(?:,\s*"example":\s*([^,}\]]+))?/g;
let match;
const fields = {};
while ((match = propRegex.exec(content)) !== null) {
  const [, key, type, desc, example] = match;
  if (!fields[key]) {
    fields[key] = { type, desc: desc ? desc.replace(/\\n/g, ' ') : '', example };
  }
}
console.log('Fields in approve-transaction:');
console.log(JSON.stringify(fields, null, 2));

// Look for path and URLs
const paths = content.match(/api\/light\/server\/[a-zA-Z0-9.\/_-]+/g) || [];
console.log('Paths:', [...new Set(paths)]);
