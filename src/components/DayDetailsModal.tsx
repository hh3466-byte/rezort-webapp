import React, { useState } from 'react';
import { 
  X, 
  Calendar, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Home, 
  Plus, 
  CheckCircle, 
  MessageSquare, 
  Phone, 
  DollarSign, 
  Dog, 
  User, 
  AlertCircle,
  Clock,
  ShieldAlert,
  Edit2,
  Trash2,
  Gift,
  CreditCard,
  MapPin,
  FileText
} from 'lucide-react';
import { getWazeNavigationUrl } from '../utils/geolocationUtils';
import { Booking, ResortSettings, IntakeRequest, DaycarePass } from '../types';
import { formatFullHebrewDate, getDailyBreakdown, formatDateIL, formatStayDatesDisplay, getTodayStr, isTrainingBooking, getBookingPairInfo, calculateDaysCount } from '../utils/dateUtils';
import { getServiceTypeHebrew, generatePaymentReminderMessage, openWhatsAppMessage, cleanPhoneNumber } from '../utils/whatsappUtils';
import { findDaycarePassByCode, findActiveDaycarePassByPhone, loadStoredDaycarePasses } from '../services/dbService';
import { getDateShabbatOrHoliday } from '../utils/jewishCalendar';
import { ShabbatHolidayGreetingModal } from './ShabbatHolidayGreetingModal';
import { getPlacementDisplayName, normalizePlacementKey } from '../utils/kennelUtils';
import { getStayStatusColors } from './CalendarView';
import { isIntakeRequestNew } from '../utils/intakeUtils';
import { WhatsAppChatHistoryModal } from './WhatsAppChatHistoryModal';
import { CustomerDocumentsModal } from './CustomerDocumentsModal';

interface DayDetailsModalProps {
  dateStr: string | null;
  highlightedBookingId?: string | null;
  bookings: Booking[];
  settings: ResortSettings;
  onClose: () => void;
  onSelectBooking: (booking: Booking) => void;
  onNewBookingForDate: (dateStr: string) => void;
  onDeleteBooking?: (bookingId: string) => void;
  onMarkAsPaid: (bookingId: string) => void;
  onOpenPaymentModal: (booking: Booking) => void;
  onOpenSendPaymentLink?: (booking: Booking) => void;
  onToggleStayStatus: (bookingId: string, newStatus: Booking['stayStatus']) => void;
  onInitiateRelease?: (booking: Booking) => void;
  onToggleReviewRequest?: (booking: Booking) => void;
  onOpenVoucher?: (data: { customerName: string; dogName: string; phone: string; staysCount?: number }) => void;
  intakeRequests?: IntakeRequest[];
  focusedIntakeRequestId?: string | null;
  onApproveIntakeRequest?: (req: IntakeRequest) => void;
  onRejectIntakeRequest?: (req: IntakeRequest) => void;
}

export const DayDetailsModal: React.FC<DayDetailsModalProps> = ({
  dateStr,
  highlightedBookingId,
  bookings,
  settings,
  onClose,
  onSelectBooking,
  onNewBookingForDate,
  onDeleteBooking,
  onMarkAsPaid,
  onOpenPaymentModal,
  onOpenSendPaymentLink,
  onToggleStayStatus,
  onInitiateRelease,
  onToggleReviewRequest,
  onOpenVoucher,
  intakeRequests = [],
  focusedIntakeRequestId,
  onApproveIntakeRequest,
  onRejectIntakeRequest,
}) => {
  if (!dateStr) return null;

  const breakdown = getDailyBreakdown(bookings, dateStr);
  const isOverbooked = breakdown.total > settings.maxCapacity;
  const holidayInfo = getDateShabbatOrHoliday(dateStr);
  const [isGreetingModalOpen, setIsGreetingModalOpen] = useState(false);
  const [selectedChatHistory, setSelectedChatHistory] = useState<{ phone: string; customerName: string; dogName?: string } | null>(null);
  const [selectedDocumentsBooking, setSelectedDocumentsBooking] = useState<Booking | null>(null);

  // Pending requests for this date: ONLY first-time inquiries where contact has NOT been made yet (or pass reservation requests)
  const pendingRequestsForDate = React.useMemo(() => {
    if (!intakeRequests || !dateStr) return [];
    return intakeRequests.filter(r => {
      // Must be a brand new inquiry where contact has NOT been made yet, or pass reservations
      if (!isIntakeRequestNew(r, bookings)) return false;
      const targetEnd = r.endDate || r.startDate;
      return r.startDate <= dateStr && targetEnd >= dateStr;
    });
  }, [intakeRequests, dateStr, bookings]);

  const getStaysCount = (phone: string) => {
    const clean = cleanPhoneNumber(phone);
    if (!clean) return 0;
    return bookings.filter(bk => cleanPhoneNumber(bk.ownerPhone) === clean).length;
  };

  const sortWithHighlighted = (list: Booking[]) => {
    return [...list].sort((a, b) => {
      if (highlightedBookingId) {
        if (a.id === highlightedBookingId) return -1;
        if (b.id === highlightedBookingId) return 1;
      }
      const aTrain = isTrainingBooking(a) ? 1 : 0;
      const bTrain = isTrainingBooking(b) ? 1 : 0;
      if (aTrain !== bTrain) {
        return aTrain - bTrain; // non-training first, training last
      }
      return 0;
    });
  };

  const arrivalsList = sortWithHighlighted(breakdown.arrivals);
  const stayingList = sortWithHighlighted(breakdown.staying);
  const departuresList = sortWithHighlighted(breakdown.departures);

  // If a specific dog was clicked or searched, prioritize its section first!
  const isArrivalTarget = arrivalsList.some(b => b.id === highlightedBookingId);
  const isStayingTarget = stayingList.some(b => b.id === highlightedBookingId);
  const isDepartureTarget = departuresList.some(b => b.id === highlightedBookingId);

  const renderArrivalsSection = () => (
    <div key="arrivals">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-extrabold text-green-700 flex items-center gap-1.5">
          <ArrowDownLeft className="w-4 h-4" />
          <span>מגיעים היום ({arrivalsList.length})</span>
        </h4>
      </div>

      {arrivalsList.length === 0 ? (
        <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-xl border border-slate-100">
          אין כניסות מתוכננות ליום זה
        </p>
      ) : (
        <div className="space-y-2.5">
          {arrivalsList.map(b => (
            <DogBookingCard
              key={b.id}
              booking={b}
              allBookings={bookings}
              settings={settings}
              dateStr={dateStr || undefined}
              isHighlighted={b.id === highlightedBookingId}
              onSelect={() => onSelectBooking(b)}
              onDelete={() => onDeleteBooking && onDeleteBooking(b.id)}
              onMarkPaid={() => onMarkAsPaid(b.id)}
              onOpenPayment={() => onOpenPaymentModal(b)}
              onOpenSendPaymentLink={() => onOpenSendPaymentLink && onOpenSendPaymentLink(b)}
              onToggleStayStatus={onToggleStayStatus}
              onInitiateRelease={() => onInitiateRelease && onInitiateRelease(b)}
              onToggleReviewRequest={() => onToggleReviewRequest && onToggleReviewRequest(b)}
              onOpenVoucher={() => onOpenVoucher && onOpenVoucher({ customerName: b.ownerName, dogName: b.dogName, phone: b.ownerPhone, staysCount: getStaysCount(b.ownerPhone) })}
              onOpenChatHistory={(p, c, d) => setSelectedChatHistory({ phone: p, customerName: c, dogName: d })}
              onOpenDocuments={(bk) => setSelectedDocumentsBooking(bk)}
              actionType="arrival"
            />
          ))}
        </div>
      )}
    </div>
  );

  const renderStayingSection = () => (
    <div key="staying">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-extrabold text-indigo-700 flex items-center gap-1.5">
          <Home className="w-4 h-4" />
          <span>שוהים בריזורט ({stayingList.length})</span>
        </h4>
      </div>

      {stayingList.length === 0 ? (
        <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-xl border border-slate-100">
          אין כלבים נוספים השוהים ביום זה
        </p>
      ) : (
        <div className="space-y-2.5">
          {stayingList.map(b => (
            <DogBookingCard
              key={b.id}
              booking={b}
              allBookings={bookings}
              settings={settings}
              dateStr={dateStr || undefined}
              isHighlighted={b.id === highlightedBookingId}
              onSelect={() => onSelectBooking(b)}
              onDelete={() => onDeleteBooking && onDeleteBooking(b.id)}
              onMarkPaid={() => onMarkAsPaid(b.id)}
              onOpenPayment={() => onOpenPaymentModal(b)}
              onOpenSendPaymentLink={() => onOpenSendPaymentLink && onOpenSendPaymentLink(b)}
              onToggleStayStatus={onToggleStayStatus}
              onInitiateRelease={() => onInitiateRelease && onInitiateRelease(b)}
              onToggleReviewRequest={() => onToggleReviewRequest && onToggleReviewRequest(b)}
              onOpenVoucher={() => onOpenVoucher && onOpenVoucher({ customerName: b.ownerName, dogName: b.dogName, phone: b.ownerPhone, staysCount: getStaysCount(b.ownerPhone) })}
              onOpenChatHistory={(p, c, d) => setSelectedChatHistory({ phone: p, customerName: c, dogName: d })}
              onOpenDocuments={(bk) => setSelectedDocumentsBooking(bk)}
              actionType="staying"
            />
          ))}
        </div>
      )}
    </div>
  );

  const renderDeparturesSection = () => (
    <div key="departures">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-extrabold text-amber-700 flex items-center gap-1.5">
          <ArrowUpRight className="w-4 h-4" />
          <span>חוזרים הביתה היום ({departuresList.length})</span>
        </h4>
      </div>

      {departuresList.length === 0 ? (
        <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-xl border border-slate-100">
          אין יציאות מתוכננות ליום זה
        </p>
      ) : (
        <div className="space-y-2.5">
          {departuresList.map(b => (
            <DogBookingCard
              key={b.id}
              booking={b}
              allBookings={bookings}
              settings={settings}
              dateStr={dateStr || undefined}
              isHighlighted={b.id === highlightedBookingId}
              onSelect={() => onSelectBooking(b)}
              onDelete={() => onDeleteBooking && onDeleteBooking(b.id)}
              onMarkPaid={() => onMarkAsPaid(b.id)}
              onOpenPayment={() => onOpenPaymentModal(b)}
              onOpenSendPaymentLink={() => onOpenSendPaymentLink && onOpenSendPaymentLink(b)}
              onToggleStayStatus={onToggleStayStatus}
              onInitiateRelease={() => onInitiateRelease && onInitiateRelease(b)}
              onToggleReviewRequest={() => onToggleReviewRequest && onToggleReviewRequest(b)}
              onOpenVoucher={() => onOpenVoucher && onOpenVoucher({ customerName: b.ownerName, dogName: b.dogName, phone: b.ownerPhone, staysCount: getStaysCount(b.ownerPhone) })}
              onOpenChatHistory={(p, c, d) => setSelectedChatHistory({ phone: p, customerName: c, dogName: d })}
              onOpenDocuments={(bk) => setSelectedDocumentsBooking(bk)}
              actionType="departure"
            />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-3xl lg:max-w-4xl w-full max-h-[90vh] flex flex-col text-slate-900 overflow-hidden my-auto">
        
        {/* Header with Full Hebrew Date & Capacity (Fixed / Pinned) */}
        <div className="flex items-start justify-between gap-3 p-4 sm:p-5 pb-3.5 border-b border-slate-100 shrink-0 bg-white z-10">
          <div>
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-green-600" />
              <h3 className="font-extrabold text-lg sm:text-xl text-slate-900">
                {formatFullHebrewDate(dateStr)}
              </h3>
            </div>
            
            {/* Capacity Meter */}
            <div className="flex items-center gap-2 mt-2">
              <div className={`text-xs px-2.5 py-1 rounded-full font-bold border flex items-center gap-1.5 ${
                isOverbooked 
                  ? 'bg-red-100 text-red-700 border-red-300'
                  : breakdown.total >= settings.maxCapacity
                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                  : 'bg-green-100 text-green-800 border-green-300'
              }`}>
                {isOverbooked ? <ShieldAlert className="w-3.5 h-3.5" /> : <Home className="w-3.5 h-3.5" />}
                <span>תפוסה יומית: {breakdown.total} / {settings.maxCapacity} כלבים</span>
              </div>

              {isOverbooked && (
                <span className="text-xs text-red-600 font-semibold">
                  ⚠️ חריגה של {breakdown.total - settings.maxCapacity} מעל הקיבולת!
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onNewBookingForDate(dateStr);
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1 shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>הזמנה ליום זה</span>
            </button>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body Content */}
        <div className="p-4 sm:p-5 pt-3 overflow-y-auto overflow-x-hidden flex-1 space-y-4">

        {/* Pending Intake / Pass Reservation Requests for this Date */}
        {pendingRequestsForDate.length > 0 && (
          <div className="space-y-3">
            {pendingRequestsForDate.map(req => {
              const isPass = Boolean(req.daycarePassCode || (req.notes && (req.notes.includes('כרטיסיי') || req.notes.includes('בנק'))));
              const matchedPass = req.daycarePassCode ? findDaycarePassByCode(req.daycarePassCode, settings.daycare_passes) : null;
              const isBoarding = req.serviceType === 'boarding';
              const daysCount = Math.max(1, calculateDaysCount(req.startDate, req.endDate));
              const remainingDays = matchedPass ? Math.max(0, matchedPass.totalDays - matchedPass.usedDays) : null;
              const isFocused = focusedIntakeRequestId === req.id;

              return (
                <div 
                  key={req.id}
                  className={`rounded-2xl p-4 border-2 shadow-lg transition-all animate-in fade-in-50 ${
                    isPass 
                      ? 'bg-gradient-to-r from-emerald-950 via-teal-900 to-slate-900 text-white border-emerald-400' 
                      : 'bg-amber-50 text-amber-950 border-amber-300'
                  } ${isFocused ? 'ring-4 ring-amber-400' : ''}`}
                >
                  <div className="flex items-start justify-between flex-wrap gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{isPass ? '🎟️' : '📋'}</span>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                            isPass ? 'bg-amber-400 text-slate-950' : 'bg-amber-200 text-amber-900'
                          }`}>
                            {isPass ? 'בקשת שריון מכרטיסייה / בנק ימים' : 'בקשת קליטה חדשה'}
                          </span>
                          {req.daycarePassCode && (
                            <span className="text-xs font-mono font-bold bg-white/20 px-2 py-0.5 rounded text-white border border-white/20">
                              #{req.daycarePassCode}
                            </span>
                          )}
                          {isFocused && (
                            <span className="text-[10px] font-black bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full">
                              מבוקש כעת 📌
                            </span>
                          )}
                        </div>
                        <h3 className="text-lg font-black mt-1">
                          {req.dogName} 🐾 ({req.dogBreed || 'מעורב'})
                        </h3>
                        <p className={`text-xs ${isPass ? 'text-slate-300' : 'text-slate-600'} flex items-center gap-1.5 mt-0.5`}>
                          <span>{req.ownerName}</span>
                          <span>•</span>
                          <span className="font-mono font-bold">{req.ownerPhone}</span>
                        </p>
                      </div>
                    </div>

                    <div className="text-left bg-white/10 p-2 rounded-xl border border-white/15">
                      <span className={`text-xs font-bold block ${isPass ? 'text-emerald-300' : 'text-amber-800'}`}>
                        {formatDateIL(req.startDate)} עד {formatDateIL(req.endDate)} ({daysCount} {isBoarding ? 'יממות' : 'ימים'})
                      </span>
                      {remainingDays !== null && (
                        <span className="text-[11px] text-amber-300 font-bold block mt-0.5">
                          יתרה בכרטיסייה: נותרו {remainingDays} מתוך {matchedPass?.totalDays || 21} ימים ({remainingDays}/{matchedPass?.totalDays || 21})
                        </span>
                      )}
                    </div>
                  </div>

                  {req.notes && (
                    <p className={`text-xs p-2.5 rounded-xl mb-3 ${isPass ? 'bg-white/10 text-slate-200 border border-white/10' : 'bg-amber-100/70 text-amber-900'}`}>
                      📝 {req.notes}
                    </p>
                  )}

                  {/* Resort Occupancy context */}
                  <div className={`text-xs mb-3 flex items-center justify-between px-2 py-1.5 rounded-xl ${isPass ? 'bg-white/5' : 'bg-amber-100/40'}`}>
                    <span>
                      תפוסת הריזורט ביום זה: <strong>{breakdown.total} מתוך {settings.maxCapacity} כלבים</strong>
                    </span>
                    <span className={breakdown.total >= settings.maxCapacity ? 'text-rose-400 font-bold' : 'text-emerald-300 font-bold'}>
                      {breakdown.total >= settings.maxCapacity ? '⚠️ תפוסה מלאה' : `🟢 ${settings.maxCapacity - breakdown.total} מקומות פנויים`}
                    </span>
                  </div>

                  {/* Actions: Approve & Book vs Reject */}
                  <div className="flex items-center gap-2 pt-2 border-t border-white/15">
                    <button
                      type="button"
                      onClick={() => onApproveIntakeRequest && onApproveIntakeRequest(req)}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-black py-2.5 px-3 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>{isPass ? 'אשר וקלוט ליומן (קיזוז יום מהכרטיסייה) 🟢' : 'אשר וקלוט ליומן 🟢'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onRejectIntakeRequest && onRejectIntakeRequest(req)}
                      className="bg-white/10 hover:bg-red-600/30 text-white hover:text-red-200 border border-white/20 hover:border-red-400 font-bold py-2.5 px-3 rounded-xl text-xs flex items-center gap-1 cursor-pointer transition-all"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>דחה 🔴</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Highlighted Search Target Banner */}
        {highlightedBookingId && (
          <div className="p-2.5 bg-emerald-100 border border-emerald-300 rounded-xl flex items-center justify-between gap-2 text-xs text-emerald-950 font-bold shadow-2xs animate-in fade-in">
            <div className="flex items-center gap-1.5">
              <span>🎯</span>
              <span>תוצאת חיפוש: הכלב שנבחר מוצג בראש הרשימה ומודגש בירוק</span>
            </div>
            <span className="text-[10px] bg-emerald-700 text-white px-2 py-0.5 rounded-full font-black">
              בראש הרשימה ⭐
            </span>
          </div>
        )}

        {/* Shabbat / Holiday Greeting Button Banner */}
        {breakdown.staying.length > 0 && (
          <div className="p-3.5 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border-2 border-emerald-300 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-[#25D366] text-white flex items-center justify-center font-black text-xl shadow-2xs shrink-0">
                💬
              </div>
              <div>
                <div className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                  <span>עדכון ד״ש מהכלבים {holidayInfo.isSpecial ? `(${holidayInfo.label})` : ''}</span>
                  {holidayInfo.isSpecial && (
                    <span className="text-[10px] bg-emerald-200/80 text-emerald-950 px-2 py-0.2 rounded-full font-black">
                      {holidayInfo.icon} חג / שבת
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-emerald-800 font-medium">
                  שליחת הודעת וואטסאפ אישית וחמה לבעלי {breakdown.staying.length} הכלבים ששוהים כעת בריזורט
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsGreetingModalOpen(true)}
              className="bg-[#25D366] hover:bg-[#1EBE5D] active:scale-95 text-white font-black px-4 py-2 rounded-xl text-xs sm:text-sm flex items-center gap-2 transition-all shadow-xs cursor-pointer hover:shadow-md shrink-0"
            >
              <MessageSquare className="w-4 h-4 fill-white/20 shrink-0" />
              <span>שלח ד״ש לבעלים ({breakdown.staying.length} כלבים)</span>
            </button>
          </div>
        )}

        {/* Sections in dynamic priority order: Whichever section contains the searched dog appears FIRST! */}
        <div className="space-y-5">
          {isArrivalTarget
            ? [renderArrivalsSection(), renderDeparturesSection(), renderStayingSection()]
            : isStayingTarget
            ? [renderStayingSection(), renderDeparturesSection(), renderArrivalsSection()]
            : isDepartureTarget
            ? [renderDeparturesSection(), renderArrivalsSection(), renderStayingSection()]
            : [renderDeparturesSection(), renderArrivalsSection(), renderStayingSection()]}
        </div>

      </div>

      {/* Shabbat / Holiday Greeting Modal */}
      {isGreetingModalOpen && (
        <ShabbatHolidayGreetingModal
          dateStr={dateStr}
          bookings={bookings}
          settings={settings}
          onClose={() => setIsGreetingModalOpen(false)}
        />
      )}

      {/* WhatsApp Chat History Modal with Voice Note Transcription */}
      {selectedChatHistory && (
        <WhatsAppChatHistoryModal
          isOpen={true}
          onClose={() => setSelectedChatHistory(null)}
          phone={selectedChatHistory.phone}
          customerName={selectedChatHistory.customerName}
          dogName={selectedChatHistory.dogName}
          settings={settings}
        />
      )}

      {/* Customer & Booking Related Documents Modal (מסמכים קשורים) */}
      {selectedDocumentsBooking && (
        <CustomerDocumentsModal
          isOpen={true}
          onClose={() => setSelectedDocumentsBooking(null)}
          booking={selectedDocumentsBooking}
          allBookings={bookings}
          intakeRequests={intakeRequests}
          settings={settings}
          onOpenSendPaymentLink={() => onOpenSendPaymentLink && onOpenSendPaymentLink(selectedDocumentsBooking)}
          onOpenVoucher={() => onOpenVoucher && onOpenVoucher({
            customerName: selectedDocumentsBooking.ownerName,
            dogName: selectedDocumentsBooking.dogName,
            phone: selectedDocumentsBooking.ownerPhone,
            staysCount: getStaysCount(selectedDocumentsBooking.ownerPhone)
          })}
        />
      )}

      </div>
    </div>
  );
};

export interface PassStayInfo {
  isPass: boolean;
  pass?: DaycarePass;
  passCode?: string;
  totalDays: number;
  currentDayInPass: number;
  currentDayInStay: number;
  totalDaysInStay: number;
  remainingDays: number;
  displayText: string;
  tooltipText: string;
  futureDaysBooked?: number;
  netAvailableAfterFuture?: number;
  statusType?: 'normal' | 'low' | 'exhausted' | 'exceeded';
  isExceeded?: boolean;
  exceededDays?: number;
  remainingLabel?: string;
}

export function getBookingPassStayInfo(
  booking: Booking,
  settings?: ResortSettings,
  currentDateStr?: string
): PassStayInfo | null {
  const notes = booking.notes || '';
  const isExplicitPass = Boolean(
    booking.daycarePassId ||
    booking.daycarePassCode ||
    booking.daycarePassPaid ||
    notes.includes('כרטיסיי') ||
    notes.includes('כרטיסיה') ||
    notes.includes('בנק יממות') ||
    notes.includes('בנק 21') ||
    notes.includes('בנק 10')
  );

  const passes: DaycarePass[] = (settings?.daycare_passes && settings.daycare_passes.length > 0)
    ? settings.daycare_passes
    : (settings?.daycarePasses && settings.daycarePasses.length > 0)
    ? settings.daycarePasses
    : loadStoredDaycarePasses();

  let matchedPass: DaycarePass | null = null;
  if (booking.daycarePassId) {
    matchedPass = passes.find(p => p.id === booking.daycarePassId) || null;
  }
  if (!matchedPass && booking.daycarePassCode && booking.daycarePassCode !== 'קוד') {
    matchedPass = findDaycarePassByCode(booking.daycarePassCode, passes);
  }
  if (!matchedPass) {
    const codeMatch = notes.match(/#(\d+)/) || notes.match(/קוד\s*#?([A-Za-z0-9-]+)/i);
    if (codeMatch && codeMatch[1]) {
      matchedPass = findDaycarePassByCode(codeMatch[1], passes);
    }
  }
  if (!matchedPass && booking.ownerPhone) {
    matchedPass = findActiveDaycarePassByPhone(booking.ownerPhone, passes);
  }

  if (!isExplicitPass && !matchedPass) {
    return null;
  }

  const totalDays = matchedPass?.totalDays || (() => {
    const m = notes.match(/בנק\s*(\d+)/i) || notes.match(/(\d+)\s*יממות/i) || notes.match(/כרטיסיי?ת\s*(\d+)/i);
    return m ? parseInt(m[1], 10) : 21;
  })();

  const effectiveDate = currentDateStr || getTodayStr();
  const totalDaysInStay = Math.max(1, calculateDaysCount(booking.startDate, booking.endDate));

  let currentDayInStay = 1;
  if (effectiveDate <= booking.startDate) {
    currentDayInStay = 1;
  } else if (effectiveDate >= booking.endDate) {
    currentDayInStay = totalDaysInStay;
  } else {
    currentDayInStay = Math.min(totalDaysInStay, Math.max(1, calculateDaysCount(booking.startDate, effectiveDate) + 1));
  }

  let priorDays = 0;
  if (matchedPass?.usageHistory && matchedPass.usageHistory.length > 0) {
    for (const u of matchedPass.usageHistory) {
      if (u.bookingId === booking.id) break;
      priorDays += (u.daysDeducted || u.daysCount || 0);
    }
  } else {
    const priorMatch = notes.match(/נוצלו\s*כבר\s*(\d+)/);
    if (priorMatch && priorMatch[1]) {
      priorDays = parseInt(priorMatch[1], 10);
    }
  }

  // Progressive countdown: nights consumed up to and including effectiveDate
  const currentDayInPass = priorDays + currentDayInStay;
  const totalConsumedOnThisDate = priorDays + currentDayInStay;
  const remainingOnThisDate = totalDays - totalConsumedOnThisDate;
  const daysUsedThroughThisStay = priorDays + totalDaysInStay;
  const remainingAfterStay = totalDays - daysUsedThroughThisStay;

  const isExceeded = remainingOnThisDate < 0;
  const exceededDays = isExceeded ? Math.abs(remainingOnThisDate) : 0;
  const statusType: 'normal' | 'low' | 'exhausted' | 'exceeded' = isExceeded
    ? 'exceeded'
    : remainingOnThisDate === 0
    ? 'exhausted'
    : remainingOnThisDate <= 2
    ? 'low'
    : 'normal';

  let remainingLabel = `${remainingOnThisDate}/${totalDays}`;
  if (isExceeded) {
    remainingLabel = `חריגה (+${exceededDays}) · ${daysUsedThroughThisStay}/${totalDays}`;
  } else if (remainingOnThisDate === 0) {
    remainingLabel = `0/${totalDays} (מוצה)`;
  } else if (remainingOnThisDate <= 2) {
    remainingLabel = `${remainingOnThisDate}/${totalDays}`;
  }

  // Any future booked stays already registered in pass:
  const futureDaysBooked = matchedPass ? Math.max(0, matchedPass.usedDays - daysUsedThroughThisStay) : 0;
  const netAvailableAfterFuture = Math.max(0, remainingAfterStay - futureDaysBooked);

  const passCode = matchedPass?.passCode || (booking.daycarePassCode && booking.daycarePassCode !== 'קוד' ? booking.daycarePassCode : '') || (notes.match(/#(\d+)/)?.[1]) || '';

  const displayText = isExceeded 
    ? `🚨 חריגת כרטיסייה: ${daysUsedThroughThisStay}/${totalDays}`
    : `🎟️ כרטיסייה: ${remainingOnThisDate}/${totalDays}`;

  const tooltipText = isExceeded
    ? `🚨 חריגת כרטיסייה #${passCode}! יום זה חורג ב-${exceededDays} יממות מעבר למכסה שנרכשה (${daysUsedThroughThisStay}/${totalDays}). נדרש לגבות תשלום נפרד!`
    : `כרטיסייה${passCode ? ` #${passCode}` : ''} | יום ${currentDayInPass} מתוך ${totalDays} | נותרו ${remainingOnThisDate} מתוך ${totalDays} יממות בסיום יום זה (בסיום שהייה זו יוותרו ${Math.max(0, remainingAfterStay)} יממות)${futureDaysBooked > 0 ? ` (${netAvailableAfterFuture} פנויים לאחר שריון עתידי נוסף)` : ''}`;

  return {
    isPass: true,
    pass: matchedPass || undefined,
    passCode: passCode || undefined,
    totalDays,
    currentDayInPass,
    currentDayInStay,
    totalDaysInStay,
    remainingDays: remainingOnThisDate,
    futureDaysBooked,
    netAvailableAfterFuture,
    statusType,
    isExceeded,
    exceededDays,
    remainingLabel,
    displayText,
    tooltipText
  };
}

interface DogBookingCardProps {
  booking: Booking;
  allBookings?: Booking[];
  settings: ResortSettings;
  dateStr?: string;
  isHighlighted?: boolean;
  onSelect: () => void;
  onDelete?: () => void;
  onMarkPaid: () => void;
  onOpenPayment: () => void;
  onOpenSendPaymentLink?: () => void;
  onToggleStayStatus?: (bookingId: string, newStatus: Booking['stayStatus']) => void;
  onInitiateRelease?: () => void;
  onToggleReviewRequest?: () => void;
  onOpenVoucher?: () => void;
  onOpenChatHistory?: (phone: string, customerName: string, dogName?: string) => void;
  onOpenDocuments?: (booking: Booking) => void;
  actionType: 'arrival' | 'staying' | 'departure';
}

const DogBookingCard: React.FC<DogBookingCardProps> = React.memo(({
  booking,
  allBookings,
  settings,
  dateStr,
  isHighlighted,
  onSelect,
  onDelete,
  onMarkPaid,
  onOpenPayment,
  onOpenSendPaymentLink,
  onToggleStayStatus,
  onInitiateRelease,
  onToggleReviewRequest,
  onOpenVoucher,
  onOpenChatHistory,
  onOpenDocuments,
  actionType,
}) => {
  const todayStr = getTodayStr();
  const effectiveDate = dateStr || todayStr;
  const isEnded = booking.stayStatus === 'checked_out' || (booking.endDate < todayStr);
  const isEndingToday = booking.endDate === todayStr;
  const remainingDebt = Math.max(0, Math.round(booking.totalPrice - booking.depositAmount));
  const roundedTotal = Math.round(booking.totalPrice || 0);
  const roundedDeposit = Math.round(booking.depositAmount || 0);
  const stayColors = getStayStatusColors(
    booking.stayStatus, 
    booking.endDate, 
    todayStr, 
    booking.startDate, 
    actionType === 'departure' ? booking.endDate : todayStr
  );

  const passInfo = getBookingPassStayInfo(booking, settings, effectiveDate);
  const isPassStay = Boolean(passInfo?.isPass);
  const isFree = !isPassStay && Boolean(booking.isFreeStay || (booking as any).is_free_stay);

  // Accurate Pair Detection
  const pairInfo = allBookings && allBookings.length > 0 ? getBookingPairInfo(booking, allBookings) : null;
  const hasExplicitPairNotes = Boolean(
    booking.notes && (
      booking.notes.includes('זוג כלבים') || 
      booking.notes.includes('2 כלבים') || 
      booking.notes.includes('כלב שני') || 
      booking.notes.includes('כלב נוסף') || 
      booking.notes.includes('שולם דרך')
    )
  );
  const isPairDog = Boolean((pairInfo && pairInfo.isPair) || booking.linkedDogName || hasExplicitPairNotes);
  const isSecondaryDog = Boolean((pairInfo && pairInfo.isSecondary) || booking.linkedDogName || (booking.notes && (booking.notes.includes('שולם דרך') || booking.notes.includes('כלב שני'))));

  // Status color styles matching design
  let paymentBorder = isEnded 
    ? 'border-slate-200 bg-slate-50/70 text-slate-600 opacity-80' 
    : isPassStay && passInfo?.isExceeded
    ? 'border-2 border-rose-500 bg-rose-50/80 shadow-md ring-2 ring-rose-400/50'
    : isPassStay && passInfo?.statusType === 'low'
    ? 'border-amber-400 bg-amber-50/40 ring-1 ring-amber-300'
    : isPassStay
    ? 'border-teal-400 bg-teal-50/30'
    : isFree
    ? 'border-emerald-300 bg-emerald-50/40'
    : 'border-red-300 bg-red-50/40';

  let paymentTag = isEnded ? (
    <span className="text-[11px] bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 shadow-2xs whitespace-nowrap">
      <span>🏁 הסתיים ושוחרר</span>
    </span>
  ) : isPassStay && passInfo ? (
    <span 
      title={passInfo.tooltipText}
      className={`text-xs px-3 py-1 rounded-xl font-black flex items-center gap-1.5 shadow-xs whitespace-nowrap border ${
        passInfo.isExceeded
          ? 'bg-gradient-to-r from-rose-700 via-rose-800 to-red-900 text-white border-rose-500 animate-pulse'
          : passInfo.statusType === 'exhausted'
          ? 'bg-gradient-to-r from-orange-600 to-amber-700 text-white border-orange-500'
          : passInfo.statusType === 'low'
          ? 'bg-gradient-to-r from-amber-600 via-amber-700 to-yellow-800 text-white border-amber-500'
          : 'bg-gradient-to-r from-teal-700 via-teal-800 to-emerald-800 text-white border-teal-600/40'
      }`}
    >
      <span>{passInfo.displayText}</span>
      <span className="text-[10px] text-white/90 font-black bg-black/25 px-1.5 py-0.5 rounded-md">
        ({passInfo.remainingLabel})
      </span>
    </span>
  ) : isFree ? (
    isSecondaryDog ? (
      <span className="text-[11px] bg-emerald-600 text-white px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 shadow-xs whitespace-nowrap">
        <span>🎁 שולם במלואו (דרך {booking.linkedDogName || (pairInfo && pairInfo.siblingNames) || 'כרטיס ראשון'})</span>
      </span>
    ) : (
      <span className="text-[11px] bg-emerald-600 text-white px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 shadow-xs whitespace-nowrap">
        <span>🎁 אירוח ללא תשלום (חינם)</span>
      </span>
    )
  ) : (
    <span className="text-[11px] bg-red-500 text-white px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 shadow-xs whitespace-nowrap">
      <span>לא שולם (חוב ₪{remainingDebt.toLocaleString('he-IL')})</span>
    </span>
  );

  if (!isEnded && !isFree && !isPassStay) {
    if (booking.paymentStatus === 'fully_paid' || (remainingDebt === 0 && roundedTotal > 0)) {
      paymentBorder = 'border-green-300 bg-green-50/40';
      paymentTag = (
        <span className="text-[11px] bg-green-600 text-white px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 shadow-xs whitespace-nowrap">
          <span>שולם מלא (₪{roundedTotal.toLocaleString('he-IL')})</span>
        </span>
      );
    } else if (booking.paymentStatus === 'deposit_paid' || roundedDeposit > 0) {
      paymentBorder = 'border-dashed border-green-400 bg-green-50/20';
      paymentTag = (
        <span className="text-[11px] border-2 border-dashed border-green-600 bg-green-50 text-green-900 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 whitespace-nowrap">
          <span>מקדמה ₪{roundedDeposit.toLocaleString('he-IL')} (יתרה ₪{remainingDebt.toLocaleString('he-IL')})</span>
        </span>
      );
    }
  }

  const handleSendWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    const msg = generatePaymentReminderMessage(booking, settings);
    openWhatsAppMessage(booking.ownerPhone, msg);
  };

  const cardRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (isHighlighted && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [isHighlighted]);

  return (
    <div
      ref={cardRef}
      onClick={onSelect}
      className={`p-3.5 sm:p-4 rounded-2xl border-2 transition-all hover:shadow-xs cursor-pointer ${
        isHighlighted
          ? 'ring-3 ring-emerald-500 border-emerald-500 bg-emerald-50/50 shadow-md scale-[1.01]'
          : isPairDog
          ? `${paymentBorder} border-r-[5px] border-r-indigo-500`
          : paymentBorder
      }`}
    >
      {/* Top Row: Dog Details & Payment Tag */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5 pb-2.5 border-b border-slate-200/60">
        <div className="space-y-1 flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {isTrainingBooking(booking) ? (
              <img
                src="/resort-official-logo.jpg"
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/resort-logo.svg'; }}
                alt="אילוף"
                title="כלב בתהליך אילוף"
                className="w-5 h-5 object-contain shrink-0 rounded-full border border-amber-300/60 shadow-2xs"
              />
            ) : (
              <span className="text-base shrink-0">🐾</span>
            )}
            <span className={`font-black text-base sm:text-lg ${stayColors.dogClass}`}>{booking.dogName}</span>
            <span className={`text-xs sm:text-sm font-bold ${stayColors.ownerClass}`}>({booking.ownerName})</span>
            {isHighlighted && (
              <span className="bg-emerald-700 text-white text-[11px] font-black px-2.5 py-0.5 rounded-full shadow-xs flex items-center gap-1 shrink-0">
                <span>⭐</span>
                <span>נבחר ביומן</span>
              </span>
            )}
            {isPairDog && (
              <span className="text-xs bg-indigo-100 text-indigo-900 border border-indigo-300 px-2.5 py-0.5 rounded-full font-black flex items-center gap-1 shadow-2xs">
                <span>🔗</span>
                <span>{isSecondaryDog ? `זוג כלבים (שולם דרך ${booking.linkedDogName || (pairInfo && pairInfo.siblingNames) || 'כרטיס ראשון'})` : `זוג כלבים${pairInfo && pairInfo.siblingNames ? ` (יחד עם ${pairInfo.siblingNames})` : ''}`}</span>
              </span>
            )}
            {booking.dogBreed && (
              <span className="text-xs text-slate-500 font-normal">({booking.dogBreed})</span>
            )}
            <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-medium border border-slate-200">
              {getServiceTypeHebrew(booking.serviceType)}
            </span>
            {isPassStay && passInfo && (
              <span 
                title={passInfo.tooltipText}
                className={`text-xs px-2.5 py-0.5 rounded-full font-black shadow-2xs flex items-center gap-1 shrink-0 ${
                  passInfo.isExceeded
                    ? 'bg-rose-100 text-rose-950 border-2 border-rose-500 animate-pulse'
                    : 'bg-teal-100 text-teal-950 border border-teal-300'
                }`}
              >
                <span>{passInfo.isExceeded ? '🚨' : '🎟️'} בנק {passInfo.totalDays} יממות ({passInfo.remainingDays}/{passInfo.totalDays})</span>
              </span>
            )}
            {/* Placement / Room / Suite Location Badge (Visible for ALL dogs) */}
            {(() => {
              const norm = normalizePlacementKey(booking.kennelNumber);
              let badgeColor = 'bg-amber-50/80 text-amber-800 border-amber-300 border-dashed';
              let badgeText = '📍 טרם שובץ חדר';
              let titleText = 'הכלב טרם שובץ לחדר/סוויטה בריזורט';

              if (norm === 'home') {
                badgeColor = 'bg-amber-100 text-amber-950 border-amber-300';
                badgeText = '📍 הלנה ביתית (בבית של שמוליק)';
                titleText = 'מיקום: הלנה ביתית (בבית של שמוליק)';
              } else if (norm && norm.startsWith('room_')) {
                badgeColor = 'bg-sky-100 text-sky-950 border-sky-300';
                badgeText = `📍 ${getPlacementDisplayName(booking.kennelNumber)}`;
                titleText = `מיקום בריזורט: ${getPlacementDisplayName(booking.kennelNumber)}`;
              } else if (norm && norm.startsWith('suite_')) {
                badgeColor = 'bg-purple-100 text-purple-950 border-purple-300';
                badgeText = `📍 ${getPlacementDisplayName(booking.kennelNumber)}`;
                titleText = `מיקום בריזורט: ${getPlacementDisplayName(booking.kennelNumber)}`;
              } else if (norm) {
                badgeColor = 'bg-emerald-100 text-emerald-950 border-emerald-300';
                badgeText = `📍 ${getPlacementDisplayName(booking.kennelNumber)}`;
                titleText = `מיקום בריזורט: ${getPlacementDisplayName(booking.kennelNumber)}`;
              }

              return (
                <span 
                  title={titleText}
                  className={`text-xs px-2.5 py-0.5 rounded-full font-black border shadow-2xs ${badgeColor} inline-flex items-center gap-1 shrink-0`}
                >
                  {badgeText}
                </span>
              );
            })()}
            {isEnded && (
              <span className="text-[10px] bg-slate-200/80 text-slate-600 px-2 py-0.5 rounded-full font-bold">
                הסתיים
              </span>
            )}
            {isPassStay && passInfo && passInfo.isExceeded && (
              <div className="w-full mt-2 p-2.5 rounded-xl bg-rose-50 border-2 border-rose-400 text-rose-950 text-xs font-black flex items-center gap-2 animate-pulse shadow-xs">
                <span className="text-base shrink-0">🚨</span>
                <span className="flex-1">
                  <strong>התראת חריגת כרטיסייה:</strong> שהייה זו חורגת ב-<strong>{passInfo.exceededDays}</strong> {passInfo.exceededDays === 1 ? 'יממה' : 'יממות'} מעבר למכסה שנרכשה בכרטיסייה (#{passInfo.passCode || '8935'})! נדרש לגבות תשלום נפרד עבור ימי החריגה.
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-600 mt-1">
            <span className="flex items-center gap-1 font-bold text-slate-800">
              <User className="w-3.5 h-3.5 text-indigo-500" />
              <span>בעלים: <strong className={stayColors.ownerClass ? 'text-slate-900 font-bold' : 'text-slate-900'}>{booking.ownerName}</strong></span>
            </span>
            <span className="flex items-center gap-1 font-mono text-slate-700 font-semibold" dir="ltr">
              <Phone className="w-3.5 h-3.5 text-green-600" /> {booking.ownerPhone}
            </span>
            <span className="flex items-center gap-1 font-medium text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">
              <Calendar className="w-3.5 h-3.5 text-amber-600" />
              <span>{formatStayDatesDisplay(booking.startDate, booking.endDate, booking.serviceType)}</span>
            </span>
            {booking.ownerAddress && (
              <span className="flex items-center gap-1.5 font-bold text-slate-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md shadow-2xs">
                <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>{booking.ownerAddress}</span>
                <a
                  href={getWazeNavigationUrl(booking.ownerAddress, booking.ownerCoordinates)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="mr-1 text-[11px] text-sky-700 hover:text-sky-900 font-black underline flex items-center gap-0.5"
                  title="נווט לבית הבעלים ב-Waze במקרה חירום"
                >
                  <span>🚗 Waze</span>
                </a>
              </span>
            )}
          </div>

          {/* Feeding & Medication Details Line */}
          {(booking.feedingSchedule || booking.foodPortion || booking.medicationSchedule || booking.specialDiet) && (
            <div className="flex flex-wrap items-center gap-2 text-xs mt-1">
              {(booking.feedingSchedule || booking.foodPortion || booking.specialDiet) && (
                <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md font-medium">
                  🥣 מזון: {booking.feedingSchedule ? `⏰ ${booking.feedingSchedule} ` : ''}{[booking.foodPortion, booking.specialDiet].filter(Boolean).join(' | ')}
                </span>
              )}
              {(booking.medicationSchedule || (booking.medications && !booking.medications.includes('אין') && !booking.medications.includes('בריא'))) && (
                <span className="bg-rose-50 text-rose-800 border border-rose-200 px-2 py-0.5 rounded-md font-bold">
                  💊 תרופות: {booking.medicationSchedule || booking.medications}
                </span>
              )}
              {booking.complexitySurcharge && booking.complexitySurcharge > 0 && (
                <span className="bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-md font-bold">
                  💰 תוספת מורכבות: ₪{booking.complexitySurcharge}
                </span>
              )}
            </div>
          )}

          {booking.placementNotes && (
            <div className="bg-amber-100/90 border border-amber-300 text-amber-950 font-black text-xs px-2.5 py-1 rounded-xl inline-flex items-center gap-1.5 shadow-2xs mt-1">
              <span>🚩 דגש שיבוץ:</span>
              <span className="text-slate-900 font-bold">{booking.placementNotes}</span>
            </div>
          )}

          {/* Prominent Notes Box: Eye-catching styling with strict overflow containment */}
          {booking.notes && (() => {
            let displayNotes = booking.notes;
            if (isPassStay && passInfo) {
              displayNotes = displayNotes.replace(/\[אירוח ללא תשלום \(חינם\)\]/g, `[שריון מכרטיסייה${passInfo.passCode ? ` #${passInfo.passCode}` : ''}]`).trim();
            }
            return (
              <div 
                title={displayNotes}
                className="bg-amber-100/90 border border-amber-300/90 text-amber-950 text-xs sm:text-[13px] font-medium px-3 py-1.5 rounded-xl shadow-2xs mt-1.5 flex items-start gap-1.5 max-w-full overflow-hidden"
              >
                <span className="shrink-0 font-black text-amber-900">📝 הערות:</span>
                <span className="line-clamp-2 break-words leading-relaxed text-slate-900 font-semibold">{displayNotes}</span>
              </div>
            );
          })()}
        </div>

        {/* Payment Tag (Top Corner) */}
        <div className="shrink-0 self-start">
          {paymentTag}
        </div>
      </div>

      {/* Action Buttons Section */}
      <div className="pt-3 mt-3 border-t border-slate-200/80 flex flex-col gap-2.5">
        {/* Tier 1: Primary Operation (Check-in / Check-out - 70% width, centered in window) */}
        <div className="w-full flex items-center justify-center">
          {/* Check-in Button for Booked/Arriving Dogs */}
          {(booking.stayStatus === 'booked' || (booking.stayStatus as any) === 'confirmed') && onToggleStayStatus && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleStayStatus(booking.id, 'checked_in');
              }}
              title="סמן שהכלב נכנס ונקלט כעת בפועל בריזורט (צ'ק-אין מהיר)"
              className="w-[70%] min-w-[220px] max-w-full mx-auto bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-sm sm:text-base py-3 px-4 rounded-xl font-black flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-md hover:shadow-lg"
            >
              <CheckCircle className="w-5 h-5 text-white shrink-0" />
              <span className="truncate">קלוט לריזורט (צ'ק-אין) 🐾</span>
            </button>
          )}

          {/* Quick Check-Out / Release Dog Button */}
          {booking.stayStatus === 'checked_in' && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const remaining = Number(booking.totalPrice || 0) - Number(booking.depositAmount || 0);
                if (remaining <= 0 || booking.isFreeStay || booking.paymentStatus === 'fully_paid') {
                  if (onToggleStayStatus) {
                    onToggleStayStatus(booking.id, 'checked_out');
                  } else if (onInitiateRelease) {
                    onInitiateRelease();
                  }
                } else if (onInitiateRelease) {
                  onInitiateRelease();
                }
              }}
              title="שחרר כלב הביתה (צ'ק-אאוט מהיר)"
              className="w-[70%] min-w-[220px] max-w-full mx-auto bg-sky-600 hover:bg-sky-700 active:scale-[0.98] text-white text-sm sm:text-base py-3 px-4 rounded-xl font-black flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-md hover:shadow-lg"
            >
              <Home className="w-5 h-5 text-white shrink-0" />
              <span className="truncate">שחרר הביתה (צ'ק-אאוט) 🏁</span>
            </button>
          )}

          {/* Revert Check-out to Checked-in if needed */}
          {booking.stayStatus === 'checked_out' && onToggleStayStatus && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleStayStatus(booking.id, 'checked_in');
              }}
              title="החזר כלב למצב שוהה בריזורט"
              className="w-[70%] min-w-[220px] max-w-full mx-auto bg-slate-100 hover:bg-slate-200 active:scale-[0.98] text-slate-800 text-xs sm:text-sm py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all cursor-pointer border border-slate-300 shadow-2xs"
            >
              <span className="truncate">↩️ החזר לשהייה בריזורט</span>
            </button>
          )}
        </div>

        {/* Tier 2: Secondary Tools & CRM Actions (Equal width and height in balanced grid) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 w-full pt-1">
          {/* Primary Edit Button: Moved down to bottom row */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            title="ערוך פרטי הזמנה, תאריכים, מחיר או דרישות מיוחדות"
            className="w-full h-10 px-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer bg-indigo-50 hover:bg-indigo-100 active:scale-95 text-indigo-700 border border-indigo-200 shadow-2xs text-center"
          >
            <Edit2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span className="truncate">ערוך הזמנה ✏️</span>
          </button>

          {/* Customer Documents Button (מסמכים קשורים) */}
          {onOpenDocuments && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenDocuments(booking);
              }}
              title="צפה בהסכמי שהייה/אילוף חתומים דיגיטלית, שאלון קליטה, קבלות ומסמכים קשורים בתיק הלקוח"
              className="w-full h-10 px-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer bg-white hover:bg-indigo-50/60 active:scale-95 text-slate-700 hover:text-indigo-900 border border-slate-200 hover:border-indigo-300 shadow-2xs text-center"
            >
              <FileText className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="truncate">מסמכים קשורים 📄</span>
            </button>
          )}

          {/* WhatsApp Chat History & Voice Transcription Button (הצג היסטוריית הודעות) */}
          {onOpenChatHistory && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenChatHistory(booking.ownerPhone, booking.ownerName, booking.dogName);
              }}
              title="הצג היסטוריית הודעות והקלטות וואטסאפ עם הלקוח ותמלול קולי מלא"
              className="w-full h-10 px-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer bg-white hover:bg-emerald-50/60 active:scale-95 text-slate-700 hover:text-emerald-950 border border-slate-200 hover:border-emerald-300 shadow-2xs text-center"
            >
              <MessageSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="truncate">היסטוריית הודעות 💬</span>
            </button>
          )}

          {/* Send Payment Link Button */}
          {onOpenSendPaymentLink && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenSendPaymentLink();
              }}
              title="שלח קישור Grow / Bit לתשלום בוואטסאפ (יתרה, יום נוסף, או חיוב אקסטרה/קולר/וטרינר)"
              className="w-full h-10 px-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer bg-white hover:bg-emerald-50/60 active:scale-95 text-slate-700 hover:text-emerald-950 border border-slate-200 hover:border-emerald-300 shadow-2xs text-center"
            >
              <CreditCard className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="truncate">קישור לתשלום 💳</span>
            </button>
          )}

          {/* Send Voucher Button */}
          {onOpenVoucher && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenVoucher();
              }}
              title="הפק ושלח שובר הטבה לפעם הבאה או חבר מביא חבר"
              className="w-full h-10 px-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer bg-white hover:bg-amber-50/60 active:scale-95 text-slate-700 hover:text-amber-900 border border-slate-200 hover:border-amber-300 shadow-2xs text-center"
            >
              <Gift className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span className="truncate">שובר הטבה 🎁</span>
            </button>
          )}

          {/* Review & VIP Voucher Auto-Send toggle for departing/checked out dogs */}
          {(booking.stayStatus === 'checked_out' || isEnded || isEndingToday) && onToggleReviewRequest && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleReviewRequest();
              }}
              title={booking.skipReviewRequest 
                ? "שליחת שובר VIP וסקר מבוטלת ללקוח זה. לחץ להפעלה מחדש" 
                : "שובר VIP וסקר יישלחו אוטומטית מחר. לחץ לביטול (אם לא הלך טוב עם הלקוח)"}
              className={`w-full h-10 px-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer border shadow-2xs active:scale-95 text-center ${
                booking.skipReviewRequest
                  ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                  : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
              }`}
            >
              <span className="truncate">{booking.skipReviewRequest ? '🚫 שובר בוטל' : '⭐ שובר למחר'}</span>
            </button>
          )}

          {/* Quick Pay Action */}
          {remainingDebt > 0 && !isEnded && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkPaid();
                }}
                title="סמן כעת כשולם הכל במלואו"
                className="w-full h-10 px-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white border border-emerald-600 shadow-xs text-center"
              >
                <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">סמן כשולם ✅</span>
              </button>

              <button
                type="button"
                onClick={handleSendWhatsApp}
                title="שלח תזכורת תשלום בוואטסאפ ללקוח"
                className="w-full h-10 px-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer bg-white hover:bg-emerald-50 active:scale-95 text-emerald-700 border border-emerald-300 shadow-2xs text-center"
              >
                <MessageSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate">תזכורת תשלום 📲</span>
              </button>
            </>
          )}

          {/* Direct Delete Button */}
          {onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              title="מחק הזמנה זו מהיומן ומהענן"
              className="w-full h-10 px-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer bg-white hover:bg-rose-50 active:scale-95 text-rose-600 hover:text-rose-700 border border-slate-200 hover:border-rose-200 shadow-2xs text-center"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              <span className="truncate">מחק 🗑️</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
