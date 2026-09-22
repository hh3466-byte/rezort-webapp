import React, { useState, useRef, useEffect } from 'react';
import { IntakeRequest, IntakeRequestStatus, ResortSettings, Booking } from '../types';
import { cleanPhoneNumber, getServiceTypeHebrew, getFirstName } from '../utils/whatsappUtils';
import { formatClientPaymentLinkMessage, formatClientRejectionMessage, sendGreenApiDirectMessage } from '../services/notificationService';
import { getNextAllowedCommunicationDate, isShabbatOrHolidayRestricted } from '../utils/jewishCalendar';
import { SendIntakeModal } from './SendIntakeModal';
import { 
  X, 
  Phone, 
  MessageCircle, 
  CreditCard, 
  CheckCircle, 
  XCircle, 
  Calendar, 
  User, 
  Heart, 
  ShieldCheck, 
  Clock, 
  Filter,
  Search,
  ExternalLink,
  ChevronDown,
  Copy,
  Check,
  Pencil,
  AlertCircle,
  Plus,
  Minus,
  Save,
  Trash2,
  Sparkles,
  RotateCcw,
  Dog,
  Mic,
  MicOff,
  Bell,
  MapPin
} from 'lucide-react';
import { getWazeNavigationUrl } from '../utils/geolocationUtils';
import { calculateDaysCount, addDays, formatDateIL, getDayNameHebrew, getBookingsForDate } from '../utils/dateUtils';
import { generateUnansweredFollowUpMarketingText } from '../services/whatsappCrmService';
import { 
  normalizeHebrew, 
  hasActiveBookingForIntake, 
  getIntakeRequestAgeHours, 
  getEffectiveIntakeStatus, 
  isUnansweredIntakeRequest, 
  isIntakeRequestNew, 
  isIntakeRequestInTreatment 
} from '../utils/intakeUtils';

interface IntakeRequestsModalProps {
  requests: IntakeRequest[];
  settings: ResortSettings;
  bookings?: Booking[];
  initialFilter?: 'all' | 'pending' | 'new' | 'in_progress' | 'payment_requested' | 'approved' | 'rejected';
  onClose: () => void;
  onUpdateStatus: (id: string, status: IntakeRequestStatus, internalNotes?: string) => Promise<void>;
  onApproveAndBook: (request: IntakeRequest) => void;
  onDeleteRequest: (id: string) => Promise<void>;
  onSaveRequest?: (request: IntakeRequest) => Promise<void>;
}

export interface BoardingRateOptions {
  isFriendlyWithDogs?: 'yes' | 'no' | 'depends' | string | boolean;
  dogGender?: 'male' | 'female' | 'male_intact' | 'male_neutered' | 'female_spayed' | 'female_intact' | string;
  isNeutered?: boolean;
  isolationRate?: number;
}

/**
 * Calculate boarding daily rate based on duration and dog profile:
 * - When dog requires isolation / is aggressive (isFriendlyWithDogs === 'no')
 *   OR dog is an unneutered male (male intact):
 *   Fixed rate of 230 NIS/day (or defaultDailyRateIsolation from settings) with NO duration discounts.
 * - Regular dogs:
 *   - 1 to 7 days: default rate (180 NIS/day)
 *   - > 7 days (8 to 29 days): 150 NIS/day
 *   - 30+ days (month): 120 NIS/day
 */
export function calculateBoardingRate(
  days: number, 
  defaultRate: number = 180,
  optionsOrFriendly?: BoardingRateOptions | 'yes' | 'no' | 'depends' | string | boolean,
  isolationRateParam: number = 230
): { dailyRate: number; totalPrice: number; explanation: string; isSpecialRate: boolean } {
  const isObj = typeof optionsOrFriendly === 'object' && optionsOrFriendly !== null;
  const isFriendlyWithDogs = isObj ? optionsOrFriendly.isFriendlyWithDogs : optionsOrFriendly;
  const dogGender = isObj ? optionsOrFriendly.dogGender : undefined;
  const isNeutered = isObj ? optionsOrFriendly.isNeutered : undefined;
  const isolationRate = (isObj && optionsOrFriendly.isolationRate) ? optionsOrFriendly.isolationRate : (isolationRateParam || 230);

  const isAggressiveOrIsolation = isFriendlyWithDogs === 'no' || isFriendlyWithDogs === false;
  const isMaleIntact = dogGender === 'male_intact' || (dogGender === 'male' && isNeutered === false);

  // If dog requires isolation / aggressive OR is an unneutered male: 230 NIS/day, NO duration discounts!
  if (isAggressiveOrIsolation || isMaleIntact) {
    const rate = isolationRate || 230;
    let reason = 'בידוד / תוקפני';
    if (isAggressiveOrIsolation && isMaleIntact) {
      reason = 'בידוד / זכר לא מסורס';
    } else if (isMaleIntact) {
      reason = 'זכר לא מסורס';
    }
    return {
      dailyRate: rate,
      totalPrice: days * rate,
      explanation: `${days} ימים × ₪${rate} (${reason})`,
      isSpecialRate: true
    };
  }

  // מעבר ל-3 שבועות (21 ימים ומעלה): 120 ₪ ללילה
  if (days >= 21) {
    return {
      dailyRate: 120,
      totalPrice: days * 120,
      explanation: `${days} ימים × ₪120 (מעל 3 שבועות)`,
      isSpecialRate: false
    };
  }
  // 7 לילות ומעלה: 150 ₪ ללילה
  if (days >= 7) {
    return {
      dailyRate: 150,
      totalPrice: days * 150,
      explanation: `${days} ימים × ₪150 (7 לילות ומעלה)`,
      isSpecialRate: false
    };
  }
  // עד 6 לילות: 180 ₪ ללילה (תעריף ברירת מחדל)
  const rate = defaultRate || 180;
  return {
    dailyRate: rate,
    totalPrice: days * rate,
    explanation: `${days} ימים × ₪${rate} (עד 6 לילות)`,
    isSpecialRate: false
  };
}

// Subcomponent: Live Calendar & Available Spots for Requested Dates
const RequestedDatesCalendar: React.FC<{
  startDate: string;
  endDate: string;
  serviceType: string;
  bookings?: Booking[];
  settings: ResortSettings;
}> = ({ startDate, endDate, serviceType, bookings = [], settings }) => {
  const activeBookings = (bookings || []).filter(b => b.stayStatus !== 'cancelled');

  const daysList = React.useMemo(() => {
    if (!startDate) return [];
    const list: string[] = [];
    const isSingleDayTraining = serviceType === 'training' && (!endDate || endDate <= startDate);
    const targetEnd = isSingleDayTraining ? addDays(startDate, 13) : (endDate || startDate);
    
    let curr = startDate;
    let safety = 0;
    while (curr <= targetEnd && safety < 45) {
      list.push(curr);
      curr = addDays(curr, 1);
      safety++;
    }
    return list;
  }, [startDate, endDate, serviceType]);

  if (daysList.length === 0) return null;

  const dayStats = daysList.map(dStr => {
    const dayBookings = getBookingsForDate(activeBookings, dStr);
    const count = dayBookings.length;
    const max = settings.maxCapacity || 25;
    const free = Math.max(0, max - count);
    const isFull = count >= max;
    const percent = Math.min(100, Math.round((count / max) * 100));
    return {
      dateStr: dStr,
      dayName: getDayNameHebrew(dStr),
      dayBookings,
      count,
      max,
      free,
      isFull,
      percent
    };
  });

  const minFree = Math.min(...dayStats.map(s => s.free));
  const hasFullDays = dayStats.some(s => s.isFull);

  return (
    <div className="bg-slate-50/90 border border-slate-200 rounded-2xl p-3 sm:p-3.5 space-y-2.5 my-2.5 shadow-2xs">
      {/* Header and overall availability banner */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200/80">
        <div className="flex items-center gap-2 font-black text-xs text-slate-900">
          <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>יומן תפוסה ומקומות פנויים לתאריכים המבוקשים ({daysList.length} ימים):</span>
        </div>

        <div>
          {hasFullDays ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-black bg-red-100 text-red-800 border border-red-300 px-2.5 py-0.5 rounded-lg shadow-2xs animate-pulse">
              <span>⚠️ שים לב: ישנם ימים בתפוסה מלאה!</span>
            </span>
          ) : minFree <= 2 ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-black bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-0.5 rounded-lg shadow-2xs">
              <span>🟡 תפוסה גבוהה (נותרו {minFree} פנויים בלבד)</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300 px-2.5 py-0.5 rounded-lg shadow-2xs">
              <span>✅ יש מקום פנוי בכל הימים (לפחות {minFree} פנויים)</span>
            </span>
          )}
        </div>
      </div>

      {/* Days Strip / Grid with Pulsing and Blinking Borders */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
        {dayStats.map((st) => (
          <div
            key={st.dateStr}
            className={`rounded-xl p-2.5 text-xs flex flex-col justify-between transition-all ${
              st.isFull
                ? 'pulse-border-red bg-red-50/90 text-red-950 shadow-sm'
                : 'pulse-border-green bg-emerald-50/40 text-slate-800 shadow-xs'
            }`}
          >
            {/* Day Title */}
            <div className="flex items-center justify-between font-bold pb-1 border-b border-slate-100">
              <span className="text-[11px] text-slate-800">יום {st.dayName}</span>
              <span className="text-[10px] text-slate-500 font-mono">{formatDateIL(st.dateStr).slice(0, 5)}</span>
            </div>

            {/* Occupancy and Free spots */}
            <div className="my-1.5 space-y-1">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span>תפוסה: {st.count}/{st.max}</span>
                <span className={st.isFull ? 'text-red-700 font-black' : st.free <= 2 ? 'text-amber-700 font-black' : 'text-emerald-700 font-black'}>
                  {st.isFull ? '0 פנוי 🔴' : `${st.free} פנוי 🟢`}
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    st.isFull ? 'bg-red-500' : st.count > st.max * 0.7 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${st.percent}%` }}
                />
              </div>
            </div>

            {/* Dogs booked on this day */}
            <div className="pt-1 border-t border-slate-100 text-[10px]">
              {st.dayBookings.length === 0 ? (
                <span className="text-slate-400 font-medium">פנוי לחלוטין ✨</span>
              ) : (
                <div className="flex flex-wrap gap-1 max-h-[50px] overflow-y-auto no-scrollbar">
                  {st.dayBookings.map(b => (
                    <span
                      key={b.id}
                      className="inline-flex items-center gap-0.5 bg-slate-100 text-slate-700 font-bold px-1.5 py-0.2 rounded text-[9px] truncate max-w-full"
                      title={`${b.dogName} (${getServiceTypeHebrew(b.serviceType)}) - ${b.ownerName}`}
                    >
                      <span>🐾</span>
                      <span className="truncate max-w-[55px]">{b.dogName}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const IntakeRequestsModal: React.FC<IntakeRequestsModalProps> = ({
  requests,
  settings,
  bookings = [],
  initialFilter,
  onClose,
  onUpdateStatus,
  onApproveAndBook,
  onDeleteRequest,
  onSaveRequest
}) => {
  const [filter, setFilter] = useState<'all' | 'pending' | 'new' | 'in_progress' | 'payment_requested' | 'approved' | 'rejected' | 'archived_48h'>(initialFilter || 'new');

  useEffect(() => {
    if (initialFilter) {
      setFilter(initialFilter);
    }
  }, [initialFilter]);
  const [searchQuery, setSearchQuery] = useState('');
  const [notesInputs, setNotesInputs] = useState<Record<string, string>>({});
  const [savedNoteSuccess, setSavedNoteSuccess] = useState<Record<string, boolean>>({});
  const [followUpTimes, setFollowUpTimes] = useState<Record<string, string>>({});
  const [followUpSentAlert, setFollowUpSentAlert] = useState<Record<string, boolean>>({});
  const [activeVoiceReqId, setActiveVoiceReqId] = useState<string | null>(null);
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [copiedPaymentMsg, setCopiedPaymentMsg] = useState(false);
  const [copiedPaymentLink, setCopiedPaymentLink] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isSendIntakeModalOpen, setIsSendIntakeModalOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<IntakeRequest | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [paymentPromptRequest, setPaymentPromptRequest] = useState<IntakeRequest | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [customPaymentLink, setCustomPaymentLink] = useState<string>('');
  const [isSendingPayment, setIsSendingPayment] = useState<boolean>(false);
  const [paymentSendError, setPaymentSendError] = useState<string | null>(null);
  const [quickSendingId, setQuickSendingId] = useState<string | null>(null);
  const [rejectPromptRequest, setRejectPromptRequest] = useState<IntakeRequest | null>(null);
  const [rejectMessageText, setRejectMessageText] = useState<string>('');
  const [isProcessingReject, setIsProcessingReject] = useState<boolean>(false);
  const [customPrices, setCustomPrices] = useState<Record<string, number>>({});

  const handleUpdatePrice = async (req: IntakeRequest, newPrice: number) => {
    setCustomPrices(prev => ({ ...prev, [req.id]: newPrice }));
    if (onSaveRequest && newPrice >= 0 && newPrice !== req.depositRequested) {
      try {
        await onSaveRequest({
          ...req,
          depositRequested: newPrice,
          calculatedPrice: newPrice
        });
      } catch (err) {
        console.error('Error saving edited price:', err);
      }
    }
  };

  const handleSaveEdit = async () => {
    if (!editingRequest) return;
    setEditError(null);

    if (!editingRequest.ownerName.trim()) {
      setEditError('נא למלא שם בעלים מלא');
      return;
    }
    if (!editingRequest.ownerPhone.trim()) {
      setEditError('נא למלא מספר טלפון נייד');
      return;
    }
    if (!editingRequest.dogName.trim()) {
      setEditError('נא למלא את שם הכלב/ה');
      return;
    }
    if (!editingRequest.startDate || !editingRequest.endDate) {
      setEditError('נא לבחור תאריכי שהות');
      return;
    }
    if (editingRequest.endDate < editingRequest.startDate) {
      setEditError('תאריך היציאה אינו יכול להיות מוקדם מתאריך הכניסה');
      return;
    }

    setIsSavingEdit(true);
    try {
      if (onSaveRequest) {
        await onSaveRequest(editingRequest);
      }
      setEditingRequest(null);
    } catch (err: any) {
      setEditError('אירעה שגיאה בשמירת השינויים, אנא נסה שוב');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleCopyIntakeLink = () => {
    const url = `${window.location.origin}/?intake=true`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const hasActiveBooking = (r: IntakeRequest) => hasActiveBookingForIntake(r, bookings);
  const getEffectiveStatus = (r: IntakeRequest) => getEffectiveIntakeStatus(r, bookings);
  const getRequestAgeHours = (r: IntakeRequest) => getIntakeRequestAgeHours(r);
  const isUnansweredRequest = (r: IntakeRequest) => isUnansweredIntakeRequest(r, bookings);
  const isReqNew = (r: IntakeRequest) => isIntakeRequestNew(r, bookings);
  const isReqInTreatment = (r: IntakeRequest) => isIntakeRequestInTreatment(r, bookings);

  const newCount = requests.filter(isReqNew).length;
  const inTreatmentCount = requests.filter(isReqInTreatment).length;
  const pendingCount = requests.filter(r => getEffectiveStatus(r) === 'pending' && !isUnansweredRequest(r)).length;
  const paymentRequestedCount = requests.filter(r => getEffectiveStatus(r) === 'payment_requested' && !isUnansweredRequest(r)).length;
  const approvedCount = requests.filter(r => getEffectiveStatus(r) === 'approved').length;
  const unansweredCount = requests.filter(isUnansweredRequest).length;

  const filteredRequests = requests.filter(r => {
    if (searchQuery.trim()) {
      const q = normalizeHebrew(searchQuery);
      const qRaw = searchQuery.toLowerCase().trim();
      const name = normalizeHebrew(r.ownerName);
      const dog = normalizeHebrew(r.dogName);
      const phone = (r.ownerPhone || '').replace(/\D/g, '');
      const breed = normalizeHebrew(r.dogBreed || '');
      const notes = normalizeHebrew(r.notes || '');
      const intNotes = normalizeHebrew(r.internalNotes || '');

      const matchName = name.includes(q) || (r.ownerName || '').toLowerCase().includes(qRaw);
      const matchDog = dog.includes(q) || (r.dogName || '').toLowerCase().includes(qRaw);
      const matchPhone = phone.includes(q.replace(/\D/g, '')) || (r.ownerPhone || '').includes(qRaw);
      const matchBreed = breed.includes(q) || (r.dogBreed || '').toLowerCase().includes(qRaw);
      const matchNotes = notes.includes(q) || intNotes.includes(q);

      // Flexible matching for common Hebrew vowel spelling differences (תם <-> תום, מימי <-> מיני)
      const qCore = q.replace(/[יו]/g, '');
      const dogCore = dog.replace(/[יו]/g, '');
      const nameCore = name.replace(/[יו]/g, '');
      const matchCore = (qCore.length >= 2) && (dogCore.includes(qCore) || nameCore.includes(qCore));

      return matchName || matchDog || matchPhone || matchBreed || matchNotes || matchCore;
    }

    const effectiveStatus = getEffectiveStatus(r);
    if (filter === 'new' && !isReqNew(r)) return false;
    if (filter === 'in_progress' && !isReqInTreatment(r)) return false;
    if (filter === 'pending' && (effectiveStatus !== 'pending' || isUnansweredRequest(r))) return false;
    if (filter === 'payment_requested' && (effectiveStatus !== 'payment_requested' || isUnansweredRequest(r))) return false;
    if (filter === 'approved' && effectiveStatus !== 'approved') return false;
    if (filter === 'rejected' && effectiveStatus !== 'rejected') return false;
    if (filter === 'archived_48h' && !isUnansweredRequest(r)) return false;
    return true;
  });

  const handleOpenPaymentPrompt = (request: IntakeRequest) => {
    setPaymentPromptRequest(request);
    const daysCount = Math.max(1, calculateDaysCount(request.startDate, request.endDate));
    let calculatedDefault = 0;
    if (request.serviceType === 'training') {
      calculatedDefault = Number(settings?.defaultDailyRateTraining) || 6500;
    } else if (request.serviceType === 'daycare') {
      calculatedDefault = daysCount * (Number(settings?.defaultDailyRateDaycare) || 90);
    } else {
      calculatedDefault = calculateBoardingRate(
        daysCount, 
        Number(settings?.defaultDailyRateBoarding) || 180,
        {
          isFriendlyWithDogs: request.isFriendlyWithDogs,
          dogGender: request.dogGender,
          isNeutered: request.isNeutered,
          isolationRate: Number(settings?.defaultDailyRateIsolation) || 230
        }
      ).totalPrice;
    }
    const effectiveAmount = customPrices[request.id] ?? (request.depositRequested && request.depositRequested > 0 ? request.depositRequested : calculatedDefault);
    setPaymentAmount(String(effectiveAmount));
    setCustomPaymentLink(settings.growPaymentLink || 'https://pay.grow.link/MjcyNjk~3d59a40e0ae26ce0d41b50b4eebdff04-MzczNjYzMg');
    setPaymentSendError(null);
  };

  const handleQuickSendPayment = async (req: IntakeRequest) => {
    setQuickSendingId(req.id);
    try {
      const daysCount = Math.max(1, calculateDaysCount(req.startDate, req.endDate));
      let calculatedDefault = 0;
      if (req.serviceType === 'training') {
        calculatedDefault = Number(settings?.defaultDailyRateTraining) || 6500;
      } else if (req.serviceType === 'daycare') {
        calculatedDefault = daysCount * (Number(settings?.defaultDailyRateDaycare) || 90);
      } else {
        calculatedDefault = calculateBoardingRate(
          daysCount, 
          Number(settings?.defaultDailyRateBoarding) || 180,
          {
            isFriendlyWithDogs: req.isFriendlyWithDogs,
            dogGender: req.dogGender,
            isNeutered: req.isNeutered,
            isolationRate: Number(settings?.defaultDailyRateIsolation) || 230
          }
        ).totalPrice;
      }
      const numAmount = customPrices[req.id] ?? (req.depositRequested && req.depositRequested > 0 ? req.depositRequested : calculatedDefault);
      
      let linkToUse = (settings.growPaymentLink || 'https://pay.grow.link/MjcyNjk~3d59a40e0ae26ce0d41b50b4eebdff04-MzczNjYzMg').trim();
      if (linkToUse.startsWith('//')) linkToUse = 'https:' + linkToUse;
      else if (!linkToUse.startsWith('http://') && !linkToUse.startsWith('https://')) linkToUse = 'https://' + linkToUse;

      const updated: IntakeRequest = {
        ...req,
        depositRequested: numAmount,
        status: 'payment_requested'
      };

      const cleanPhone = cleanPhoneNumber(req.ownerPhone);
      const msg = formatClientPaymentLinkMessage(updated, settings, numAmount, linkToUse);

      // Send directly via Green-API
      const greenRes = await sendGreenApiDirectMessage(cleanPhone, msg, settings.greenApiIdInstance, settings.greenApiToken);
      if (!greenRes || !greenRes.success) {
        alert(`השליחה האוטומטית המהירה נכשלה (${greenRes?.error || 'שגיאת חיבור'}). נפתח כעת חלון השליחה הידני.`);
        handleOpenPaymentPrompt(req);
        return;
      }

      // Save status
      if (onSaveRequest) {
        await onSaveRequest(updated);
      } else {
        await onUpdateStatus(req.id, 'payment_requested');
      }

      setFollowUpSentAlert(prev => ({ ...prev, [req.id]: true }));
      setTimeout(() => setFollowUpSentAlert(prev => ({ ...prev, [req.id]: false })), 4000);
    } catch (err: any) {
      console.warn('Quick send error:', err);
      alert(`שגיאה בשליחה מהירה: ${err?.message || err}`);
    } finally {
      setQuickSendingId(null);
    }
  };

  const sortedRequests = [...filteredRequests].sort((a, b) => {
    // Unhandled requests (pending) ranked AT THE TOP!
    const aUnhandled = a.status === 'pending';
    const bUnhandled = b.status === 'pending';
    if (aUnhandled && !bUnhandled) return -1;
    if (!aUnhandled && bUnhandled) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const handleAddQuickNote = async (req: IntakeRequest, tag: string) => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    const stamp = `[${day}/${month} ${hours}:${mins}] ${tag}`;
    const existing = notesInputs[req.id] !== undefined ? notesInputs[req.id] : (req.internalNotes || '');
    const updatedNotes = existing ? `${existing}\n${stamp}` : stamp;

    setNotesInputs(prev => ({ ...prev, [req.id]: updatedNotes }));
    
    try {
      if (onSaveRequest) {
        await onSaveRequest({ ...req, internalNotes: updatedNotes });
      } else {
        await onUpdateStatus(req.id, req.status, updatedNotes);
      }
      setSavedNoteSuccess(prev => ({ ...prev, [req.id]: true }));
      setTimeout(() => setSavedNoteSuccess(prev => ({ ...prev, [req.id]: false })), 2500);
    } catch (e) {
      console.warn('Error saving quick note:', e);
    }
  };

  const handleSendMarketingReminder = (req: IntakeRequest) => {
    const cleanPhone = cleanPhoneNumber(req.ownerPhone);
    const intlPhone = cleanPhone.startsWith('0')
      ? '972' + cleanPhone.slice(1)
      : (cleanPhone.startsWith('5') && cleanPhone.length === 9 ? '972' + cleanPhone : cleanPhone);

    const intakeUrl = typeof window !== 'undefined' && window.location.origin ? `${window.location.origin}/?request=true` : undefined;
    const msg = generateUnansweredFollowUpMarketingText(req.ownerName, req.dogName, req.serviceType, intakeUrl);
    
    // תזמון פולואפ אוטומטי למחרת באותה שעה - עם הגנה הרמטית מפני ערבי שבת/חג ושבתות
    const rawTarget = new Date();
    rawTarget.setDate(rawTarget.getDate() + 1);
    const safeTarget = getNextAllowedCommunicationDate(rawTarget);
    const timeStr = `${String(safeTarget.getHours()).padStart(2, '0')}:${String(safeTarget.getMinutes()).padStart(2, '0')}`;
    const dateStr = `${String(safeTarget.getDate()).padStart(2, '0')}/${String(safeTarget.getMonth() + 1).padStart(2, '0')}`;
    const dayName = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'][safeTarget.getDay()];
    const isShifted = safeTarget.getDate() !== rawTarget.getDate() || safeTarget.getHours() !== rawTarget.getHours();
    const followUpVal = isShifted
      ? `יום ${dayName} (${dateStr}) בשעה ${timeStr} (הוסט עקב שבת/חג 🕯️)`
      : `מחר (יום ${dayName} ${dateStr}) בשעה ${timeStr}`;
    setFollowUpTimes(prev => ({ ...prev, [req.id]: followUpVal }));

    handleAddQuickNote(req, `📲 נשלחה תזכורת שיווקית (לא ענה בטלפון - תזמון חזרה: ${followUpVal})`);
    
    const waUrl = `https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
  };

  const handleSaveFreeTextNote = async (req: IntakeRequest) => {
    const text = notesInputs[req.id] !== undefined ? notesInputs[req.id] : (req.internalNotes || '');
    try {
      if (onSaveRequest) {
        await onSaveRequest({ ...req, internalNotes: text });
      } else {
        await onUpdateStatus(req.id, req.status, text);
      }
      setSavedNoteSuccess(prev => ({ ...prev, [req.id]: true }));
      setTimeout(() => setSavedNoteSuccess(prev => ({ ...prev, [req.id]: false })), 2500);
    } catch (e) {
      console.warn('Error saving free text note:', e);
    }
  };

  const toggleVoiceRecording = (req: IntakeRequest) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('זיהוי קולי אינו נתמך בדפדפן זה. מומלץ להשתמש ב-Google Chrome או Microsoft Edge.');
      return;
    }

    if (activeVoiceReqId === req.id && isVoiceListening) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
      setIsVoiceListening(false);
      setActiveVoiceReqId(null);
      return;
    }

    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }

      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = false;
      rec.lang = 'he-IL';

      rec.onstart = () => {
        setIsVoiceListening(true);
        setActiveVoiceReqId(req.id);
      };

      rec.onresult = (e: any) => {
        let speechChunk = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) {
            speechChunk += e.results[i][0].transcript + ' ';
          }
        }
        if (speechChunk.trim()) {
          const currentText = notesInputs[req.id] !== undefined ? notesInputs[req.id] : (req.internalNotes || '');
          const updated = currentText ? `${currentText} ${speechChunk.trim()}` : speechChunk.trim();
          setNotesInputs(prev => ({ ...prev, [req.id]: updated }));
          if (onSaveRequest) {
            onSaveRequest({ ...req, internalNotes: updated });
          } else {
            onUpdateStatus(req.id, req.status, updated);
          }
          setSavedNoteSuccess(prev => ({ ...prev, [req.id]: true }));
          setTimeout(() => setSavedNoteSuccess(prev => ({ ...prev, [req.id]: false })), 2500);
        }
      };

      rec.onerror = (err: any) => {
        console.warn('Speech recognition error:', err);
        setIsVoiceListening(false);
        setActiveVoiceReqId(null);
      };

      rec.onend = () => {
        setIsVoiceListening(false);
        setActiveVoiceReqId(null);
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (err) {
      console.warn('Cannot start speech recognition:', err);
      setIsVoiceListening(false);
      setActiveVoiceReqId(null);
    }
  };

  const handleSendResortFollowUpAlert = async (req: IntakeRequest) => {
    const followUpTarget = (followUpTimes[req.id] || 'בהקדם').trim();
    const currentNotes = (notesInputs[req.id] !== undefined ? notesInputs[req.id] : (req.internalNotes || '')).trim();
    const cleanPhone = cleanPhoneNumber(req.ownerPhone);
    const intlPhone = cleanPhone.startsWith('0') ? '972' + cleanPhone.substring(1) : cleanPhone;

    const reason = currentNotes || 'בירור פרטים ותיאום הגעה מול הלקוח';

    // Format requested by user: "שים לב, צריך לחזור ל(שם הבעלים) בגלל והסיבה"
    const alertMsg = `🔔 *התרעת מעקב - הריזורט לכלב* 🐾\n\n` +
      `⚠️ *שים לב: צריך לחזור ל-${req.ownerName}!* בגלל: ${reason}\n\n` +
      `🐕 *עבור הכלב:* ${req.dogName} (${req.dogBreed || 'מעורב'})\n` +
      `📞 *טלפון הלקוח:* ${req.ownerPhone}\n` +
      `📅 *מועד מתוכנן לחזרה:* ${followUpTarget}\n\n` +
      `💬 *לפתיחת שיחה מיידית עם הלקוח בוואטסאפ:*\n` +
      `https://wa.me/${intlPhone}`;

    const stamp = `[תזכורת מעקב לחזרה: ${followUpTarget}]`;
    const updatedNotes = currentNotes ? `${currentNotes}\n${stamp}` : stamp;
    setNotesInputs(prev => ({ ...prev, [req.id]: updatedNotes }));

    try {
      if (onSaveRequest) {
        await onSaveRequest({ ...req, internalNotes: updatedNotes });
      } else {
        await onUpdateStatus(req.id, req.status, updatedNotes);
      }
    } catch (e) {}

    // Resort destination phone
    const resortPhone = cleanPhoneNumber(settings?.managerPhone || '0548765888');
    const intlResortPhone = resortPhone.startsWith('0') ? '972' + resortPhone.substring(1) : resortPhone;

    // Send via Green-API in background if configured
    if (settings?.greenApiIdInstance && settings?.greenApiToken) {
      try {
        await sendGreenApiDirectMessage(intlResortPhone, alertMsg, settings.greenApiIdInstance, settings.greenApiToken);
      } catch (err) {
        console.warn('Green API alert error:', err);
      }
    }

    // Open WhatsApp directly
    const waUrl = `https://wa.me/${intlResortPhone}?text=${encodeURIComponent(alertMsg)}`;
    window.open(waUrl, '_blank');

    setFollowUpSentAlert(prev => ({ ...prev, [req.id]: true }));
    setTimeout(() => setFollowUpSentAlert(prev => ({ ...prev, [req.id]: false })), 4000);
  };

  const handleConfirmSendPayment = async (mode: 'green_api' | 'manual_whatsapp' = 'green_api') => {
    if (!paymentPromptRequest) return;
    setIsSendingPayment(true);
    setPaymentSendError(null);
    
    const numAmount = Number(paymentAmount) || 0;
    let linkToUse = (customPaymentLink || '').trim();
    if (!linkToUse) {
      linkToUse = settings.growPaymentLink || 'https://pay.grow.link/MjcyNjk~3d59a40e0ae26ce0d41b50b4eebdff04-MzczNjYzMg';
    }
    if (linkToUse.startsWith('//')) {
      linkToUse = 'https:' + linkToUse;
    } else if (!linkToUse.startsWith('http://') && !linkToUse.startsWith('https://')) {
      linkToUse = 'https://' + linkToUse;
    }

    const updated: IntakeRequest = {
      ...paymentPromptRequest,
      depositRequested: numAmount,
      status: 'payment_requested'
    };

    const cleanPhone = cleanPhoneNumber(paymentPromptRequest.ownerPhone);
    const intlPhone = cleanPhone.startsWith('0') 
      ? '972' + cleanPhone.substring(1) 
      : (cleanPhone.startsWith('5') && cleanPhone.length === 9 ? '972' + cleanPhone : cleanPhone);
    const msg = formatClientPaymentLinkMessage(updated, settings, numAmount, linkToUse);

    // 1. Direct automated send via Green-API (ideal for mobile phones!)
    if (mode === 'green_api') {
      try {
        const greenRes = await sendGreenApiDirectMessage(cleanPhone, msg, settings.greenApiIdInstance, settings.greenApiToken);
        if (!greenRes || !greenRes.success) {
          setPaymentSendError(greenRes?.error || 'השליחה האוטומטית נכשלה. באפשרותך ללחוץ על "פתח בוואטסאפ ידנית" או להעתיק את ההודעה.');
          setIsSendingPayment(false);
          return;
        }
      } catch (gErr: any) {
        console.warn('Green-API payment send notice:', gErr);
        setPaymentSendError(`שגיאת תקשורת: ${gErr?.message || String(gErr)}`);
        setIsSendingPayment(false);
        return;
      }
    }

    // 2. Save updated status
    try {
      if (onSaveRequest) {
        await onSaveRequest(updated);
      } else {
        await onUpdateStatus(paymentPromptRequest.id, 'payment_requested');
      }
      setFollowUpSentAlert(prev => ({ ...prev, [paymentPromptRequest.id]: true }));
      setTimeout(() => setFollowUpSentAlert(prev => ({ ...prev, [paymentPromptRequest.id]: false })), 4000);
    } catch (err) {
      console.warn('Error saving payment status:', err);
    } finally {
      setIsSendingPayment(false);
      setPaymentPromptRequest(null);
    }
  };

  const handleOpenRejectPrompt = (request: IntakeRequest) => {
    setRejectPromptRequest(request);
    setRejectMessageText(formatClientRejectionMessage(request, settings));
  };

  const handleConfirmRejectWithWhatsApp = async () => {
    if (!rejectPromptRequest) return;
    setIsProcessingReject(true);
    try {
      await onUpdateStatus(rejectPromptRequest.id, 'rejected');
      const cleanPhone = cleanPhoneNumber(rejectPromptRequest.ownerPhone);
      const intlPhone = cleanPhone.startsWith('0') ? '972' + cleanPhone.substring(1) : cleanPhone;
      const whatsappUrl = `https://wa.me/${intlPhone}?text=${encodeURIComponent(rejectMessageText)}`;
      window.open(whatsappUrl, '_blank');
      setRejectPromptRequest(null);
    } catch (e) {
      console.warn('Reject error:', e);
    } finally {
      setIsProcessingReject(false);
    }
  };

  const handleConfirmRejectWithoutWhatsApp = async () => {
    if (!rejectPromptRequest) return;
    setIsProcessingReject(true);
    try {
      await onUpdateStatus(rejectPromptRequest.id, 'rejected');
      setRejectPromptRequest(null);
    } catch (e) {
      console.warn('Reject error:', e);
    } finally {
      setIsProcessingReject(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200" dir="rtl">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black text-lg shadow-2xs">
              📥
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-[#0f4c3a]">
                  בקשות קליטה מלקוחות
                </h2>
                {pendingCount > 0 && (
                  <span className="bg-gradient-to-r from-red-600 to-rose-600 text-white text-xs px-2.5 py-0.5 rounded-full font-black shadow-xs ring-1 ring-white/50 animate-pulse">
                    {pendingCount} חדשות
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium">
                נהל את פניות הלקוחות: חייג לשיחת היכרות, שלח קישור לתשלום ב-Grow, וקלוט ליומן לאחר תשלום
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsSendIntakeModalOpen(true)}
              className="bg-[#25D366] hover:bg-[#1EBE5D] active:scale-95 text-white px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
              title="שליחת שאלון בקשה לקליטה ללקוח שהתקשר בטלפון או ביקש שוב (פניות וואטסאפ מקבלות שאלון אוטומטית)"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>שלח שאלון ללקוח שהתקשר</span>
            </button>

            <button
              type="button"
              onClick={handleCopyIntakeLink}
              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
              title="העתקת הקישור לשאלון בקשת הקליטה לשליחה מהירה ללקוחות בוואטסאפ"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'הקישור הועתק!' : 'העתק קישור לשאלון'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center cursor-pointer transition-colors border border-slate-200 shadow-2xs"
              title="סגור"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filters & Search Toolbar */}
        <div className="p-3 sm:p-4 border-b border-slate-100 bg-white flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
            {[
              { id: 'new', label: '🔴 שאלונים לבדיקה', count: newCount, isHot: newCount > 0 },
              { id: 'in_progress', label: '🟡 שאלונים בתהליך', count: inTreatmentCount, isHot: false },
              { id: 'payment_requested', label: '💳 נשלח קישור לתשלום', count: paymentRequestedCount, isHot: false },
              { id: 'approved', label: '🟢 נקלטו ביומן', count: approvedCount, isHot: false },
              { id: 'archived_48h', label: '⌛ לא ענו / מעל 24 שעות', count: unansweredCount, isHot: false },
              { id: 'rejected', label: 'נדחו', count: requests.filter(r => r.status === 'rejected').length, isHot: false },
              { id: 'all', label: 'הכול', count: requests.length, isHot: false },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  filter === tab.id
                    ? 'bg-[#065f46] text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${
                  tab.id === 'new' && tab.count > 0
                    ? 'bg-rose-600 text-white shadow-2xs animate-pulse'
                    : tab.id === 'in_progress' && tab.count > 0
                    ? 'bg-amber-500 text-amber-950 shadow-2xs font-bold'
                    : filter === tab.id 
                    ? 'bg-emerald-800 text-white' 
                    : 'bg-slate-200 text-slate-700'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search Bar & Bulk Actions */}
          <div className="flex items-center gap-2 flex-1 sm:max-w-xs w-full">
            <div className="relative flex-1 flex items-center">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="חפש בקשה (שם, כלב, טלפון)..."
                className="w-full bg-slate-50 focus:bg-white text-slate-900 text-xs sm:text-sm pl-8 pr-9 py-2 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-all shadow-2xs"
              />
              <button
                type="button"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-600 cursor-pointer p-0.5"
                title="חפש"
              >
                <Search className="w-4 h-4" />
              </button>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer p-1"
                  title="נקה חיפוש"
                >
                  ✕
                </button>
              )}
            </div>

            {filter === 'rejected' && filteredRequests.length > 0 && (
              <button
                type="button"
                onClick={async () => {
                  if (window.confirm(`האם למחוק לצמיתות את כל ${filteredRequests.length} בקשות הקליטה שנדחו מהמערכת?\nפעולה זו תמחק אותן לחלוטין ולא ניתנת לשחזור.`)) {
                    for (const req of filteredRequests) {
                      await onDeleteRequest(req.id);
                    }
                  }
                }}
                className="bg-red-50 hover:bg-red-100 active:scale-98 text-red-700 border border-red-200 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs whitespace-nowrap"
                title="מחיקה סופית של כל הבקשות שנדחו מהמערכת"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-600" />
                <span>מחק הכל ({filteredRequests.length})</span>
              </button>
            )}

            <div className="relative min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="חיפוש לפי שם, כלב או טלפון..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-1.5 text-xs font-semibold text-slate-900 focus:bg-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Requests List Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-50/50">
          {filteredRequests.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <div className="text-4xl">📭</div>
              <h3 className="text-base font-bold text-slate-700">
                אין בקשות קליטה {filter === 'pending' ? 'ממתינות לבדיקה' : 'להצגה כעת'}
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                לקוחות שימלאו את שאלון בקשת הקליטה המקוון יופיעו כאן מיד עם כל הפרטים לצורך תיאום טלפוני ושליחת קישור לתשלום.
              </p>
            </div>
          ) : (
            sortedRequests.map((req) => {
              const serviceLabel = getServiceTypeHebrew(req.serviceType);
              const cleanPhone = cleanPhoneNumber(req.ownerPhone);
              const intlPhone = cleanPhone.startsWith('0') ? '972' + cleanPhone.substring(1) : cleanPhone;
              const createdD = new Date(req.createdAt);
              const cDay = String(createdD.getDate()).padStart(2, '0');
              const cMonth = String(createdD.getMonth() + 1).padStart(2, '0');
              const cHours = String(createdD.getHours()).padStart(2, '0');
              const cMins = String(createdD.getMinutes()).padStart(2, '0');
              const intakeEnteredText = `הזמנה נכנסה ב: ${cDay}.${cMonth} בשעה ${cHours}:${cMins}`;

              const daysCount = Math.max(1, calculateDaysCount(req.startDate, req.endDate));
              const boardingRateInfo = calculateBoardingRate(
                daysCount, 
                Number(settings?.defaultDailyRateBoarding) || 180,
                {
                  isFriendlyWithDogs: req.isFriendlyWithDogs,
                  dogGender: req.dogGender,
                  isNeutered: req.isNeutered,
                  isolationRate: Number(settings?.defaultDailyRateIsolation) || 230
                }
              );
              let defaultPrice = boardingRateInfo.totalPrice;
              let priceExplanation = boardingRateInfo.explanation;

              if (req.serviceType === 'training') {
                defaultPrice = Number(settings?.defaultDailyRateTraining) || 6500;
                priceExplanation = 'מחיר תהליך אילוף';
              } else if (req.serviceType === 'daycare') {
                const daycareRate = Number(settings?.defaultDailyRateDaycare) || 90;
                defaultPrice = daysCount * daycareRate;
                priceExplanation = `${daysCount} ימים × ₪${daycareRate}`;
              }

              const currentReqPrice = customPrices[req.id] !== undefined 
                ? customPrices[req.id] 
                : (req.depositRequested && req.depositRequested > 0 ? req.depositRequested : defaultPrice);

              const isNew = req.status === 'pending' && (!req.internalNotes || !req.internalNotes.trim());
              const isInTreatment = req.status === 'payment_requested' || (req.status === 'pending' && Boolean(req.internalNotes && req.internalNotes.trim()));

              return (
                <div
                  key={req.id}
                  className={`rounded-3xl border-2 p-4 sm:p-5 transition-all space-y-4 ${
                    isNew 
                      ? 'border-rose-400 bg-rose-50/20 ring-2 ring-rose-400/20 shadow-md' 
                      : isInTreatment && req.status !== 'payment_requested'
                      ? 'border-amber-400 bg-amber-50/25 ring-2 ring-amber-400/20 shadow-sm'
                      : req.status === 'approved'
                      ? 'border-emerald-300 bg-emerald-50/20 shadow-xs'
                      : req.status === 'payment_requested'
                      ? 'border-blue-300 bg-blue-50/20 shadow-xs'
                      : 'border-slate-200 bg-white shadow-xs opacity-95'
                  }`}
                >
                  {/* Card Top: Dog & Owner Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div className="flex items-start gap-3.5">
                      <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-center font-black text-2xl shadow-xs shrink-0 mt-1">
                        🐕
                      </div>
                      
                      {/* 4 Lines - Arranged one below the other, BIG and clear */}
                      <div className="flex flex-col gap-1.5 text-right">
                        {/* שורה ראשונה: שם הכלב / שמות כל הכלבים בטופס */}
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-1.5 flex-wrap">
                            <span>{req.dogName}</span>
                            {req.additionalDogs && req.additionalDogs.length > 0 && (
                              <>
                                <span className="text-emerald-700 font-black">+</span>
                                <span className="text-emerald-950 font-black">
                                  {req.additionalDogs.map(d => d.dogName).join(' + ')}
                                </span>
                              </>
                            )}
                          </h3>
                          <span className="text-sm font-bold text-slate-500">
                            ({req.dogBreed || 'מעורב'}{req.dogAge ? `, ${req.dogAge}` : ''})
                          </span>
                          {req.additionalDogs && req.additionalDogs.length > 0 && (
                            <span className="bg-purple-100 text-purple-950 border border-purple-300 text-[11px] font-black px-2 py-0.5 rounded-lg shadow-2xs">
                              🐾 {1 + req.additionalDogs.length} כלבים בטופס
                            </span>
                          )}
                          
                          {/* Status Badge */}
                          <span className={`text-xs px-3 py-1 rounded-full font-black border shadow-2xs flex items-center gap-1.5 ${
                            isNew
                              ? 'bg-rose-600 text-white border-rose-700 ring-2 ring-rose-400/40 animate-pulse'
                              : isInTreatment && req.status !== 'payment_requested'
                              ? 'bg-amber-100 text-amber-950 border-amber-400 ring-1 ring-amber-400/40'
                              : req.status === 'payment_requested'
                              ? 'bg-blue-100 text-blue-900 border-blue-300'
                              : req.status === 'approved'
                              ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                              : 'bg-slate-200 text-slate-700 border-slate-300'
                          }`}>
                            {isNew ? (
                              <>
                                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                                <span>🔴 פנייה חדשה</span>
                              </>
                            ) : isInTreatment && req.status !== 'payment_requested' ? (
                              <>
                                <span className="w-2 h-2 rounded-full bg-amber-500" />
                                <span>🟡 בתהליך טיפול</span>
                              </>
                            ) : req.status === 'payment_requested' ? (
                              <span>💳 נשלח קישור לתשלום</span>
                            ) : req.status === 'approved' ? (
                              <span>🟢 נקלט ביומן הראשי</span>
                            ) : (
                              <span>⚪ נדחה / בוטל</span>
                            )}
                          </span>
                        </div>

                        {/* שורה שניה: שם הבעלים ומספר הטלפון שלו */}
                        <div className="text-base sm:text-lg font-black text-slate-800 flex items-center gap-2 flex-wrap">
                          <span>בעלים: <strong className="text-slate-950">{req.ownerName}</strong></span>
                          <span className="text-slate-400">·</span>
                          <span className="font-mono font-black text-slate-900" dir="ltr">{req.ownerPhone}</span>
                          {req.ownerAddress && (
                            <span className="text-xs font-bold text-slate-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xl flex items-center gap-1.5 shadow-2xs">
                              <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>{req.ownerAddress}</span>
                              <a
                                href={getWazeNavigationUrl(req.ownerAddress, req.ownerCoordinates)}
                                target="_blank"
                                rel="noreferrer"
                                className="mr-1 text-[11px] text-sky-700 hover:text-sky-900 font-black underline flex items-center gap-0.5"
                                title="נווט לבית הבעלים ב-Waze במקרה חירום"
                              >
                                <span>🚗 Waze</span>
                              </a>
                            </span>
                          )}

                          {/* Additional Dogs in same intake */}
                          {req.additionalDogs && req.additionalDogs.length > 0 && (
                            <div className="w-full bg-amber-50/90 border border-amber-300 rounded-xl p-2.5 text-xs text-amber-950 font-bold flex flex-col gap-1 mt-0.5">
                              <div className="flex items-center gap-1.5 font-black text-amber-900">
                                <Dog className="w-4 h-4 text-amber-700 shrink-0" />
                                <span>🐾 כלבים נוספים באותה בקשת קליטה ({req.additionalDogs.length}):</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5 pt-0.5">
                                {req.additionalDogs.map((ad, adIdx) => (
                                  <span key={adIdx} className="bg-white border border-amber-200 px-2 py-0.5 rounded-lg shadow-2xs font-semibold">
                                    <strong className="text-slate-900">{ad.dogName}</strong> ({ad.dogBreed || 'מעורב'}{ad.dogAge ? `, ${ad.dogAge}` : ''}) · {ad.sameDatesAsPrimary ? 'אותם תאריכים' : `${formatDateIL(ad.startDate || '')}–${formatDateIL(ad.endDate || '')}`}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* שורה שלישית: לחץ לוואטסאפ איתו + שלח קישור לתשלום */}
                        <div className="pt-0.5 flex items-center gap-2 flex-wrap">
                          <a
                            href={`https://wa.me/${intlPhone}?text=${encodeURIComponent(`שלום ${getFirstName(req.ownerName)}, כאן שמוליק מ${settings.resortName} 🐾 בהמשך לשאלון בקשת הקליטה ששלחתם עבור ${req.dogName}`)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#1EBE5D] active:scale-95 text-white font-black px-4 py-2 rounded-xl text-sm transition-all shadow-xs cursor-pointer hover:shadow-md"
                            title="פתח שיחת וואטסאפ ישירה"
                          >
                            <MessageCircle className="w-4 h-4 fill-white/20 shrink-0" />
                            <span>לחץ לוואטסאפ איתו</span>
                          </a>

                          {/* כפתור שליחה מהירה של קישור לתשלום - שליחה ישירה ב-1 קליק ללא פתיחת חלון */}
                          <button
                            type="button"
                            disabled={quickSendingId === req.id}
                            onClick={() => handleQuickSendPayment(req)}
                            className="inline-flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-95 text-white font-black px-3.5 py-2 rounded-xl text-sm transition-all shadow-xs cursor-pointer hover:shadow-md disabled:opacity-50"
                            title="שליחה מהירה של קישור התשלום המאובטח (Grow) ישירות לוואטסאפ של הלקוח במידה וכל הפרטים ברורים"
                          >
                            <Sparkles className="w-4 h-4 text-emerald-200 shrink-0" />
                            <span>{quickSendingId === req.id ? 'שולח קישור...' : '⚡ שליחה מהירה'}</span>
                          </button>

                          {/* כפתור שליחת קישור לתשלום - ממוקם בראש הכרטיס לגישה מהירה ומיידית */}
                          <button
                            type="button"
                            onClick={() => handleOpenPaymentPrompt(req)}
                            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-black px-4 py-2 rounded-xl text-sm transition-all shadow-xs cursor-pointer hover:shadow-md"
                            title="הגדר סכום שסוכם ושלח או שלח שוב קישור לתשלום ישירות לוואטסאפ של הלקוח"
                          >
                            <CreditCard className="w-4 h-4 text-white shrink-0" />
                            <span>{req.status === 'payment_requested' ? 'שלח שוב קישור לתשלום 💬' : 'שלח קישור לתשלום 💳'}</span>
                          </button>

                          {/* כפתור תזכורת שיווקית (לא ענה בטלפון) עם קישורי פייסבוק ואינסטגרם */}
                          <button
                            type="button"
                            onClick={() => handleSendMarketingReminder(req)}
                            className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-black px-3.5 py-2 rounded-xl text-sm transition-all shadow-xs cursor-pointer hover:shadow-md"
                            title="שלח בוואטסאפ הודעה שיווקית מקיפה (מי אנחנו, פנסיון, אילוף, קישור לפייסבוק ולאינסטגרם) עבור לקוח שלא ענה"
                          >
                            <Sparkles className="w-4 h-4 text-amber-100 shrink-0" />
                            <span>תזכורת שיווקית (לא ענה) ✨</span>
                          </button>
                        </div>

                        {/* שורה רביעית: הזמנה נכנסה ב: DD.MM בשעה HH:MM */}
                        <div className="text-xs sm:text-sm font-bold text-slate-500 flex items-center gap-1.5 pt-0.5">
                          <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                          <span>{intakeEnteredText}</span>
                        </div>
                      </div>
                    </div>

                    {/* Quick Dates Badge with Harmonious, Centered Payment Calculation - ENLARGED & PROMINENT */}
                    <div className="bg-slate-50/90 hover:bg-slate-50 border border-slate-200/90 rounded-2xl p-3 sm:p-3.5 flex flex-col items-center justify-center text-center shadow-xs gap-2 min-w-[270px] sm:min-w-[310px] self-stretch sm:self-center" dir="rtl">
                      {/* Top Row: Dates & Duration pill - BIG, PROMINENT & CLEAR */}
                      <div className="w-full flex items-center justify-between gap-2.5 pb-2 border-b border-slate-200/80">
                        <div className="flex items-center gap-2 text-slate-900">
                          <Calendar className="w-4 h-4 sm:w-5 h-5 text-emerald-600 shrink-0" />
                          <div className="text-right flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm sm:text-base font-black text-slate-800">
                              {serviceLabel}:
                            </span>
                            <span className="text-sm sm:text-base font-black text-slate-950 font-mono tracking-tight" dir="ltr">
                              {req.serviceType === 'training' 
                                ? `החל מ-${formatDateIL(req.startDate)}` 
                                : `${formatDateIL(req.startDate)} – ${formatDateIL(req.endDate)}`}
                            </span>
                          </div>
                        </div>

                        {req.serviceType !== 'training' && (
                          <span className="bg-slate-200/90 text-slate-950 border border-slate-300 text-xs sm:text-sm font-black px-2.5 py-1 rounded-xl shadow-2xs shrink-0 whitespace-nowrap">
                            {daysCount} ימים
                          </span>
                        )}
                      </div>

                      {/* Middle Row: Centered Editable Payment Field */}
                      <div className="w-full flex items-center justify-center gap-2 pt-0.5">
                        <span className="text-xs sm:text-sm font-bold text-slate-700 flex items-center gap-1">
                          <CreditCard className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>לתשלום:</span>
                        </span>

                        <div className="inline-flex items-center bg-white border border-slate-300 hover:border-emerald-500 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 rounded-xl px-3 py-1 shadow-2xs transition-all">
                          <span className="text-sm font-bold text-slate-500 ml-1">₪</span>
                          <input
                            type="number"
                            min={0}
                            step={10}
                            value={currentReqPrice}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setCustomPrices(prev => ({ ...prev, [req.id]: val }));
                            }}
                            onBlur={(e) => {
                              const val = Number(e.target.value);
                              handleUpdatePrice(req, val);
                            }}
                            className="w-20 font-mono font-black text-base sm:text-lg text-slate-900 bg-transparent text-center focus:outline-none"
                            title="לחץ לעריכת הסכום"
                          />
                          <Pencil className="w-3.5 h-3.5 text-slate-400 mr-1 shrink-0 cursor-pointer hover:text-emerald-600 transition-colors" />
                        </div>
                      </div>

                      {/* Bottom Row: Clear Rate Explanation */}
                      <div className="text-xs text-slate-500 font-medium">
                        {priceExplanation}
                      </div>
                    </div>
                  </div>

                  {/* Card Middle: Key Vetting Indicators */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 text-xs">
                    {/* Friendly with dogs */}
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 block font-semibold mb-0.5">
                        מסתדר עם כלבים:
                      </span>
                      <span className={`font-bold ${
                        req.isFriendlyWithDogs === 'yes' ? 'text-emerald-700' :
                        req.isFriendlyWithDogs === 'no' ? 'text-red-700' : 'text-amber-700'
                      }`}>
                        {req.isFriendlyWithDogs === 'yes' ? 'חברותי 🟢' :
                         req.isFriendlyWithDogs === 'no' ? 'חייב בידוד / תוקפני 🔴' : 'תלוי 🟡'}
                      </span>
                    </div>

                    {/* Dog Gender - 1-click interactive toggle */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const nextGender = req.dogGender === 'female' ? 'male' : 'female';
                        onSaveRequest({ ...req, dogGender: nextGender });
                      }}
                      title="לחץ לעריכה מהירה: החלף בין נקבה לזכר (שומר מיידית)"
                      className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer hover:scale-[1.02] active:scale-98 shadow-2xs ${
                        req.dogGender === 'female'
                          ? 'bg-pink-50/90 hover:bg-pink-100 border-pink-300 text-pink-950'
                          : 'bg-blue-50/90 hover:bg-blue-100 border-blue-300 text-blue-950'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] text-slate-500 font-bold block mb-0.5">
                          מין (לחץ לשינוי ✏️):
                        </span>
                        <span className="text-[9px] text-slate-400 font-mono">↺</span>
                      </div>
                      <span className={`font-black text-xs flex items-center gap-1 ${
                        req.dogGender === 'female' ? 'text-pink-700' : 'text-blue-700'
                      }`}>
                        {req.dogGender === 'female' ? '🌸 נקבה ♀️' : '🔷 זכר ♂️'}
                      </span>
                    </button>

                    {/* Neutered / Spayed - 1-click interactive toggle */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSaveRequest({ ...req, isNeutered: !req.isNeutered });
                      }}
                      title="לחץ לעריכה מהירה: סמן מעוקרת/מסורס (שומר מיידית)"
                      className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer hover:scale-[1.02] active:scale-98 shadow-2xs ${
                        req.isNeutered
                          ? 'bg-emerald-50/90 hover:bg-emerald-100 border-emerald-300 text-emerald-950'
                          : 'bg-slate-50 hover:bg-amber-50 border-slate-200 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] text-slate-500 font-bold block mb-0.5">
                          {req.dogGender === 'female' ? 'מעוקרת:' : 'מסורס:'} (לחץ ✏️)
                        </span>
                        <span className="text-[9px] text-slate-400 font-mono">↺</span>
                      </div>
                      <span className="font-black text-xs text-slate-900">
                        {req.isNeutered ? 'כן ✂️' : 'לא'}
                      </span>
                    </button>

                    {/* Vaccinated */}
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 block font-semibold mb-0.5">
                        חיסונים בתוקף:
                      </span>
                      <span className={`font-bold ${req.isVaccinated ? 'text-emerald-700' : 'text-red-600'}`}>
                        {req.isVaccinated ? 'כן 💉' : 'חסר ⚠️'}
                      </span>
                    </div>

                    {/* House Trained */}
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 block font-semibold mb-0.5">
                        מחונך לצרכים:
                      </span>
                      <span className={`font-bold ${req.isHouseTrained !== false ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {req.isHouseTrained !== false ? 'כן 🚽' : 'לא ⚠️'}
                      </span>
                    </div>

                    {/* Treated for Parasites */}
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 block font-semibold mb-0.5">
                        נגד קרציות/פשפשים:
                      </span>
                      <span className={`font-bold ${req.isTreatedParasites !== false ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {req.isTreatedParasites !== false ? 'מטופל 🛡️' : 'לא ⚠️'}
                      </span>
                    </div>

                    {/* Dog Size */}
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 block font-semibold mb-0.5">
                        גודל כלב:
                      </span>
                      <span className="font-bold text-slate-800">
                        {req.dogSize === 'small' ? 'קטן' :
                         req.dogSize === 'medium' ? 'בינוני' :
                         req.dogSize === 'large' ? 'גדול' : 'ענק'}
                      </span>
                    </div>
                  </div>

                  {/* Special Needs, Client Notes & Shmulik Internal Notes */}
                  {(req.specialNeeds || req.notes || req.internalNotes || (req.depositRequested && req.depositRequested > 0)) && (
                    <div className="space-y-2">
                      {(req.specialNeeds || req.notes) && (
                        <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-2.5 text-xs text-amber-950 space-y-1">
                          {req.specialNeeds && (
                            <div>
                              <strong className="font-bold">🩺 צרכים מיוחדים/תרופות:</strong> {req.specialNeeds}
                            </div>
                          )}
                          {req.notes && (
                            <div>
                              <strong className="font-bold">📝 הערות הלקוח:</strong> {req.notes}
                            </div>
                          )}
                        </div>
                      )}

                      {/* 📞 Call Progress, Phone Summary & Free-Text Tracking (Always accessible) */}
                      <div className="bg-white/95 border-2 border-emerald-300/80 rounded-2xl p-3.5 space-y-3 shadow-xs">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 text-xs sm:text-sm font-black text-slate-900">
                            <Phone className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>📞 מעקב שיחות וסיכום טיפול בבקשה (שמוליק):</span>
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Speech-to-Text Microphone Dictation Button */}
                            <button
                              type="button"
                              onClick={() => toggleVoiceRecording(req)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95 ${
                                activeVoiceReqId === req.id && isVoiceListening
                                  ? 'bg-red-600 text-white animate-pulse ring-2 ring-red-400'
                                  : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200'
                              }`}
                              title="לחץ להכתבה קולית בעברית ישירות לתוך ההערה"
                            >
                              {activeVoiceReqId === req.id && isVoiceListening ? (
                                <>
                                  <MicOff className="w-3.5 h-3.5 animate-bounce" />
                                  <span>מקליט... דבר עכשיו 🎙️ (לחץ לסיום)</span>
                                </>
                              ) : (
                                <>
                                  <Mic className="w-3.5 h-3.5 text-indigo-700" />
                                  <span>🎙️ הכתבה קולית</span>
                                </>
                              )}
                            </button>

                            {savedNoteSuccess[req.id] && (
                              <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-lg animate-in fade-in flex items-center gap-1">
                                <Check className="w-3 h-3 text-emerald-600" />
                                ההערה נשמרה! ✨
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Quick Action Stamp Buttons */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {[
                            { tag: '📞 לא ענה בטלפון', label: '📞 לא ענה', color: 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-900' },
                            { tag: '📲 נשלחה תזכורת שיווקית בוואטסאפ (פייסבוק/אינסטגרם)', label: '📲 תזכורת שיווקית', color: 'bg-indigo-50 hover:bg-indigo-100 border-indigo-300 text-indigo-900' },
                            { tag: '🔄 צריך להתקשר אליו שוב', label: '🔄 צריך לחזור אליו', color: 'bg-orange-50 hover:bg-orange-100 border-orange-300 text-orange-900' },
                            { tag: '💬 שלחתי לו הודעה בוואטסאפ', label: '💬 שלחתי הודעה', color: 'bg-emerald-50 hover:bg-emerald-100 border-emerald-300 text-emerald-900' },
                            { tag: '🤝 שוחחנו בטלפון - סוכמו הפרטים', label: '🤝 שוחחנו - סוכם', color: 'bg-blue-50 hover:bg-blue-100 border-blue-300 text-blue-900' },
                            { tag: '❌ בוטל / לא רלוונטי', label: '❌ לא רלוונטי', color: 'bg-rose-50 hover:bg-rose-100 border-rose-300 text-rose-900' },
                            { tag: '🚫 הלקוח לא ענה (הוסר מהרשימה עד שיפנה)', label: '🚫 לא ענה (הסר)', color: 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700' },
                          ].map((btn, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleAddQuickNote(req, btn.tag)}
                              className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition-all active:scale-95 cursor-pointer shadow-2xs ${btn.color}`}
                              title={`הוסף חותמת תאריך ושעה: "${btn.tag}"`}
                            >
                              {btn.label}
                            </button>
                          ))}
                        </div>

                        {/* Free-Text Editable Textarea */}
                        <div className="space-y-1.5">
                          <textarea
                            rows={3}
                            value={notesInputs[req.id] !== undefined ? notesInputs[req.id] : (req.internalNotes || '')}
                            onChange={(e) => {
                              const val = e.target.value;
                              setNotesInputs(prev => ({ ...prev, [req.id]: val }));
                            }}
                            onBlur={() => handleSaveFreeTextNote(req)}
                            placeholder="כתוב כאן מה סוכם בשיחה עם הלקוח, דגשים מיוחדים, תאריכים מבוקשים או הערות מעקב... (נשמר אוטומטית בעת יציאה מהשדה או באמצעות כפתור המיקרופון)"
                            className="w-full bg-slate-50/90 hover:bg-white focus:bg-white text-slate-900 text-xs sm:text-sm p-3 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none resize-y font-medium transition-all"
                          />
                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span>💡 ניתן להקליד, להשתמש במיקרופון 🎙️ או ללחוץ על הכפתורים המהירים</span>
                            <button
                              type="button"
                              onClick={() => handleSaveFreeTextNote(req)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1 rounded-lg text-xs flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95 transition-all"
                            >
                              <Save className="w-3.5 h-3.5" />
                              <span>שמור הערה</span>
                            </button>
                          </div>
                        </div>

                        {/* ⏰ Follow-up scheduler & WhatsApp Alert to Resort */}
                        <div className="bg-amber-50/70 border border-amber-300/80 rounded-2xl p-3 space-y-2">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                              <Bell className="w-4 h-4 text-amber-700 shrink-0" />
                              <span>⏰ מתי צריך לחזור ללקוח ולקבל התרעה לוואטסאפ?</span>
                            </div>
                            {followUpSentAlert[req.id] && (
                              <span className="text-xs bg-green-100 text-green-800 font-bold px-2.5 py-0.5 rounded-lg flex items-center gap-1 animate-in fade-in">
                                <Check className="w-3.5 h-3.5 text-green-700" />
                                התרעת תזכורת נשלחה לוואטסאפ של הריזורט! 🔔
                              </span>
                            )}
                          </div>

                          {/* Quick scheduling preset slots */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {[
                              { label: '🕒 מחר באותה שעה (24 שעות)', getVal: () => {
                                const raw = new Date(); raw.setDate(raw.getDate() + 1);
                                const d = getNextAllowedCommunicationDate(raw);
                                const dayName = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'][d.getDay()];
                                const isShifted = d.getDate() !== raw.getDate();
                                return isShifted
                                  ? `יום ${dayName} (${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}) בשעה ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} (שבת/חג 🕯️)`
                                  : `מחר (יום ${dayName} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}) בשעה ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                              }},
                              { label: '⏱️ בעוד שעתיים', getVal: () => {
                                const raw = new Date(); raw.setHours(raw.getHours() + 2);
                                const d = getNextAllowedCommunicationDate(raw);
                                return `היום בשעה ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                              }},
                              { label: '🌅 מחר ב-10:00', getVal: () => {
                                const raw = new Date(); raw.setDate(raw.getDate() + 1); raw.setHours(10, 0, 0, 0);
                                const d = getNextAllowedCommunicationDate(raw);
                                const dayName = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'][d.getDay()];
                                return `יום ${dayName} (${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}) בשעה ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                              }},
                              { label: '🌇 מחר ב-17:00', getVal: () => {
                                const raw = new Date(); raw.setDate(raw.getDate() + 1); raw.setHours(17, 0, 0, 0);
                                const d = getNextAllowedCommunicationDate(raw);
                                const dayName = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'][d.getDay()];
                                return `יום ${dayName} (${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}) בשעה ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                              }},
                              { label: '📅 בעוד יומיים ב-11:00', getVal: () => {
                                const raw = new Date(); raw.setDate(raw.getDate() + 2); raw.setHours(11, 0, 0, 0);
                                const d = getNextAllowedCommunicationDate(raw);
                                const dayName = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'][d.getDay()];
                                return `יום ${dayName} (${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}) בשעה ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                              }},
                            ].map((slot, sIdx) => {
                              const val = slot.getVal();
                              return (
                                <button
                                  key={sIdx}
                                  type="button"
                                  onClick={() => setFollowUpTimes(prev => ({ ...prev, [req.id]: val }))}
                                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                                    followUpTimes[req.id] === val
                                      ? 'bg-amber-600 text-white border-amber-700 shadow-2xs'
                                      : 'bg-white hover:bg-amber-100 text-amber-900 border-amber-200'
                                  }`}
                                >
                                  {slot.label}
                                </button>
                              );
                            })}
                          </div>

                          {/* Time input + Send WhatsApp Alert Button */}
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1">
                            <div className="flex-1 flex items-center gap-2 bg-white border border-amber-200 rounded-xl px-3 py-1.5 text-xs">
                              <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <input
                                type="text"
                                value={followUpTimes[req.id] || ''}
                                onChange={(e) => setFollowUpTimes(prev => ({ ...prev, [req.id]: e.target.value }))}
                                placeholder="לדוגמה: מחר ב-10:00 / יום שלישי בצהריים..."
                                className="w-full text-xs font-bold text-slate-900 bg-transparent focus:outline-none"
                              />
                            </div>

                            {/* Send alert to Resort WhatsApp */}
                            <button
                              type="button"
                              onClick={() => handleSendResortFollowUpAlert(req)}
                              className="bg-[#065f46] hover:bg-[#044e45] active:scale-95 text-white font-black px-3.5 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer shrink-0"
                              title="שלח התרעה לוואטסאפ של הריזורט עם פרטי הלקוח, סיבת הפנייה ומועד החזרה המתוכנן"
                            >
                              <Bell className="w-3.5 h-3.5" />
                              <span>🔔 שלח התרעה לוואטסאפ של הריזורט</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {req.depositRequested && req.depositRequested > 0 ? (
                        <div className="text-xs font-bold text-emerald-900 bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200 inline-flex items-center gap-1.5">
                          <span>💰 הסכום שסוכם הוא:</span>
                          <span className="font-mono text-sm">₪{req.depositRequested}</span>
                        </div>
                      ) : null}
                    </div>
                  )}

                  {/* LIVE OCCUPANCY & AVAILABLE SPOTS CALENDAR FOR REQUESTED DATES */}
                  <RequestedDatesCalendar
                    startDate={req.startDate}
                    endDate={req.endDate}
                    serviceType={req.serviceType}
                    bookings={bookings}
                    settings={settings}
                  />

                  {/* Card Bottom: Shmulik Action Buttons */}
                  <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    
                    {/* Left: Contact actions */}
                    <div className="flex items-center gap-2">
                      {/* Regular SIM Phone Call */}
                      <a
                        href={`tel:${cleanPhone}`}
                        className="bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-2xs"
                        title="חיוג סלולרי רגיל (מהסים של הטלפון)"
                      >
                        <Phone className="w-3.5 h-3.5 text-slate-500" />
                        <span>חיוג סלולרי</span>
                      </a>
                    </div>

                    {/* Right: Booking decision actions (Manual after call) */}
                    <div className="flex items-center gap-2">
                      {/* Edit Details Button */}
                      <button
                        type="button"
                        onClick={() => { setEditingRequest({ ...req }); setEditError(null); }}
                        className="bg-amber-50 hover:bg-amber-100 active:scale-98 text-amber-950 border border-amber-300 font-black px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                        title="ערוך את כל פרטי הבקשה (שירות, תאריכים, פרטי כלב, בעלים, חיסונים והערות)"
                      >
                        <Pencil className="w-3.5 h-3.5 text-amber-700" />
                        <span>ערוך פרטים ✏️</span>
                      </button>


                      {/* Approve and Book on calendar */}
                      <button
                        type="button"
                        onClick={() => onApproveAndBook(req)}
                        className="bg-[#065f46] hover:bg-[#044e45] active:scale-98 text-white font-black px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                        title="לאחר קבלת תשלום / אישור סופי: קלוט להזמנה פעילה ביומן הראשי"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>קלוט ליומן הראשי 🟢</span>
                      </button>

                      {/* Reject / Dismiss OR Restore & Permanent Deletion */}
                      {req.status !== 'rejected' ? (
                        <button
                          type="button"
                          onClick={() => handleOpenRejectPrompt(req)}
                          className="bg-white hover:bg-red-50 text-red-600 border border-slate-200 hover:border-red-200 font-bold px-2.5 py-1.5 rounded-xl text-xs transition-colors cursor-pointer"
                          title="דחה בקשה זו (עם אפשרות שליחת הודעת וואטסאפ מנומסת ללקוח)"
                        >
                          דחה
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          {/* Send rejection WhatsApp message */}
                          <button
                            type="button"
                            onClick={() => handleOpenRejectPrompt(req)}
                            className="bg-emerald-50 hover:bg-emerald-100 active:scale-98 text-emerald-800 border border-emerald-300 font-bold px-2.5 py-1.5 rounded-xl text-xs flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                            title="שלח הודעת דחייה מנומסת בוואטסאפ ללקוח"
                          >
                            <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                            <span>הודעת דחייה 💬</span>
                          </button>

                          {/* Restore / Reopen */}
                          <button
                            type="button"
                            onClick={() => onUpdateStatus(req.id, 'pending')}
                            className="bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-700 border border-slate-300 font-bold px-2.5 py-1.5 rounded-xl text-xs flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                            title="החזר את הבקשה לסטטוס ממתין לבדיקה"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
                            <span>שחזר</span>
                          </button>

                          {/* Permanent Deletion */}
                          <button
                            type="button"
                            onClick={async () => {
                              if (window.confirm(`האם למחוק סופית את בקשת הקליטה של ${req.dogName} (${req.ownerName})?\nפעולה זו תמחק את הבקשה לחלוטין מהמערכת ללא אפשרות שחזור.`)) {
                                await onDeleteRequest(req.id);
                              }
                            }}
                            className="bg-red-600 hover:bg-red-700 active:scale-98 text-white font-black px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                            title="מחיקה סופית ומוחלטת של ההזמנה/בקשה מהמערכת"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>מחיקה סופית 🗑️</span>
                          </button>
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <div>
            סה״כ {requests.length} בקשות קליטה במערכת
          </div>
          <button
            type="button"
            onClick={onClose}
            className="bg-white hover:bg-slate-200 text-slate-800 font-bold px-4 py-2 rounded-xl border border-slate-200 cursor-pointer shadow-2xs"
          >
            סגור חלון
          </button>
        </div>

      </div>

      {/* FULL EDIT INTAKE SUB-MODAL */}
      {editingRequest && (
        <div className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150" dir="rtl">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 bg-amber-50/60 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center font-black text-lg shadow-2xs">
                  ✏️
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900">
                    עריכת בקשת קליטה: {editingRequest.dogName}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    עדכן שינויים, תאריכים, סכומים והערות שסוכמו בשיחה עם {editingRequest.ownerName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingRequest(null)}
                className="w-8 h-8 rounded-xl bg-white hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer border border-slate-200 shadow-2xs"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
              {editError && (
                <div className="bg-red-50 text-red-700 border border-red-200 rounded-xl p-3 font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              {/* 1. Service Type */}
              <div className="space-y-1.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <label className="font-extrabold text-slate-800 block text-xs">
                  ✨ סוג השירות המבוקש
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'boarding', label: '🏨 פנסיון לינה' },
                    { id: 'training', label: '🎓 אילוף' },
                    { id: 'daycare', label: '✂️ יום כיף' },
                  ].map(st => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setEditingRequest({
                        ...editingRequest,
                        serviceType: st.id as any,
                        endDate: st.id === 'daycare' ? editingRequest.startDate : editingRequest.endDate
                      })}
                      className={`py-2 px-1 rounded-xl border text-center font-bold transition-all cursor-pointer ${
                        editingRequest.serviceType === st.id
                          ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Dates */}
              <div className="space-y-2 bg-emerald-50/40 p-3.5 rounded-2xl border border-emerald-200">
                <div className="flex items-center justify-between">
                  <label className="font-extrabold text-[#0f4c3a] block text-xs">
                    {editingRequest.serviceType === 'training' ? '🎓 תאריך כניסה לאילוף' : '📅 תאריכי שהות בריזורט'}
                  </label>
                  <span className="text-[11px] font-bold text-emerald-800 bg-white px-2 py-0.5 rounded-full border border-emerald-200">
                    {editingRequest.serviceType === 'training' 
                      ? 'תחילת אילוף (משך מותאם אישית)' 
                      : editingRequest.serviceType === 'daycare' 
                      ? 'שהות יומית' 
                      : `${Math.max(1, calculateDaysCount(editingRequest.startDate, editingRequest.endDate))} ימים (${Math.max(1, calculateDaysCount(editingRequest.startDate, editingRequest.endDate))} לילות)`}
                  </span>
                </div>

                {editingRequest.serviceType === 'training' ? (
                  <div>
                    <span className="text-[11px] text-slate-600 font-bold block mb-1">
                      🎓 תאריך הגעה / כניסה לאילוף:
                    </span>
                    <input
                      type="date"
                      value={editingRequest.startDate}
                      onChange={(e) => {
                        const s = e.target.value;
                        setEditingRequest({
                          ...editingRequest,
                          startDate: s,
                          endDate: s
                        });
                      }}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-mono text-slate-900 font-bold focus:border-emerald-500 focus:outline-none"
                    />
                    <div className="text-[10px] text-emerald-800 font-bold mt-1">
                      {editingRequest.startDate ? `יום ${getDayNameHebrew(editingRequest.startDate)}, ${formatDateIL(editingRequest.startDate)}` : ''}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <span className="text-[11px] text-slate-600 font-bold block mb-1">
                          🏨 תאריך הגעה / כניסה:
                        </span>
                        <input
                          type="date"
                          value={editingRequest.startDate}
                          onChange={(e) => {
                            const s = e.target.value;
                            const curNights = Math.max(1, calculateDaysCount(editingRequest.startDate, editingRequest.endDate));
                            setEditingRequest({
                              ...editingRequest,
                              startDate: s,
                              endDate: editingRequest.serviceType === 'daycare' ? s : addDays(s, curNights)
                            });
                          }}
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-mono text-slate-900 font-bold focus:border-emerald-500 focus:outline-none"
                        />
                        <div className="text-[10px] text-emerald-800 font-bold mt-1">
                          {editingRequest.startDate ? `יום ${getDayNameHebrew(editingRequest.startDate)}, ${formatDateIL(editingRequest.startDate)}` : ''}
                        </div>
                      </div>

                      <div>
                        <span className="text-[11px] text-slate-600 font-bold block mb-1">
                          🚗 תאריך איסוף / יציאה:
                        </span>
                        <input
                          type="date"
                          min={editingRequest.startDate}
                          value={editingRequest.endDate}
                          onChange={(e) => setEditingRequest({ ...editingRequest, endDate: e.target.value })}
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-mono text-slate-900 font-bold focus:border-emerald-500 focus:outline-none"
                        />
                        <div className="text-[10px] text-emerald-800 font-bold mt-1">
                          {editingRequest.endDate ? `יום ${getDayNameHebrew(editingRequest.endDate)}, ${formatDateIL(editingRequest.endDate)}` : ''}
                        </div>
                      </div>
                    </div>

                    {/* Quick nights adjust */}
                    {editingRequest.serviceType !== 'daycare' && (
                      <div className="flex items-center justify-between pt-1 text-xs">
                        <span className="text-slate-500 font-medium">כוונון לילות מהיר:</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              const n = Math.max(1, calculateDaysCount(editingRequest.startDate, editingRequest.endDate) - 1);
                              setEditingRequest({ ...editingRequest, endDate: addDays(editingRequest.startDate, n) });
                            }}
                            className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg font-bold text-slate-700"
                          >
                            -1 לילה
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const n = calculateDaysCount(editingRequest.startDate, editingRequest.endDate) + 1;
                              setEditingRequest({ ...editingRequest, endDate: addDays(editingRequest.startDate, n) });
                            }}
                            className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg font-bold text-slate-700"
                          >
                            +1 לילה
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingRequest({ ...editingRequest, endDate: addDays(editingRequest.startDate, 7) })}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-lg font-bold"
                          >
                            שבוע (7 לילות)
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Live Occupancy Calendar in Edit Modal */}
                <RequestedDatesCalendar
                  startDate={editingRequest.startDate}
                  endDate={editingRequest.endDate}
                  serviceType={editingRequest.serviceType}
                  bookings={bookings}
                  settings={settings}
                />
              </div>

              {/* 3. Dog Details */}
              <div className="space-y-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <label className="font-extrabold text-slate-800 block text-xs">
                  🐕 פרטי הכלב/ה
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <span className="text-[11px] text-slate-600 font-bold block mb-1">שם הכלב *</span>
                    <input
                      type="text"
                      value={editingRequest.dogName}
                      onChange={(e) => setEditingRequest({ ...editingRequest, dogName: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-600 font-bold block mb-1">גזע</span>
                    <input
                      type="text"
                      value={editingRequest.dogBreed || ''}
                      onChange={(e) => setEditingRequest({ ...editingRequest, dogBreed: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-600 font-bold block mb-1">גיל</span>
                    <input
                      type="text"
                      value={editingRequest.dogAge || ''}
                      onChange={(e) => setEditingRequest({ ...editingRequest, dogAge: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Dog Gender */}
                <div>
                  <span className="text-[11px] text-slate-600 font-bold block mb-1">מין הכלב/ה:</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingRequest({ ...editingRequest, dogGender: 'male' })}
                      className={`py-1.5 px-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        editingRequest.dogGender !== 'female'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      זכר ♂️
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingRequest({ ...editingRequest, dogGender: 'female' })}
                      className={`py-1.5 px-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        editingRequest.dogGender === 'female'
                          ? 'bg-pink-600 text-white border-pink-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      נקבה ♀️
                    </button>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] text-slate-600 font-bold block mb-1">גודל כלב:</span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { id: 'small', label: 'קטן (עד 10)' },
                      { id: 'medium', label: 'בינוני (10-25)' },
                      { id: 'large', label: 'גדול (25-45)' },
                      { id: 'giant', label: 'ענק (45+)' },
                    ].map(s => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setEditingRequest({ ...editingRequest, dogSize: s.id as any })}
                        className={`py-1.5 px-1 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${
                          editingRequest.dogSize === s.id
                            ? 'bg-emerald-700 text-white border-emerald-700'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 4. Owner Details */}
              <div className="space-y-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <label className="font-extrabold text-slate-800 block text-xs">
                  👤 פרטי הבעלים
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <span className="text-[11px] text-slate-600 font-bold block mb-1">שם הבעלים *</span>
                    <input
                      type="text"
                      value={editingRequest.ownerName}
                      onChange={(e) => setEditingRequest({ ...editingRequest, ownerName: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-600 font-bold block mb-1">טלפון נייד *</span>
                    <input
                      type="tel"
                      value={editingRequest.ownerPhone}
                      onChange={(e) => setEditingRequest({ ...editingRequest, ownerPhone: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold focus:border-emerald-500 focus:outline-none font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-600 font-bold block mb-1">דוא״ל</span>
                    <input
                      type="email"
                      value={editingRequest.ownerEmail || ''}
                      onChange={(e) => setEditingRequest({ ...editingRequest, ownerEmail: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* 5. Vetting & Health Questions */}
              <div className="space-y-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <label className="font-extrabold text-slate-800 block text-xs">
                  🛡️ התאמה ובריאות
                </label>
                <div className="space-y-2">
                  {/* Friendly with dogs */}
                  <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-slate-200">
                    <span className="font-bold text-slate-700">מסתדר עם כלבים:</span>
                    <div className="flex items-center gap-1">
                      {[
                        { id: 'yes', label: 'חברותי 🟢' },
                        { id: 'depends', label: 'תלוי 🟡' },
                        { id: 'no', label: 'חייב בידוד / תוקפני 🔴' },
                      ].map(f => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setEditingRequest({ ...editingRequest, isFriendlyWithDogs: f.id as any })}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            editingRequest.isFriendlyWithDogs === f.id
                              ? 'bg-emerald-700 text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Booleans: Neutered, Vaccinated, House-trained, Parasites */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-slate-200">
                      <span className="font-bold text-slate-700">
                        {editingRequest.dogGender === 'female' ? 'מעוקרת:' : 'מסורס:'}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingRequest({ ...editingRequest, isNeutered: true })}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer ${editingRequest.isNeutered ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-700'}`}
                        >
                          כן
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingRequest({ ...editingRequest, isNeutered: false })}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer ${!editingRequest.isNeutered ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-700'}`}
                        >
                          לא
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-slate-200">
                      <span className="font-bold text-slate-700">חיסונים בתוקף:</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingRequest({ ...editingRequest, isVaccinated: true })}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer ${editingRequest.isVaccinated ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-700'}`}
                        >
                          כן
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingRequest({ ...editingRequest, isVaccinated: false })}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer ${!editingRequest.isVaccinated ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-700'}`}
                        >
                          לא
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-slate-200">
                      <span className="font-bold text-slate-700">מחונך לצרכים:</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingRequest({ ...editingRequest, isHouseTrained: true })}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer ${editingRequest.isHouseTrained !== false ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-700'}`}
                        >
                          כן
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingRequest({ ...editingRequest, isHouseTrained: false })}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer ${editingRequest.isHouseTrained === false ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-700'}`}
                        >
                          לא
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-slate-200">
                      <span className="font-bold text-slate-700">נגד קרציות/פשפשים:</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingRequest({ ...editingRequest, isTreatedParasites: true })}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer ${editingRequest.isTreatedParasites !== false ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-700'}`}
                        >
                          כן
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingRequest({ ...editingRequest, isTreatedParasites: false })}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer ${editingRequest.isTreatedParasites === false ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-700'}`}
                        >
                          לא
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 6. Notes & Special Needs */}
              <div className="space-y-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <label className="font-extrabold text-slate-800 block text-xs">
                  📝 הערות, צרכים מיוחדים וסיכום שיחה
                </label>
                <div className="space-y-2">
                  <div>
                    <span className="text-[11px] text-slate-600 font-bold block mb-1">
                      🩺 צרכים מיוחדים / תרופות:
                    </span>
                    <textarea
                      rows={2}
                      value={editingRequest.specialNeeds || ''}
                      onChange={(e) => setEditingRequest({ ...editingRequest, specialNeeds: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-xl p-2 text-slate-900 font-medium focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-600 font-bold block mb-1">
                      📝 הערות הלקוח:
                    </span>
                    <textarea
                      rows={2}
                      value={editingRequest.notes || ''}
                      onChange={(e) => setEditingRequest({ ...editingRequest, notes: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-xl p-2 text-slate-900 font-medium focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-blue-900 font-bold block mb-1">
                      📌 סיכום שיחה והערות שמוליק (פנימי):
                    </span>
                    <textarea
                      rows={2}
                      value={editingRequest.internalNotes || ''}
                      onChange={(e) => setEditingRequest({ ...editingRequest, internalNotes: e.target.value })}
                      placeholder="למשל: סוכם בשיחה שיביא את המזון שלו, מקדמה 500 ש״ח תועבר בביט..."
                      className="w-full bg-blue-50/60 border border-blue-200 rounded-xl p-2 text-slate-900 font-medium focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* 7. Agreed Amount & Status */}
              <div className="space-y-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <label className="font-extrabold text-slate-800 block text-xs">
                  💰 סכום שסוכם וסטטוס טיפול
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <span className="text-[11px] text-slate-600 font-bold block mb-1">
                      הסכום שסוכם (₪):
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={editingRequest.depositRequested || ''}
                      onChange={(e) => setEditingRequest({ ...editingRequest, depositRequested: Number(e.target.value) || 0 })}
                      placeholder="0"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold font-mono focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-600 font-bold block mb-1">
                      סטטוס הבקשה:
                    </span>
                    <select
                      value={editingRequest.status}
                      onChange={(e) => setEditingRequest({ ...editingRequest, status: e.target.value as any })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold focus:border-emerald-500 focus:outline-none cursor-pointer"
                    >
                      <option value="pending">ממתין לשיחה</option>
                      <option value="payment_requested">נשלח קישור לתשלום</option>
                      <option value="approved">נקלט ביומן</option>
                      <option value="rejected">נדחה</option>
                    </select>
                  </div>
                </div>
              </div>

            </div>

            {/* Sub-modal Footer */}
            <div className="p-3 sm:p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setEditingRequest(null)}
                className="bg-white hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl border border-slate-300 cursor-pointer shadow-2xs transition-colors"
              >
                ביטול
              </button>
              <button
                type="button"
                disabled={isSavingEdit}
                onClick={handleSaveEdit}
                className="bg-emerald-700 hover:bg-emerald-800 active:scale-98 text-white font-black px-5 py-2 rounded-xl shadow-xs cursor-pointer flex items-center gap-2 transition-all disabled:opacity-50"
              >
                {isSavingEdit ? 'שומר שינויים...' : '💾 שמור שינויים'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* QUICK PAYMENT PROMPT MODAL */}
      {paymentPromptRequest && (
        <div className="fixed inset-0 z-70 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-5 animate-in fade-in duration-150" dir="rtl">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[92dvh] sm:max-h-[90vh] shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            
            {/* Header */}
            <div className="p-3.5 sm:p-4 border-b border-slate-100 bg-blue-50/80 shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-900 flex items-center justify-center font-black text-lg shadow-2xs">
                  💳
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                    שליחת קישור לתשלום בוואטסאפ
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    עבור {paymentPromptRequest.ownerName} ({paymentPromptRequest.dogName}) · {paymentPromptRequest.ownerPhone}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPaymentPromptRequest(null)}
                className="w-8 h-8 rounded-xl bg-white hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer border border-slate-200 shadow-2xs"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Content (Keyboard-friendly & Mobile-safe) */}
            <div className="p-3.5 sm:p-5 space-y-3.5 text-xs overflow-y-auto flex-1 min-h-0">
              {/* Live Occupancy Calendar for Requested Dates */}
              <RequestedDatesCalendar
                startDate={paymentPromptRequest.startDate}
                endDate={paymentPromptRequest.endDate}
                serviceType={paymentPromptRequest.serviceType}
                bookings={bookings}
                settings={settings}
              />

              {/* Quick presets & Free stay toggle */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setPaymentAmount('0')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                    paymentAmount === '0' || parseFloat(paymentAmount) === 0
                      ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                      : 'bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100'
                  }`}
                >
                  🎁 אירוח ללא תשלום / כלב שני (₪0)
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentAmount('200')}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer"
                >
                  מקדמה 200 ₪
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentAmount('300')}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer"
                >
                  מקדמה 300 ₪
                </button>
              </div>

              {/* Amount input - NO autoFocus so keyboard doesn't open unexpectedly on mobile */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-900 block">
                  💰 הסכום שסוכם (₪):
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="לדוגמה: 500"
                    className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 focus:border-blue-500 rounded-xl px-4 py-2.5 text-base font-black font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">₪</span>
                </div>
              </div>

              {/* Payment Link (Optional override) */}
              {parseFloat(paymentAmount) !== 0 && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">
                    🔗 קישור לתשלום (Grow):
                  </label>
                  <input
                    type="text"
                    value={customPaymentLink}
                    onChange={(e) => setCustomPaymentLink(e.target.value)}
                    className="w-full bg-slate-50 text-slate-800 text-xs px-3 py-2 rounded-xl border border-slate-200 focus:border-blue-500 focus:outline-none font-mono"
                    placeholder="https://pay.grow.link/..."
                  />
                  <span className="text-[10px] text-slate-400 block">
                    (ברירת מחדל: עמוד Grow של הריזורט לתשלום מאובטח ב-Bit, Apple Pay ואשראי).
                  </span>
                </div>
              )}

              {/* Message preview snippet */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-[11px] text-slate-700 space-y-1">
                <span className="font-bold text-slate-500 block">תצוגה מקדימה של הודעת הוואטסאפ שתשלח:</span>
                <div className="text-slate-800 whitespace-pre-wrap font-sans bg-white p-2.5 rounded-xl border border-slate-200 break-all select-all leading-relaxed" dir="rtl">
                  {formatClientPaymentLinkMessage(
                    paymentPromptRequest,
                    settings,
                    parseFloat(paymentAmount) || 0,
                    customPaymentLink
                  )}
                </div>
              </div>

              {/* Error / Alert banner */}
              {paymentSendError && (
                <div className="bg-rose-50 border border-rose-300 text-rose-900 rounded-xl p-3 text-xs font-bold flex items-center gap-2">
                  <span>⚠️ {paymentSendError}</span>
                </div>
              )}

            </div>

            {/* Sticky, Foolproof Footer for Shmulik - Always visible at bottom */}
            <div className="p-3 sm:p-4 border-t border-slate-200 bg-white shrink-0 flex flex-col gap-2.5 z-10 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
              {parseFloat(paymentAmount) === 0 ? (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <button
                    type="button"
                    disabled={isSendingPayment}
                    onClick={() => handleConfirmSendPayment('green_api')}
                    className="bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-black py-3 px-4 rounded-2xl shadow-md cursor-pointer flex items-center justify-center gap-2 text-sm sm:text-base transition-all disabled:opacity-50 flex-1"
                  >
                    <MessageCircle className="w-5 h-5" />
                    <span>{isSendingPayment ? 'שולח אישור...' : '⚡ אשר ושלח הודעה בוואטסאפ (₪0)'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onApproveAndBook({
                        ...paymentPromptRequest,
                        isFreeStay: true,
                        depositRequested: 0,
                        notes: `[אירוח ללא תשלום (חינם / כלב נוסף)] ${paymentPromptRequest.notes || ''}`.trim()
                      });
                      setPaymentPromptRequest(null);
                    }}
                    className="bg-purple-600 hover:bg-purple-700 active:scale-98 text-white font-black px-4 py-2.5 rounded-xl shadow-xs cursor-pointer flex items-center justify-center gap-1.5 text-xs sm:text-sm"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>קלוט ישירות ליומן ב-₪0</span>
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {/* Giant Primary Send Button for Shmulik */}
                  <button
                    type="button"
                    disabled={isSendingPayment}
                    onClick={() => handleConfirmSendPayment('green_api')}
                    className="bg-[#065f46] hover:bg-[#044e45] active:scale-98 text-white font-black py-3.5 px-5 rounded-2xl shadow-lg cursor-pointer flex items-center justify-center gap-2.5 text-base sm:text-lg transition-all disabled:opacity-50 w-full"
                    title="שליחה ישירה מוואטסאפ הריזורט ללקוח ברקע (עובד אוטומטית גם מהנייד וגם מהמחשב)"
                  >
                    <MessageCircle className="w-5 h-5" />
                    <span>{isSendingPayment ? 'שולח קישור ללקוח...' : `⚡ שלח קישור בוואטסאפ (₪${paymentAmount || 0})`}</span>
                  </button>

                  {/* Secondary Options Strip */}
                  <div className="flex items-center justify-between gap-1.5 pt-0.5">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => { setPaymentPromptRequest(null); setPaymentSendError(null); }}
                        className="bg-white hover:bg-slate-100 text-slate-600 font-bold px-3 py-1.5 rounded-xl border border-slate-200 cursor-pointer shadow-2xs text-xs"
                      >
                        ביטול
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const msg = formatClientPaymentLinkMessage(
                            paymentPromptRequest,
                            settings,
                            parseFloat(paymentAmount) || 0,
                            customPaymentLink
                          );
                          navigator.clipboard.writeText(msg);
                          setCopiedPaymentLink(true);
                          setTimeout(() => setCopiedPaymentLink(false), 2000);
                        }}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-2.5 py-1.5 rounded-xl border border-slate-200 cursor-pointer text-xs flex items-center gap-1"
                      >
                        {copiedPaymentLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedPaymentLink ? 'הועתק!' : 'העתק'}</span>
                      </button>
                    </div>

                    {/* Direct Native WhatsApp Link (Backup if Green-API fails) */}
                    {(() => {
                      const cleanP = cleanPhoneNumber(paymentPromptRequest.ownerPhone);
                      const intlP = cleanP.startsWith('0') 
                        ? '972' + cleanP.substring(1) 
                        : (cleanP.startsWith('5') && cleanP.length === 9 ? '972' + cleanP : cleanP);
                      const fullMsg = formatClientPaymentLinkMessage(
                        { ...paymentPromptRequest, depositRequested: Number(paymentAmount) || 0, status: 'payment_requested' },
                        settings,
                        Number(paymentAmount) || 0,
                        customPaymentLink
                      );
                      const waLink = `https://wa.me/${intlP}?text=${encodeURIComponent(fullMsg)}`;
                      return (
                        <a
                          href={waLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => {
                            onUpdateStatus(paymentPromptRequest.id, 'payment_requested');
                            setPaymentPromptRequest(null);
                          }}
                          className="text-emerald-700 hover:text-emerald-800 font-bold px-2.5 py-1.5 rounded-xl text-xs flex items-center gap-1 hover:underline"
                          title="פתח שיחת וואטסאפ במכשיר הנוכחי (גיבוי ידני)"
                        >
                          <span>📱 פתח בוואטסאפ</span>
                        </a>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* REJECT WITH WHATSAPP SUB-MODAL */}
      {rejectPromptRequest && (
        <div className="fixed inset-0 z-70 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150" dir="rtl">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 bg-red-50/70 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-red-100 text-red-800 flex items-center justify-center font-black text-lg shadow-2xs">
                  💬
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900">
                    דחיית בקשת קליטה ושליחת הודעה ללקוח
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    עבור {rejectPromptRequest.ownerName} ({rejectPromptRequest.dogName}) · {rejectPromptRequest.ownerPhone}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRejectPromptRequest(null)}
                className="w-8 h-8 rounded-xl bg-white hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer border border-slate-200 shadow-2xs"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-5 space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-900 block flex items-center justify-between">
                  <span>נוסח הודעת הדחייה המנומסת (ניתן לערוך בחופשיות):</span>
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    שליחה ישירה לוואטסאפ
                  </span>
                </label>
                <textarea
                  rows={6}
                  value={rejectMessageText}
                  onChange={(e) => setRejectMessageText(e.target.value)}
                  className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 focus:border-red-400 rounded-xl p-3 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500/20 leading-relaxed font-sans"
                  placeholder="הזן נוסח הודעה..."
                />
              </div>

              <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-3 text-[11px] text-amber-900 space-y-1">
                <span className="font-bold block">💡 בחר כיצד להמשיך:</span>
                <p>
                  באפשרותך לדחות את הבקשה ולפתוח מיד הודעת וואטסאפ מנוסחת היטב ללקוח, או לדחות את הבקשה במערכת בלבד ללא יצירת קשר.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-3 sm:p-4 border-t border-slate-100 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setRejectPromptRequest(null)}
                className="bg-white hover:bg-slate-200 text-slate-700 font-bold px-3 py-2 rounded-xl border border-slate-300 cursor-pointer text-xs"
              >
                ביטול
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isProcessingReject}
                  onClick={handleConfirmRejectWithoutWhatsApp}
                  className="bg-white hover:bg-red-50 text-red-700 border border-red-200 font-bold px-3.5 py-2 rounded-xl text-xs cursor-pointer transition-colors shadow-2xs"
                  title="עדכן סטטוס לנדחה במערכת ללא פתיחת הודעת וואטסאפ"
                >
                  דחה בלבד (ללא הודעה)
                </button>

                <button
                  type="button"
                  disabled={isProcessingReject}
                  onClick={handleConfirmRejectWithWhatsApp}
                  className="bg-[#25D366] hover:bg-[#1EBE5D] active:scale-98 text-white font-black px-4 py-2 rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 text-xs transition-all"
                  title="עדכן לנדחה ופתח שיחת וואטסאפ עם ההודעה המנוסחת ללקוח"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>📲 דחה ושלח בוואטסאפ</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Proactive Send Form Modal */}
      <SendIntakeModal
        isOpen={isSendIntakeModalOpen}
        onClose={() => setIsSendIntakeModalOpen(false)}
        settings={settings}
        bookings={bookings}
        intakeRequests={requests}
      />

    </div>
  );
};
