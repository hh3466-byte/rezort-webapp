const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\hh346\\.gemini\\antigravity-ide\\brain';

function searchTranscripts(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      searchTranscripts(fullPath);
    } else if (entry.name === 'transcript.jsonl') {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split('\n');
        for (const line of lines) {
          if (!line) continue;
          if (line.includes('USER_INPUT') && (line.includes('מייל') || line.includes('תשלום') || line.includes('Grow'))) {
            try {
              const obj = JSON.parse(line);
              console.log(`[${path.basename(path.dirname(fullPath))}] USER:`, obj.content?.slice(0, 150));
            } catch (e) {}
          }
        }
      } catch (e) {}
    }
  }
}

searchTranscripts(brainDir);
