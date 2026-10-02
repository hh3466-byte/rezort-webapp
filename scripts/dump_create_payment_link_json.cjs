const fs = require('fs');

const content = fs.readFileSync('create-payment-link.html', 'utf8');

// Find all occurrences of schema definitions
const jsonStart = content.indexOf('{"type":"object","properties":');
console.log('jsonStart:', jsonStart);
if (jsonStart !== -1) {
  let depth = 0;
  let end = jsonStart;
  for (let i = jsonStart; i < content.length; i++) {
    if (content[i] === '{') depth++;
    else if (content[i] === '}') {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  const jsonStr = content.substring(jsonStart, end);
  try {
    const parsed = JSON.parse(jsonStr);
    console.log('PARSED COMPLETE SCHEMA:');
    console.log(JSON.stringify(parsed, null, 2));
    fs.writeFileSync('grow_create_payment_link_schema.json', JSON.stringify(parsed, null, 2));
  } catch (e) {
    console.log('Failed to parse:', e.message);
    console.log(jsonStr.substring(0, 500));
  }
}
