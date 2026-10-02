const fs = require('fs');

const callbackContent = fs.readFileSync('payment-request-callback.html', 'utf8');
const approveContent = fs.readFileSync('approve-transaction-1.html', 'utf8');

console.log('=== PAYMENT REQUEST CALLBACK (WEBHOOK) ===');
const cbMatch = callbackContent.match(/"properties":\s*(\{[^}]+\})/);
if (cbMatch) console.log('Callback properties:', cbMatch[1]);

// Search for pre tags in callback
const preMatches = callbackContent.match(/<pre[^>]*>([\s\S]*?)<\/pre>/g) || [];
preMatches.forEach((p, i) => {
  console.log(`\nCallback [PRE #${i + 1}]:\n`, p.replace(/<[^>]+>/g, '').trim());
});

console.log('\n=== APPROVE TRANSACTION ===');
const approveUrls = approveContent.match(/https?:\/\/[a-zA-Z0-9.-]*(?:meshulam|grow)[a-zA-Z0-9.\/_-]*/g) || [];
console.log('Approve URLs:', [...new Set(approveUrls)]);

const approvePre = approveContent.match(/<pre[^>]*>([\s\S]*?)<\/pre>/g) || [];
approvePre.forEach((p, i) => {
  console.log(`\nApprove [PRE #${i + 1}]:\n`, p.replace(/<[^>]+>/g, '').trim());
});
