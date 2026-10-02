const fs = require('fs');
const content = fs.readFileSync('payment-link.html', 'utf8');

// Find paths
const paths = content.match(/api\/light\/server\/[a-zA-Z0-9.\/_-]+/g) || [];
console.log('Detected api/light paths in payment-link.html:', [...new Set(paths)]);

// Also search for any "path": "..."
const allPaths = content.match(/"path":\s*"([^"]+)"/g) || [];
console.log('All "path" values:', [...new Set(allPaths)]);

// Search for parameter objects
const paramMatches = content.match(/"parameters":\s*(\[[^\]]+\])/g) || [];
console.log('Parameter blocks found:', paramMatches.length);
paramMatches.forEach((p, i) => console.log(`Param block ${i+1}:`, p));
