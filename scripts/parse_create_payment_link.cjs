const fs = require('fs');

const content = fs.readFileSync('create-payment-link.html', 'utf8');

// Find all properties and endpoints
console.log('=== CREATE PAYMENT LINK ENDPOINT DETAILS ===');

// Extract URLs
const urls = content.match(/https?:\/\/[a-zA-Z0-9.-]*(?:meshulam|grow)[a-zA-Z0-9.\/_-]*/g) || [];
console.log('Detected URLs:', [...new Set(urls)]);

// Extract requestBody schema
const reqBodyMatch = content.match(/"requestBody":\s*(\{[^}]*"content":[\s\S]*?"schema":\s*(\{[^}]*"properties":[\s\S]*?\}),\s*"required")/);
if (reqBodyMatch) {
  console.log('Request body schema:');
  console.log(reqBodyMatch[2].substring(0, 1500));
}

// Extract JSON properties
const propRegex = /"([a-zA-Z0-9_]+)":\s*\{\s*"type":\s*"([^"]+)"(?:,\s*"description":\s*"([^"]*)")?(?:,\s*"example":\s*([^,}\]]+))?/g;
let match;
const fields = {};
while ((match = propRegex.exec(content)) !== null) {
  const [, key, type, desc, example] = match;
  if (!fields[key]) {
    fields[key] = { type, desc: desc ? desc.replace(/\\n/g, ' ') : '', example };
  }
}
console.log('\nAll Fields in create-payment-link:');
console.log(JSON.stringify(fields, null, 2));

// Extract response samples
const resMatch = content.match(/"responses":\s*(\{[^}]*"200":[\s\S]*?\})/);
if (resMatch) {
  console.log('\n200 Response sample:');
  console.log(resMatch[1].substring(0, 1000));
}
