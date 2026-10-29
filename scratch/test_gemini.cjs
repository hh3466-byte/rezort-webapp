const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');

const envContent = fs.readFileSync('.env', 'utf-8');
let key = '';
envContent.split('\n').forEach(line => {
  if (line.startsWith('GEMINI_API_KEY=')) {
    key = line.replace('GEMINI_API_KEY=', '').trim().replace(/^['"]|['"]$/g, '');
  }
});
console.log('Gemini key exists:', Boolean(key));
const ai = new GoogleGenAI({ apiKey: key });
console.log('AI client created successfully!');

async function test() {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: 'Translate to Hebrew: Hello world'
    });
    console.log('Gemini response:', response.text);
  } catch (e) {
    console.error('Error:', e.message);
  }
}
test();
