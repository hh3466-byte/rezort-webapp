import React, { useState } from 'react';
import { 
  X, 
  Sparkles, 
  Mic, 
  Calendar, 
  ShieldAlert, 
  MessageSquare, 
  Smartphone, 
  CheckCircle2, 
  ArrowLeft, 
  ArrowRight,
  Dog,
  DollarSign,
  Play,
  Copy,
  Users
} from 'lucide-react';
import { ResortSettings } from '../types';

interface GuideProps {
  settings: ResortSettings;
  onClose: () => void;
  onTryPrompt: (promptText: string) => void;
}

export const Guide: React.FC<GuideProps> = ({
  settings,
  onClose,
  onTryPrompt,
}) => {
  const [currentStep, setCurrentStep] = useState(0);

  const guideSteps = [
    {
      id: 'voice_agent',
      title: '1. הסוכן הקולי החכם — תפעול בקול ללא הקלדה',
      icon: Mic,
      color: 'text-green-700 bg-green-100',
      description: 'ברירת המחדל באפליקציה היא דיבור בקול. אין צורך להקליד שדות ידנית.',
      points: [
        'כפתור "🎙️ לחץ עלי על מנת להתחיל" נמצא תמיד בראש המסך ובכל הטפסים.',
        'לחץ עליו ודבר בעברית חופשית (או הדבק הודעת וואטסאפ מלקוח).',
        'הסוכן מזהה אוטומטית: שם הכלב, שם הלקוח, טלפון, סוג שירות, תאריכים, מחיר כולל ומקדמה.',
        'נפתחת חלונית אישור מהירה — קליק אחד על "אשר והוסף ליומן" וההזמנה משוריינת!'
      ],
      samplePrompts: [
        'בלו של כהן, פנסיון משישי עד ראשון, 800 שקל, שילם מקדמה 200 בביט',
        'שריון לאילוף לכלב מקס של דני לוי, טלפון 0501234567, משני עד חמישי הבא, 1200 ש״ח',
        'תקבל תשלום 300 שקל מקדמה מרונית על לוקה'
      ]
    },
    {
      id: 'color_coding',
      title: '2. מקרא הצבעים — סטטוס שריון ותשלום במבט מהיר',
      icon: DollarSign,
      color: 'text-amber-700 bg-amber-100',
      description: 'היומן מסודר בצבעים ברורים שמאפשרים לדעת בשבריר שנייה מי סגור ומי בחוב:',
      points: [
        '🔴 אדום: לקוח שהזמין וטרם שילם מקדמה (הזמנה ממתינה / חוב פתוח).',
        '🟡 ירוק מקווקו: לקוח ששילם מקדמה לשריון המקום (מקום שמור, נותרה יתרה לגבייה).',
        '🟢 ירוק מלא: לקוח ששילם את כל הסכום במלואו (סגור ומאושר 100%).',
        'כפתור "סמן כשולם" זמין בקליק אחד בכל כרטיס וביומן לסגירה מיידית.'
      ],
      samplePrompts: []
    },
    {
      id: 'overbooking',
      title: '3. ניהול קיבולת ומניעת אובר-בוקינג',
      icon: ShieldAlert,
      color: 'text-red-700 bg-red-100',
      description: 'הגדרת קיבולת הריזורט (ברירת מחדל 12 כלבים) ומניעת עומסי יתר:',
      points: [
        'כל משבצת ביומן מציגה מונה תפוסה מדויק (למשל: 4/12).',
        'במידה וביום מסוים מגיעים לתפוסה מלאה או חריגה — המשבצת נצבעת באדום ומהבהבת.',
        'בעת הוספת הזמנה (בקול או בטופס), המערכת בודקת אוטומטית את כל טווח התאריכים ומתריעה מראש על חריגה.',
        'לשונית "📊 תחזית תפוסה" מציגה גרף ל-14, 30 ו-60 ימים קדימה לזיהוי עומסים מראש.'
      ],
      samplePrompts: []
    },
    {
      id: 'whatsapp_integration',
      title: '4. הודעות וואטסאפ אוטומטיות בקליק אחד',
      icon: MessageSquare,
      color: 'text-green-700 bg-green-100',
      description: 'תקשורת מהירה ומקצועית מול הלקוחות ללא צורך בניסוח הודעות מחדש:',
      points: [
        'אישורי הזמנה מפורטים עם תאריכים ופירוט תשלום.',
        'תזכורות תשלום אוטומטיות עם יתרת החוב וקישורי Bit / PayBox ישירים.',
        'הודעות שחרור הביתה ותודות בסיום שהות.',
        'אפשרות לערוך את נוסחי ההודעות בהגדרות המערכת לפי העדפתך.'
      ],
      samplePrompts: []
    },
    {
      id: 'pwa_android',
      title: '5. התקנה באנדרואיד ובטלפון כאפליקציה מלאה (PWA)',
      icon: Smartphone,
      color: 'text-indigo-700 bg-indigo-100',
      description: 'איך להפוך את האפליקציה לאייקון במסך הבית של הטלפון:',
      points: [
        'פתח את הקישור בדפדפן Google Chrome באנדרואיד (או Safari באייפון).',
        'לחץ על תפריט 3 הנקודות למעלה (⋮).',
        'בחר באפשרות "הוסף למסך הבית" (Add to Home screen) או "התקן אפליקציה".',
        'האפליקציה תופיע כאייקון עצמאי במסך הבית, תפתח במסך מלא ותקבל גישה ישירה למיקרופון.'
      ],
      samplePrompts: []
    }
  ];

  const currentStepData = guideSteps[currentStep];
  const IconComponent = currentStepData.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-2xl w-full p-5 sm:p-7 text-slate-900 max-h-[92vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-green-50 text-green-700 flex items-center justify-center border border-green-200 font-bold">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-xl sm:text-2xl text-slate-900">
                מדריך אינטראקטיבי ליומן הריזורט
              </h3>
              <p className="text-xs sm:text-sm text-slate-500">
                למד כיצד לנהל את הריזורט בקלות ובמהירות
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Step Indicators */}
        <div className="my-5 flex items-center justify-between gap-1.5">
          {guideSteps.map((step, idx) => (
            <button
              key={step.id}
              onClick={() => setCurrentStep(idx)}
              className={`flex-1 h-2 rounded-full transition-all cursor-pointer ${
                idx === currentStep
                  ? 'bg-green-600 ring-2 ring-green-400/40'
                  : idx < currentStep
                  ? 'bg-green-300'
                  : 'bg-slate-200 hover:bg-slate-300'
              }`}
              title={step.title}
            />
          ))}
        </div>

        {/* Step Content */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl ${currentStepData.color}`}>
              <IconComponent className="w-6 h-6" />
            </div>
            <h4 className="font-extrabold text-lg sm:text-xl text-slate-900">
              {currentStepData.title}
            </h4>
          </div>

          <p className="text-sm text-slate-600">
            {currentStepData.description}
          </p>

          {/* Bullet Points */}
          <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-2.5 text-xs sm:text-sm">
            {currentStepData.points.map((pt, i) => (
              <div key={i} className="flex items-start gap-2 text-slate-800">
                <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                <span>{pt}</span>
              </div>
            ))}
          </div>

          {/* Sample Prompts to Try Directly */}
          {currentStepData.samplePrompts.length > 0 && (
            <div className="space-y-2 pt-2">
              <span className="text-xs font-bold text-green-800 block">
                נסה ללחוץ על אחת הדוגמאות להפעלה מיידית של הסוכן:
              </span>
              <div className="space-y-1.5">
                {currentStepData.samplePrompts.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      onClose();
                      onTryPrompt(prompt);
                    }}
                    className="w-full text-right text-xs bg-white hover:bg-slate-50 text-slate-800 hover:text-green-700 p-3 rounded-xl border border-slate-200 flex items-center justify-between gap-2 transition-all cursor-pointer shadow-xs"
                  >
                    <span className="truncate font-medium">"{prompt}"</span>
                    <span className="text-[11px] bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded font-bold shrink-0 flex items-center gap-1">
                      <Play className="w-3 h-3 fill-current" /> הפעל
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="mt-7 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={currentStep === 0}
            onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-200"
          >
            <ArrowRight className="w-4 h-4" />
            <span>הקודם</span>
          </button>

          <span className="text-xs text-slate-400 font-mono">
            {currentStep + 1} מתוך {guideSteps.length}
          </span>

          {currentStep < guideSteps.length - 1 ? (
            <button
              type="button"
              onClick={() => setCurrentStep(prev => Math.min(guideSteps.length - 1, prev + 1))}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-green-600 hover:bg-green-700 text-white flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            >
              <span>הבא</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl text-xs font-black bg-green-600 hover:bg-green-700 text-white flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            >
              <span>התחל לעבוד עם היומן! 🎉</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
