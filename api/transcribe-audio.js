import { GoogleGenAI } from '@google/genai';

/**
 * Serverless / Express endpoint to transcribe WhatsApp voice notes / audio messages into Hebrew text.
 * Uses Gemini API (multimodal audio) with fallback.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  try {
    const { audioUrl, audioBase64, mimeType } = req.body || {};
    if (!audioUrl && !audioBase64) {
      return res.status(400).json({ ok: false, error: 'Missing audioUrl or audioBase64' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      return res.status(200).json({
        ok: false,
        fallbackToWebSpeech: true,
        error: 'Gemini API key is not configured'
      });
    }

    let base64Data = audioBase64;
    let mime = mimeType || 'audio/ogg';

    if (!base64Data && audioUrl) {
      const audioRes = await fetch(audioUrl);
      if (!audioRes.ok) {
        return res.status(400).json({ ok: false, error: `Failed to fetch audio: ${audioRes.status}` });
      }
      const arrayBuf = await audioRes.arrayBuffer();
      base64Data = Buffer.from(arrayBuf).toString('base64');
      const respMime = audioRes.headers.get('content-type');
      if (respMime) mime = respMime;
    }

    const cleanMime = mime.split(';')[0].trim() || 'audio/ogg';

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          inlineData: {
            data: base64Data,
            mimeType: cleanMime
          }
        },
        {
          text: 'אנא תמלל את הודעת הקול הבאה לעברית בדיוק מוחלט, מילה במילה. החזר אך ורק את התמלול הטקסטואלי ללא שום תוספת, פתיח או סיום.'
        }
      ]
    });

    const transcription = (response.text || '').trim();
    return res.status(200).json({
      ok: true,
      text: transcription
    });
  } catch (err) {
    console.error('Error in /api/transcribe-audio:', err);
    return res.status(200).json({
      ok: false,
      fallbackToWebSpeech: true,
      error: err?.message || 'Transcription error'
    });
  }
}
