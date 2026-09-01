import React, { useState, useEffect, useRef } from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Sparkles, 
  Calendar, 
  User, 
  Phone, 
  DollarSign, 
  Edit3, 
  Dog,
  ShieldAlert,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Mic,
  Square,
  HelpCircle,
  Clock,
  CreditCard,
  FileText,
  Check
} from 'lucide-react';
import { AgentActionProposal, Booking, ResortSettings, ServiceType } from '../types';
import { formatDateIL, calculateDaysCount, addDays, getTodayStr } from '../utils/dateUtils';
import { getServiceTypeHebrew } from '../utils/whatsappUtils';
import { 
  getClarificationQuestions, 
  applyClarificationAnswer, 
  ClarificationItem 
} from '../services/agentService';

interface AgentActionModalProps {
  proposal: AgentActionProposal | null;
  settings: ResortSettings;
  onClose: () => void;
  onConfirm: (proposal: AgentActionProposal) => void;
  onEditManually: (partialBooking: Partial<Booking>) => void;
}

export const AgentActionModal: React.FC<AgentActionModalProps> = ({
  proposal,
  settings,
  onClose,
  onConfirm,
  onEditManually,
}) => {
  if (!proposal) return null;

  // Local editable state to let user fix fields directly in this modal!
  const [editedBooking, setEditedBooking] = useState<Partial<Booking>>({ ...proposal.parsedBooking });
  const [isInlineEditOpen, setIsInlineEditOpen] = useState(false);
  
  // Voice Clarification Question state
  const [activeRecordingQuestionId, setActiveRecordingQuestionId] = useState<string | null>(null);
  const [questionTranscript, setQuestionTranscript] = useState('');
  const [clarificationHistory, setClarificationHistory] = useState<Record<string, boolean>>({});
  const recognitionRef = useRef<any>(null);

  // Sync if proposal changes
  useEffect(() => {
    setEditedBooking({ ...proposal.parsedBooking });
    setClarificationHistory({});
  }, [proposal]);

  // Setup Web Speech API for question voice answers
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'he-IL';

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setQuestionTranscript(currentTranscript);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error in modal:', event.error);
        setActiveRecordingQuestionId(null);
      };

      recognition.onend = () => {
        setActiveRecordingQuestionId(null);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const { intent, explanation, overbookingCheck, rawText } = proposal;
  const roundedTotal = Math.round(editedBooking.totalPrice || 0);
  const roundedDeposit = Math.round(editedBooking.depositAmount || 0);
  const remainingDebt = Math.max(0, roundedTotal - roundedDeposit);

  // Get dynamic clarification questions
  const clarificationQuestions: ClarificationItem[] = intent === 'new_booking'
    ? getClarificationQuestions({ ...proposal, parsedBooking: editedBooking }, rawText, settings)
    : [];

  // Calculate days if dates are present
  const startD = editedBooking.startDate;
  const endD = editedBooking.endDate;
  let daysText = '';
  if (startD && endD) {
    const d = calculateDaysCount(startD, endD);
    daysText = `${d} ${d === 1 ? 'יום' : 'ימים'}`;
  }

  const handleFieldChange = (field: keyof Booking, value: any) => {
    setEditedBooking(prev => {
      const updated = { ...prev, [field]: value };
      
      // Auto re-calc price if dates or service changes and user didn't lock custom price
      if (field === 'startDate' || field === 'endDate' || field === 'serviceType') {
        const s = field === 'startDate' ? value : updated.startDate;
        const srv = field === 'serviceType' ? value : updated.serviceType;
        if (srv === 'training') {
          if (s) updated.endDate = addDays(s, 50);
          updated.totalPrice = settings.defaultDailyRateTraining || 6500;
        } else {
          const e = field === 'endDate' ? value : updated.endDate;
          if (s && e && s <= e) {
            const days = calculateDaysCount(s, e);
            let rate = settings.defaultDailyRateBoarding;
            if (srv === 'day_training') rate = settings.defaultDailyRateDayTraining || 250;
            if (srv === 'daycare') rate = settings.defaultDailyRateDaycare;
            updated.totalPrice = days * rate;
          }
        }
      }
      return updated;
    });
  };

  const handleStartQuestionRecording = (questionId: string) => {
    if (activeRecordingQuestionId === questionId) {
      handleStopQuestionRecording(questionId);
      return;
    }

    if (recognitionRef.current) {
      try {
        if (activeRecordingQuestionId) {
          recognitionRef.current.stop();
        }
        setQuestionTranscript('');
        setActiveRecordingQuestionId(questionId);
        recognitionRef.current.start();
      } catch (err) {
        console.warn('Error starting question mic:', err);
      }
    }
  };

  const handleStopQuestionRecording = (questionId: string) => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
    setActiveRecordingQuestionId(null);

    const answer = questionTranscript.trim();
    if (answer) {
      applyAnswer(questionId as any, answer);
    }
  };

  const applyAnswer = (questionId: ClarificationItem['id'], answerText: string) => {
    const updated = applyClarificationAnswer(editedBooking, questionId, answerText, settings);
    setEditedBooking(updated);
    setClarificationHistory(prev => ({ ...prev, [questionId]: true }));
    setQuestionTranscript('');
  };

  const handleConfirmWithEdits = () => {
    onConfirm({
      ...proposal,
      parsedBooking: editedBooking,
    });
  };

  const getIntentBadge = () => {
    switch (intent) {
      case 'new_booking':
        return <span className="bg-green-100 text-green-800 border border-green-300 text-xs px-2.5 py-1 rounded-full font-bold">✨ הזמנה חדשה לשריון</span>;
      case 'payment_update':
        return <span className="bg-blue-100 text-blue-800 border border-blue-300 text-xs px-2.5 py-1 rounded-full font-bold">💳 עדכון תשלום</span>;
      case 'cancel_booking':
        return <span className="bg-red-100 text-red-800 border border-red-300 text-xs px-2.5 py-1 rounded-full font-bold">❌ ביטול הזמנה</span>;
      case 'clear_all_data':
        return <span className="bg-red-600 text-white text-xs px-2.5 py-1 rounded-full font-bold">🧹 מחיקת כל הנתונים</span>;
      case 'backup_data':
        return <span className="bg-purple-100 text-purple-800 border border-purple-300 text-xs px-2.5 py-1 rounded-full font-bold">💾 הורדת גיבוי</span>;
      case 'navigate_tab':
        return <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs px-2.5 py-1 rounded-full font-bold">🧭 ניווט</span>;
      default:
        return <span className="bg-slate-100 text-slate-700 text-xs px-2.5 py-1 rounded-full font-bold">הוראה</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-lg w-full p-5 sm:p-6 text-slate-900 max-h-[92vh] overflow-y-auto">
        
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-green-50 text-green-700 border border-green-200 flex items-center justify-center font-bold">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-lg text-slate-900">הצעה מהסוכן החכם</h3>
                {getIntentBadge()}
              </div>
              <p className="text-xs text-slate-500">בדוק, השלם פרטים בקול או בלחיצה, ואשר ישירות ליומן</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Natural Explanation */}
        <div className="my-3 bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-900">
          <p className="font-semibold">{explanation || 'הסוכן זיהה את הנתונים הבאים:'}</p>
          <p className="text-xs text-green-700 mt-1 italic">הקלטה/טקסט שנקלט: "{rawText}"</p>
        </div>

        {/* Overbooking Warning Alert if present */}
        {overbookingCheck?.isOverbooked && (
          <div className="mb-3 bg-red-50 border-2 border-red-400 rounded-xl p-3 text-red-900 flex items-start gap-2.5">
            <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-bold text-red-900">אזהרת אובר-בוקינג / תפוסה מלאה!</p>
              <p className="mt-0.5">
                בתאריכים אלו הריזורט יגיע ל-
                <span className="font-extrabold text-red-950"> {overbookingCheck.highestOccupancy} </span>
                כלבים (קיבולת מקסימלית: {overbookingCheck.maxCapacity}).
              </p>
            </div>
          </div>
        )}

        {/* CLARIFICATION QUESTIONS SECTION (Requested by User) */}
        {intent === 'new_booking' && clarificationQuestions.length > 0 && (
          <div className="mb-4 bg-amber-50/70 border-2 border-amber-300 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-amber-900 font-bold text-xs">
                <HelpCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>שאלות להשלמת פרטים ששכחנו בהקלטה (ענה במיקרופון 🎙️ או בלחיצה):</span>
              </div>
            </div>

            <div className="space-y-2.5">
              {clarificationQuestions.map((q) => {
                const isRecordingThis = activeRecordingQuestionId === q.id;
                const isMarkedDone = q.isComplete || clarificationHistory[q.id];

                return (
                  <div 
                    key={q.id} 
                    className={`p-2.5 rounded-xl border transition-all ${
                      isRecordingThis
                        ? 'bg-red-50 border-red-400 shadow-sm'
                        : isMarkedDone
                        ? 'bg-white/90 border-emerald-200'
                        : 'bg-white border-amber-200 shadow-xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-slate-800">{q.question}</span>
                          {isMarkedDone && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded-full">
                              <Check className="w-3 h-3" /> מוגדר: {q.currentValueDisplay}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">{q.description}</p>
                      </div>

                      {/* Microphone Answer Button for this specific question */}
                      <button
                        type="button"
                        onClick={() => isRecordingThis ? handleStopQuestionRecording(q.id) : handleStartQuestionRecording(q.id)}
                        className={`shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer select-none ${
                          isRecordingThis
                            ? 'bg-red-600 text-white animate-pulse shadow-md'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                        }`}
                        title="ענה במיקרופון לשאלה זו"
                      >
                        {isRecordingThis ? (
                          <>
                            <Square className="w-3.5 h-3.5 fill-white" />
                            <span>סיים תשובה</span>
                          </>
                        ) : (
                          <>
                            <Mic className="w-3.5 h-3.5" />
                            <span>ענה בקול 🎙️</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Live recording preview for this question */}
                    {isRecordingThis && (
                      <div className="mt-2 p-2 bg-red-100/80 rounded-lg text-xs text-red-900 flex items-center gap-1.5 animate-fade-in">
                        <span className="animate-ping w-2 h-2 rounded-full bg-red-600 shrink-0"></span>
                        <span className="font-semibold">מקשיב לתשובתך:</span>
                        <span className="italic">{questionTranscript || 'דבר עכשיו...'}</span>
                      </div>
                    )}

                    {/* Quick click options */}
                    <div className="mt-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                      <span className="text-[10px] text-slate-400 font-semibold shrink-0">תשובה מהירה:</span>
                      {q.quickOptions.map((opt, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => applyAnswer(q.id, opt.voiceSample)}
                          className="bg-slate-100 hover:bg-emerald-100 hover:text-emerald-900 hover:border-emerald-300 text-slate-700 border border-slate-200 px-2 py-0.8 rounded-lg text-[11px] font-medium shrink-0 transition-colors cursor-pointer"
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Structured Data / Quick Edit Form */}
        {intent === 'new_booking' || intent === 'payment_update' || intent === 'cancel_booking' ? (
          <div className="space-y-3">
            
            {/* Quick In-Place Edit Toggle */}
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-slate-700">סיכום פרטי ההזמנה שישמרו ביומן:</span>
              <button
                type="button"
                onClick={() => setIsInlineEditOpen(!isInlineEditOpen)}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-lg transition-colors"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>{isInlineEditOpen ? 'סגור עריכה מתקדמת' : '✏️ עריכה ידנית מלאה'}</span>
                {isInlineEditOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>

            {isInlineEditOpen ? (
              /* Inline Fast Editor directly in modal */
              <div className="bg-slate-50 border-2 border-indigo-200 rounded-xl p-3.5 space-y-3 animate-in fade-in">
                <div className="text-xs font-bold text-indigo-900 mb-1 flex items-center gap-1">
                  <span>ערוך ותקן נתונים במקום:</span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">שם הכלב *</label>
                    <input
                      type="text"
                      value={editedBooking.dogName || ''}
                      onChange={(e) => handleFieldChange('dogName', e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:border-indigo-500 focus:outline-hidden"
                      placeholder="שם הכלב"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">שם הבעלים *</label>
                    <input
                      type="text"
                      value={editedBooking.ownerName || ''}
                      onChange={(e) => handleFieldChange('ownerName', e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-900 focus:border-indigo-500 focus:outline-hidden"
                      placeholder="שם הבעלים"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">טלפון לקוח</label>
                    <input
                      type="tel"
                      value={editedBooking.ownerPhone || ''}
                      onChange={(e) => handleFieldChange('ownerPhone', e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-900 focus:border-indigo-500 focus:outline-hidden"
                      placeholder="050-0000000"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">סוג שירות</label>
                    <select
                      value={editedBooking.serviceType || 'boarding'}
                      onChange={(e) => handleFieldChange('serviceType', e.target.value as ServiceType)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-900 focus:border-indigo-500 focus:outline-hidden"
                    >
                      <option value="boarding">🏨 פנסיון לילה (₪{settings.defaultDailyRateBoarding}/יום)</option>
                      <option value="training">🎓 תהליך אילוף (50 יום - ₪{settings.defaultDailyRateTraining || 6500})</option>
                      <option value="day_training">🦮 אילוף ביומיות (₪{settings.defaultDailyRateDayTraining || 250}/יום)</option>
                      <option value="daycare">✂️ יום כיף / שהות יומית (₪{settings.defaultDailyRateDaycare}/יום)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">תאריך כניסה</label>
                    <input
                      type="date"
                      value={editedBooking.startDate || ''}
                      onChange={(e) => handleFieldChange('startDate', e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-mono text-slate-900 focus:border-indigo-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">תאריך יציאה</label>
                    <input
                      type="date"
                      value={editedBooking.endDate || ''}
                      onChange={(e) => handleFieldChange('endDate', e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-mono text-slate-900 focus:border-indigo-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">סה״כ לתשלום (₪)</label>
                    <input
                      type="number"
                      value={editedBooking.totalPrice === 0 ? '' : (editedBooking.totalPrice ?? '')}
                      onChange={(e) => handleFieldChange('totalPrice', e.target.value === '' ? 0 : Number(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:border-indigo-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">שולם כמקדמה (₪)</label>
                    <input
                      type="number"
                      value={editedBooking.depositAmount === 0 ? '' : (editedBooking.depositAmount ?? '')}
                      onChange={(e) => handleFieldChange('depositAmount', e.target.value === '' ? 0 : Number(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-green-700 focus:border-indigo-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">הערות ודרישות מיוחדות</label>
                  <input
                    type="text"
                    value={editedBooking.notes || ''}
                    onChange={(e) => handleFieldChange('notes', e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-hidden"
                    placeholder="למשל: תרופה בבוקר, אוכל רפואי, שינוי שעת הגעה..."
                  />
                </div>
              </div>
            ) : (
              /* Summary Card View */
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 text-sm">
                
                {/* Dog & Owner */}
                <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-200">
                  <div>
                    <span className="text-xs text-slate-500 block mb-0.5 flex items-center gap-1">
                      <Dog className="w-3.5 h-3.5 text-green-600" /> שם הכלב
                    </span>
                    <span className="font-bold text-base text-slate-900">
                      {editedBooking.dogName || 'לא צוין'}
                      {editedBooking.dogBreed && <span className="text-xs text-slate-500 font-normal mr-1">({editedBooking.dogBreed})</span>}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block mb-0.5 flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-indigo-500" /> בעלים / איש קשר
                    </span>
                    <span className="font-semibold text-slate-900">
                      {editedBooking.ownerName || 'לקוח'}
                      {editedBooking.ownerPhone && (
                        <span className="text-xs text-slate-500 block font-mono">
                          {editedBooking.ownerPhone}
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Service & Dates */}
                <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-200">
                  <div>
                    <span className="text-xs text-slate-500 block mb-0.5">סוג שירות</span>
                    <span className="inline-block bg-white text-slate-800 text-xs px-2.5 py-1 rounded-md font-semibold border border-slate-200">
                      {getServiceTypeHebrew(editedBooking.serviceType || 'boarding')}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block mb-0.5 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-amber-600" /> תאריכים {daysText && <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.2 rounded text-[11px]">({daysText})</span>}
                    </span>
                    <span className="font-semibold text-slate-900 text-xs flex items-center gap-1">
                      <span>{editedBooking.startDate ? formatDateIL(editedBooking.startDate) : 'היום'}</span>
                      <span className="text-slate-400">עד</span>
                      <span>{editedBooking.endDate ? formatDateIL(editedBooking.endDate) : 'לא נקבע'}</span>
                    </span>
                  </div>
                </div>

                {/* Pricing & Payments with Live Direct Entry & Verification */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                      <DollarSign className="w-4 h-4 text-emerald-600" />
                      <span>תשלום ומקדמה שנקלטו:</span>
                    </span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${
                      remainingDebt === 0 && roundedTotal > 0
                        ? 'bg-emerald-100 text-emerald-800'
                        : roundedDeposit > 0
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {remainingDebt === 0 && roundedTotal > 0 ? '✓ שולם במלואו' : roundedDeposit > 0 ? `מקדמה ₪${roundedDeposit}` : 'חוב פתוח'}
                    </span>
                  </div>

                  {/* 3 Quick Action Buttons */}
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        handleFieldChange('depositAmount', roundedTotal);
                        handleFieldChange('paymentStatus', 'fully_paid');
                      }}
                      className={`p-1.5 text-center rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                        remainingDebt === 0 && roundedTotal > 0
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-slate-50 hover:bg-emerald-50 text-slate-700 border-slate-200 hover:border-emerald-300'
                      }`}
                    >
                      <span>🟢 שולם הכל במלואו</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const half = Math.round(roundedTotal / 2);
                        handleFieldChange('depositAmount', roundedDeposit > 0 ? roundedDeposit : (half || 150));
                        handleFieldChange('paymentStatus', 'deposit_paid');
                      }}
                      className={`p-1.5 text-center rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                        roundedDeposit > 0 && remainingDebt > 0
                          ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                          : 'bg-slate-50 hover:bg-amber-50 text-slate-700 border-slate-200 hover:border-amber-300'
                      }`}
                    >
                      <span>🟡 שולמה מקדמה</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        handleFieldChange('depositAmount', 0);
                        handleFieldChange('paymentStatus', 'unpaid');
                      }}
                      className={`p-1.5 text-center rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                        roundedDeposit === 0
                          ? 'bg-red-500 text-white border-red-500 shadow-xs'
                          : 'bg-slate-50 hover:bg-red-50 text-slate-700 border-slate-200 hover:border-red-300'
                      }`}
                    >
                      <span>🔴 טרם שולם</span>
                    </button>
                  </div>

                  {/* Direct Payment Fields */}
                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                        סה״כ סכום ההזמנה (₪):
                      </label>
                      <input
                        type="number"
                        value={editedBooking.totalPrice === 0 ? '' : (editedBooking.totalPrice ?? '')}
                        onChange={(e) => {
                          const val = e.target.value === '' ? 0 : Number(e.target.value) || 0;
                          handleFieldChange('totalPrice', val);
                          if (editedBooking.paymentStatus === 'fully_paid') {
                            handleFieldChange('depositAmount', val);
                          }
                        }}
                        placeholder="0"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-black text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                        סכום ששולם בפועל (₪):
                      </label>
                      <input
                        type="number"
                        value={editedBooking.depositAmount === 0 ? '' : (editedBooking.depositAmount ?? '')}
                        onChange={(e) => {
                          const val = e.target.value === '' ? 0 : Number(e.target.value) || 0;
                          handleFieldChange('depositAmount', val);
                          handleFieldChange('paymentStatus', (val >= roundedTotal && roundedTotal > 0) ? 'fully_paid' : val > 0 ? 'deposit_paid' : 'unpaid');
                        }}
                        placeholder="0"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-black text-emerald-700 focus:border-indigo-500 focus:bg-white focus:outline-hidden"
                      />
                    </div>
                  </div>

                  {/* Balance / Remaining Debt Status */}
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                    <span className="text-slate-600 font-medium">יתרה לגבייה בעזיבה:</span>
                    <span className={`font-black text-sm ${remainingDebt > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {remainingDebt > 0 ? `₪${remainingDebt.toLocaleString('he-IL')} (חוב פתוח)` : '₪0 (שולם במלואו ✓)'}
                    </span>
                  </div>
                </div>

                {editedBooking.notes && (
                  <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-2 text-xs text-amber-900">
                    <span className="font-bold">הערות ודרישות מיוחדות:</span> {editedBooking.notes}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-center space-y-3">
            <div className="text-3xl">
              {intent === 'clear_all_data' ? '🧹' : intent === 'backup_data' ? '💾' : '🧭'}
            </div>
            <p className="font-bold text-slate-900 text-base">
              {intent === 'clear_all_data' && 'מחיקת כל הנתונים וההזמנות מהענן'}
              {intent === 'backup_data' && 'יצירת קובץ גיבוי מלא של הריזורט'}
              {intent === 'navigate_tab' && 'מעבר ישיר למסך המבוקש'}
            </p>
            <p className="text-xs text-slate-500">
              {intent === 'clear_all_data' && 'פעולה זו תמחק את כל ההזמנות הקיימות ותנקה את היומן לחלוטין.'}
              {intent === 'backup_data' && 'קובץ JSON מאובטח יורד מיד למכשירך.'}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-5 flex flex-col sm:flex-row gap-2.5">
          <button
            type="button"
            onClick={handleConfirmWithEdits}
            className={`flex-1 active:scale-98 text-white py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer ${
              intent === 'clear_all_data' 
                ? 'bg-red-600 hover:bg-red-700 shadow-red-600/20' 
                : 'bg-green-600 hover:bg-green-700 shadow-green-600/20'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 stroke-[3]" />
            <span>
              {intent === 'clear_all_data' && '🧹 אשר מחיקה מלאה'}
              {intent === 'backup_data' && '💾 הורד גיבוי עכשיו'}
              {intent === 'cancel_booking' && '🗑️ אשר ביטול הזמנה'}
              {intent === 'payment_update' && '💳 אשר עדכון תשלום'}
              {intent === 'new_booking' && '➕ אשר והוסף ליומן'}
              {intent === 'navigate_tab' && '🚀 עבור למסך עכשיו'}
            </span>
          </button>

          {(intent === 'new_booking' || intent === 'payment_update') && (
            <button
              type="button"
              onClick={() => onEditManually(editedBooking)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-200"
            >
              <Edit3 className="w-4 h-4 text-amber-600" />
              <span>ערוך בטופס מלא</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="bg-transparent hover:bg-slate-100 text-slate-500 hover:text-slate-800 py-3 px-3 rounded-xl font-semibold text-xs transition-colors cursor-pointer"
          >
            בטל
          </button>
        </div>
      </div>
    </div>
  );
};


