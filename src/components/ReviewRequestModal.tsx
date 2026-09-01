import React, { useState } from 'react';
import { 
  X, 
  MessageSquare, 
  Dog, 
  User, 
  Phone, 
  Calendar, 
  Star, 
  Share2, 
  ChevronRight, 
  ChevronLeft, 
  CheckCircle2, 
  ExternalLink,
  Clock
} from 'lucide-react';
import { Booking } from '../types';
import { formatDateIL, calculateDaysCount } from '../utils/dateUtils';
import { openWhatsAppMessage } from '../utils/whatsappUtils';

interface ReviewRequestModalProps {
  pendingBookings: Booking[];
  onClose: () => void;
  onHandled: (bookingId: string) => void;
}

export const buildReviewMessageText = (ownerName: string, dogName: string): string => {
  return `היי ${ownerName || 'יקר/ה'}😊
שמחנו ממש לארח אותך ואת ${dogName || 'הכלב/ה'} אצלנו בריזורט לכלב🐾🤍
נשמח מאוד לשמוע איך היה לכם! 
כמה מילים מכם על החוויה שלכם תמיד עוזרות לנו להשתפר 🙏🏻
בנוסף, אתם יותר ממוזמנים לעקוב אחרינו ברשתות החברתיות - כדי להישאר מעודכנים, לראות תמונות מתוקות של האורחים שלנו, וכמובן לשתף אותנו בחוויות שלכם.
נשמח לשמוע אותם
https://maps.app.goo.gl/G31uwaQXP6Ln5myX9
https://www.facebook.com/profile.php?id=61576998315714&sk=reviews
https://www.instagram.com/dogz.resort/

מחכים לראות אתכם שוב! 
שימרו איתנו על קשר
צוות הריזורט לכלב🐶`;
};

export const ReviewRequestModal: React.FC<ReviewRequestModalProps> = ({
  pendingBookings,
  onClose,
  onHandled,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!pendingBookings || pendingBookings.length === 0) return null;

  const currentBooking = pendingBookings[Math.min(currentIndex, pendingBookings.length - 1)];
  const [customText, setCustomText] = useState(() => 
    buildReviewMessageText(currentBooking?.ownerName || '', currentBooking?.dogName || '')
  );

  // Update text when current booking changes
  const handleBookingChange = (newIndex: number) => {
    setCurrentIndex(newIndex);
    const b = pendingBookings[newIndex];
    if (b) {
      setCustomText(buildReviewMessageText(b.ownerName, b.dogName));
    }
  };

  const handleApproveAndSend = () => {
    if (!currentBooking) return;
    openWhatsAppMessage(currentBooking.ownerPhone, customText);
    onHandled(currentBooking.id);

    if (pendingBookings.length > 1) {
      const nextIndex = currentIndex < pendingBookings.length - 1 ? currentIndex : 0;
      handleBookingChange(nextIndex);
    } else {
      onClose();
    }
  };

  const handleCancelAndDismiss = () => {
    if (!currentBooking) return;
    onHandled(currentBooking.id);

    if (pendingBookings.length > 1) {
      const nextIndex = currentIndex < pendingBookings.length - 1 ? currentIndex : 0;
      handleBookingChange(nextIndex);
    } else {
      onClose();
    }
  };

  const daysCount = calculateDaysCount(currentBooking.startDate, currentBooking.endDate);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden text-slate-900 flex flex-col">
        
        {/* Header with Warm Resort Amber/Golden Theme */}
        <div className="p-4 sm:p-5 bg-gradient-to-l from-amber-500/15 via-emerald-500/10 to-amber-500/5 border-b border-amber-200/60 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500 text-white shadow-md flex items-center justify-center font-bold shrink-0">
              <Star className="w-6 h-6 fill-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-lg sm:text-xl text-slate-900">
                  בקשת חוות דעת ללקוח ⭐
                </h3>
                {pendingBookings.length > 1 && (
                  <span className="text-xs bg-amber-100 text-amber-900 border border-amber-300 font-bold px-2 py-0.5 rounded-full">
                    {currentIndex + 1} מתוך {pendingBookings.length}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                הכלב שוחרר אתמול — זמן מעולה לשליחת בקשת דירוג וחוות דעת!
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white/80 rounded-xl transition-colors cursor-pointer"
            title="סגור כעת (הזכר לי בפעם הבאה)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 space-y-3.5 flex-1 overflow-y-auto max-h-[75vh]">
          
          {/* Released Dog Profile Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-black text-lg text-slate-900">
                  🐾 {currentBooking.dogName}
                </span>
                {currentBooking.dogBreed && (
                  <span className="text-xs text-slate-500 font-medium">
                    ({currentBooking.dogBreed})
                  </span>
                )}
              </div>
              <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full border border-emerald-200">
                השתחרר אתמול ✓
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 pt-1 border-t border-slate-200/60">
              <span className="flex items-center gap-1 font-semibold text-slate-800">
                <User className="w-3.5 h-3.5 text-indigo-500" /> {currentBooking.ownerName}
              </span>
              <span className="flex items-center gap-1 font-mono text-emerald-700">
                <Phone className="w-3.5 h-3.5" /> {currentBooking.ownerPhone}
              </span>
              <span className="flex items-center gap-1 text-slate-700">
                <Calendar className="w-3.5 h-3.5 text-amber-600" />
                <span>שהה {daysCount} ימים (עד {formatDateIL(currentBooking.endDate)})</span>
              </span>
            </div>
          </div>

          {/* Navigation if multiple dogs released yesterday */}
          {pendingBookings.length > 1 && (
            <div className="flex items-center justify-between bg-amber-50/70 p-2 rounded-xl border border-amber-200 text-xs">
              <button
                type="button"
                disabled={currentIndex === 0}
                onClick={() => handleBookingChange(currentIndex - 1)}
                className="flex items-center gap-1 font-bold text-amber-900 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" /> הקודם
              </button>
              <span className="font-semibold text-amber-950">
                כלב {currentIndex + 1} מתוך {pendingBookings.length}
              </span>
              <button
                type="button"
                disabled={currentIndex === pendingBookings.length - 1}
                onClick={() => handleBookingChange(currentIndex + 1)}
                className="flex items-center gap-1 font-bold text-amber-900 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
              >
                הבא <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Message Textarea Preview */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-bold text-slate-700 flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-emerald-600" />
                <span>נוסח ההודעה שתישלח ללקוח בוואטסאפ:</span>
              </label>
              <span className="text-[11px] text-slate-400">ניתן לערוך לפני שליחה</span>
            </div>
            
            <textarea
              rows={9}
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              dir="rtl"
              className="w-full bg-slate-50 text-slate-900 text-xs sm:text-sm p-3.5 rounded-2xl border border-slate-200 focus:border-emerald-500 focus:bg-white focus:outline-none leading-relaxed resize-none shadow-2xs font-medium"
            />
          </div>

          {/* Quick Review Links Preview Badges */}
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-[11px] text-slate-600 flex flex-wrap items-center gap-3">
            <span className="font-bold text-slate-700">קישורים בהודעה:</span>
            <a 
              href="https://maps.app.goo.gl/G31uwaQXP6Ln5myX9" 
              target="_blank" 
              rel="noreferrer"
              className="text-emerald-700 hover:underline flex items-center gap-0.5"
            >
              Google Maps <ExternalLink className="w-2.5 h-2.5" />
            </a>
            <a 
              href="https://www.facebook.com/profile.php?id=61576998315714&sk=reviews" 
              target="_blank" 
              rel="noreferrer"
              className="text-blue-600 hover:underline flex items-center gap-0.5"
            >
              Facebook Reviews <ExternalLink className="w-2.5 h-2.5" />
            </a>
            <a 
              href="https://www.instagram.com/dogz.resort/" 
              target="_blank" 
              rel="noreferrer"
              className="text-pink-600 hover:underline flex items-center gap-0.5"
            >
              Instagram <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>

        </div>

        {/* Footer Decision Buttons for Shmulik */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={handleCancelAndDismiss}
            className="order-2 sm:order-1 px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer text-center"
          >
            אל תשלח (ביטול בקשה לכלב זה)
          </button>

          <div className="order-1 sm:order-2 flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2.5 text-xs font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 rounded-xl transition-colors cursor-pointer"
            >
              הזכר לי אחר כך
            </button>
            <button
              type="button"
              onClick={handleApproveAndSend}
              className="flex-1 sm:flex-initial bg-green-600 hover:bg-green-700 active:scale-98 text-white font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer"
            >
              <MessageSquare className="w-4 h-4" />
              <span>אישור ושליחה בוואטסאפ</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
