import React, { useState, useEffect } from 'react';
import { X, Send, Copy, Check, Calendar, AlertCircle, CheckCircle, RefreshCw, Smartphone, ShieldCheck } from 'lucide-react';
import { Booking, ResortSettings, IntakeRequest } from '../types';
import { 
  formatTomorrowOverviewReport, 
  sendTomorrowOverviewToShmulik,
  checkIfOverviewAlreadySentToday
} from '../services/morningReportService';
import { getTodayStr, addDays, getDayNameHebrew, formatDateIL } from '../utils/dateUtils';
import { cleanPhoneNumber } from '../utils/whatsappUtils';

interface TomorrowOverviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookings: Booking[];
  settings: ResortSettings;
  intakeRequests: IntakeRequest[];
  showToast?: (msg: string) => void;
}

export const TomorrowOverviewModal: React.FC<TomorrowOverviewModalProps> = ({
  isOpen,
  onClose,
  bookings,
  settings,
  intakeRequests,
  showToast
}) => {
  const [isSending, setIsSending] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; text: string } | null>(null);
  const [alreadySentStatus, setAlreadySentStatus] = useState<{ alreadySent: boolean; reason?: string } | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  const today = getTodayStr();
  const tomorrow = addDays(today, 1);
  const tomorrowDayName = getDayNameHebrew(tomorrow);
  const tomorrowFormatted = formatDateIL(tomorrow);

  const managerPhone = cleanPhoneNumber(settings?.whatsappNotificationPhone || settings?.managerPhone || '0548765888');
  const reportText = formatTomorrowOverviewReport(
    settings?.managerName || 'שמוליק',
    bookings,
    settings,
    intakeRequests,
    today
  );

  const checkStatus = async () => {
    setIsCheckingStatus(true);
    try {
      const res = await checkIfOverviewAlreadySentToday(today, settings);
      setAlreadySentStatus(res);
    } catch (e) {
      console.warn(e);
    } finally {
      setIsCheckingStatus(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      checkStatus();
      setSendResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(reportText);
    setIsCopied(true);
    showToast?.('הודעת הסקירה הועתקה ללוח בהצלחה!');
    setTimeout(() => setIsCopied(false), 2500);
  };

  const handleSendNow = async (force: boolean = false) => {
    setIsSending(true);
    setSendResult(null);
    try {
      const res = await sendTomorrowOverviewToShmulik(
        bookings,
        settings,
        intakeRequests,
        { force }
      );

      if (res.success) {
        setSendResult({ success: true, text: res.message || 'הסקירה נשלחה בהצלחה לוואטסאפ של שמוליק!' });
        showToast?.('הסקירה נשלחה בהצלחה לוואטסאפ של שמוליק!');
        checkStatus();
      } else {
        setSendResult({ success: false, text: res.error || 'שגיאה בשליחת הסקירה' });
      }
    } catch (e: any) {
      setSendResult({ success: false, text: e.message || 'שגיאה בלתי צפויה בשליחה' });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-auto"
        dir="rtl"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-900 via-blue-900 to-indigo-950 text-white p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-500/30 border border-indigo-400/40 flex items-center justify-center text-xl shadow-inner">
              📋
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black flex items-center gap-2">
                מה קורה מחר בריזורט?
                <span className="text-xs bg-indigo-500/40 text-indigo-200 px-2 py-0.5 rounded-full border border-indigo-400/30">
                  שעה 19:00
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-indigo-200/90 font-medium">
                סקירה יומית מלאה לשמוליק – יום {tomorrowDayName}, {tomorrowFormatted}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-indigo-200 hover:text-white hover:bg-white/10 p-2 rounded-xl transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Status Alert Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-bold text-slate-700">סטטוס שליחה להיום:</span>
              {isCheckingStatus ? (
                <span className="text-slate-400 flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin" /> בודק 4 שכבות הגנה...
                </span>
              ) : alreadySentStatus?.alreadySent ? (
                <span className="text-emerald-700 font-black bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" /> נשלח היום (0 כפילויות)
                </span>
              ) : (
                <span className="text-amber-700 font-bold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg flex items-center gap-1">
                  ⏳ טרם נשלח (מתוזמן ל-19:00)
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
              <Smartphone className="w-3.5 h-3.5 text-slate-400" />
              <span>יעד: {managerPhone}</span>
            </div>
          </div>

          {/* WhatsApp Preview Box */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-600 px-1">
              <span>תצוגה מקדימה מדויקת (איך שזה יופיע בוואטסאפ של שמוליק):</span>
              <button
                onClick={handleCopy}
                className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer transition-colors"
              >
                {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{isCopied ? 'הועתק!' : 'העתק טקסט'}</span>
              </button>
            </div>

            <div className="bg-[#efeae2] p-3 sm:p-4 rounded-2xl border border-slate-300 font-sans text-xs sm:text-sm text-slate-800 whitespace-pre-wrap leading-relaxed shadow-inner max-h-[350px] overflow-y-auto selection:bg-emerald-200">
              {reportText}
            </div>
          </div>

          {/* Feedback banner */}
          {sendResult && (
            <div className={`p-3.5 rounded-xl border flex items-center gap-2.5 text-xs sm:text-sm font-bold ${
              sendResult.success 
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800' 
                : 'bg-rose-50 border-rose-300 text-rose-800'
            }`}>
              {sendResult.success ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{sendResult.text}</span>
            </div>
          )}

          {/* Info Notes */}
          <div className="p-3 bg-indigo-50/70 border border-indigo-200/60 rounded-xl text-indigo-950 text-xs space-y-1">
            <p className="font-bold flex items-center gap-1.5 text-indigo-900">
              💡 <span>איך פועלת האוטומציה החדשה ב-19:00:</span>
            </p>
            <ul className="list-disc list-inside space-y-0.5 text-indigo-800/90 pr-1">
              <li>ההודעה נשלחת אוטומטית בכל יום בשעה <strong>19:00 בדיוק</strong> לוואטסאפ של שמוליק.</li>
              <li>מכינה סקירה מלאה לכל אירועי מחר: כניסות, שחרורים, יתרות תשלום מודגשות, תפוסה ודגשים.</li>
              <li>בכל כלב עם חוב, מצורף קישור <strong>wa.me</strong> ישיר לבעלים עם תזכורת נעימה שמחר הכלב מתחיל/מסיים את השהות בריזורט, עם אפשרות לעריכת הטקסט ישירות בוואטסאפ לפני השליחה!</li>
              <li><strong>מנגנון 4 שכבות הגנה:</strong> מונע 100% כפילויות בכל המכשירים והדפדפנים.</li>
              <li><strong>ערב כיפור:</strong> מוחרג הרמטית מהשליחה.</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs sm:text-sm font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-xl transition-all cursor-pointer"
          >
            סגור חלון
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="px-3.5 py-2 text-xs sm:text-sm font-bold bg-white border border-slate-300 hover:border-indigo-400 text-slate-700 rounded-xl shadow-2xs hover:bg-slate-50 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              {isCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
              <span>{isCopied ? 'הועתק ללוח' : 'העתק'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleSendNow(true)}
              disabled={isSending}
              className="px-4 py-2 text-xs sm:text-sm font-black bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {isSending ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>שולח...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>שלח לשמוליק עכשיו בוואטסאפ</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
