const fs = require('fs');
const content = fs.readFileSync('payment-link.html', 'utf8');

const hrefs = content.match(/href="([^"]+)"/g) || [];
console.log('All hrefs in payment-link.html:');
console.log([...new Set(hrefs.filter(h => h.includes('reference')))].join('\n'));
