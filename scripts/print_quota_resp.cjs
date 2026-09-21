const fs = require('fs');
const path = require('path');

const fPath = path.join('C:\\Users\\hh346\\.gemini\\antigravity-ide\\brain', '7ea9efff-3c22-41ee-a23b-66c1376faeed', '.system_generated', 'logs', 'transcript_full.jsonl');
const lines = fs.readFileSync(fPath, 'utf8').split('\n');
for (const l of lines) {
  if (!l) continue;
  try {
    const item = JSON.parse(l);
    if (item.type === 'PLANNER_RESPONSE' && item.content && item.content.includes('Service invoked too many times')) {
      console.log('FOUND RESPONSE:\n', item.content);
    }
  } catch (e) {}
}
