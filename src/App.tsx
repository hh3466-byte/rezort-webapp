import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';

import { Booking, ResortSettings, AgentActionProposal, PaymentMethod, GrowIncomingPayment, IntakeRequest, IntakeRequestStatus } from './types';
import { initialBookings, defaultSettings } from './data/initialData';
import { loadStoredBookings, loadStoredSettings } from './utils/storage';
import { 
  subscribeToBookings, 
  subscribeToSettings, 
  subscribeToGrowPayments,
  updateGrowPaymentStatus,
  subscribeToIntakeRequests,
  updateIntakeRequestStatusInDb,
  deleteIntakeRequestFromDb,
  loadStoredIntakeRequests,
  saveBookingToDb, 
  deleteBookingFromDb, 
  saveSettingsToDb, 
  batchRestoreToDb, 
  clearAllBookingsFromDb
} from './services/dbService';
import { parseVoiceOrWhatsAppText } from './services/agentService';
import { getTodayStr, getBookingsForDate, addDays } from './utils/dateUtils';

import { VoiceAgentBar } from './components/VoiceAgentBar';
import { CalendarView } from './components/CalendarView';
import { OccupancyForecast } from './components/OccupancyForecast';
import { BookingsList } from './components/BookingsList';
import { CustomersView } from './components/CustomersView';
import { DayDetailsModal } from './components/DayDetailsModal';
import { AgentActionModal } from './components/AgentActionModal';
import { BookingFormModal } from './components/BookingFormModal';
import { SimpleBookingWizard } from './components/SimpleBookingWizard';
import { GrowPaymentsModal } from './components/GrowPaymentsModal';
import { PaymentModal } from './components/PaymentModal';
import { ExtremeChangeModal, ExtremeChangeImpact } from './components/ExtremeChangeModal';
import { ManagerAuthModal } from './components/ManagerAuthModal';
import { Settings as SettingsIcon, Star } from 'lucide-react';
import { SettingsModal } from './components/SettingsModal';
import { ReportsModal } from './components/ReportsModal';
import { Guide } from './components/Guide';
import { HeaderMetricModal, HeaderMetricType } from './components/HeaderMetricModal';
import { ReviewRequestModal } from './components/ReviewRequestModal';
import { IntakeRequestsModal } from './components/IntakeRequestsModal';
import { PublicIntakePage } from './components/PublicIntakePage';

export default function App() {
  // Core application state with live Cloud synchronization
  const [bookings, setBookings] = useState<Booking[]>(() => loadStoredBookings());
  const [settings, setSettings] = useState<ResortSettings>(() => loadStoredSettings());
  const [activeTab, setActiveTab] = useState<'calendar' | 'forecast' | 'bookings' | 'customers'>('calendar');

  // Calendar year/month state
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth());

  // Modals state
  const [selectedDateForDetails, setSelectedDateForDetails] = useState<string | null>(null);
  const [agentProposal, setAgentProposal] = useState<AgentActionProposal | null>(null);
  const [bookingWizardOpen, setBookingWizardOpen] = useState<{
    isOpen: boolean;
    initialData?: Partial<Booking> | null;
  }>({ isOpen: false, initialData: null });
  const [bookingFormModal, setBookingFormModal] = useState<{
    isOpen: boolean;
    initialData?: Partial<Booking> | null;
  }>({ isOpen: false, initialData: null });
  const [paymentModalBooking, setPaymentModalBooking] = useState<Booking | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isReportsOpen, setIsReportsOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // Incoming Grow Payments from Gmail sync
  const [pendingGrowPayments, setPendingGrowPayments] = useState<GrowIncomingPayment[]>([]);
  const [activeGrowPayment, setActiveGrowPayment] = useState<GrowIncomingPayment | null>(null);

  // Client Intake Requests State
  const isIntakeParam = typeof window !== 'undefined' && (
    window.location.search.includes('request') ||
    window.location.search.includes('intake') ||
    window.location.hash.includes('request') ||
    window.location.hash.includes('intake')
  );
  const [showPublicIntake, setShowPublicIntake] = useState(isIntakeParam);
  const [intakeRequests, setIntakeRequests] = useState<IntakeRequest[]>(() => loadStoredIntakeRequests());
  const [isIntakeModalOpen, setIsIntakeModalOpen] = useState(false);
  const pendingIntakeCount = intakeRequests.filter(r => r.status === 'pending').length;

  // Manager Authentication State (Passcode 3466)
  const [isManagerAuthOpen, setIsManagerAuthOpen] = useState(false);
  const [managerAuthContext, setManagerAuthContext] = useState<{
    actionType: 'open_settings' | 'clear_all';
    title?: string;
    description?: string;
    onSuccess?: () => void;
  }>({ actionType: 'open_settings' });

  const handleOpenSettingsWithAuth = () => {
    setManagerAuthContext({
      actionType: 'open_settings',
      title: 'אישור מנהל נדרש 🔒',
      description: 'לפתיחת הגדרות הריזורט, תעריפי השירותים וגיבויים, אנא הזן קוד מנהל:'
    });
    setIsManagerAuthOpen(true);
  };

  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Extreme Change Confirmation Modal State
  const [appExtremeModal, setAppExtremeModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    impacts: ExtremeChangeImpact[];
    severity?: 'warning' | 'danger';
    confirmText?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    impacts: [],
    onConfirm: () => {}
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Real-time Cloud Sync from Firestore / Supabase
  useEffect(() => {
    const unsubBookings = subscribeToBookings((incomingBookings) => {
      setBookings(prev => {
        // Structural comparison to avoid unnecessary React re-renders and flickering
        if (prev.length === incomingBookings.length) {
          const prevSig = prev.map(b => `${b.id}-${b.paymentStatus}-${b.depositAmount}-${b.totalPrice}-${b.stayStatus}`).join('|');
          const nextSig = incomingBookings.map(b => `${b.id}-${b.paymentStatus}-${b.depositAmount}-${b.totalPrice}-${b.stayStatus}`).join('|');
          if (prevSig === nextSig) return prev;
        }
        return incomingBookings;
      });
    });

    const unsubSettings = subscribeToSettings((updatedSettings) => {
      setSettings(updatedSettings);
    });

    const unsubGrowPayments = subscribeToGrowPayments((payments) => {
      setPendingGrowPayments(payments);
    });

    const unsubIntake = subscribeToIntakeRequests((requests) => {
      setIntakeRequests(requests);
    });

    return () => {
      unsubBookings();
      unsubSettings();
      unsubGrowPayments();
      unsubIntake();
    };
  }, []);

  // Today stats calculations
  const todayStr = getTodayStr();
  const activeBookings = bookings.filter(b => b.stayStatus !== 'cancelled');
  const todayBookings = getBookingsForDate(activeBookings, todayStr);

  const totalDogsToday = todayBookings.length;
  const boardingToday = todayBookings.filter(b => b.serviceType === 'boarding' || b.serviceType === 'daycare').length;
  const fullTrainingToday = todayBookings.filter(b => b.serviceType === 'training').length;
  const dayTrainingToday = todayBookings.filter(b => b.serviceType === 'day_training').length;
  const trainingToday = fullTrainingToday + dayTrainingToday;
  const freeSlots = Math.max(0, settings.maxCapacity - totalDogsToday);

  // Accurate real-time money calculation across all bookings
  const totalCollected = activeBookings.reduce((acc, b) => {
    if (b.paymentStatus === 'fully_paid') {
      return acc + (Number(b.totalPrice) || 0);
    }
    return acc + (Number(b.depositAmount) || 0);
  }, 0);

  const openDebtTotal = activeBookings.reduce((acc, b) => {
    if (b.paymentStatus === 'fully_paid') return acc;
    const debt = Math.max(0, (Number(b.totalPrice) || 0) - (Number(b.depositAmount) || 0));
    return acc + debt;
  }, 0);

  const unpaidBookings = activeBookings.filter(b => 
    b.paymentStatus !== 'fully_paid' && ((Number(b.totalPrice) || 0) - (Number(b.depositAmount) || 0) > 0)
  );
  const unpaidCount = unpaidBookings.length;

  // Header metric drill-down / edit modal state (occupancy, boarding, training, debt, revenue)
  const [activeHeaderMetric, setActiveHeaderMetric] = useState<HeaderMetricType | null>(null);

  // Review requests for dogs checked out yesterday
  const yesterdayStr = addDays(todayStr, -1);
  const [handledReviewIds, setHandledReviewIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('shmulik_handled_review_requests');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isReviewModalDismissed, setIsReviewModalDismissed] = useState(false);

  // Identify dogs checked out yesterday that haven't been handled yet
  const pendingReviewBookings = bookings.filter(b => {
    if (b.stayStatus === 'cancelled') return false;
    if (handledReviewIds.includes(b.id)) return false;
    const isCheckoutYesterday = b.stayStatus === 'checked_out' && b.endDate === yesterdayStr;
    const isEndedYesterday = b.endDate === yesterdayStr;
    return isCheckoutYesterday || isEndedYesterday;
  });

  const handleReviewHandled = (bookingId: string) => {
    setHandledReviewIds(prev => {
      const next = prev.includes(bookingId) ? prev : [...prev, bookingId];
      try {
        localStorage.setItem('shmulik_handled_review_requests', JSON.stringify(next));
      } catch {}
      return next;
    });
    showToast('⭐ בקשת חוות הדעת עודכנה בהצלחה');
  };

  // Jump to today
  const handleJumpToToday = () => {
    const d = new Date();
    setCurrentYear(d.getFullYear());
    setCurrentMonth(d.getMonth());
    setActiveTab('calendar');
  };

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  // Voice Agent execution handler
  const handleAgentProcess = async (text: string): Promise<AgentActionProposal> => {
    const proposal = await parseVoiceOrWhatsAppText({
      text,
      existingBookings: bookings,
      settings,
    });
    setAgentProposal(proposal);
    return proposal;
  };

  // Agent proposal confirmed by user
  const handleConfirmProposal = async (proposal: AgentActionProposal) => {
    const { intent, parsedBooking, targetTab, existingBookingId, rawText } = proposal;

    if (intent === 'new_booking') {
      const rawLower = (rawText || '').toLowerCase();
      const isFullyPaid = parsedBooking.paymentStatus === 'fully_paid' ||
        (Boolean(parsedBooking.depositAmount) && Boolean(parsedBooking.totalPrice) && (parsedBooking.depositAmount || 0) >= (parsedBooking.totalPrice || 0)) ||
        rawLower.includes('שולם במלואו') ||
        rawLower.includes('שילם במלואו') ||
        rawLower.includes('שולם הכל') ||
        rawLower.includes('שילם הכל') ||
        rawLower.includes('הכל שולם') ||
        rawLower.includes('שולם מלא') ||
        rawLower.includes('שילם מלא') ||
        rawLower.includes('שולם מראש');

      const totalPrice = parsedBooking.totalPrice || 0;
      const depositAmount = isFullyPaid 
        ? totalPrice 
        : (parsedBooking.depositAmount || 0);

      const paymentStatus = isFullyPaid 
        ? 'fully_paid' 
        : (depositAmount > 0 ? 'deposit_paid' : 'unpaid');

      const newBooking: Booking = {
        id: `b-${Date.now()}`,
        dogName: parsedBooking.dogName || 'כלב',
        dogBreed: parsedBooking.dogBreed || 'מעורב',
        ownerName: parsedBooking.ownerName || 'לקוח',
        ownerPhone: parsedBooking.ownerPhone || '050-0000000',
        ownerEmail: parsedBooking.ownerEmail || '',
        serviceType: parsedBooking.serviceType || 'boarding',
        startDate: parsedBooking.startDate || new Date().toISOString().split('T')[0],
        endDate: parsedBooking.endDate || new Date().toISOString().split('T')[0],
        totalPrice,
        depositAmount,
        paymentStatus,
        paymentMethod: parsedBooking.paymentMethod || 'bit',
        stayStatus: 'booked',
        notes: parsedBooking.notes || '',
        vaccinationValid: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setBookings(prev => [...prev, newBooking]);
      showToast(`✨ שריון ל${newBooking.dogName} נוסף וסונכרן לענן!`);
      await saveBookingToDb(newBooking);
      
      if (newBooking.paymentStatus === 'fully_paid') {
        confetti({ particleCount: 60, spread: 60, origin: { y: 0.7 } });
      }
    } else if (intent === 'payment_update') {
      const target = existingBookingId 
        ? bookings.find(b => b.id === existingBookingId)
        : bookings.find(b => b.dogName.toLowerCase() === (parsedBooking.dogName || '').toLowerCase());

      if (target) {
        await handleSavePayment(target.id, parsedBooking.depositAmount || 0, parsedBooking.paymentMethod || 'bit');
      } else {
        showToast('לא נמצאה הזמנה מתאימה לעדכון תשלום');
      }
    } else if (intent === 'cancel_booking') {
      const target = existingBookingId 
        ? bookings.find(b => b.id === existingBookingId)
        : bookings.find(b => b.dogName.toLowerCase() === (parsedBooking.dogName || '').toLowerCase());

      if (target) {
        await handleDeleteBooking(target.id);
      } else {
        showToast('לא נמצאה הזמנה מתאימה לביטול');
      }
    } else if (intent === 'clear_all_data') {
      setManagerAuthContext({
        actionType: 'clear_all',
        title: 'אישור מנהל למחיקת כל הנתונים 🔒',
        description: 'הסוכן זיהה בקשה למחיקת היומן. אנא הזן קוד מנהל לאישור המחיקה:',
        onSuccess: async () => {
          await handleClearAllData();
        }
      });
      setIsManagerAuthOpen(true);
    } else if (intent === 'backup_data') {
      // Trigger backup export
      const dataStr = JSON.stringify({ bookings, settings, exportDate: new Date().toISOString() }, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `dog_resort_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('💾 קובץ הגיבוי הורד בהצלחה למכשירך');
    } else if (intent === 'navigate_tab') {
      if (targetTab === 'calendar' || targetTab === 'forecast' || targetTab === 'bookings' || targetTab === 'customers') {
        setActiveTab(targetTab);
      } else if (targetTab === 'reports') {
        setIsReportsOpen(true);
      } else if (targetTab === 'backup') {
        handleOpenSettingsWithAuth();
      }
      showToast('🧭 עברת למסך המבוקש');
    }

    setAgentProposal(null);
  };

  // Fast 1-click Mark as Paid
  const handleMarkAsPaid = async (bookingId: string) => {
    const match = bookings.find(b => String(b.id) === String(bookingId));
    if (!match) return;

    const total = Number(match.totalPrice) || 0;
    const updatedBooking: Booking = {
      ...match,
      totalPrice: total,
      depositAmount: total,
      paymentStatus: 'fully_paid',
      updatedAt: new Date().toISOString(),
    };

    // Optimistically update state immediately
    setBookings(prev => prev.map(b => String(b.id) === String(bookingId) ? updatedBooking : b));

    confetti({
      particleCount: 70,
      spread: 60,
      origin: { y: 0.6 }
    });

    showToast(`🟢 ההזמנה של ${updatedBooking.dogName} סומנה כשולמה במלואו וסונכרנה`);
    await saveBookingToDb(updatedBooking);
  };

  // Grow Payments Acceptance Handler
  const handleAcceptGrowPayment = (payment: GrowIncomingPayment) => {
    setActiveGrowPayment(payment);
    const methodStr = (payment.payment_method || '').toLowerCase();
    const payMethod: PaymentMethod = methodStr.includes('bit') 
      ? 'bit' 
      : methodStr.includes('paybox') 
      ? 'paybox' 
      : 'credit';

    setBookingWizardOpen({
      isOpen: true,
      initialData: {
        ownerName: payment.customer_name,
        ownerPhone: payment.customer_phone,
        ownerEmail: payment.customer_email || '',
        depositAmount: payment.amount,
        totalPrice: payment.amount,
        paymentStatus: 'deposit_paid',
        paymentMethod: payMethod,
        notes: `עסקת Grow (אסמכתא: ${payment.reference_id})`,
      }
    });
  };

  // Grow Payment Dismissal
  const handleDismissGrowPayment = async (payment: GrowIncomingPayment) => {
    await updateGrowPaymentStatus(payment.id, 'dismissed');
    setPendingGrowPayments(prev => prev.filter(p => p.id !== payment.id));
    showToast('תשלום הוסר מההמתנה');
  };

  // Record partial / custom payment
  const handleSavePayment = async (bookingId: string, addedAmount: number, method: PaymentMethod, notes?: string) => {
    const match = bookings.find(b => String(b.id) === String(bookingId));
    if (!match) return;

    const currentDeposit = Number(match.depositAmount) || 0;
    const totalPrice = Number(match.totalPrice) || 0;
    const newDeposit = currentDeposit + addedAmount;
    const isFull = newDeposit >= totalPrice;

    const updatedBooking: Booking = {
      ...match,
      depositAmount: newDeposit,
      paymentStatus: isFull ? 'fully_paid' : 'deposit_paid',
      paymentMethod: method,
      notes: notes ? `${match.notes ? match.notes + ' | ' : ''}תשלום ₪${addedAmount} (${method})` : match.notes,
      updatedAt: new Date().toISOString(),
    };

    setBookings(prev => prev.map(b => String(b.id) === String(bookingId) ? updatedBooking : b));

    if (isFull) {
      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.6 }
      });
      showToast(`🟢 יתרת החוב של ${updatedBooking.dogName} שולמה במלואה!`);
    } else {
      showToast(`💳 תשלום ע״ס ₪${addedAmount} נרשם וסונכרן לענן`);
    }

    await saveBookingToDb(updatedBooking);
  };

  // Save from BookingFormModal (Add / Edit)
  const handleSaveBookingForm = async (booking: Booking) => {
    // Instant optimistic state update
    setBookings(prev => {
      const exists = prev.some(b => b.id === booking.id);
      if (exists) {
        return prev.map(b => b.id === booking.id ? booking : b);
      }
      return [...prev, booking];
    });
    setBookingFormModal({ isOpen: false, initialData: null });
    showToast(`💾 ההזמנה של ${booking.dogName} נשמרה וסונכרנה בענן`);
    await saveBookingToDb(booking);
  };

  // Delete / Cancel Booking with ExtremeChange confirmation
  const handleDeleteBooking = async (bookingId: string) => {
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) return;

    setAppExtremeModal({
      isOpen: true,
      title: '🗑️ אישור מחיקת כל ההזמנה מכל הימים',
      description: `האם אתה בטוח שברצונך למחוק את כל ההזמנה של הכלב "${booking.dogName}" (הבעלים: ${booking.ownerName})? פעולה זו תמחק לחלוטין את השהות מכל הימים ביומן (${booking.startDate} עד ${booking.endDate}) ומהענן.`,
      impacts: [
        { label: 'שם הכלב והבעלים', newValue: `🐾 ${booking.dogName} (${booking.ownerName})` },
        { label: 'תאריכים שנמחקים מכל היומן', newValue: `📅 ${booking.startDate} עד ${booking.endDate}` },
        { label: 'סכום העסקה שמתבטל', newValue: `₪${booking.totalPrice.toLocaleString()}` }
      ],
      severity: 'danger',
      confirmText: 'כן, מחק את כל ההזמנה',
      onConfirm: async () => {
        setAppExtremeModal(prev => ({ ...prev, isOpen: false }));
        setBookings(prev => prev.filter(b => b.id !== bookingId));
        setSelectedDateForDetails(null);
        setBookingFormModal({ isOpen: false, initialData: null });
        await deleteBookingFromDb(bookingId);
        showToast(`🗑️ כל ההזמנה של ${booking.dogName} נמחקה מכל הימים ביומן ומהענן`);
      }
    });
  };

  // Toggle Stay Status (Check-in / Check-out)
  const handleToggleStayStatus = async (bookingId: string, newStatus: Booking['stayStatus']) => {
    const booking = bookings.find(b => b.id === bookingId);
    if (booking) {
      const updated: Booking = {
        ...booking,
        stayStatus: newStatus,
        updatedAt: new Date().toISOString()
      };

      // Instant optimistic state update
      setBookings(prev => prev.map(b => b.id === bookingId ? updated : b));

      if (newStatus === 'checked_in') showToast('🐾 נקלט בהצלחה בריזורט');
      if (newStatus === 'checked_out') showToast('🏡 שוחרר הביתה בהצלחה');

      await saveBookingToDb(updated);
    }
  };

  // Clear all bookings
  const handleClearAllData = async () => {
    setBookings([]);
    setSelectedDateForDetails(null);
    setBookingFormModal({ isOpen: false, initialData: null });
    await clearAllBookingsFromDb();
    showToast('🧹 כל הנתונים נמחקו - היומן נקי לחלוטין!');
  };

  // If the client opened the public intake form link (?request=true) or manager opened preview
  if (showPublicIntake) {
    return (
      <PublicIntakePage
        settings={settings}
        onBackToApp={() => setShowPublicIntake(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans p-3 sm:p-6 pb-24 selection:bg-emerald-200">
      
      {/* Centered Main Layout Container matching the user's screenshot */}
      <div className="max-w-6xl mx-auto space-y-4">
        
        {/* Top Header Row */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1 pb-1">
          
          {/* Left Buttons in RTL (top left): + הזמנה חדשה, בקשות קליטה, חוות דעת, משותף, הגדרות */}
          <div className="flex flex-wrap items-center gap-2.5 order-2 sm:order-1">
            <button
              onClick={() => setBookingWizardOpen({ isOpen: true, initialData: null })}
              id="btn-new-booking-top"
              className="bg-[#065f46] hover:bg-[#044e45] active:scale-98 text-white font-bold px-4 py-2.5 rounded-xl text-sm shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <span>+</span>
              <span>הזמנה חדשה</span>
            </button>

            {/* Intake Requests Modal Button */}
            <button
              type="button"
              onClick={() => setIsIntakeModalOpen(true)}
              id="btn-intake-requests-top"
              className="bg-white hover:bg-slate-50 active:scale-98 border border-slate-200 hover:border-emerald-300 text-slate-800 font-bold px-3 py-2 rounded-xl text-xs sm:text-sm shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer relative"
              title="צפייה בבקשות קליטה חדשות מלקוחות, חיוג לתיאום, ושליחת קישור לתשלום"
            >
              <span>📥 בקשות קליטה</span>
              {pendingIntakeCount > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full animate-pulse">
                  {pendingIntakeCount}
                </span>
              )}
            </button>

            {/* Public Intake Link Button */}
            <button
              type="button"
              onClick={() => setShowPublicIntake(true)}
              className="bg-white hover:bg-slate-50 active:scale-98 border border-slate-200 text-slate-600 hover:text-emerald-700 font-semibold px-2.5 py-2 rounded-xl text-xs shadow-2xs flex items-center gap-1 transition-all cursor-pointer"
              title="פתיחת שאלון הקליטה המקוון (אותו שולחים ללקוחות פונים בוואטסאפ)"
            >
              <span>🔗 שאלון קליטה</span>
            </button>

            {/* Notification button for pending review requests (dogs checked out yesterday) */}
            {pendingReviewBookings.length > 0 && (
              <button
                type="button"
                onClick={() => setIsReviewModalDismissed(false)}
                className="bg-amber-50 hover:bg-amber-100 active:scale-98 border border-amber-300 text-amber-900 font-bold px-3 py-1.5 rounded-xl text-xs sm:text-sm shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer animate-pulse"
                title="לחץ לפתיחת בקשת חוות דעת לכלבים שהשתחררו אתמול"
              >
                <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
                <span>⭐ {pendingReviewBookings.length} חוות דעת</span>
              </button>
            )}

            <div className="flex items-center gap-1.5 bg-[#eff6ff] border border-blue-100 text-blue-700 px-3 py-1.5 rounded-full text-xs font-semibold shadow-2xs">
              <span>🔮</span>
              <span>משותף</span>
            </div>

            <button
              onClick={handleOpenSettingsWithAuth}
              id="btn-settings-top"
              className="bg-white hover:bg-slate-50 active:scale-98 border border-slate-200 hover:border-slate-300 text-slate-700 font-bold px-3 py-1.5 rounded-xl text-xs sm:text-sm shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
              title="הגדרות תפוסה, תעריפים, ביט וגיבוי (אישור מנהל)"
            >
              <SettingsIcon className="w-4 h-4 text-emerald-700" />
              <span>⚙️ הגדרות ותעריפים</span>
            </button>
          </div>

          {/* Right Brand Title & Subtitle with Official Resort Logo in RTL */}
          <div className="text-right order-1 sm:order-2 flex items-center justify-end gap-3">
            {/* Official Resort Logo placed to the left in continuation to the line */}
            <img 
              src="/resort-logo.svg" 
              alt="לוגו הריזורט לכלב" 
              className="w-11 h-11 sm:w-13 sm:h-13 object-contain drop-shadow-xs hover:scale-105 transition-transform shrink-0" 
            />
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-[#0f4c3a] tracking-tight flex items-center justify-end gap-2">
                <span>יומן הריזורט לכלב</span>
                <span>🐕</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
                דבר אליי — ואני אנהל את היומן: הזמנות, תשלומים ותפוסה
              </p>
            </div>
          </div>

        </header>

        {/* 5 Metric Stat Cards: תפוסה כללית | פנסיון | אילוף | חוב פתוח | נגבה עד כה (כולן לחיצות לעיון ועריכה) */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          
          {/* Card 1 (Right in RTL): תפוסה כללית */}
          <div 
            onClick={() => setActiveHeaderMetric('occupancy')}
            role="button"
            tabIndex={0}
            className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4 shadow-xs flex flex-col justify-between hover:border-emerald-400 hover:shadow-md cursor-pointer transition-all active:scale-[0.99] group"
            title="לחץ לעיון ועריכת כלבי התפוסה הכללית היום"
          >
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-500 text-right group-hover:text-emerald-700 transition-colors">
                תפוסה כללית
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                totalDogsToday >= settings.maxCapacity 
                  ? 'bg-red-50 text-red-700 border-red-200' 
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
              }`}>
                {Math.round((totalDogsToday / Math.max(1, settings.maxCapacity)) * 100)}% תפוסה
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 my-1 text-right">
              {totalDogsToday} <span className="text-xs font-semibold text-slate-400">/ {settings.maxCapacity}</span>
            </div>
            <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 pt-1 border-t border-slate-50">
              <span className="truncate">{freeSlots > 0 ? `${freeSlots} מקומות פנויים` : 'בתפוסה מלאה'}</span>
              <span className="text-[10px] text-emerald-700 font-bold opacity-80 group-hover:opacity-100 flex items-center gap-0.5">
                עיון ועריכה 🔍
              </span>
            </div>
          </div>

          {/* Card 2: פנסיון */}
          <div 
            onClick={() => setActiveHeaderMetric('boarding')}
            role="button"
            tabIndex={0}
            className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4 shadow-xs flex flex-col justify-between hover:border-sky-400 hover:shadow-md cursor-pointer transition-all active:scale-[0.99] group"
            title="לחץ לעיון ועריכת כלבי הפנסיון והדייקר היום"
          >
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-500 text-right group-hover:text-sky-700 transition-colors">
                פנסיון ומשפחתון
              </div>
              <span className="text-[10px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200">
                🏨 לינת לילה
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 my-1 text-right">
              {boardingToday} <span className="text-xs font-semibold text-slate-400">כלבים</span>
            </div>
            <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 pt-1 border-t border-slate-50">
              <span className="truncate">{boardingToday === 0 ? 'אין כלבים בלינה' : `${boardingToday} בפנסיון היום`}</span>
              <span className="text-[10px] text-sky-700 font-bold opacity-80 group-hover:opacity-100 flex items-center gap-0.5">
                עיון ועריכה 🔍
              </span>
            </div>
          </div>

          {/* Card 3: אילוף (מחולק ל: תהליך אילוף 50 יום | אילוף ביומיות) */}
          <div 
            onClick={() => setActiveHeaderMetric('training')}
            role="button"
            tabIndex={0}
            className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4 shadow-xs flex flex-col justify-between hover:border-purple-400 hover:shadow-md cursor-pointer transition-all active:scale-[0.99] group col-span-2 sm:col-span-1"
            title="לחץ לעיון ועריכת כלבי האילוף היום"
          >
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-500 text-right group-hover:text-purple-700 transition-colors">
                באילוף היום
              </div>
              <span className="text-[10px] font-black text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                סה״כ {trainingToday}
              </span>
            </div>

            {/* Split: תהליך אילוף (50 יום) vs אילוף ביומיות */}
            <div className="grid grid-cols-2 gap-1.5 my-1 pt-0.5 divide-x divide-x-reverse divide-slate-100">
              
              {/* Right Side: תהליך אילוף מלא */}
              <div className="text-right pr-0.5">
                <div className="flex items-baseline gap-1">
                  <span className="text-xl sm:text-2xl font-black text-purple-600">
                    {fullTrainingToday}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">כלבים</span>
                </div>
                <div className="text-[10px] font-bold text-slate-700 truncate">
                  🎓 תהליך אילוף
                </div>
                <div className="text-[9px] text-slate-400 font-medium">
                  (50 יום)
                </div>
              </div>

              {/* Left Side: אילוף ביומיות */}
              <div className="text-right pr-1.5">
                <div className="flex items-baseline gap-1">
                  <span className="text-xl sm:text-2xl font-black text-indigo-600">
                    {dayTrainingToday}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">כלבים</span>
                </div>
                <div className="text-[10px] font-bold text-slate-700 truncate">
                  🦮 אילוף ביומיות
                </div>
                <div className="text-[9px] text-slate-400 font-medium">
                  (ללא לינה)
                </div>
              </div>

            </div>

            <div className="flex items-center justify-between text-[10px] font-medium text-slate-400 pt-1 border-t border-slate-100">
              <span className="truncate">{fullTrainingToday} מלא · {dayTrainingToday} ביומיות</span>
              <span className="text-[10px] text-purple-700 font-bold opacity-80 group-hover:opacity-100 flex items-center gap-0.5">
                עיון ועריכה 🔍
              </span>
            </div>
          </div>

          {/* Card 4: חוב פתוח */}
          <div 
            onClick={() => setActiveHeaderMetric('debt')}
            role="button"
            tabIndex={0}
            className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4 shadow-xs flex flex-col justify-between hover:border-red-400 hover:shadow-md cursor-pointer transition-all active:scale-[0.99] group"
            title="לחץ לעיון ועריכת ההזמנות עם יתרת חוב פתוח"
          >
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-500 text-right group-hover:text-red-700 transition-colors">
                חוב פתוח
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                openDebtTotal === 0
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-red-50 text-red-700 border-red-200'
              }`}>
                {openDebtTotal === 0 ? '🟢 הכול שולם' : `🔴 ${unpaidCount} ממתינות`}
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-[#0f766e] my-1 text-right">
              ₪{openDebtTotal.toLocaleString('he-IL')}
            </div>
            <div className="flex items-center justify-between text-[11px] font-medium text-slate-400 pt-1 border-t border-slate-50">
              <span className="truncate">{openDebtTotal === 0 ? 'הכול שולם 🥳' : `${unpaidCount} הזמנות עם יתרה`}</span>
              <span className="text-[10px] text-red-600 font-bold opacity-80 group-hover:opacity-100 flex items-center gap-0.5">
                עיון ועריכה 🔍
              </span>
            </div>
          </div>

          {/* Card 5 (Left in RTL): נגבה עד כה */}
          <div 
            onClick={() => setActiveHeaderMetric('revenue')}
            role="button"
            tabIndex={0}
            className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4 shadow-xs flex flex-col justify-between hover:border-emerald-400 hover:shadow-md cursor-pointer transition-all active:scale-[0.99] group"
            title="לחץ לעיון בכל התקבולים וההכנסות שנגבו"
          >
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-500 text-right group-hover:text-emerald-700 transition-colors">
                נגבה עד כה
              </div>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                💳 הכנסות
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-[#0f766e] my-1 text-right">
              ₪{totalCollected.toLocaleString('he-IL')}
            </div>
            <div className="flex items-center justify-between text-[11px] font-medium text-slate-400 pt-1 border-t border-slate-50">
              <span className="truncate">סה״כ מקדמות ותשלומים</span>
              <span className="text-[10px] text-emerald-700 font-bold opacity-80 group-hover:opacity-100 flex items-center gap-0.5">
                עיון ועריכה 🔍
              </span>
            </div>
          </div>

        </div>

        {/* Voice & Text Smart Assistant Input Bar */}
        <VoiceAgentBar onProcessCommand={handleAgentProcess} />

        {/* Navigation Tabs Bar (Pills matching image) */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 no-scrollbar">
          
          {/* Left Button in RTL: היום */}
          <button
            onClick={handleJumpToToday}
            className="bg-white hover:bg-emerald-50 border border-emerald-500 text-emerald-700 text-xs sm:text-sm font-bold px-4 py-2 rounded-xl transition-all cursor-pointer shrink-0 shadow-2xs"
          >
            היום
          </button>

          {/* Right Tabs Group in RTL */}
          <div className="flex items-center gap-2 shrink-0">
            
            {/* Tab: גיבוי & הגדרות */}
            <button
              onClick={handleOpenSettingsWithAuth}
              className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs sm:text-sm font-bold px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              <span>💾</span>
              <span>גיבוי</span>
            </button>

            {/* Tab: דוחות */}
            <button
              onClick={() => setIsReportsOpen(true)}
              className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs sm:text-sm font-bold px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
            >
              <span>💰</span>
              <span>דוחות</span>
            </button>

            {/* Tab: לקוחות */}
            <button
              onClick={() => setActiveTab('customers')}
              className={`text-xs sm:text-sm font-bold px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs ${
                activeTab === 'customers'
                  ? 'bg-[#065f46] text-white border border-[#065f46]'
                  : 'bg-white hover:bg-slate-100 border border-slate-200 text-slate-700'
              }`}
            >
              <span>⭐</span>
              <span>לקוחות</span>
            </button>

            {/* Tab: הזמנות */}
            <button
              onClick={() => setActiveTab('bookings')}
              className={`text-xs sm:text-sm font-bold px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs ${
                activeTab === 'bookings'
                  ? 'bg-[#065f46] text-white border border-[#065f46]'
                  : 'bg-white hover:bg-slate-100 border border-slate-200 text-slate-700'
              }`}
            >
              <span>📋</span>
              <span>הזמנות ({activeBookings.length})</span>
            </button>

            {/* Tab: תפוסה */}
            <button
              onClick={() => setActiveTab('forecast')}
              className={`text-xs sm:text-sm font-bold px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs ${
                activeTab === 'forecast'
                  ? 'bg-[#065f46] text-white border border-[#065f46]'
                  : 'bg-white hover:bg-slate-100 border border-slate-200 text-slate-700'
              }`}
            >
              <span>📊</span>
              <span>תפוסה</span>
            </button>

            {/* Tab: יומן */}
            <button
              onClick={() => setActiveTab('calendar')}
              className={`text-xs sm:text-sm font-bold px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs ${
                activeTab === 'calendar'
                  ? 'bg-[#065f46] text-white border border-[#065f46]'
                  : 'bg-white hover:bg-slate-100 border border-slate-200 text-slate-700'
              }`}
            >
              <span>📅</span>
              <span>יומן</span>
            </button>

          </div>
        </div>

        {/* Active View Container */}
        <main className="transition-all">
          {activeTab === 'calendar' && (
            <CalendarView
              bookings={bookings}
              settings={settings}
              currentYear={currentYear}
              currentMonth={currentMonth}
              onPrevMonth={handlePrevMonth}
              onNextMonth={handleNextMonth}
              onSetMonth={(m) => setCurrentMonth(m)}
              onSetYear={(y) => setCurrentYear(y)}
              onJumpToToday={handleJumpToToday}
              onSelectDate={(dStr) => setSelectedDateForDetails(dStr)}
              onSelectBooking={(b) => setSelectedDateForDetails(b.startDate)}
              onNewBookingForDate={(dStr) => {
                setBookingWizardOpen({
                  isOpen: true,
                  initialData: { startDate: dStr, endDate: addDays(dStr, 3) },
                });
              }}
            />
          )}

          {activeTab === 'forecast' && (
            <OccupancyForecast
              bookings={bookings}
              settings={settings}
              onSelectDate={(dStr) => setSelectedDateForDetails(dStr)}
              onNewBookingForDate={(dStr) => {
                setBookingWizardOpen({
                  isOpen: true,
                  initialData: { startDate: dStr, endDate: addDays(dStr, 3) },
                });
              }}
            />
          )}

          {activeTab === 'bookings' && (
            <BookingsList
              bookings={bookings}
              settings={settings}
              onSelectBooking={(b) => setSelectedDateForDetails(b.startDate)}
              onOpenPaymentModal={(b) => setPaymentModalBooking(b)}
              onMarkAsPaid={handleMarkAsPaid}
              onEditBooking={(b) => setBookingFormModal({ isOpen: true, initialData: b })}
              onDeleteBooking={handleDeleteBooking}
              onOpenNewBooking={() => setBookingWizardOpen({ isOpen: true, initialData: null })}
            />
          )}

          {activeTab === 'customers' && (
            <CustomersView
              bookings={bookings}
              settings={settings}
              onSelectBooking={(b) => setSelectedDateForDetails(b.startDate)}
              onNewBookingForCustomer={(customer) => {
                const firstDog = customer.dogs[0];
                setBookingWizardOpen({
                  isOpen: true,
                  initialData: {
                    ownerName: customer.name,
                    ownerPhone: customer.phone,
                    ownerEmail: customer.email,
                    dogName: firstDog?.name || '',
                    dogBreed: firstDog?.breed || '',
                  },
                });
              }}
            />
          )}
        </main>

        {/* Bottom Voice & Typing Bar matching image */}
        <footer className="pt-2">
          <VoiceAgentBar
            onProcessCommand={handleAgentProcess}
          />
        </footer>

      </div>

      {/* Modals & Dialogs */}
      {selectedDateForDetails && (
        <DayDetailsModal
          dateStr={selectedDateForDetails}
          bookings={bookings}
          settings={settings}
          onClose={() => setSelectedDateForDetails(null)}
          onSelectBooking={(booking) => {
            setSelectedDateForDetails(null);
            setBookingFormModal({ isOpen: true, initialData: booking });
          }}
          onNewBookingForDate={(date) => {
            setSelectedDateForDetails(null);
            setBookingWizardOpen({
              isOpen: true,
              initialData: { startDate: date, endDate: addDays(date, 3) },
            });
          }}
          onMarkAsPaid={handleMarkAsPaid}
          onDeleteBooking={handleDeleteBooking}
          onOpenPaymentModal={(b) => {
            setSelectedDateForDetails(null);
            setPaymentModalBooking(b);
          }}
          onToggleStayStatus={handleToggleStayStatus}
        />
      )}

      {agentProposal && (
        <AgentActionModal
          proposal={agentProposal}
          settings={settings}
          onConfirm={handleConfirmProposal}
          onClose={() => setAgentProposal(null)}
          onEditManually={(partialBooking) => {
            setAgentProposal(null);
            setBookingWizardOpen({ isOpen: true, initialData: partialBooking });
          }}
        />
      )}

      {/* Grow Incoming Payments Popup / Notification for Shmulik */}
      {!bookingWizardOpen.isOpen && pendingGrowPayments.length > 0 && (
        <GrowPaymentsModal
          pendingPayments={pendingGrowPayments}
          onAccept={handleAcceptGrowPayment}
          onDismiss={handleDismissGrowPayment}
        />
      )}

      {/* 4-Step Intuitive Booking Wizard matching the video */}
      {bookingWizardOpen.isOpen && (
        <SimpleBookingWizard
          isOpen={bookingWizardOpen.isOpen}
          initialData={bookingWizardOpen.initialData}
          existingBookings={bookings}
          settings={settings}
          onClose={() => {
            setBookingWizardOpen({ isOpen: false, initialData: null });
            setActiveGrowPayment(null);
          }}
          onSave={async (newBooking) => {
            setBookings(prev => {
              const exists = prev.some(b => b.id === newBooking.id);
              if (exists) {
                return prev.map(b => b.id === newBooking.id ? newBooking : b);
              }
              return [...prev, newBooking];
            });

            // If this booking came from a Grow payment, mark the payment completed
            if (activeGrowPayment) {
              await updateGrowPaymentStatus(activeGrowPayment.id, 'completed');
              setPendingGrowPayments(prev => prev.filter(p => p.id !== activeGrowPayment.id));
              setActiveGrowPayment(null);
            }

            showToast(`💾 ההזמנה של ${newBooking.dogName} נשמרה וסונכרנה בענן`);
            await saveBookingToDb(newBooking);
          }}
        />
      )}

      {/* Direct Full Form Modal (For editing existing records) */}
      {bookingFormModal.isOpen && (
        <BookingFormModal
          initialData={bookingFormModal.initialData}
          existingBookings={bookings}
          settings={settings}
          onClose={() => setBookingFormModal({ isOpen: false, initialData: null })}
          onSave={handleSaveBookingForm}
          onDeleteBooking={handleDeleteBooking}
        />
      )}

      {paymentModalBooking && (
        <PaymentModal
          booking={paymentModalBooking}
          settings={settings}
          onClose={() => setPaymentModalBooking(null)}
          onSavePayment={(bookingId, amount, method, notes) => {
            handleSavePayment(bookingId, amount, method, notes);
            setPaymentModalBooking(null);
          }}
        />
      )}

      {isSettingsOpen && (
        <SettingsModal
          settings={settings}
          bookings={bookings}
          onClose={() => setIsSettingsOpen(false)}
          onSaveSettings={async (newSettings) => {
            setSettings(newSettings);
            await saveSettingsToDb(newSettings);
            showToast('⚙️ הגדרות הריזורט עודכנו וסונכרנו בענן');
          }}
          onRestoreBookings={async (imported) => {
            await batchRestoreToDb(imported);
            showToast('💾 הנתונים שוחזרו וסונכרנו בענן');
          }}
          onClearAllData={handleClearAllData}
        />
      )}

      {isReportsOpen && (
        <ReportsModal
          bookings={bookings}
          settings={settings}
          onClose={() => setIsReportsOpen(false)}
        />
      )}

      {isGuideOpen && (
        <Guide 
          settings={settings}
          onClose={() => setIsGuideOpen(false)}
          onTryPrompt={(promptText) => {
            setIsGuideOpen(false);
            handleAgentProcess(promptText);
          }}
        />
      )}

      {/* Review Request Modal (The day after a dog is checked out) */}
      {!isReviewModalDismissed && pendingReviewBookings.length > 0 && (
        <ReviewRequestModal
          pendingBookings={pendingReviewBookings}
          onClose={() => setIsReviewModalDismissed(true)}
          onHandled={handleReviewHandled}
        />
      )}

      {/* Header Metric Drill-down & Edit Modal */}
      {activeHeaderMetric && (
        <HeaderMetricModal
          metricType={activeHeaderMetric}
          bookings={bookings}
          settings={settings}
          onClose={() => setActiveHeaderMetric(null)}
          onEditBooking={(booking) => {
            setActiveHeaderMetric(null);
            setBookingFormModal({ isOpen: true, initialData: booking });
          }}
          onMarkAsPaid={handleMarkAsPaid}
          onOpenPaymentModal={(booking) => {
            setActiveHeaderMetric(null);
            setPaymentModalBooking(booking);
          }}
          onToggleStayStatus={handleToggleStayStatus}
        />
      )}

      {/* Intake Requests Modal (Client Online Inquiries) */}
      {isIntakeModalOpen && (
        <IntakeRequestsModal
          requests={intakeRequests}
          settings={settings}
          onClose={() => setIsIntakeModalOpen(false)}
          onUpdateStatus={async (id, status, notes) => {
            await updateIntakeRequestStatusInDb(id, status, notes);
            showToast('סטטוס בקשת הקליטה עודכן');
          }}
          onApproveAndBook={async (req) => {
            setBookingWizardOpen({
              isOpen: true,
              initialData: {
                dogName: req.dogName,
                dogBreed: req.dogBreed,
                ownerName: req.ownerName,
                ownerPhone: req.ownerPhone,
                ownerEmail: req.ownerEmail,
                serviceType: req.serviceType,
                startDate: req.startDate,
                endDate: req.endDate,
                vaccinationValid: req.isVaccinated,
                notes: [req.specialNeeds, req.notes].filter(Boolean).join(' | '),
                depositAmount: req.depositRequested || 0,
                paymentStatus: req.depositRequested ? 'deposit_paid' : 'fully_paid',
                stayStatus: 'booked'
              }
            });
            await updateIntakeRequestStatusInDb(req.id, 'approved');
            setIsIntakeModalOpen(false);
          }}
          onDeleteRequest={async (id) => {
            await deleteIntakeRequestFromDb(id);
            showToast('בקשת הקליטה הוסרה');
          }}
        />
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl text-xs sm:text-sm font-bold flex items-center gap-2 border border-slate-800 animate-bounce">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Global Extreme Change Alert Modal */}
      <ExtremeChangeModal
        isOpen={appExtremeModal.isOpen}
        title={appExtremeModal.title}
        description={appExtremeModal.description}
        impacts={appExtremeModal.impacts}
        severity={appExtremeModal.severity}
        confirmText={appExtremeModal.confirmText}
        onConfirm={appExtremeModal.onConfirm}
        onCancel={() => setAppExtremeModal(prev => ({ ...prev, isOpen: false }))}
      />

      {/* Manager Authentication Modal (PIN 3466) */}
      <ManagerAuthModal
        isOpen={isManagerAuthOpen}
        title={managerAuthContext.title}
        description={managerAuthContext.description}
        onSuccess={() => {
          setIsManagerAuthOpen(false);
          if (managerAuthContext.onSuccess) {
            managerAuthContext.onSuccess();
          } else if (managerAuthContext.actionType === 'open_settings') {
            setIsSettingsOpen(true);
          }
        }}
        onClose={() => setIsManagerAuthOpen(false)}
      />

    </div>
  );
}
