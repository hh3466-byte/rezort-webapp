const fs = require('fs');

const files = ['payment-link.html', 'create-payment-process.html', 'server-response.html', 'approve-transaction.html'];

for (const f of files) {
  if (!fs.existsSync(f)) continue;
  const content = fs.readFileSync(f, 'utf8');
  console.log(`\n=================== SPEC IN ${f} ===================`);
  
  // Extract JSON blobs that look like OpenAPI operation or schema
  const regex = /\{"operation":([\s\S]*?),"apiSetting"/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    try {
      const op = JSON.parse(match[1]);
      console.log('Operation method/path:', op.method, op.path);
      console.log('Summary:', op.summary || op.description);
      console.log('Parameters:', JSON.stringify(op.parameters, null, 2));
      console.log('RequestBody:', JSON.stringify(op.requestBody, null, 2));
      console.log('Responses:', JSON.stringify(op.responses, null, 2));
    } catch (e) {
      console.log('Could not parse operation:', e.message);
    }
  }

  // Also search for general JSON schemas
  const schemaRegex = /"schema":\s*(\{[^{}]*"type":\s*"object"[\s\S]*?\})/g;
  let sMatch;
  let count = 0;
  while ((sMatch = schemaRegex.exec(content)) !== null && count < 3) {
    count++;
    console.log(`Schema snippet ${count}:`, sMatch[1].substring(0, 500));
  }
}
