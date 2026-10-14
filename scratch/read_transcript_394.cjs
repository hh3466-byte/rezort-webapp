const fs = require('fs');

const path = 'C:/Users/hh346/.gemini/antigravity-ide/brain/d678fe40-d02e-48dd-81be-8e0bde4c08bd/.system_generated/logs/transcript.jsonl';
const lines = fs.readFileSync(path, 'utf8').split('\n');

for (let i = 394; i <= 430; i++) {
  if (!lines[i]) continue;
  try {
    const obj = JSON.parse(lines[i]);
    console.log(`=== Line ${i} [${obj.type} - ${obj.source}] ===`);
    if (obj.content) {
      console.log(typeof obj.content === 'string' ? obj.content.substring(0, 500) : JSON.stringify(obj.content).substring(0, 500));
    }
  } catch(e) {}
}
