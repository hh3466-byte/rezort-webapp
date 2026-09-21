const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\hh346\\.gemini\\antigravity-ide\\brain';
const convs = fs.readdirSync(brainDir, { withFileTypes: true })
  .filter(d => d.isDirectory() && d.name !== '.system_generated');

for (const c of convs) {
  const tPath = path.join(brainDir, c.name, '.system_generated', 'logs', 'transcript.jsonl');
  if (fs.existsSync(tPath)) {
    const stat = fs.statSync(tPath);
    const content = fs.readFileSync(tPath, 'utf8');
    if (content.includes('2026-09-15')) {
      console.log(`Conv ${c.name} modified ${stat.mtime}:`);
      const lines = content.split('\n');
      for (const l of lines) {
        if (l.includes('USER_INPUT') && l.includes('מייל')) {
          try {
            const data = JSON.parse(l);
            console.log('   -> ', data.content?.slice(0, 100));
          } catch(e) {}
        }
      }
    }
  }
}
