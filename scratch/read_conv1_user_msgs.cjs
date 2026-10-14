const fs = require('fs');

const path = 'C:/Users/hh346/.gemini/antigravity-ide/brain/494a583d-2784-46e6-a9a7-5719c1bc5ed8/.system_generated/logs/transcript.jsonl';
const lines = fs.readFileSync(path, 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
  if (!lines[i]) continue;
  try {
    const obj = JSON.parse(lines[i]);
    if (obj.type === 'USER_INPUT') {
      console.log(`=== [Line ${i} USER_INPUT] ===`);
      console.log(obj.content);
    }
  } catch(e) {}
}
