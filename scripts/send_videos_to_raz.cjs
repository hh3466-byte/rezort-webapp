const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || '').trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[match[1]] = val;
  }
});
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const RAZ_CHAT_ID = '972543180407@c.us';

async function sendVideosToRaz() {
  const { data: settings } = await supabase.from('settings').select('*');
  const s = settings?.[0]?.data || {};
  const greenId = s.greenApiIdInstance;
  const greenToken = s.greenApiToken;

  const videos = [
    {
      url: 'https://do-media-7107.fra1.digitaloceanspaces.com/710722735421/6910ce04-a995-4f0f-b7f0-f3ee87b89a62.mp4',
      fileName: 'hila_training_video_1.mp4',
      caption: '🎬 סרטון אילוף חדש מהילה המאלפת (Halodog) 🐾'
    },
    {
      url: 'https://do-media-7107.fra1.digitaloceanspaces.com/710722735421/09bc4dd0-5a37-4255-8f70-cb872e9a9052.mp4',
      fileName: 'hila_training_video_2.mp4',
      caption: '🎬 סרטון אילוף נוסף מהילה המאלפת (Halodog) 🐾'
    },
    {
      url: 'https://do-media-7107.fra1.digitaloceanspaces.com/710722735421/eac233a5-a593-4e90-8439-00f7cad19afd.mp4',
      fileName: 'hila_training_video_3.mp4',
      caption: '🎬 סרטון אילוף מהילה המאלפת (26.09) 🐾'
    }
  ];

  console.log(`Sending ${videos.length} videos to Raz (${RAZ_CHAT_ID})...`);

  // First send intro text message
  const introRes = await fetch(`https://api.green-api.com/waInstance${greenId}/sendMessage/${greenToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chatId: RAZ_CHAT_ID,
      message: `היי רז! 🐾✨\nמעביר אליך את סרטוני האילוף האחרונים שהתקבלו מהילה המאלפת (Halodog) לצורך תיעוד, סושיאל וקהילה:`
    })
  });
  const introData = await introRes.json();
  console.log('Intro msg result:', introData);

  for (let i = 0; i < videos.length; i++) {
    const v = videos[i];
    console.log(`Sending video ${i + 1}/${videos.length}: ${v.url}`);
    const sendRes = await fetch(`https://api.green-api.com/waInstance${greenId}/sendFileByUrl/${greenToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId: RAZ_CHAT_ID,
        urlFile: v.url,
        fileName: v.fileName,
        caption: v.caption
      })
    });
    const sendData = await sendRes.json();
    console.log(`Video ${i + 1} result:`, sendData);
    // Short delay between files
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('All videos sent successfully to Raz!');
}

sendVideosToRaz().catch(console.error);
