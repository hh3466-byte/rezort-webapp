import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-initialize GoogleGenAI client
let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// Health Check API
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Gemini Agent Speech & WhatsApp Parser API with Resilient Multi-Model Fallback
app.post('/api/agent/parse', async (req, res) => {
  const { text, referenceDate, existingBookingsSummary } = req.body;
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Text prompt is required' });
  }

  const ai = getAIClient();
  const refDate = referenceDate || new Date().toISOString().split('T')[0];

  if (ai) {
    const systemInstruction = `אתה סוכן חכם מהיר ומדויק לניהול יומן פנסיון ומרכז אילוף כלבים בישראל.
תאריך הייחוס של היום: ${refDate}.

כללים קריטיים לחילוץ:
1. intent:
   - "new_booking": הזמנה חדשה
   - "payment_update": רישום תשלום / מקדמה לכלב קיים
   - "cancel_booking": ביטול / מחיקת הזמנה
   - "clear_all_data": מחיקת כל הנתונים
   - "backup_data": גיבוי נתונים
   - "navigate_tab": מעבר לשונית
   - "query": שאלה

2. תאריכים ומשך שהות (קריטי ביותר!):
   - שים לב היטב למשך השהות ולסוג השירות!
   - תהליך אילוף מלא (training): תהליך אילוף מלא הוא תמיד 70 יום! הגדר תמיד endDate לתאריך startDate + 70 ימים!
   - אילוף ביומיות / ללא לינה (day_training): אילוף יומי שבו הכלב מגיע בבוקר וחוזר הביתה. חשב תאריכים לפי מספר הימים שצוינו.
   - פנסיון (boarding): "כמה ימים" = לפחות 3 ימים (למשל מ-${refDate} עד ${refDate} + 3 ימים). "שבוע" = 7 ימים. "סופש" = מחמישי או שישי עד שבת. "ממחר" = התחלה מחר.
   - יום כיף (daycare): יום בודד (startDate = endDate).

3. מחירים ותשלומים (מספרים שלמים בלבד!):
   - כל המחירים (totalPrice, depositAmount) חייבים להיות מספרים שלמים ומעוגלים.
   - אם נאמר "שולם במלואו", "שילם הכל", "שולם הכל", "הכל שולם", "שולם מלא", "שילם מלא", "שולם מראש" או כל ביטוי דומה:
     * הגדר תמיד: paymentStatus: 'fully_paid'
     * הגדר תמיד: depositAmount שווה במדויק ל-totalPrice! (לדוגמה אם totalPrice=900 אז depositAmount=900).
   - אם נאמרה מקדמה חלקית (למשל: "שילם מקדמה 200"), הגדר paymentStatus: 'deposit_paid' ו-depositAmount: 200.
   - אם לא שולם: הגדר depositAmount: 0 ו-paymentStatus: 'unpaid'.
   - אם לא נאמר מחיר:
     * תהליך אילוף מלא (training) = 6500 ₪ מחיר קבוע לתהליך מלא של 70 יום!
     * אילוף ביומיות ללא לינה (day_training) = 250 ₪ ליום.
     * פנסיון (boarding) = 180 ₪ ליום. הכפל במספר הימים ועגל למספר שלם!
     * יום כיף (daycare) = 90 ₪ ליום.

4. שמות ופרטים:
   - חלץ את שם הכלב, שם הבעלים, טלפון, וסוג שירות ('boarding' | 'training' | 'day_training' | 'daycare').
   - אם מדובר בכלב קיים (ביטול/תשלום), ציין את ה-id שלו.

הזמנות קיימות:
${JSON.stringify(existingBookingsSummary || [])}`;

    // Fast, ultra-responsive models (primary: gemini-3.1-flash-lite)
    const candidateModels = ['gemini-3.1-flash-lite', 'gemini-3.7-flash', 'gemini-flash-latest'];

    for (const model of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: `חלץ נתונים מדויקים כ-JSON מהטקסט הבא: "${text}"`,
          config: {
            systemInstruction,
            temperature: 0.1,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                intent: {
                  type: Type.STRING,
                  description: 'new_booking | payment_update | cancel_booking | clear_all_data | backup_data | reset_to_demo | navigate_tab | query'
                },
                confidence: { type: Type.NUMBER },
                explanation: { type: Type.STRING, description: 'הסבר קצר, ברור ותמציתי בעברית על הפעולה שהסוכן זיהה והולך לבצע' },
                existingBookingId: { type: Type.STRING, description: 'ID של הזמנה קיימת אם רלוונטי' },
                targetTab: { type: Type.STRING, description: 'calendar | forecast | bookings | customers | reports | backup' },
                parsedBooking: {
                  type: Type.OBJECT,
                  properties: {
                    dogName: { type: Type.STRING },
                    dogBreed: { type: Type.STRING },
                    ownerName: { type: Type.STRING },
                    ownerPhone: { type: Type.STRING },
                    serviceType: { type: Type.STRING, description: 'boarding | training | day_training | daycare' },
                    startDate: { type: Type.STRING, description: 'YYYY-MM-DD' },
                    endDate: { type: Type.STRING, description: 'YYYY-MM-DD' },
                    totalPrice: { type: Type.NUMBER },
                    depositAmount: { type: Type.NUMBER },
                    paymentStatus: { type: Type.STRING, description: 'unpaid | deposit_paid | fully_paid' },
                    paymentMethod: { type: Type.STRING, description: 'bit | paybox | cash | credit | bank_transfer' },
                    notes: { type: Type.STRING }
                  }
                }
              },
              required: ['intent', 'explanation']
            }
          }
        });

        if (response && response.text) {
          const parsedJson = JSON.parse(response.text);
          const pb = parsedJson.parsedBooking || {};
          
          // Ensure strictly integer prices
          if (pb.totalPrice !== undefined && pb.totalPrice !== null) {
            pb.totalPrice = Math.round(Number(pb.totalPrice));
          }
          if (pb.depositAmount !== undefined && pb.depositAmount !== null) {
            pb.depositAmount = Math.round(Number(pb.depositAmount));
          }

          const cleanLower = text.toLowerCase();
          const isFullyPaidMentioned = cleanLower.includes('שולם במלואו') || 
            cleanLower.includes('שילם במלואו') || 
            cleanLower.includes('שולם הכל') || 
            cleanLower.includes('שילם הכל') || 
            cleanLower.includes('הכל שולם') || 
            cleanLower.includes('שולם מלא') || 
            cleanLower.includes('שילם מלא') || 
            cleanLower.includes('שולם מראש');

          if (isFullyPaidMentioned || pb.paymentStatus === 'fully_paid') {
            pb.paymentStatus = 'fully_paid';
            if (pb.totalPrice && pb.totalPrice > 0) {
              pb.depositAmount = pb.totalPrice;
            }
          }

          return res.json({
            success: true,
            modelUsed: model,
            proposal: {
              intent: parsedJson.intent || 'new_booking',
              confidence: parsedJson.confidence || 0.95,
              explanation: parsedJson.explanation || '',
              existingBookingId: parsedJson.existingBookingId || undefined,
              targetTab: parsedJson.targetTab || undefined,
              rawText: text,
              parsedBooking: pb
            }
          });
        }
      } catch (err: any) {
        console.warn(`Model ${model} unavailable or busy (${err?.message || err}), trying fallback...`);
      }
    }
  }

  // Graceful fallback if Gemini API is temporarily busy or not configured
  return res.json({
    success: true,
    fallback: true,
    proposal: null,
    message: 'Using client-side heuristic parser'
  });
});

// Setup Vite middleware in dev or static files in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Dog Resort Manager server listening on http://localhost:${PORT}`);
  });
}

startServer();
