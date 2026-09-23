import React, { useState } from 'react';
import { 
  Home, 
  Calendar, 
  ChevronRight, 
  ChevronLeft, 
  Share2, 
  Copy, 
  Check, 
  Bell, 
  Printer, 
  AlertTriangle, 
  Plus, 
  Clock, 
  Pill, 
  Utensils, 
  Dog, 
  User, 
  Phone, 
  Sparkles, 
  Edit2, 
  CheckCircle2,
  X,
  ShieldAlert,
  DollarSign
} from 'lucide-react';
import { Booking, ResortSettings } from '../types';
import { formatDateIL, formatFullHebrewDate, getTodayStr, addDays } from '../utils/dateUtils';
import { formatIsraeliPhoneDisplay, openWhatsAppMessage } from '../utils/whatsappUtils';
import { getKennelOccupancyForDate, formatKennelsAndFeedingWhatsAppMessage, KennelSlotData } from '../utils/kennelUtils';

interface KennelFeedingBoardProps {
  bookings: Booking[];
  settings: ResortSettings;
  onSaveBooking: (booking: Booking) => void;
  onSelectBooking: (booking: Booking) => void;
  onNewBooking?: (initialData?: Partial<Booking>) => void;
}

export const KennelFeedingBoard: React.FC<KennelFeedingBoardProps> = ({
  bookings,
  settings,
  onSaveBooking,
  onSelectBooking,
  onNewBooking,
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(getTodayStr());
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [assigningDog, setAssigningDog] = useState<Booking | null>(null);

  const { kennels, homeBoarding, unassigned, totalStaying, occupiedKennelsCount } = getKennelOccupancyForDate(
    bookings,
    selectedDate
  );

  const isToday = selectedDate === getTodayStr();

  // Count dogs with medication
  const dogsWithMedsCount = bookings.filter(b => {
    if (b.stayStatus === 'cancelled') return false;
    if (b.startDate > selectedDate || b.endDate < selectedDate) return false;
    const meds = (b.medicationSchedule || b.medications || '').trim();
    return meds && !meds.includes('אין') && !meds.includes('בריא');
  }).length;

  const handleToggleDailyFeeding = (
    booking: Booking,
    type: 'morning' | 'evening' | 'meds',
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    const currentMap = booking.dailyFeedingsCompleted || {};
    const dateRecord = currentMap[selectedDate] || {};
    const updatedDateRecord = {
      ...dateRecord,
      [type]: !dateRecord[type],
    };

    const updatedBooking: Booking = {
      ...booking,
      dailyFeedingsCompleted: {
        ...currentMap,
        [selectedDate]: updatedDateRecord,
      },
      updatedAt: new Date().toISOString(),
    };

    onSaveBooking(updatedBooking);
  };

  const handleAssignPlacement = (booking: Booking, targetPlacement: number | 'home' | null) => {
    const updatedBooking: Booking = {
      ...booking,
      kennelNumber: targetPlacement === null ? undefined : targetPlacement,
      updatedAt: new Date().toISOString(),
    };
    onSaveBooking(updatedBooking);
    setAssigningDog(null);
  };

  const formattedWhatsAppMsg = formatKennelsAndFeedingWhatsAppMessage(bookings, selectedDate);

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(formattedWhatsAppMsg);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSendToWhatsApp = () => {
    const managerPhone = settings.whatsappNotificationPhone || '0506336896';
    openWhatsAppMessage(managerPhone, formattedWhatsAppMsg);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in">
      {/* Top Header & Navigation Bar */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Date Selector */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-2xs">
            <button
              onClick={() => setSelectedDate(addDays(selectedDate, -1))}
              title="יום קודם"
              className="p-2 hover:bg-white rounded-xl text-slate-700 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => setSelectedDate(getTodayStr())}
              className={`px-3 py-1.5 text-xs font-black rounded-xl transition-all cursor-pointer ${
                isToday
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              היום
            </button>
            <button
              onClick={() => setSelectedDate(addDays(selectedDate, 1))}
              title="יום הבא"
              className="p-2 hover:bg-white rounded-xl text-slate-700 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>

          <div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
              <span>🪣 11 תאים ודליי מזון</span>
              <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-0.5 rounded-full font-bold">
                {formatFullHebrewDate(selectedDate)}
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              ניהול שקיות מזון אישיות, שעות האכלה, תרופות והלנה ביתית בבית של שמוליק
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="bg-[#25D366] hover:bg-[#1EBE5D] active:scale-95 text-white font-black px-3.5 py-2 rounded-xl text-xs flex items-center gap-2 transition-all shadow-xs cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
            <span>ייצא בהודעה 📲</span>
          </button>

          <button
            onClick={handlePrint}
            className="bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer border border-slate-200"
          >
            <Printer className="w-4 h-4" />
            <span>הדפס לוח</span>
          </button>
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-lg shrink-0">
            🐕
          </div>
          <div>
            <div className="text-xs font-bold text-slate-500">כלבים שוהים</div>
            <div className="text-lg font-black text-slate-900">{totalStaying} כלבים</div>
          </div>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black text-lg shrink-0">
            🏠
          </div>
          <div>
            <div className="text-xs font-bold text-slate-500">תאים מאוכלסים</div>
            <div className="text-lg font-black text-emerald-700">
              {occupiedKennelsCount} / 11 תאים
            </div>
          </div>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-amber-200 bg-amber-50/40 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-black text-lg shrink-0">
            🏡
          </div>
          <div>
            <div className="text-xs font-bold text-amber-800">הלנה ביתית</div>
            <div className="text-lg font-black text-amber-950">
              {homeBoarding.dogs.length} כלבים בבית
            </div>
          </div>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-rose-200 bg-rose-50/40 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-black text-lg shrink-0">
            💊
          </div>
          <div>
            <div className="text-xs font-bold text-rose-800">כלבים עם תרופות</div>
            <div className="text-lg font-black text-rose-900">{dogsWithMedsCount} כלבים</div>
          </div>
        </div>
      </div>

      {/* Mandatory Unassigned Alert Drawer */}
      {unassigned.length > 0 && (
        <div className="bg-red-50 border-2 border-red-300 rounded-3xl p-4 sm:p-5 shadow-sm animate-in slide-in-from-top-2">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 text-red-900 font-black text-sm sm:text-base">
              <ShieldAlert className="w-5 h-5 text-red-600 shrink-0" />
              <span>הוראת חובה: {unassigned.length} כלבים שוהים ללא כתובת תא או הלנה ביתית!</span>
            </div>
            <span className="text-xs bg-red-200 text-red-900 px-2.5 py-0.5 rounded-full font-extrabold">
              חובה לשבץ
            </span>
          </div>
          <p className="text-xs text-red-800 mb-3">
            חל איסור מוחלט על קליטת כלב בריזורט ללא כתובת שיבוץ מדויקת. אנא שייך כלב זה לתא 1–11 או להלנה ביתית:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {unassigned.map(b => (
              <div
                key={b.id}
                className="bg-white p-3 rounded-2xl border border-red-200 shadow-2xs flex items-center justify-between gap-2"
              >
                <div>
                  <div className="font-black text-slate-900 text-sm flex items-center gap-1.5">
                    <span>🐾 {b.dogName}</span>
                    <span className="text-xs font-normal text-slate-500">({b.ownerName})</span>
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5">
                    {b.feedingSchedule ? `⏰ ${b.feedingSchedule}` : 'טרם הוגדרו שעות האכלה'}
                  </div>
                </div>

                <button
                  onClick={() => setAssigningDog(b)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3 py-1.5 rounded-xl transition-all cursor-pointer shrink-0"
                >
                  שבץ תא 🏠
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 1. VIP Home Boarding Section (בבית של שמוליק) */}
      <div className="bg-gradient-to-r from-amber-50 via-orange-50/60 to-amber-50 border-2 border-amber-300 rounded-3xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-amber-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-black text-2xl shadow-xs shrink-0">
              🏡
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base sm:text-lg text-amber-950">
                  הלנה ביתית (בבית של שמוליק)
                </h3>
                <span className="text-xs bg-amber-200 text-amber-900 font-extrabold px-2.5 py-0.5 rounded-full border border-amber-300">
                  🪣 דלי הלנה ביתית ({homeBoarding.dogs.length} שקיות)
                </span>
              </div>
              <p className="text-xs text-amber-800 mt-0.5">
                כלבים שישנים בתוך הבית של שמוליק – שקיות מזון, תרופות והשגחה אישית
              </p>
            </div>
          </div>

          <div className="text-xs font-bold text-amber-900 bg-white/80 px-3 py-1.5 rounded-xl border border-amber-200 shrink-0 self-start sm:self-auto">
            {homeBoarding.dogs.length === 0 ? '⚪ אין כלבים בבית כעת' : `🟢 ${homeBoarding.dogs.length} כלבים בבית`}
          </div>
        </div>

        {/* Home Boarding Dogs List */}
        <div className="mt-4">
          {homeBoarding.dogs.length === 0 ? (
            <p className="text-xs text-amber-700/80 italic p-3 bg-white/60 rounded-xl border border-amber-100">
              אין כלבים המשובצים להלנה ביתית ביום זה.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {homeBoarding.dogs.map(dog => (
                <DogKennelCard
                  key={dog.id}
                  dog={dog}
                  dateStr={selectedDate}
                  onSelect={() => onSelectBooking(dog)}
                  onToggleDailyFeeding={handleToggleDailyFeeding}
                  onChangePlacement={() => setAssigningDog(dog)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 2. Grid of 11 Kennels (תאים 1 עד 11) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
            <span>🐾 11 התאים ודליי המזון (1–11)</span>
            <span className="text-xs font-bold text-slate-500">
              ({occupiedKennelsCount} תאים פעילים היום)
            </span>
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {kennels.map(k => (
            <div
              key={k.kennelNumber}
              className={`bg-white border rounded-3xl p-4 shadow-sm flex flex-col justify-between transition-all ${
                k.dogs.length > 0
                  ? 'border-indigo-300 ring-2 ring-indigo-100'
                  : 'border-slate-200 bg-slate-50/40 opacity-90'
              }`}
            >
              {/* Card Header */}
              <div className="pb-3 border-b border-slate-100 flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-base shrink-0 ${
                      k.dogs.length > 0
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {k.kennelNumber}
                  </div>
                  <div>
                    <div className="font-black text-sm text-slate-900 flex items-center gap-1.5">
                      <span>תא {k.kennelNumber}</span>
                      <span className="text-[11px] font-bold text-slate-500">| 🪣 דלי מס' {k.kennelNumber}</span>
                    </div>
                    <div className="text-[11px] font-medium text-slate-500">
                      {k.dogs.length === 0
                        ? 'פנוי'
                        : k.dogs.length === 1
                        ? 'כלב 1 (שקית מזון 1)'
                        : `${k.dogs.length} כלבים (${k.dogs.length} שקיות מזון)`}
                    </div>
                  </div>
                </div>

                <span
                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                    k.dogs.length > 0
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-slate-100 text-slate-500 border-slate-200'
                  }`}
                >
                  {k.dogs.length > 0 ? `🟢 ${k.dogs.length} כלבים` : '⚪ פנוי'}
                </span>
              </div>

              {/* Dogs in Kennel */}
              <div className="py-3 flex-1 space-y-2.5">
                {k.dogs.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-400 italic">
                    תא זה פנוי ביום זה
                  </div>
                ) : (
                  k.dogs.map(dog => (
                    <DogKennelCard
                      key={dog.id}
                      dog={dog}
                      dateStr={selectedDate}
                      onSelect={() => onSelectBooking(dog)}
                      onToggleDailyFeeding={handleToggleDailyFeeding}
                      onChangePlacement={() => setAssigningDog(dog)}
                    />
                  ))
                )}
              </div>

              {/* Footer Quick Assign */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400 font-medium">
                  {k.dogs.length > 1 ? 'שקיות נפרדות לכל כלב בדלי' : 'שקית מזון אישית'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (onNewBooking) {
                      onNewBooking({
                        startDate: selectedDate,
                        endDate: addDays(selectedDate, 2),
                        kennelNumber: k.kennelNumber,
                      });
                    }
                  }}
                  className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>קלוט לתא {k.kennelNumber}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal: Quick Placement Assignment */}
      {assigningDog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-black text-base text-slate-900">
                  שיבוץ מיקום לינה: {assigningDog.dogName}
                </h3>
                <p className="text-xs text-slate-500">
                  חובה לבחור תא 1–11 או הלנה ביתית בבית של שמוליק
                </p>
              </div>
              <button
                onClick={() => setAssigningDog(null)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Placement Options Grid */}
            <div className="space-y-3">
              {/* Option 1: Home Boarding */}
              <button
                onClick={() => handleAssignPlacement(assigningDog, 'home')}
                className={`w-full p-3.5 rounded-2xl border-2 text-right transition-all cursor-pointer flex items-center justify-between ${
                  assigningDog.kennelNumber === 'home'
                    ? 'border-amber-500 bg-amber-50 text-amber-950 font-black'
                    : 'border-amber-200 hover:border-amber-400 bg-amber-50/50 text-amber-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">🏡</span>
                  <div>
                    <div className="font-black text-sm">הלנה ביתית (בבית של שמוליק)</div>
                    <div className="text-xs text-amber-800 font-normal">דלי הלנה ביתית בתוך הבית</div>
                  </div>
                </div>
                {assigningDog.kennelNumber === 'home' && <Check className="w-5 h-5 text-amber-600" />}
              </button>

              <div className="text-xs font-black text-slate-700 px-1 pt-1">
                או בחר אחד מ-11 התאים:
              </div>

              {/* 11 Kennels Grid */}
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(num => (
                  <button
                    key={num}
                    onClick={() => handleAssignPlacement(assigningDog, num)}
                    className={`p-3 rounded-xl border text-center transition-all cursor-pointer font-black text-sm ${
                      assigningDog.kennelNumber === num
                        ? 'border-indigo-600 bg-indigo-600 text-white shadow-xs'
                        : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-slate-800'
                    }`}
                  >
                    תא {num}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setAssigningDog(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              >
                סגור
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Export to WhatsApp Message */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 max-w-2xl w-full shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-2xl">📲</span>
                <div>
                  <h3 className="font-black text-base sm:text-lg text-slate-900">
                    דוח 11 תאים ודליי האכלה לוואטסאפ
                  </h3>
                  <p className="text-xs text-slate-500">
                    מוכן לשליחה מהירה לצוות הריזורט או לשמוליק
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Message Preview Box */}
            <div className="flex-1 overflow-y-auto bg-slate-900 text-slate-100 p-4 rounded-2xl font-mono text-xs whitespace-pre-wrap leading-relaxed border border-slate-800 select-all" dir="rtl">
              {formattedWhatsAppMsg}
            </div>

            {/* Footer Action Buttons */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <button
                onClick={handleCopyMessage}
                className="bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer border border-slate-300"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'הועתק בהצלחה!' : 'העתק טקסט'}</span>
              </button>

              <button
                onClick={handleSendToWhatsApp}
                className="bg-[#25D366] hover:bg-[#1EBE5D] active:scale-95 text-white font-black px-5 py-2.5 rounded-xl text-xs sm:text-sm flex items-center gap-2 transition-all shadow-xs cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                <span>פתח בוואטסאפ לצוות 🚀</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface DogKennelCardProps {
  dog: Booking;
  dateStr: string;
  onSelect: () => void;
  onToggleDailyFeeding: (booking: Booking, type: 'morning' | 'evening' | 'meds', e: React.MouseEvent) => void;
  onChangePlacement: () => void;
}

const DogKennelCard: React.FC<DogKennelCardProps> = ({
  dog,
  dateStr,
  onSelect,
  onToggleDailyFeeding,
  onChangePlacement,
}) => {
  const feedings = dog.dailyFeedingsCompleted?.[dateStr] || {};
  const meds = (dog.medicationSchedule || dog.medications || '').trim();
  const hasMeds = meds && !meds.includes('אין') && !meds.includes('בריא');
  const foodDetails = [dog.foodPortion, dog.specialDiet].filter(Boolean).join(' | ');

  return (
    <div
      onClick={onSelect}
      className="bg-white border border-slate-200 hover:border-indigo-400 p-3 rounded-2xl shadow-2xs hover:shadow-sm transition-all cursor-pointer space-y-2 group"
    >
      {/* Dog Top Info */}
      <div className="flex items-start justify-between gap-1.5">
        <div>
          <div className="font-black text-slate-900 text-sm flex items-center gap-1.5">
            <span>🐾 {dog.dogName}</span>
            {dog.dogBreed && <span className="text-[11px] font-normal text-slate-500">({dog.dogBreed})</span>}
          </div>
          <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
            <User className="w-3 h-3 text-slate-400" />
            <span>{dog.ownerName}</span>
            {dog.ownerPhone && (
              <span className="font-mono text-slate-600">({formatIsraeliPhoneDisplay(dog.ownerPhone)})</span>
            )}
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onChangePlacement();
          }}
          title="שנה שיבוץ תא / הלנה ביתית"
          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-indigo-600 p-1 rounded-lg transition-all"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Food Bag Instructions */}
      <div className="bg-slate-50 border border-slate-100 p-2 rounded-xl text-xs space-y-1">
        <div className="font-bold text-slate-800 flex items-center gap-1">
          <Utensils className="w-3 h-3 text-amber-600 shrink-0" />
          <span>שקית מזון:</span>
          <span className="font-normal text-slate-700">{dog.feedingSchedule || 'שעות כרגיל'}</span>
        </div>
        {foodDetails && (
          <div className="text-[11px] text-slate-600 pr-4">
            {foodDetails}
          </div>
        )}
      </div>

      {/* Medications Badge */}
      {hasMeds && (
        <div className="bg-rose-50 border border-rose-200 p-2 rounded-xl text-xs">
          <div className="font-black text-rose-900 flex items-center gap-1">
            <Pill className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            <span>תרופות:</span>
            <span className="font-medium text-rose-800">{meds}</span>
          </div>
        </div>
      )}

      {/* Complexity Surcharge Badge */}
      {dog.complexitySurcharge && dog.complexitySurcharge > 0 && (
        <div className="bg-amber-100/80 border border-amber-300 text-amber-950 font-bold text-[11px] px-2 py-0.5 rounded-lg inline-flex items-center gap-1">
          <span>💰 תוספת מורכבות: ₪{dog.complexitySurcharge}</span>
          {dog.complexityReason && <span className="font-normal text-amber-800">({dog.complexityReason})</span>}
        </div>
      )}

      {/* Placement Note Badge */}
      {dog.placementNotes && (
        <div className="bg-orange-50 border border-orange-200 text-orange-950 text-[11px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1">
          <span>🚩 {dog.placementNotes}</span>
        </div>
      )}

      {/* Daily Feeding Checkboxes (☀️ בוקר, 🌙 ערב, 💊 תרופות) */}
      <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between gap-1">
        <button
          type="button"
          onClick={(e) => onToggleDailyFeeding(dog, 'morning', e)}
          className={`flex-1 py-1 px-1.5 rounded-lg text-[10px] font-extrabold flex items-center justify-center gap-1 transition-all border ${
            feedings.morning
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
          }`}
        >
          <span>☀️ בוקר</span>
          {feedings.morning && <Check className="w-3 h-3 stroke-[3]" />}
        </button>

        <button
          type="button"
          onClick={(e) => onToggleDailyFeeding(dog, 'evening', e)}
          className={`flex-1 py-1 px-1.5 rounded-lg text-[10px] font-extrabold flex items-center justify-center gap-1 transition-all border ${
            feedings.evening
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
          }`}
        >
          <span>🌙 ערב</span>
          {feedings.evening && <Check className="w-3 h-3 stroke-[3]" />}
        </button>

        {hasMeds && (
          <button
            type="button"
            onClick={(e) => onToggleDailyFeeding(dog, 'meds', e)}
            className={`flex-1 py-1 px-1.5 rounded-lg text-[10px] font-extrabold flex items-center justify-center gap-1 transition-all border ${
              feedings.meds
                ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
            }`}
          >
            <span>💊 תרופה</span>
            {feedings.meds && <Check className="w-3 h-3 stroke-[3]" />}
          </button>
        )}
      </div>
    </div>
  );
};
