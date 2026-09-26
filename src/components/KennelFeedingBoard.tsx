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
  DollarSign,
  Compass,
  Trees
} from 'lucide-react';
import { Booking, ResortSettings } from '../types';
import { formatDateIL, formatFullHebrewDate, getTodayStr, addDays } from '../utils/dateUtils';
import { formatIsraeliPhoneDisplay, openWhatsAppMessage } from '../utils/whatsappUtils';
import { 
  getKennelOccupancyForDate, 
  formatKennelsAndFeedingWhatsAppMessage, 
  KennelSlotData, 
  ALL_PLACEMENT_SLOTS,
  normalizePlacementKey,
  getPlacementDisplayName
} from '../utils/kennelUtils';

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

  const { rooms, suites, outdoors, homeBoarding, unassigned, totalStaying, occupiedSlotsCount } = getKennelOccupancyForDate(
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

  const handleAssignPlacement = (booking: Booking, targetPlacement: string | number | null) => {
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

  const occupiedRoomsCount = rooms.filter(r => r.dogs.length > 0).length;
  const occupiedSuitesCount = suites.filter(s => s.dogs.length > 0).length;
  const occupiedOutdoorsCount = outdoors.filter(o => o.dogs.length > 0).length;

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
              <span>🏠 שיבוצי חדרים, סוויטות ודליי האכלה</span>
              <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-0.5 rounded-full font-bold">
                {formatFullHebrewDate(selectedDate)}
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              ניהול חדרים 1–7, סוויטות 1–4, שבילים, חצר מרכזית, הלנה ביתית ודליי מזון
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-base shrink-0">
            🐕
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-500">כלבים שוהים</div>
            <div className="text-base font-black text-slate-900">{totalStaying} כלבים</div>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-blue-200 bg-blue-50/30 shadow-2xs flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-black text-base shrink-0">
            🚪
          </div>
          <div>
            <div className="text-[11px] font-bold text-blue-800">חדרים 1–7</div>
            <div className="text-base font-black text-blue-950">
              {occupiedRoomsCount} / 7
            </div>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-purple-200 bg-purple-50/30 shadow-2xs flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-black text-base shrink-0">
            ⭐
          </div>
          <div>
            <div className="text-[11px] font-bold text-purple-800">סוויטות 1–4</div>
            <div className="text-base font-black text-purple-950">
              {occupiedSuitesCount} / 4
            </div>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/30 shadow-2xs flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-base shrink-0">
            🌿
          </div>
          <div>
            <div className="text-[11px] font-bold text-emerald-800">שבילים וחצר</div>
            <div className="text-base font-black text-emerald-950">
              {occupiedOutdoorsCount} / 3
            </div>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-amber-200 bg-amber-50/40 shadow-2xs flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-black text-base shrink-0">
            🏡
          </div>
          <div>
            <div className="text-[11px] font-bold text-amber-800">הלנה ביתית</div>
            <div className="text-base font-black text-amber-950">
              {homeBoarding.dogs.length} כלבים
            </div>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-rose-200 bg-rose-50/40 shadow-2xs flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-black text-base shrink-0">
            💊
          </div>
          <div>
            <div className="text-[11px] font-bold text-rose-800">עם תרופות</div>
            <div className="text-base font-black text-rose-900">{dogsWithMedsCount} כלבים</div>
          </div>
        </div>
      </div>

      {/* Flexible Unassigned Dogs Drawer */}
      {unassigned.length > 0 && (
        <div className="bg-amber-50/70 border border-amber-300 rounded-3xl p-4 sm:p-5 shadow-sm animate-in slide-in-from-top-2">
          <div className="flex items-start justify-between gap-3 mb-2.5">
            <div className="flex items-center gap-2 text-amber-950 font-black text-sm sm:text-base">
              <span className="text-lg">📋</span>
              <span>כלבים הממתינים לשיבוץ מיקום לינה ({unassigned.length} כלבים)</span>
            </div>
            <span className="text-xs bg-amber-200 text-amber-950 px-2.5 py-0.5 rounded-full font-extrabold border border-amber-300">
              ממתין לשיבוץ
            </span>
          </div>
          <p className="text-xs text-amber-800 mb-3">
            הכלבים הבאים נקלטו במערכת וטרם שובצו לחדר, סוויטה או שביל. ניתן לשבץ בכל שלב בלחיצה על "שבץ תא/חדר":
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {unassigned.map(b => (
              <div
                key={b.id}
                onClick={() => onSelectBooking(b)}
                className="bg-white hover:bg-slate-50 p-3 rounded-2xl border border-amber-200 hover:border-indigo-400 shadow-2xs flex items-center justify-between gap-2 cursor-pointer transition-all group"
                title="לחץ לעריכה מלאה של כל ההזמנה, שעות האכלה, תרופות והנחיות מיוחדות"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-black text-slate-900 text-sm flex items-center gap-1.5 flex-wrap">
                    <span>🐾 {b.dogName}</span>
                    <span className="text-xs font-normal text-slate-500">({b.ownerName})</span>
                    <span className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded-md font-bold group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      ✏️ ערוך הכל
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5">
                    {b.feedingSchedule ? `⏰ ${b.feedingSchedule}` : 'טרם הוגדרו שעות האכלה'}
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setAssigningDog(b);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs px-3 py-1.5 rounded-xl transition-all cursor-pointer shrink-0 shadow-2xs flex items-center gap-1"
                  title="שיבוץ מהיר בלחיצה אחת"
                >
                  <span>🏠</span>
                  <span>שבץ מיקום</span>
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

      {/* 2. Rooms 1-7 Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
            <span>🚪 חדרי אירוח (חדר 1–7)</span>
            <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">
              {occupiedRoomsCount} / 7 חדרים מאוכלסים
            </span>
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {rooms.map(k => (
            <SlotCard
              key={k.slotId}
              slot={k}
              selectedDate={selectedDate}
              onSelectBooking={onSelectBooking}
              handleToggleDailyFeeding={handleToggleDailyFeeding}
              setAssigningDog={setAssigningDog}
              onNewBooking={onNewBooking}
            />
          ))}
        </div>
      </div>

      {/* 3. Suites 1-4 Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
            <span>⭐ סוויטות אירוח (סוויטה 1–4)</span>
            <span className="text-xs font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-full">
              {occupiedSuitesCount} / 4 סוויטות מאוכלסות
            </span>
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {suites.map(k => (
            <SlotCard
              key={k.slotId}
              slot={k}
              selectedDate={selectedDate}
              onSelectBooking={onSelectBooking}
              handleToggleDailyFeeding={handleToggleDailyFeeding}
              setAssigningDog={setAssigningDog}
              onNewBooking={onNewBooking}
            />
          ))}
        </div>
      </div>

      {/* 4. Outdoor Trails & Central Yard Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
            <span>🌿 שבילים וחצר מרכזית (שביל מזרחי, שביל מערבי, חצר מרכזית)</span>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
              {occupiedOutdoorsCount} / 3 מתחמים פעילים
            </span>
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {outdoors.map(k => (
            <SlotCard
              key={k.slotId}
              slot={k}
              selectedDate={selectedDate}
              onSelectBooking={onSelectBooking}
              handleToggleDailyFeeding={handleToggleDailyFeeding}
              setAssigningDog={setAssigningDog}
              onNewBooking={onNewBooking}
            />
          ))}
        </div>
      </div>

      {/* Modal: Quick Placement Assignment */}
      {assigningDog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-black text-base sm:text-lg text-slate-900">
                  שיבוץ מיקום: {assigningDog.dogName}
                </h3>
                <p className="text-xs text-slate-500">
                  בחר חדר (1–7), סוויטה (1–4), שביל, חצר מרכזית או הלנה ביתית
                </p>
              </div>
              <button
                onClick={() => setAssigningDog(null)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current status */}
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs flex items-center justify-between">
              <span className="text-slate-600 font-bold">שיבוץ נוכחי:</span>
              <span className="font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-200">
                {getPlacementDisplayName(assigningDog.kennelNumber)}
              </span>
            </div>

            {/* Placement Options Grid */}
            <div className="space-y-4">
              {/* Option 1: Home Boarding */}
              <div>
                <div className="text-xs font-black text-amber-900 mb-1.5 flex items-center gap-1.5">
                  <span>🏡</span>
                  <span>הלנה ביתית</span>
                </div>
                <button
                  onClick={() => handleAssignPlacement(assigningDog, 'home')}
                  className={`w-full p-3 rounded-2xl border-2 text-right transition-all cursor-pointer flex items-center justify-between ${
                    normalizePlacementKey(assigningDog.kennelNumber) === 'home'
                      ? 'border-amber-500 bg-amber-50 text-amber-950 font-black'
                      : 'border-amber-200 hover:border-amber-400 bg-amber-50/40 text-amber-900'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🏡</span>
                    <div>
                      <div className="font-black text-xs sm:text-sm">הלנה ביתית (בבית של שמוליק)</div>
                      <div className="text-[11px] text-amber-800 font-normal">דלי הלנה ביתית בתוך הבית</div>
                    </div>
                  </div>
                  {normalizePlacementKey(assigningDog.kennelNumber) === 'home' && <Check className="w-4 h-4 text-amber-600" />}
                </button>
              </div>

              {/* Option 2: Rooms 1-7 */}
              <div>
                <div className="text-xs font-black text-blue-900 mb-1.5 flex items-center gap-1.5">
                  <span>🚪</span>
                  <span>חדרי אירוח (1–7)</span>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                  {[1, 2, 3, 4, 5, 6, 7].map(num => {
                    const slotKey = `room_${num}`;
                    const isSelected = normalizePlacementKey(assigningDog.kennelNumber) === slotKey;
                    return (
                      <button
                        key={slotKey}
                        onClick={() => handleAssignPlacement(assigningDog, slotKey)}
                        className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer font-black text-xs ${
                          isSelected
                            ? 'border-blue-600 bg-blue-600 text-white shadow-xs'
                            : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-slate-800'
                        }`}
                      >
                        חדר {num}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Option 3: Suites 1-4 */}
              <div>
                <div className="text-xs font-black text-purple-900 mb-1.5 flex items-center gap-1.5">
                  <span>⭐</span>
                  <span>סוויטות אירוח (1–4)</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {[1, 2, 3, 4].map(num => {
                    const slotKey = `suite_${num}`;
                    const isSelected = normalizePlacementKey(assigningDog.kennelNumber) === slotKey;
                    return (
                      <button
                        key={slotKey}
                        onClick={() => handleAssignPlacement(assigningDog, slotKey)}
                        className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer font-black text-xs ${
                          isSelected
                            ? 'border-purple-600 bg-purple-600 text-white shadow-xs'
                            : 'border-purple-200 hover:border-purple-400 hover:bg-purple-50 text-purple-900'
                        }`}
                      >
                        סוויטה {num}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Option 4: Outdoor Trails & Central Yard */}
              <div>
                <div className="text-xs font-black text-emerald-900 mb-1.5 flex items-center gap-1.5">
                  <span>🌿</span>
                  <span>שבילים וחצר מרכזית</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'trail_east', label: 'שביל מזרחי', icon: '🌲' },
                    { id: 'trail_west', label: 'שביל מערבי', icon: '🌿' },
                    { id: 'yard_central', label: 'חצר מרכזית', icon: '🌳' },
                  ].map(item => {
                    const isSelected = normalizePlacementKey(assigningDog.kennelNumber) === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleAssignPlacement(assigningDog, item.id)}
                        className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer font-black text-xs flex flex-col items-center gap-1 ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-600 text-white shadow-xs'
                            : 'border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50 text-emerald-950'
                        }`}
                      >
                        <span className="text-base">{item.icon}</span>
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Option 5: Unassign / Clear Placement */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  onClick={() => handleAssignPlacement(assigningDog, null)}
                  className="w-full py-2 px-3 rounded-xl border border-dashed border-slate-300 text-slate-600 hover:text-red-700 hover:border-red-300 hover:bg-red-50 text-xs font-bold transition-all cursor-pointer"
                >
                  ⚪ בטל שיבוץ (העבר לרשימת ממתינים לשיבוץ)
                </button>
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
                    דוח שיבוצי חדרים, סוויטות ודליי האכלה לוואטסאפ
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

interface SlotCardProps {
  slot: KennelSlotData;
  selectedDate: string;
  onSelectBooking: (b: Booking) => void;
  handleToggleDailyFeeding: (booking: Booking, type: 'morning' | 'evening' | 'meds', e: React.MouseEvent) => void;
  setAssigningDog: (b: Booking) => void;
  onNewBooking?: (initialData?: Partial<Booking>) => void;
}

const SlotCard: React.FC<SlotCardProps> = ({
  slot,
  selectedDate,
  onSelectBooking,
  handleToggleDailyFeeding,
  setAssigningDog,
  onNewBooking,
}) => {
  const isOccupied = slot.dogs.length > 0;

  let categoryBadgeClass = 'bg-blue-50 text-blue-700 border-blue-200';
  if (slot.category === 'suite') categoryBadgeClass = 'bg-purple-50 text-purple-700 border-purple-200';
  if (slot.category === 'outdoor') categoryBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';

  return (
    <div
      className={`bg-white border rounded-3xl p-4 shadow-sm flex flex-col justify-between transition-all ${
        isOccupied
          ? 'border-indigo-300 ring-2 ring-indigo-100'
          : 'border-slate-200 bg-slate-50/40 opacity-90'
      }`}
    >
      {/* Card Header */}
      <div className="pb-3 border-b border-slate-100 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-base shrink-0 ${
              isOccupied
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-200 text-slate-600'
            }`}
          >
            {slot.icon}
          </div>
          <div>
            <div className="font-black text-sm text-slate-900 flex items-center gap-1.5">
              <span>{slot.name}</span>
              <span className="text-[11px] font-bold text-slate-500">| 🪣 {slot.bucketName}</span>
            </div>
            <div className="text-[11px] font-medium text-slate-500">
              {!isOccupied
                ? 'פנוי'
                : slot.dogs.length === 1
                ? 'כלב 1 (שקית מזון 1)'
                : `${slot.dogs.length} כלבים (${slot.dogs.length} שקיות מזון)`}
            </div>
          </div>
        </div>

        <span
          className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
            isOccupied
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
              : 'bg-slate-100 text-slate-500 border-slate-200'
          }`}
        >
          {isOccupied ? `🟢 ${slot.dogs.length} כלבים` : '⚪ פנוי'}
        </span>
      </div>

      {/* Dogs in Slot */}
      <div className="py-3 flex-1 space-y-2.5">
        {!isOccupied ? (
          <div className="text-center py-6 text-xs text-slate-400 italic">
            מיקום זה פנוי ביום זה
          </div>
        ) : (
          slot.dogs.map(dog => (
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
          {slot.dogs.length > 1 ? 'שקיות נפרדות לכל כלב בדלי' : 'שקית מזון אישית'}
        </span>
        <button
          type="button"
          onClick={() => {
            if (onNewBooking) {
              onNewBooking({
                startDate: selectedDate,
                endDate: addDays(selectedDate, 2),
                kennelNumber: slot.slotId,
              });
            }
          }}
          className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 hover:underline cursor-pointer"
        >
          <Plus className="w-3 h-3" />
          <span>קלוט ל{slot.shortName}</span>
        </button>
      </div>
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
          title="שנה שיבוץ מיקום / חדר"
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
