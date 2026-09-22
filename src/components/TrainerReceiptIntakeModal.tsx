import React, { useState } from 'react';
import { 
  X, Check, AlertTriangle, Send, FileText, 
  Calendar, CheckCircle, Clock, Plus, Trash2,
  GraduationCap
} from 'lucide-react';
import { Booking, TrainerReceipt, TrainerStageType } from '../types';
import { 
  HILA_TRAINER_INFO, 
  parseHilaReceiptText, 
  formatManagerReceiptQuery,
  normalizeDogName 
} from '../utils/trainerPaymentUtils';

interface TrainerReceiptIntakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveReceipt: (receipt: TrainerReceipt) => void;
  trainingBookings: Booking[];
  existingReceipt?: TrainerReceipt;
  greenApiId?: string;
  greenApiToken?: string;
}

export const TrainerReceiptIntakeModal: React.FC<TrainerReceiptIntakeModalProps> = ({
  isOpen,
  onClose,
  onSaveReceipt,
  trainingBookings,
  existingReceipt,
  greenApiId,
  greenApiToken,
}) => {
  if (!isOpen) return null;

  const [receiptNumber, setReceiptNumber] = useState(existingReceipt?.receiptNumber || '20056');
  const [receiptDate, setReceiptDate] = useState(existingReceipt?.receiptDate || new Date().toISOString().substring(0, 10));
  const [paymentMethod, setPaymentMethod] = useState(existingReceipt?.paymentMethod || 'ביט');
  const [receiptImageUrl, setReceiptImageUrl] = useState(existingReceipt?.receiptImageUrl || '');
  const [rawText, setRawText] = useState(existingReceipt?.rawLineText || 'גוי תשלום 2/3 + תיאן תשלום 1/3');
  
  // Allocations list
  const [allocations, setAllocations] = useState<{
    bookingId: string;
    dogName: string;
    stage: TrainerStageType;
    amount: number;
  }[]>(
    existingReceipt?.allocations || [
      { bookingId: '', dogName: "ג'וי", stage: '2/3', amount: 500 },
      { bookingId: '', dogName: 'תיאו (תיאן)', stage: '1/3', amount: 500 },
    ]
  );

  // Is Actually Paid Status
  const [isPaidActually, setIsPaidActually] = useState(existingReceipt?.isPaidActually ?? false);
  const [paidDate, setPaidDate] = useState(existingReceipt?.paidDate || new Date().toISOString().substring(0, 10));
  const [paymentConfirmationNotes, setPaymentConfirmationNotes] = useState(existingReceipt?.paymentConfirmationNotes || '');
  const [paymentConfirmationUrl, setPaymentConfirmationUrl] = useState(existingReceipt?.paymentConfirmationUrl || '');
  
  // WhatsApp Notification Status
  const [querySent, setQuerySent] = useState(existingReceipt?.managerQuerySent ?? false);
  const [isSendingQuery, setIsSendingQuery] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const totalCalculated = allocations.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);

  // Trigger quick text parse
  const handleParseText = () => {
    if (!rawText.trim()) return;
    const parsed = parseHilaReceiptText(rawText, trainingBookings);
    if (parsed.detectedReceiptNumber) setReceiptNumber(parsed.detectedReceiptNumber);
    if (parsed.allocations.length > 0) {
      setAllocations(
        parsed.allocations.map(a => ({
          bookingId: a.booking?.id || '',
          dogName: a.dogName,
          stage: a.stage,
          amount: a.amount,
        }))
      );
    }
  };

  const handleAddAllocation = () => {
    const firstDog = trainingBookings[0]?.dogName || 'כלב חדש';
    const firstId = trainingBookings[0]?.id || '';
    setAllocations(prev => [
      ...prev,
      { bookingId: firstId, dogName: firstDog, stage: '1/3', amount: 500 },
    ]);
  };

  const handleRemoveAllocation = (index: number) => {
    setAllocations(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateAllocation = (index: number, field: string, val: any) => {
    setAllocations(prev => {
      const next = [...prev];
      if (field === 'dogName') {
        const found = trainingBookings.find(b => normalizeDogName(b.dogName) === normalizeDogName(val));
        next[index] = { ...next[index], dogName: val, bookingId: found?.id || '' };
      } else {
        next[index] = { ...next[index], [field]: val };
      }
      return next;
    });
  };

  // Send WhatsApp Query to Manager 054-3200007
  const handleSendQueryToManager = async () => {
    const dummyReceipt: TrainerReceipt = {
      id: existingReceipt?.id || `rcpt-${Date.now()}`,
      receiptNumber,
      receiptDate,
      totalAmount: totalCalculated,
      paymentMethod,
      receiptImageUrl,
      rawLineText: rawText,
      allocations,
      isPaidActually,
      paidDate: isPaidActually ? paidDate : undefined,
      paymentConfirmationNotes,
      paymentConfirmationUrl,
      managerQuerySent: true,
      managerQuerySentAt: new Date().toISOString(),
      status: isPaidActually ? 'paid' : 'pending_payment',
      createdAt: existingReceipt?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const messageText = formatManagerReceiptQuery(dummyReceipt);

    setIsSendingQuery(true);
    try {
      if (greenApiId && greenApiToken) {
        const phone = HILA_TRAINER_INFO.managerNotificationPhone; // 0543200007
        const chatId = `972${phone.startsWith('0') ? phone.slice(1) : phone}@c.us`;
        const res = await fetch(`https://api.green-api.com/waInstance${greenApiId}/sendMessage/${greenApiToken}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId, message: messageText }),
        });
        if (res.ok) {
          setQuerySent(true);
          setToastMessage('השאילתה נשלחה בהצלחה לוואטסאפ של המנהל (054-3200007)!');
        } else {
          // Open WhatsApp web link as fallback
          const waUrl = `https://wa.me/972${phone.slice(1)}?text=${encodeURIComponent(messageText)}`;
          window.open(waUrl, '_blank');
          setQuerySent(true);
        }
      } else {
        // Fallback to wa.me link
        const phone = HILA_TRAINER_INFO.managerNotificationPhone;
        const waUrl = `https://wa.me/972${phone.slice(1)}?text=${encodeURIComponent(messageText)}`;
        window.open(waUrl, '_blank');
        setQuerySent(true);
      }
    } catch {
      const phone = HILA_TRAINER_INFO.managerNotificationPhone;
      const waUrl = `https://wa.me/972${phone.slice(1)}?text=${encodeURIComponent(messageText)}`;
      window.open(waUrl, '_blank');
      setQuerySent(true);
    } finally {
      setIsSendingQuery(false);
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  const handleSave = () => {
    const finalReceipt: TrainerReceipt = {
      id: existingReceipt?.id || `rcpt-${Date.now()}`,
      receiptNumber: receiptNumber.trim() || 'קבלה',
      receiptDate,
      totalAmount: totalCalculated,
      paymentMethod,
      receiptImageUrl,
      rawLineText: rawText,
      allocations,
      isPaidActually,
      paidDate: isPaidActually ? paidDate : undefined,
      paymentConfirmationNotes,
      paymentConfirmationUrl,
      managerQuerySent: querySent,
      managerQuerySentAt: querySent ? (existingReceipt?.managerQuerySentAt || new Date().toISOString()) : undefined,
      status: isPaidActually ? 'paid' : 'pending_payment',
      createdAt: existingReceipt?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSaveReceipt(finalReceipt);
    onClose();
  };

  const hasGraduation = allocations.some(a => a.stage === '3/3');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200" dir="rtl">
      <div className="bg-white border border-purple-200 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden text-slate-900">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-purple-100 bg-linear-to-r from-purple-50 via-indigo-50/50 to-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-600 text-white rounded-2xl shadow-md">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-purple-950 flex items-center gap-2">
                <span>קליטת קבלה מהילה המאלפת</span>
                <span className="text-xs font-semibold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full border border-purple-200">
                  {HILA_TRAINER_INFO.businessName} (ע.פ {HILA_TRAINER_INFO.dealerNumber})
                </span>
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                סיווג אוטומטי של כלבים ושלבי תשלום (1/3, 2/3, 3/3) וסנכרון מול אישור התשלום
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {toastMessage && (
          <div className="bg-emerald-50 text-emerald-800 border-b border-emerald-200 px-4 py-2 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Form Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs sm:text-sm">

          {/* Section 1: Raw text input & auto classification */}
          <div className="bg-purple-50/60 border border-purple-200/80 rounded-2xl p-3.5 space-y-2">
            <label className="block text-xs font-black text-purple-900">
              ✍️ מה הילה כתבה בקבלה / בוואטסאפ (זיהוי אוטומטי):
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={rawText}
                onChange={e => setRawText(e.target.value)}
                placeholder="למשל: גוי תשלום 2/3 + תיאן תשלום 1/3"
                className="flex-1 bg-white border border-purple-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-purple-400"
              />
              <button
                type="button"
                onClick={handleParseText}
                className="bg-purple-700 hover:bg-purple-800 text-white font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1 shadow-2xs cursor-pointer transition-colors"
              >
                סווג אוטומטית
              </button>
            </div>
            <p className="text-[11px] text-purple-700 font-medium">
              המערכת מזהה אוטומטית את שם הכלב, שלב התשלום (1/3, 2/3, 3/3) ומחשבת ₪500 לכל שלב.
            </p>
          </div>

          {/* Section 2: General Receipt Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                מספר קבלה *
              </label>
              <input
                type="text"
                value={receiptNumber}
                onChange={e => setReceiptNumber(e.target.value)}
                placeholder="20056"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-black text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-400"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                תאריך קבלה *
              </label>
              <input
                type="date"
                value={receiptDate}
                onChange={e => setReceiptDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-400"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                אמצעי תשלום בקבלה
              </label>
              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-400"
              >
                <option value="ביט">ביט (Bit)</option>
                <option value="העברה בנקאית">העברה בנקאית</option>
                <option value="מזומן">מזומן</option>
                <option value="כרטיס אשראי">כרטיס אשראי</option>
              </select>
            </div>
          </div>

          {/* Receipt image link or upload */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              📷 קישור / תמונת הקבלה (אופציונלי):
            </label>
            <input
              type="text"
              value={receiptImageUrl}
              onChange={e => setReceiptImageUrl(e.target.value)}
              placeholder="כתובת תמונה או צילום מוואטסאפ..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-400"
            />
          </div>

          {/* Section 3: Dog Allocations */}
          <div className="border border-slate-200 rounded-2xl p-3 sm:p-4 bg-slate-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                <span>🐕 שיוך כלבים ושלבי תשלום בקבלה</span>
                <span className="text-[11px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                  סה״כ: ₪{totalCalculated.toLocaleString('he-IL')}
                </span>
              </span>
              <button
                type="button"
                onClick={handleAddAllocation}
                className="text-xs font-bold text-purple-700 hover:text-purple-900 bg-white border border-purple-200 hover:border-purple-300 px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>הוסף שורת כלב</span>
              </button>
            </div>

            <div className="space-y-2">
              {allocations.map((alloc, idx) => (
                <div 
                  key={idx} 
                  className="bg-white border border-slate-200 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-2 shadow-2xs"
                >
                  {/* Dog Name */}
                  <div className="flex-1 min-w-[140px]">
                    <span className="text-[10px] font-bold text-slate-500 block mb-0.5">שם הכלב</span>
                    <input
                      type="text"
                      value={alloc.dogName}
                      onChange={e => handleUpdateAllocation(idx, 'dogName', e.target.value)}
                      placeholder="שם הכלב באילוף..."
                      list="training-dogs-datalist"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800"
                    />
                  </div>

                  {/* Stage */}
                  <div className="w-32">
                    <span className="text-[10px] font-bold text-slate-500 block mb-0.5">שלב תשלום</span>
                    <select
                      value={alloc.stage}
                      onChange={e => handleUpdateAllocation(idx, 'stage', e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-800"
                    >
                      <option value="1/3">תשלום 1/3 (ראשון)</option>
                      <option value="2/3">תשלום 2/3 (אמצע)</option>
                      <option value="3/3">תשלום 3/3 (סוף תשלום)</option>
                      <option value="custom">מותאם אישית</option>
                    </select>
                  </div>

                  {/* Amount */}
                  <div className="w-24">
                    <span className="text-[10px] font-bold text-slate-500 block mb-0.5">סכום (₪)</span>
                    <input
                      type="number"
                      value={alloc.amount}
                      onChange={e => handleUpdateAllocation(idx, 'amount', Number(e.target.value) || 0)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-800 text-center"
                    />
                  </div>

                  {/* Remove action */}
                  <button
                    type="button"
                    onClick={() => handleRemoveAllocation(idx)}
                    disabled={allocations.length <= 1}
                    className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg disabled:opacity-30 cursor-pointer mt-3"
                    title="מחק שורה"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {hasGraduation && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-xs font-bold text-emerald-800 flex items-center gap-2 animate-in fade-in">
                <GraduationCap className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  🎓 שים לב: תשלום 3/3 מסמן סיום תשלום! הכלב יועבר אוטומטית ללשונית "הסתיים האילוף".
                </span>
              </div>
            )}
          </div>

          <datalist id="training-dogs-datalist">
            {trainingBookings.map(b => (
              <option key={b.id} value={b.dogName}>{b.ownerName}</option>
            ))}
          </datalist>

          {/* Section 4: CRUCIAL DUAL-STATUS CHECK - Is actually paid? */}
          <div className="border-2 border-indigo-200 bg-indigo-50/40 rounded-2xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs sm:text-sm font-black text-indigo-950 block">
                  ❓ האם שולם להילה בפועל, וכמה?
                </span>
                <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                  הילה שולחת לעיתים קבלה מראש מתוך אמון. בחר האם התשלום כבר בוצע בביט, או שכרגע הקבלה ממתינה לתשלום:
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              {/* Option A: Paid */}
              <button
                type="button"
                onClick={() => setIsPaidActually(true)}
                className={`p-3 rounded-xl border text-right transition-all cursor-pointer flex items-center gap-2.5 ${
                  isPaidActually
                    ? 'bg-emerald-100 border-emerald-500 text-emerald-950 ring-2 ring-emerald-500 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className={`p-1.5 rounded-full ${isPaidActually ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                  <Check className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-black">✅ שולם בפועל כעת בביט</div>
                  <div className="text-[10px] text-slate-500">העברתי להילה את הכסף והחשבון סגור</div>
                </div>
              </button>

              {/* Option B: Pending */}
              <button
                type="button"
                onClick={() => setIsPaidActually(false)}
                className={`p-3 rounded-xl border text-right transition-all cursor-pointer flex items-center gap-2.5 ${
                  !isPaidActually
                    ? 'bg-rose-100 border-rose-500 text-rose-950 ring-2 ring-rose-500 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className={`p-1.5 rounded-full ${!isPaidActually ? 'bg-rose-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-black">⏳ ממתין לתשלום בפועל</div>
                  <div className="text-[10px] text-slate-500">הקבלה התקבלה מראש – יוצג בהתראה בולטת!</div>
                </div>
              </button>
            </div>

            {/* Payment Details when Paid */}
            {isPaidActually && (
              <div className="pt-2 border-t border-indigo-100 space-y-2 animate-in fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] font-bold text-slate-600 block mb-0.5">תאריך ביצוע התשלום</span>
                    <input
                      type="date"
                      value={paidDate}
                      onChange={e => setPaidDate(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-600 block mb-0.5">אסמכתא / הערת תשלום</span>
                    <input
                      type="text"
                      value={paymentConfirmationNotes}
                      onChange={e => setPaymentConfirmationNotes(e.target.value)}
                      placeholder="הועבר בביט / העברה בנקאית..."
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800"
                    />
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-600 block mb-0.5">צילום אישור תשלום ביט (אופציונלי לתיוק)</span>
                  <input
                    type="text"
                    value={paymentConfirmationUrl}
                    onChange={e => setPaymentConfirmationUrl(e.target.value)}
                    placeholder="קישור לתמונת אישור ביט מוואטסאפ..."
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800"
                  />
                </div>
              </div>
            )}

            {!isPaidActually && (
              <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-2.5 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  הקבלה תופיע באדום תחת <strong>קבלות שממתינות לתשלום בביט</strong>, כך שלא ייפול פספוס או חוב להילה.
                </span>
              </div>
            )}
          </div>

          {/* Section 5: Direct WhatsApp Query to Manager 054-3200007 */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-slate-800 block">
                📱 שליחת שאילתה מיידית למנהל ({HILA_TRAINER_INFO.managerNotificationPhone})
              </span>
              <p className="text-[11px] text-slate-500 font-medium">
                שולח הודעת וואטסאפ: "האם שולם וכמה?" כדי שתוכל להשיב או לשלוח אישור תשלום ביט
              </p>
            </div>
            <button
              type="button"
              onClick={handleSendQueryToManager}
              disabled={isSendingQuery}
              className="bg-green-600 hover:bg-green-700 text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{querySent ? 'שלח שאילתה שוב' : 'שלח שאילתה לוואטסאפ'}</span>
            </button>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="text-xs font-bold text-slate-700">
            סה״כ בקבלה: <strong className="text-purple-700 text-base">₪{totalCalculated.toLocaleString('he-IL')}</strong>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              ביטול
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 text-xs font-black text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-md transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>שמור קבלה ועדכן כלבים</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
