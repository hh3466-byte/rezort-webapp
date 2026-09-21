const fs = require('fs');
const path = require('path');

function printConv(convId) {
  console.log(`\n================ CONV ${convId} ================`);
  const fPath = path.join('C:\\Users\\hh346\\.gemini\\antigravity-ide\\brain', convId, '.system_generated', 'logs', 'transcript.jsonl');
  const lines = fs.readFileSync(fPath, 'utf8').split('\n');
  for (const l of lines) {
    if (!l) continue;
    try {
      const item = JSON.parse(l);
      if (item.type === 'USER_INPUT') {
        console.log('\n[USER]:', item.content);
      } else if (item.type === 'PLANNER_RESPONSE' && item.content) {
        console.log('\n[ASSISTANT]:', item.content.slice(0, 300));
      }
    } catch (e) {}
  }
}

printConv('7ea9efff-3c22-41ee-a23b-66c1376faeed');
