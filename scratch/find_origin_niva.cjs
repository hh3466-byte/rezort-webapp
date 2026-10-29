const fs = require('fs');
const path = require('path');

const baseDir = 'C:\\Users\\hh346\\.gemini\\antigravity-ide\\brain';

function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath);
    } else if (entry.name.endsWith('.jsonl')) {
      checkFile(fullPath);
    }
  }
}

function checkFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('176637167') || content.includes('poran.niva@gmail.com') || content.includes('554341')) {
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (line.includes('176637167') || line.includes('poran.niva@gmail.com') || line.includes('554341')) {
          console.log(`FOUND in ${filePath} Line ${idx + 1}:`);
          try {
            const parsed = JSON.parse(line);
            console.log('Type:', parsed.type, 'Source:', parsed.source, 'Created:', parsed.created_at);
            if (parsed.tool_calls) {
              console.log('Tool calls:', JSON.stringify(parsed.tool_calls).slice(0, 300));
            }
            if (parsed.content) {
              console.log('Content snippet:', parsed.content.slice(0, 300));
            }
          } catch(e) {
            console.log('Raw snippet:', line.slice(0, 300));
          }
          console.log('-------------------------------------------');
        }
      });
    }
  } catch (err) {}
}

scanDir(baseDir);
