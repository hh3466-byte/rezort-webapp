const fs = require('fs');

const content = fs.readFileSync('create-payment-link.html', 'utf8');

// Search for the JSON block containing "pageCode"
const idx = content.indexOf('CreatePaymentLink');
console.log('Index of CreatePaymentLink:', idx);
if (idx !== -1) {
  console.log(content.substring(idx - 200, idx + 1500));
}

// Search for all property names and descriptions
const match = content.match(/"properties":\s*(\{[^}]+\})/);
if (match) {
  console.log('Matched properties:', match[1]);
}
