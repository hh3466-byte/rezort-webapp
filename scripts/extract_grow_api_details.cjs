const fs = require('fs');

const files = ['payment-link.html', 'create-payment-process.html', 'server-response.html', 'approve-transaction.html'];

for (const f of files) {
  if (!fs.existsSync(f)) continue;
  const content = fs.readFileSync(f, 'utf8');
  console.log(`\n=================== FILE: ${f} ===================`);
  
  // Search for API endpoint URLs (e.g., https://sandbox.meshulam.co.il or api.meshulam.co.il or grow)
  const urls = content.match(/https?:\/\/[a-zA-Z0-9.-]*(?:meshulam|grow)[a-zA-Z0-9.\/_-]*/g) || [];
  console.log('Detected Meshulam/Grow URLs:', [...new Set(urls)]);

  // Search for JSON snippets or code blocks
  const preMatches = content.match(/<pre[^>]*>([\s\S]*?)<\/pre>/g) || [];
  console.log(`Found ${preMatches.length} <pre> tags`);
  preMatches.slice(0, 5).forEach((p, idx) => {
    const text = p.replace(/<[^>]+>/g, '').trim();
    if (text.length > 20 && text.length < 2000) {
      console.log(`\n[PRE #${idx + 1}]:\n${text}`);
    }
  });

  // Search for JSON embedded in scripts
  const scripts = content.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
  for (const s of scripts) {
    if (s.includes('createPaymentProcess') || s.includes('pageCode') || s.includes('userId') || s.includes('approveTransaction')) {
      console.log('Script with relevant keywords found (length: ' + s.length + ')');
      // Look for request parameter definitions
      const matchParam = s.match(/"parameters":\s*(\[[\s\S]*?\])/);
      if (matchParam) {
        console.log('Parameters found:', matchParam[1].substring(0, 300));
      }
    }
  }
}
