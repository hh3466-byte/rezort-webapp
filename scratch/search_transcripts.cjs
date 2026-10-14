const fs = require('fs');

function searchFile(path) {
  if (!fs.existsSync(path)) return;
  console.log('Searching:', path);
  const lines = fs.readFileSync(path, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!l) continue;
    if (l.includes('557452') || l.includes('sandbox_test') || (l.includes('USER_INPUT') && l.includes('מיכאל'))) {
      try {
        const obj = JSON.parse(l);
        console.log(`[Line ${i}] type=${obj.type} source=${obj.source}:`);
        console.log(typeof obj.content === 'string' ? obj.content.substring(0, 300) : JSON.stringify(obj.content || '').substring(0, 300));
        if (obj.tool_calls) {
          console.log('tool_calls:', JSON.stringify(obj.tool_calls).substring(0, 300));
        }
      } catch (e) {
        console.log(`[Line ${i}]:`, l.substring(0, 200));
      }
    }
  }
}

searchFile('C:/Users/hh346/.gemini/antigravity-ide/brain/494a583d-2784-46e6-a9a7-5719c1bc5ed8/.system_generated/logs/transcript.jsonl');
searchFile('C:/Users/hh346/.gemini/antigravity-ide/brain/d678fe40-d02e-48dd-81be-8e0bde4c08bd/.system_generated/logs/transcript.jsonl');
