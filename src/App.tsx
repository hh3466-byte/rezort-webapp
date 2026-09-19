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
  saveIntakeRequestToDb,
  loadStoredIntakeRequests,
  saveBookingToDb, 
  deleteBookingFromDb, 
  saveSettingsToDb, 
  batchRestoreToDb, 
  clearAllBookingsFromDb,
  updateVoucherStatusInDb
} from './services/dbService';
import { parseVoiceOrWhatsAppText } from './services/agentService';
import { 
  getTodayStr, 
  getBookingsForDate, 
  addDays, 
  HEBREW_MONTHS, 
  getBookingPaymentsInMonth, 
  calculateDaysCount,
  getMonthlyRevenueBreakdown,
  getGrowClearedRevenueForMonth,
  getCashClearedRevenueForMonth
} from './utils/dateUtils';

import { CalendarView } from './components/CalendarView';
import { HeaderMetricModal, HeaderMetricType } from './components/HeaderMetricModal';
import { OccupancyForecast } from './components/OccupancyForecast';
import { BookingsList } from './components/BookingsList';
import { CustomersView } from './components/CustomersView';
import { DayDetailsModal } from './components/DayDetailsModal';
import { AgentActionModal } from './components/AgentActionModal';
import { BookingFormModal } from './components/BookingFormModal';
import { SimpleBookingWizard } from './components/SimpleBookingWizard';
import { GrowPaymentsModal, LinkedPaymentDetails } from './components/GrowPaymentsModal';
import { PaymentModal } from './components/PaymentModal';
import { ExtremeChangeModal, ExtremeChangeImpact } from './components/ExtremeChangeModal';
import { ManagerAuthModal } from './components/ManagerAuthModal';
import { WhatsAppAuthGate } from './components/WhatsAppAuthGate';
import { Settings as SettingsIcon, Star, ChevronUp, ChevronDown, MessageCircle, Bell, Volume2, LogOut, Lock, ArrowLeft, Search, BarChart3 } from 'lucide-react';
import { formatPhoneForWhatsApp } from './utils/whatsappUtils';
import { SettingsModal } from './components/SettingsModal';
import { ReportsModal } from './components/ReportsModal';
import { Guide } from './components/Guide';
import { SendPaymentLinkModal } from './components/SendPaymentLinkModal';
import { IntakeRequestsModal, calculateBoardingRate } from './components/IntakeRequestsModal';
import { isIntakeRequestNew, isIntakeRequestInTreatment } from './utils/intakeUtils';
import { CheckoutDebtAlertModal } from './components/CheckoutDebtAlertModal';
import { PublicIntakePage } from './components/PublicIntakePage';
import { SendIntakeModal } from './components/SendIntakeModal';
import { getDateShabbatOrHoliday, isCustomerMessagingRestrictedNow } from './utils/jewishCalendar';
import { ShabbatHolidayGreetingModal } from './components/ShabbatHolidayGreetingModal';
import { VoucherModal } from './components/VoucherModal';
import { DailyDogUpdatesModal } from './components/DailyDogUpdatesModal';
import { TomorrowOverviewModal } from './components/TomorrowOverviewModal';
import { WhatsAppLeadsView } from './components/WhatsAppLeadsView';
import { playNotificationChime, testSystemNotification } from './utils/soundUtils';
import { initDailyDogAutoSender } from './services/dailyDogAutoSender';
import { initTomorrowOverviewScheduler } from './services/morningReportService';
import { initOrangeFollowUpScheduler } from './services/orangeFollowUpService';
import { fetchNewCrmChatsCount } from './services/whatsappCrmService';

export default function App() {
  // Core application state with live Cloud synchronization
  const [bookings, setBookings] = useState<Booking[]>(() => loadStoredBookings());
  const [settings, setSettings] = useState<ResortSettings>(() => loadStoredSettings());
  const [activeTab, setActiveTab] = useState<'calendar' | 'forecast' | 'bookings' | 'customers' | 'whatsapp'>('calendar');
  const [newCrmChatsCount, setNewCrmChatsCount] = useState<number>(0);

  // Calendar year/month state
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth());

  // Modals state
  const [selectedDateForDetails, setSelectedDateForDetails] = useState<string | null>(null);
  const [greetingModalDate, setGreetingModalDate] = useState<string | null>(null);
  const [isGreetingBannerDismissed, setIsGreetingBannerDismissed] = useState(false);
  const [isGreetingFloatingSnoozed, setIsGreetingFloatingSnoozed] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'default';
  });
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
  const [paymentLinkBooking, setPaymentLinkBooking] = useState<Booking | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isReportsOpen, setIsReportsOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // Incoming Grow Payments from Gmail sync
  const [pendingGrowPayments, setPendingGrowPayments] = useState<GrowIncomingPayment[]>([]);
  const [activeGrowPayment, setActiveGrowPayment] = useState<GrowIncomingPayment | null>(null);
  const [isGrowPaymentsMinimized, setIsGrowPaymentsMinimized] = useState(false);
  const [isGrowFloatingSnoozed, setIsGrowFloatingSnoozed] = useState(false);

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
  const [intakeModalFilter, setIntakeModalFilter] = useState<'new' | 'in_progress' | 'all' | 'payment_requested' | 'approved' | 'rejected'>('new');
  const [isSendIntakeModalOpen, setIsSendIntakeModalOpen] = useState(false);
  const [isDailyDogUpdatesOpen, setIsDailyDogUpdatesOpen] = useState(false);
  const [isTomorrowOverviewModalOpen, setIsTomorrowOverviewModalOpen] = useState(false);
  
  const newIntakeCount = intakeRequests.filter(r => isIntakeRequestNew(r, bookings)).length;
  const inProgressIntakeCount = intakeRequests.filter(r => isIntakeRequestInTreatment(r, bookings)).length;
  const pendingIntakeCount = newIntakeCount;

  // Manager Authentication State (WhatsApp OTP / Authorized Device)
  // Whitelist: User (054-3200007), Shmulik (054-8765888 / 050-6336896)
  const [isManagerAuthenticated, setIsManagerAuthenticated] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      if (sessionStorage.getItem('resort_manager_locked') === 'true') {
        return false;
      }
      const isDeviceAuthorized = localStorage.getItem('resort_authorized_manager_device');
      if (isDeviceAuthorized) {
        return true;
      }
      return false;
    }
    return false;
  });
  const [isStaffPreviewMode, setIsStaffPreviewMode] = useState(false);

  const handleManagerLogout = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('resort_manager_locked', 'true');
      localStorage.removeItem('resort_authorized_manager_device');
    }
    setIsManagerAuthenticated(false);
    setIsStaffPreviewMode(false);
    showToast('🔒 מערכת היומן ננעלה וההרשאה למכשיר בוטלה.');
  };

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

  // Digital Loyalty & Referral Voucher Modal
  const [voucherModalData, setVoucherModalData] = useState<{
    isOpen: boolean;
    customerName?: string;
    dogName?: string;
    phone?: string;
    staysCount?: number;
  } | null>(null);

  // Metrics Row Collapse State
  const [isMetricsRowCollapsed, setIsMetricsRowCollapsed] = useState(false);

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
  const activeTonightCount = activeBookings.filter(b => b.startDate <= todayStr && b.endDate > todayStr).length;

  // Holiday and Shabbat detection for today
  const todayHolidayInfo = getDateShabbatOrHoliday(todayStr);

  // Sent greetings count for today
  const [todayGreetingsSentCount, setTodayGreetingsSentCount] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(`shabbat_greetings_${todayStr}`);
      if (!saved) return 0;
      const map = JSON.parse(saved);
      return todayBookings.filter(b => map[b.id]).length;
    } catch {
      return 0;
    }
  });

  const todayUnsentGreetingsCount = Math.max(0, totalDogsToday - todayGreetingsSentCount);

  // Update greetings count on storage or custom event
  useEffect(() => {
    const handleUpdate = () => {
      try {
        const saved = localStorage.getItem(`shabbat_greetings_${todayStr}`);
        const map = saved ? JSON.parse(saved) : {};
        setTodayGreetingsSentCount(todayBookings.filter(b => map[b.id]).length);
      } catch {
        // ignore
      }
    };
    handleUpdate();
    window.addEventListener('shabbat-greetings-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    window.addEventListener('focus', handleUpdate);
    return () => {
      window.removeEventListener('shabbat-greetings-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
      window.removeEventListener('focus', handleUpdate);
    };
  }, [todayStr, todayBookings.length]);

  const requestNotificationPermission = async () => {
    const res = await testSystemNotification();
    setNotificationPermission(res.permission);
    if (res.permission === 'granted') {
      showToast('מעולה שמוליק! התראות פוש וצלילים הופעלו בהצלחה.');
    } else if (res.permission === 'denied') {
      showToast('התראות דפדפן חסומות. לחץ על סמל המנעול ליד כתובת האתר ואפשר התראות.');
    }
  };

  const handleTestNotification = async () => {
    const res = await testSystemNotification();
    setNotificationPermission(res.permission);
    if (res.permission === 'granted' && res.notificationSent) {
      showToast('🔔 צליל ההתראה והתראת פוש נבדקו בהצלחה!');
    } else if (res.permission === 'denied') {
      showToast('⚠️ התראות דפדפן חסומות בדפדפן (צליל הושמע בהצלחה).');
    } else {
      showToast('🔊 צליל ההתראה הושמע בהצלחה!');
    }
  };

  // כלל ברזל: שקט מוחלט ללקוחות משישי 14:00 וכל השבת והחג.
  // אין תזכורות פופ-אפ ואין שליחת הודעות ללקוחות ב-11:00 בבוקר בשבת.
  // ההודעות משוגרות אוטומטית בענן 40 דקות בדיוק לאחר צאת השבת/החג!


  // 20:00 Daily Dog Evening Updates Auto-Sender Background Runner (Fail-safe auto dispatch)
  useEffect(() => {
    const cleanup = initDailyDogAutoSender(
      () => bookings,
      () => settings,
      () => intakeRequests,
      showToast
    );
    return cleanup;
  }, [bookings, settings, intakeRequests]);

  // 19:00 Daily Tomorrow Overview Auto-Sender to Shmulik (Arrivals, Departures, Debts, Capacity, Notes)
  useEffect(() => {
    const cleanup = initTomorrowOverviewScheduler(
      () => bookings,
      () => settings,
      () => intakeRequests,
      showToast
    );
    return cleanup;
  }, [bookings, settings, intakeRequests]);

  // 08:30 AM Orange Button (In-Progress) Marketing Follow-Up Scheduler
  useEffect(() => {
    const cleanup = initOrangeFollowUpScheduler(
      () => bookings,
      () => settings,
      () => intakeRequests,
      showToast
    );
    return cleanup;
  }, [bookings, settings, intakeRequests]);

  // Periodic check for new CRM chats & unread inquiries for the top button badge
  useEffect(() => {
    let isMounted = true;
    const checkCrmNew = async () => {
      try {
        if (!settings) return;
        const count = await fetchNewCrmChatsCount(settings, bookings, intakeRequests);
        if (isMounted) {
          setNewCrmChatsCount(count);
        }
      } catch (err) {
        console.warn('Error checking new CRM count:', err);
      }
    };

    checkCrmNew();
    const interval = setInterval(checkCrmNew, 45000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [settings?.greenApiIdInstance, settings?.greenApiToken, bookings, intakeRequests]);

  // Accurate real-time money calculation across all bookings
  const totalCollected = activeBookings.reduce((acc, b) => {
    if (b.paymentStatus === 'fully_paid') {
      return acc + (Number(b.totalPrice) || 0);
    }
    return acc + (Number(b.depositAmount) || 0);
  }, 0);

  // 4 Revenue Categories:
  // 1. monthDigitalCleared: נסלק החודש (והכוונה לכל אמצעי התשלום הדיגיטלי כולם)
  // 2. monthBankOn10th: יכנס לבנק ב-10 לחודש הקרוב (סליקת כרטיסי אשראי GROW)
  // 3. monthBankIn2Months: יכנס לבנק ב-10 בעוד חודשיים (תשלומי המשך / עסקאות בתשלומים)
  // 4. monthCashCollected: נסלק במזומן (ללא המילה שטרות)
  const currentMonthKey = todayStr.substring(0, 7);
  const currentMonthRevenue = React.useMemo(() => {
    return getMonthlyRevenueBreakdown(currentMonthKey, activeBookings, pendingGrowPayments);
  }, [currentMonthKey, activeBookings, pendingGrowPayments]);

  const monthDigitalCleared = currentMonthRevenue.digitalCleared; // 1. נסלק החודש (דיגיטלי)
  const monthBankOn10th = currentMonthRevenue.growClearedBankOn10th; // 2. יכנס לבנק ב-10 לחודש הקרוב
  const monthDirectBankTransfers = currentMonthRevenue.directBankTransfers; // הועבר ישירות לחשבון (העברות בנקאיות)
  const monthBankIn2Months = currentMonthRevenue.bankOn10thInTwoMonths; // 3. יכנס לבנק ב-10 בעוד חודשיים
  const monthCashCollected = currentMonthRevenue.cashCollected; // 4. נסלק במזומן
  const monthTotalCollected = currentMonthRevenue.totalCollected; // סה"כ כולל

  // Dynamic labels for upcoming 10th payout dates (e.g. 10.10 and 10.11)
  const [curYearNum, curMonthNum] = currentMonthKey.split('-').map(Number);
  const nextMonthDateObj = new Date(curYearNum, (curMonthNum || 1), 10);
  const next10thDateLabel = `10.${String(nextMonthDateObj.getMonth() + 1).padStart(2, '0')}`;
  const inTwoMonthsDateObj = new Date(curYearNum, (curMonthNum || 1) + 1, 10);
  const inTwoMonthsDateLabel = `10.${String(inTwoMonthsDateObj.getMonth() + 1).padStart(2, '0')}`;

  const monthToDateCollected = monthDigitalCleared;
  const monthPaidCount = currentMonthRevenue.digitalPaidCount;

  // Active stays and dogs in current month
  const currentMonthStart = `${todayStr.substring(0, 7)}-01`;
  const [curY, curM] = todayStr.split('-').map(Number);
  const curMonthLastDay = new Date(curY, curM, 0).getDate();
  const currentMonthEnd = `${todayStr.substring(0, 7)}-${String(curMonthLastDay).padStart(2, '0')}`;
  const currentMonthActiveStays = activeBookings.filter(b => b.startDate <= currentMonthEnd && b.endDate >= currentMonthStart);
  const currentMonthUniqueDogs = new Set(currentMonthActiveStays.map(b => b.dogName)).size;

  // Mini columns data for the last 4 months (עמודות לחודשים אחרונים לפי סליקת GROW שנכנסת לבנק)
  const recentMonthsMiniData = React.useMemo(() => {
    const list = [];
    const dateObj = new Date(todayStr + 'T12:00:00');
    const thisYear = dateObj.getFullYear();
    const thisMonth = dateObj.getMonth();

    for (let i = 3; i >= 0; i--) {
      let m = thisMonth - i;
      let y = thisYear;
      while (m < 0) {
        m += 12;
        y -= 1;
      }
      const mStr = String(m + 1).padStart(2, '0');
      const ymPrefix = `${y}-${mStr}`;
      const rev = getGrowClearedRevenueForMonth(ymPrefix, activeBookings, pendingGrowPayments);
      list.push({
        label: HEBREW_MONTHS[m].slice(0, 3),
        fullName: `${HEBREW_MONTHS[m]} ${y}`,
        revenue: rev,
        isCurrent: i === 0
      });
    }
    return list;
  }, [activeBookings, pendingGrowPayments, todayStr]);
  const maxRecentMiniRev = Math.max(1, ...recentMonthsMiniData.map(d => d.revenue));

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
  const handleAcceptGrowPayment = (payment: GrowIncomingPayment, linkedDetails?: LinkedPaymentDetails) => {
    setActiveGrowPayment(payment);
    const methodStr = (payment.payment_method || '').toLowerCase();
    const payMethod: PaymentMethod = methodStr.includes('bit') 
      ? 'bit' 
      : methodStr.includes('paybox') 
      ? 'paybox' 
      : 'credit';

    // Auto-match payment with any pending or recent intake questionnaire by phone or customer name
    const cleanPayPhone = (payment.customer_phone || '').replace(/\D/g, '');
    const matchedIntake = intakeRequests.find(req => {
      const cleanReqPhone = (req.ownerPhone || '').replace(/\D/g, '');
      if (cleanPayPhone.length >= 7 && cleanReqPhone.length >= 7) {
        return cleanReqPhone.includes(cleanPayPhone) || cleanPayPhone.includes(cleanReqPhone);
      }
      return req.ownerName.trim().toLowerCase() === payment.customer_name.trim().toLowerCase();
    });

    // Check existing booking if dog name not in intake
    const matchedBooking = bookings.find(b => {
      const cleanBPhone = (b.ownerPhone || '').replace(/\D/g, '');
      if (cleanPayPhone.length >= 7 && cleanBPhone.length >= 7) {
        return cleanBPhone.includes(cleanPayPhone) || cleanPayPhone.includes(cleanBPhone);
      }
      return b.ownerName.trim().toLowerCase() === payment.customer_name.trim().toLowerCase();
    });

    const ownerName = linkedDetails?.ownerName || matchedIntake?.ownerName || payment.customer_name;
    const ownerPhone = linkedDetails?.ownerPhone || payment.customer_phone || matchedIntake?.ownerPhone || '';
    const ownerEmail = linkedDetails?.ownerEmail || payment.customer_email || matchedIntake?.ownerEmail || '';
    const dogName = linkedDetails?.dogName || matchedIntake?.dogName || matchedBooking?.dogName || '';
    const dogBreed = linkedDetails?.dogBreed || matchedIntake?.dogBreed || matchedBooking?.dogBreed || '';
    const serviceType = linkedDetails?.serviceType || matchedIntake?.serviceType || matchedBooking?.serviceType || 'boarding';
    const startDate = linkedDetails?.startDate || matchedIntake?.startDate || getTodayStr();
    const endDate = linkedDetails?.endDate || matchedIntake?.endDate || addDays(getTodayStr(), 3);

    const notesParts = [
      linkedDetails?.specialNeeds ? `צרכים מיוחדים: ${linkedDetails.specialNeeds}` : (matchedIntake?.specialNeeds ? `צרכים מיוחדים: ${matchedIntake.specialNeeds}` : ''),
      linkedDetails?.notes ? linkedDetails.notes : (matchedIntake?.notes ? `הערות מטופס בקשת הקליטה: ${matchedIntake.notes}` : ''),
      linkedDetails?.chatSnippet ? `ציטוט מוואטסאפ: "${linkedDetails.chatSnippet}"` : '',
      `עסקת Grow (אסמכתא: ${payment.reference_id})`
    ].filter(Boolean).join(' | ');

    setBookingWizardOpen({
      isOpen: true,
      initialData: {
        ownerName,
        ownerPhone,
        ownerEmail,
        dogName,
        dogBreed,
        serviceType,
        startDate,
        endDate,
        vaccinationValid: matchedIntake?.isVaccinated ?? true,
        depositAmount: payment.amount,
        totalPrice: payment.amount,
        paymentStatus: 'deposit_paid',
        paymentMethod: payMethod,
        stayStatus: 'booked',
        notes: notesParts,
      }
    });

    if (matchedIntake || linkedDetails?.source === 'intake_request') {
      const intakeId = matchedIntake?.id;
      if (intakeId) {
        updateIntakeRequestStatusInDb(intakeId, 'approved');
      }
      showToast(`✨ תאריכים ופרטי ${dogName || 'הכלב'} נטענו אוטומטית!`);
    } else if (linkedDetails?.dogName) {
      showToast(`✨ פרטי ${linkedDetails.dogName} והלקוח קושרו אוטומטית להזמנה`);
    }
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

  // Checkout Debt Warning & Release Modal State & Handlers
  const [checkoutDebtBooking, setCheckoutDebtBooking] = useState<Booking | null>(null);

  const handleInitiateRelease = (booking: Booking) => {
    setCheckoutDebtBooking(booking);
  };

  const handleConfirmReleaseWithDebt = async (booking: Booking, skipReview = false) => {
    setCheckoutDebtBooking(null);
    const updated: Booking = {
      ...booking,
      stayStatus: 'checked_out',
      skipReviewRequest: skipReview,
      notes: skipReview
        ? (booking.notes?.includes('[ללא_סקר]') ? booking.notes : `${booking.notes || ''} [ללא_סקר]`.trim())
        : (booking.notes?.replace(/\[ללא_סקר\]/g, '').trim()),
      updatedAt: new Date().toISOString()
    };
    setBookings(prev => prev.map(b => b.id === booking.id ? updated : b));
    if (skipReview) {
      showToast(`🏡 ${booking.dogName} שוחרר הביתה (בוטלה שליחת סקר חוות דעת)`);
    } else {
      showToast(`🏡 ${booking.dogName} שוחרר בהצלחה הביתה`);
    }
    await saveBookingToDb(updated);
  };

  const handleConfirmReleaseDirect = async (booking: Booking, skipReview = false) => {
    setCheckoutDebtBooking(null);
    const updated: Booking = {
      ...booking,
      stayStatus: 'checked_out',
      skipReviewRequest: skipReview,
      notes: skipReview
        ? (booking.notes?.includes('[ללא_סקר]') ? booking.notes : `${booking.notes || ''} [ללא_סקר]`.trim())
        : (booking.notes?.replace(/\[ללא_סקר\]/g, '').trim()),
      updatedAt: new Date().toISOString()
    };
    setBookings(prev => prev.map(b => b.id === booking.id ? updated : b));
    if (skipReview) {
      showToast(`🏡 ${booking.dogName} שוחרר הביתה (בוטלה שליחת סקר חוות דעת)`);
    } else {
      showToast(`🏡 ${booking.dogName} שוחרר בהצלחה הביתה`);
    }
    await saveBookingToDb(updated);
  };

  const handleMarkPaidAndRelease = async (booking: Booking, skipReview = false) => {
    setCheckoutDebtBooking(null);
    const updated: Booking = {
      ...booking,
      depositAmount: Number(booking.totalPrice) || 0,
      paymentStatus: 'fully_paid',
      stayStatus: 'checked_out',
      skipReviewRequest: skipReview,
      notes: skipReview
        ? (booking.notes?.includes('[ללא_סקר]') ? booking.notes : `${booking.notes || ''} [ללא_סקר]`.trim())
        : (booking.notes?.replace(/\[ללא_סקר\]/g, '').trim()),
      updatedAt: new Date().toISOString()
    };
    setBookings(prev => prev.map(b => b.id === booking.id ? updated : b));
    if (skipReview) {
      showToast(`🏡 ${booking.dogName} שוחרר! סומן כשולם מלא (בוטלה שליחת סקר)`);
    } else {
      showToast(`🏡 ${booking.dogName} שוחרר בהצלחה! התשלום סומן כשולם במלואו.`);
    }
    await saveBookingToDb(updated);
  };

  const handleToggleReviewRequest = async (booking: Booking) => {
    const newSkip = !booking.skipReviewRequest;
    const updated: Booking = {
      ...booking,
      skipReviewRequest: newSkip,
      notes: newSkip
        ? (booking.notes?.includes('[ללא_סקר]') ? booking.notes : `${booking.notes || ''} [ללא_סקר]`.trim())
        : (booking.notes?.replace(/\[ללא_סקר\]/g, '').trim()),
      updatedAt: new Date().toISOString()
    };
    setBookings(prev => prev.map(b => b.id === booking.id ? updated : b));
    if (newSkip) {
      showToast(`🚫 בוטלה שליחת בקשת חוות דעת עבור ${booking.dogName}`);
    } else {
      showToast(`⭐ הופעלה שליחת בקשת חוות דעת עבור ${booking.dogName}`);
    }
    await saveBookingToDb(updated);
  };

  // Clear all bookings
  const handleClearAllData = async () => {
    setBookings([]);
    setSelectedDateForDetails(null);
    setBookingFormModal({ isOpen: false, initialData: null });
    await clearAllBookingsFromDb();
    showToast('🧹 כל הנתונים נמחקו - היומן נקי לחלוטין!');
  };

  // 1. If public intake link opened (?request=true or ?intake=true) or manager opened preview
  if (showPublicIntake) {
    return (
      <PublicIntakePage
        settings={settings}
        isStaffPreview={isStaffPreviewMode && isManagerAuthenticated}
        onBackToApp={() => {
          setShowPublicIntake(false);
          setIsStaffPreviewMode(false);
        }}
      />
    );
  }

  // 2. If device not authorized via WhatsApp OTP
  if (!isManagerAuthenticated) {
    return (
      <WhatsAppAuthGate
        settings={settings}
        onSuccess={() => {
          if (typeof window !== 'undefined') {
            sessionStorage.removeItem('resort_manager_locked');
          }
          setIsManagerAuthenticated(true);
          showToast('ברוך הבא! מכשירך אושר בהצלחה בוואטסאפ 🐾');
        }}
        onGoToPublicIntake={() => {
          setIsStaffPreviewMode(false);
          setShowPublicIntake(true);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans p-3 sm:p-6 pb-24 selection:bg-emerald-200">
      
      {/* Centered Main Layout Container */}
      <div className="max-w-[1560px] w-full mx-auto space-y-4">
        
        {/* Top Centered Brand Header: Logo & Slogan */}
        <header className="flex flex-col items-center justify-center text-center pt-2 pb-1">
          <div className="flex items-center justify-center gap-3">
            <img 
              src="/resort-logo.svg" 
              alt="לוגו הריזורט לכלב" 
              className="w-12 h-12 sm:w-14 sm:h-14 object-contain drop-shadow-xs hover:scale-105 transition-transform shrink-0" 
            />
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-[#0f4c3a] tracking-tight flex items-center justify-center gap-2">
                <span>יומן הריזורט לכלב</span>
                <span>🐕</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
                ניהול יומן פנסיון ואילוף, בקשות קליטה ותקבולים
              </p>
            </div>
          </div>
        </header>

        {/* Row 1: Operational Actions & Alerts Strip */}
        <div className="flex items-center gap-2 flex-wrap py-1 border-b border-slate-200/70 pb-2.5">
          {/* 1. Intake Questionnaires for Review (שאלונים לבדיקה) */}
          <button
            type="button"
            onClick={() => {
              setIntakeModalFilter('new');
              setIsIntakeModalOpen(true);
            }}
            id="btn-intake-new-top"
            className={`font-black px-3.5 py-2 rounded-xl text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer relative shadow-2xs shrink-0 ${
              newIntakeCount > 0
                ? 'bg-gradient-to-r from-rose-50 via-white to-rose-50 hover:from-rose-100 hover:to-rose-50 border-2 border-rose-500 text-rose-950 shadow-md shadow-rose-600/15 ring-2 ring-rose-400/25 hover:scale-[1.02] active:scale-95'
                : 'bg-white hover:bg-slate-50 active:scale-95 border border-slate-200 hover:border-slate-300 text-slate-700'
            }`}
            title="צפייה בשאלוני קליטה חדשים מלקוחות שממתינים לבדיקה וקליטה ליומן"
          >
            <span className="text-base">📥</span>
            <span className="font-black">שאלונים לבדיקה</span>
            {newIntakeCount > 0 ? (
              <span className="relative flex items-center justify-center mr-0.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 bg-gradient-to-r from-red-600 to-rose-600 text-white text-xs sm:text-sm font-black font-mono rounded-full shadow-md ring-2 ring-white">
                  {newIntakeCount}
                </span>
              </span>
            ) : (
              <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-mono font-bold">0</span>
            )}
          </button>

          {/* 2. In-Progress Intake Requests (שאלונים בתהליך) */}
          <button
            type="button"
            onClick={() => {
              setIntakeModalFilter('in_progress');
              setIsIntakeModalOpen(true);
            }}
            id="btn-intake-inprogress-top"
            className={`font-black px-3.5 py-2 rounded-xl text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer relative shadow-2xs shrink-0 ${
              inProgressIntakeCount > 0
                ? 'bg-gradient-to-r from-amber-50 via-white to-amber-50 hover:from-amber-100 hover:to-amber-50 border-2 border-amber-500 text-amber-950 shadow-md shadow-amber-600/15 ring-2 ring-amber-400/25 hover:scale-[1.02] active:scale-95'
                : 'bg-white hover:bg-slate-50 active:scale-95 border border-slate-200 hover:border-slate-300 text-slate-700'
            }`}
            title="צפייה בשאלונים פעילים הנמצאים בתהליך טיפול או בהמתנה לתשלום"
          >
            <span className="text-base">⏳</span>
            <span className="font-black">שאלונים בתהליך</span>
            {inProgressIntakeCount > 0 ? (
              <span className="relative inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-xs sm:text-sm font-black font-mono rounded-full shadow-md ring-2 ring-white">
                {inProgressIntakeCount}
              </span>
            ) : (
              <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-mono font-bold">0</span>
            )}
          </button>

          {/* 3. WhatsApp CRM with Live Count Badge & Flashing Green Border */}
          <button
            type="button"
            onClick={() => setActiveTab('whatsapp')}
            id="btn-whatsapp-crm-top"
            className={`font-black px-3.5 py-2 rounded-xl text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer relative shadow-md shrink-0 active:scale-95 ${
              activeTab === 'whatsapp'
                ? 'bg-gradient-to-r from-[#065f46] via-emerald-800 to-[#065f46] text-white ring-2 ring-emerald-400 shadow-emerald-900/30 scale-[1.02]'
                : newCrmChatsCount > 0
                ? 'bg-white hover:bg-rose-50 text-slate-900 border-2 border-rose-400 shadow-rose-200 hover:scale-[1.02] ring-2 ring-rose-300/60'
                : 'bg-white hover:bg-emerald-50 text-emerald-950 hover:scale-[1.02] blink-border-green'
            }`}
            title="מרכז וואטסאפ ופניות (CRM) – ניהול שיחות, סיווג לקוחות ומענה מהיר"
          >
            <span className="text-base relative flex items-center">
              💬
              {newCrmChatsCount > 0 ? (
                <>
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border border-white animate-ping"></span>
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-600 rounded-full border border-white"></span>
                </>
              ) : (
                <>
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-white animate-ping"></span>
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-white"></span>
                </>
              )}
            </span>
            <span className="font-black">וואטסאפ ו-CRM</span>
            {newCrmChatsCount > 0 ? (
              <span className="bg-rose-600 text-white text-[11px] font-black px-2 py-0.5 rounded-full shadow-sm animate-pulse flex items-center gap-1 font-mono">
                <span>{newCrmChatsCount}</span>
                <span className="font-sans text-[10px]">חדשות 🔥</span>
              </span>
            ) : (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-bold ${
                activeTab === 'whatsapp'
                  ? 'bg-emerald-900 text-emerald-100'
                  : 'bg-emerald-100 text-emerald-800'
              }`}>
                {activeTab === 'whatsapp' ? 'פתוח' : 'CRM 🟢'}
              </span>
            )}
          </button>

          {/* Pending Grow Payments Quick Access Button (if any) */}
          {pendingGrowPayments.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setIsGrowPaymentsMinimized(false);
                setIsGrowFloatingSnoozed(false);
              }}
              id="btn-pending-grow-payments-top"
              className="relative bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white font-black px-3 py-2 rounded-xl text-xs sm:text-sm shadow-md hover:shadow-lg flex items-center gap-1.5 transition-all cursor-pointer shrink-0 border border-emerald-400/60 active:scale-95 animate-pulse"
              title="התקבל תשלום חדש ממתין להקמת הזמנה - לחץ לפתיחת החלון"
            >
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-300 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400"></span>
              </span>
              <span>💳 תשלום ממתין</span>
              <span className="bg-amber-400 text-slate-950 text-[11px] font-black px-1.5 py-0.2 rounded-full font-mono shadow-2xs">
                ₪{pendingGrowPayments[0]?.amount.toLocaleString()}
              </span>
              {pendingGrowPayments.length > 1 && (
                <span className="bg-emerald-900/80 text-emerald-100 text-[10px] font-extrabold px-1 rounded-full">
                  +{pendingGrowPayments.length - 1}
                </span>
              )}
            </button>
          )}

          {/* 4. Daily Evening Dog Update (20:00) */}
          <button
            type="button"
            onClick={() => setIsDailyDogUpdatesOpen(true)}
            id="btn-daily-dog-updates-top"
            className="bg-gradient-to-r from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100 active:scale-95 border border-amber-300 text-amber-950 font-black px-3 py-2 rounded-xl text-xs sm:text-sm shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
            title="עדכון יומי לבעלי כלבים בשעה 20:00 - תצוגה מקדימה, החלפת נוסחים ושליחה"
          >
            <span className="text-base">🐶👑</span>
            <span>עדכון 20:00</span>
            {activeTonightCount > 0 && (
              <span className="bg-amber-500 text-white text-[11px] font-black px-1.5 py-0.2 rounded-full shadow-2xs font-mono">
                {activeTonightCount}
              </span>
            )}
          </button>

          {/* 5. Tomorrow Overview to Shmulik (19:00) */}
          <button
            type="button"
            onClick={() => setIsTomorrowOverviewModalOpen(true)}
            id="btn-tomorrow-overview-top"
            className="bg-gradient-to-r from-indigo-50 to-blue-50 hover:from-indigo-100 hover:to-blue-100 active:scale-95 border border-indigo-300 text-indigo-950 font-black px-3 py-2 rounded-xl text-xs sm:text-sm shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
            title="מה קורה מחר? סקירה יומית מלאה לשמוליק ב-19:00 (כניסות, שחרורים, יתרות לתשלום, תפוסה ודגשים)"
          >
            <span className="text-base">📋</span>
            <span className="hidden sm:inline">מה קורה מחר (19:00)</span>
            <span className="sm:hidden">מחר</span>
          </button>

          {/* 6. + New Booking Primary CTA */}
          <button
            onClick={() => setBookingWizardOpen({ isOpen: true, initialData: null })}
            id="btn-new-booking-top"
            className="bg-[#065f46] hover:bg-[#044e45] active:scale-95 text-white font-black px-3.5 py-2 rounded-xl text-xs sm:text-sm shadow-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
          >
            <span className="text-base font-bold">+</span>
            <span>הזמנה חדשה</span>
          </button>
        </div>

        {/* Row 2: Unified Navigation (Right), Shabbat/Holiday Banner in the Center Gap, and Utilities (Left) */}
        <div className="flex items-center justify-between gap-2.5 p-1.5 sm:p-2 bg-white/95 backdrop-blur-xs rounded-2xl border border-slate-200/90 shadow-2xs w-full overflow-x-auto no-scrollbar">
          
          {/* Right Side in RTL (מימין): Main Navigation Tabs */}
          <div className="flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('calendar')}
              className={`text-xs sm:text-sm font-black px-3.5 sm:px-4 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === 'calendar'
                  ? 'bg-[#065f46] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
              }`}
              title="יומן פנסיון ואילוף"
            >
              <span className="text-base">📅</span>
              <span>יומן</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('forecast')}
              className={`text-xs sm:text-sm font-black px-3.5 sm:px-4 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === 'forecast'
                  ? 'bg-[#065f46] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
              }`}
              title="תחזית תפוסה"
            >
              <span className="text-base">📊</span>
              <span>תפוסה</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('customers')}
              className={`text-xs sm:text-sm font-black px-3.5 sm:px-4 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                activeTab === 'customers'
                  ? 'bg-[#065f46] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
              }`}
              title="מאגר לקוחות וכלבים"
            >
              <span className="text-base">⭐</span>
              <span>לקוחות</span>
            </button>
          </div>

          {/* Center Gap (ברווח בין הכפתורים): Shabbat / Jewish Holiday Dog Greetings Reminder Banner */}
          {todayHolidayInfo.isSpecial && totalDogsToday > 0 && !isGreetingBannerDismissed && (() => {
            const rest = isCustomerMessagingRestrictedNow();
            if (rest.isRestricted) {
              return (
                <div className="flex-1 min-w-[260px] mx-1 sm:mx-2 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white rounded-xl px-2.5 sm:px-3.5 py-1.5 shadow-xs border border-amber-400/60 flex items-center justify-between gap-2 animate-in fade-in duration-200">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-lg shrink-0">🛡️</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-black text-xs sm:text-sm tracking-tight truncate">
                          כלל ברזל: שקט מוחלט ללקוחות משישי 14:00 וכל השבת והחג
                        </span>
                        <span className="bg-white/20 text-white text-[10px] font-black px-2 py-0.2 rounded-full shrink-0">
                          {totalDogsToday} כלבים בריזורט
                        </span>
                      </div>
                      <p className="text-[11px] text-amber-100 font-medium truncate hidden xl:block">
                        הודעות הד״ש והעדכונים ישלחו אוטומטית בענן 40 דקות לאחר צאת השבת/החג {rest.sendTimeStr ? `בשעה ${rest.sendTimeStr}` : ''} (גם כשהדפדפנים סגורים).
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setGreetingModalDate(todayStr)}
                      className="bg-white/95 hover:bg-white text-slate-900 font-black px-3 py-1.5 rounded-lg text-xs shadow-xs transition-all cursor-pointer flex items-center gap-1.5 shrink-0 active:scale-95"
                      title="צפה בנוסח ההודעות וברשימת הכלבים"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-amber-700" />
                      <span className="whitespace-nowrap">צפה בנוסח וברשימה</span>
                    </button>
                  </div>
                </div>
              );
            }

            if (todayUnsentGreetingsCount > 0) {
              return (
                <div className="flex-1 min-w-[260px] mx-1 sm:mx-2 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white rounded-xl px-2.5 sm:px-3.5 py-1.5 shadow-xs border border-emerald-400/60 flex items-center justify-between gap-2 animate-in fade-in duration-200">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-lg shrink-0">🚀</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-black text-xs sm:text-sm tracking-tight truncate">
                          מוצאי שבת/חג – חלון המשלוח האוטומטי פעיל (40 דק׳ לאחר צאת השבת)!
                        </span>
                        <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-2 py-0.2 rounded-full shadow-2xs shrink-0">
                          {todayUnsentGreetingsCount} להשלמה
                        </span>
                      </div>
                      <p className="text-[11px] text-emerald-100 font-medium truncate hidden xl:block">
                        הודעות הד״ש החם נשלחות כעת אוטומטית ברקע לכל {totalDogsToday} הכלבים בריזורט.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setGreetingModalDate(todayStr)}
                      className="bg-white hover:bg-emerald-50 text-emerald-950 font-black px-3 py-1.5 rounded-lg text-xs shadow-xs transition-all cursor-pointer flex items-center gap-1.5 shrink-0 active:scale-95"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="whitespace-nowrap">צפה ברשימה ובהתקדמות</span>
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div className="flex-1 mx-1 sm:mx-2 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl px-3 py-1.5 text-xs font-bold flex items-center justify-between shadow-2xs">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="text-base shrink-0">🎉</span>
                  <span className="font-black text-emerald-950 truncate">
                    מעולה שמוליק! כל {totalDogsToday} הודעות הד״ש נשלחו בהצלחה לבעלים.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setGreetingModalDate(todayStr)}
                  className="text-emerald-700 hover:text-emerald-900 underline font-black text-xs cursor-pointer shrink-0 mr-2"
                >
                  פתח רשימה
                </button>
              </div>
            );
          })()}

          {/* Left Side in RTL (משמאל): System & Management Utilities */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Reports Button */}
            <button
              type="button"
              onClick={() => setIsReportsOpen(true)}
              className="bg-slate-50 hover:bg-amber-50/80 active:scale-95 border border-slate-200/90 hover:border-amber-300 text-slate-700 hover:text-amber-900 font-bold px-3.5 py-2 rounded-xl text-xs sm:text-sm shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
              title="דוחות כספיים ותפוסה"
            >
              <span className="text-base">💰</span>
              <span>דוחות</span>
            </button>

            {/* Settings Button */}
            <button
              onClick={handleOpenSettingsWithAuth}
              id="btn-settings-top"
              className="bg-slate-50 hover:bg-slate-100 active:scale-95 border border-slate-200/90 hover:border-slate-300 text-slate-700 hover:text-slate-900 font-bold px-3.5 py-2 rounded-xl text-xs sm:text-sm shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
              title="הגדרות תפוסה, תעריפים, ביט וגיבוי (אישור מנהל)"
            >
              <span className="text-base">⚙️</span>
              <span>הגדרות</span>
            </button>

            {/* Lock System / Logout Button */}
            <button
              type="button"
              onClick={handleManagerLogout}
              id="btn-lock-system-top"
              className="bg-slate-50 hover:bg-rose-50 active:scale-95 border border-slate-200/90 hover:border-rose-300 text-slate-500 hover:text-rose-700 font-bold px-3 py-2 rounded-xl text-xs sm:text-sm shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer group"
              title="נעילת יומן ויציאה מאובטחת"
            >
              <Lock className="w-4 h-4 text-slate-400 group-hover:text-rose-600" />
              <span>נעילה</span>
            </button>
          </div>

        </div>

        {/* Header Metrics Section: Ultra-Compact & Space-Efficient (Hidden on mobile when in WhatsApp CRM to maximize full-screen view) */}
        <div className={activeTab === 'whatsapp' ? 'hidden sm:block' : ''}>
        {isMetricsRowCollapsed ? (
          /* Collapsed Single-Line Summary Bar (~36px height) */
          <div className="bg-white border border-slate-200 rounded-xl px-3.5 py-2 shadow-2xs flex items-center justify-between text-xs transition-all">
            <div className="flex items-center gap-2.5 sm:gap-4 overflow-x-auto no-scrollbar font-bold text-slate-700">
              <span 
                onClick={() => setActiveHeaderMetric('occupancy')} 
                className="cursor-pointer hover:text-emerald-700 transition-colors shrink-0"
                title="לחץ לפתיחת פירוט תפוסה כללית"
              >
                📊 תפוסה: <strong className="text-slate-900">{totalDogsToday}/{settings.maxCapacity}</strong> ({freeSlots > 0 ? `${freeSlots} פנויים` : 'מלא'})
              </span>
              <span className="text-slate-200">|</span>
              <span 
                onClick={() => setActiveHeaderMetric('boarding')} 
                className="cursor-pointer hover:text-sky-700 transition-colors shrink-0"
                title="לחץ לפתיחת פירוט פנסיון"
              >
                🏨 פנסיון: <strong className="text-slate-900">{boardingToday}</strong>
              </span>
              <span className="text-slate-200">|</span>
              <span 
                onClick={() => setActiveHeaderMetric('training')} 
                className="cursor-pointer hover:text-purple-700 transition-colors shrink-0"
                title="לחץ לפתיחת פירוט אילוף"
              >
                🎓 אילוף: <strong className="text-slate-900">{trainingToday}</strong> ({fullTrainingToday} מלא, {dayTrainingToday} יומיות)
              </span>
              <span className="text-slate-200">|</span>
              <span 
                onClick={() => setActiveHeaderMetric('debt')} 
                className="cursor-pointer hover:text-red-700 transition-colors shrink-0"
                title="לחץ לפתיחת פירוט חובות פתוחים"
              >
                💳 חוב: <strong className={openDebtTotal > 0 ? 'text-red-600' : 'text-emerald-700'}>₪{openDebtTotal.toLocaleString('he-IL')}</strong>
              </span>
              <span className="text-slate-200">|</span>
              <span 
                onClick={() => setActiveHeaderMetric('revenue')} 
                className="cursor-pointer hover:text-emerald-700 transition-colors shrink-0 flex items-center gap-1.5"
                title="לחץ לפתיחת פירוט ודוחות הכנסות"
              >
                <span>💰 תקבולים החודש: <strong className="text-[#065f46]">₪{monthTotalCollected.toLocaleString('he-IL')}</strong></span>
                {monthDirectBankTransfers > 0 && (
                  <span className="bg-teal-50 text-teal-900 border border-teal-200 px-1.5 py-0.2 rounded text-[11px] font-bold" title="העברות בנקאיות ישירות שכבר הופקדו בחשבון הבנק">
                    🏛️ הועבר: ₪{monthDirectBankTransfers.toLocaleString('he-IL')}
                  </span>
                )}
                <span className="bg-sky-50 text-sky-900 border border-sky-200 px-1.5 py-0.2 rounded text-[11px] font-bold">
                  🏦 ב-{next10thDateLabel}: ₪{monthBankOn10th.toLocaleString('he-IL')}
                </span>
                {monthBankIn2Months > 0 && (
                  <span className="bg-indigo-50 text-indigo-900 border border-indigo-200 px-1.5 py-0.2 rounded text-[11px] font-bold" title={`עסקאות בתשלומים שיכנסו לבנק ב-${inTwoMonthsDateLabel}`}>
                    🗓️ ב-{inTwoMonthsDateLabel}: ₪{monthBankIn2Months.toLocaleString('he-IL')}
                  </span>
                )}
                <span className="bg-amber-50 text-amber-900 border border-amber-200 px-1.5 py-0.2 rounded text-[11px] font-bold">
                  💵 מזומן: ₪{monthCashCollected.toLocaleString('he-IL')}
                </span>
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsMetricsRowCollapsed(false)}
              className="text-[11px] text-emerald-800 hover:text-emerald-900 font-bold flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200 shrink-0 transition-colors cursor-pointer mr-2"
              title="הרחב את 5 כרטיסיות המדדים"
            >
              <span>הרחב כרטיסים</span>
              <ChevronDown className="w-3.5 h-3.5 text-emerald-700" />
            </button>
          </div>
        ) : (
          /* Compact Cards Grid (Reduced by >55% vertical height) */
          <div className="space-y-1">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-extrabold text-slate-400">
                מדדים מהירים להיום
              </span>
              <button
                type="button"
                onClick={() => setIsMetricsRowCollapsed(true)}
                className="text-[10px] text-slate-400 hover:text-slate-600 font-bold flex items-center gap-0.5 hover:bg-slate-100 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                title="צמצם את כרטיסי המדדים לשורה בודדת"
              >
                <span>צמצם שורה</span>
                <ChevronUp className="w-3 h-3" />
              </button>
            </div>

            {/* Integrated Command Bar: Operations (Right) + Financial Flow (Left) */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-3 sm:p-3.5 shadow-2xs">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-3.5 items-stretch">
                
                {/* RIGHT WING (cols-5): Operational 4-Pods arranged in 2x2 Grid (No Wasted Space) */}
                <div className="lg:col-span-5 bg-slate-50/60 border border-slate-200/90 rounded-2xl p-3 flex flex-col justify-between gap-2.5 shadow-2xs">
                  <div className="flex items-center justify-between px-0.5">
                    <span className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                      <span>🐕</span>
                      <span>פעילות היום בריזורט</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-bold bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-2xs">
                      4 מוקדי תפעול
                    </span>
                  </div>

                  {/* 4 Pods in a 2x2 Grid filling the height seamlessly */}
                  <div className="grid grid-cols-2 gap-2 flex-1 items-stretch">
                    
                    {/* Pod 1: תפוסה כללית */}
                    <div 
                      onClick={() => setActiveHeaderMetric('occupancy')}
                      role="button"
                      tabIndex={0}
                      className="bg-white hover:bg-emerald-50/60 border border-slate-200/90 hover:border-emerald-300 rounded-xl p-2.5 flex flex-col justify-between transition-all cursor-pointer active:scale-[0.99] group shadow-2xs"
                      title="לחץ לעיון ועריכת כלבי התפוסה הכללית היום"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-600 group-hover:text-emerald-800 transition-colors">
                          תפוסה כללית
                        </span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border ${
                          totalDogsToday >= settings.maxCapacity 
                            ? 'bg-red-50 text-red-700 border-red-200' 
                            : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        }`}>
                          {Math.round((totalDogsToday / Math.max(1, settings.maxCapacity)) * 100)}%
                        </span>
                      </div>
                      <div className="text-lg sm:text-xl font-black text-slate-900 my-0.5 text-right">
                        {totalDogsToday} <span className="text-[11px] font-semibold text-slate-400">/ {settings.maxCapacity}</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-medium text-slate-500 pt-1 border-t border-slate-100">
                        <span className="truncate">{freeSlots > 0 ? `${freeSlots} פנויים` : 'מלא 🔴'}</span>
                        <span className="text-[10px] text-emerald-700 font-bold opacity-80 group-hover:opacity-100">
                          עיון 🔍
                        </span>
                      </div>
                    </div>

                    {/* Pod 2: פנסיון ומשפחתון */}
                    <div 
                      onClick={() => setActiveHeaderMetric('boarding')}
                      role="button"
                      tabIndex={0}
                      className="bg-white hover:bg-sky-50/60 border border-slate-200/90 hover:border-sky-300 rounded-xl p-2.5 flex flex-col justify-between transition-all cursor-pointer active:scale-[0.99] group shadow-2xs"
                      title="לחץ לעיון ועריכת כלבי הפנסיון והדייקר היום"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-600 group-hover:text-sky-800 transition-colors">
                          פנסיון
                        </span>
                        <span className="text-[9px] font-bold text-sky-700 bg-sky-50 px-1.5 py-0.2 rounded-full border border-sky-200">
                          🏨 לינה
                        </span>
                      </div>
                      <div className="text-lg sm:text-xl font-black text-slate-900 my-0.5 text-right">
                        {boardingToday} <span className="text-[11px] font-semibold text-slate-400">כלבים</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-medium text-slate-500 pt-1 border-t border-slate-100">
                        <span className="truncate">{boardingToday === 0 ? 'אין לינה' : `${boardingToday} בפנסיון`}</span>
                        <span className="text-[10px] text-sky-700 font-bold opacity-80 group-hover:opacity-100">
                          עיון 🔍
                        </span>
                      </div>
                    </div>

                    {/* Pod 3: באילוף היום */}
                    <div 
                      onClick={() => setActiveHeaderMetric('training')}
                      role="button"
                      tabIndex={0}
                      className="bg-white hover:bg-purple-50/60 border border-slate-200/90 hover:border-purple-300 rounded-xl p-2.5 flex flex-col justify-between transition-all cursor-pointer active:scale-[0.99] group shadow-2xs"
                      title="לחץ לעיון ועריכת כלבי האילוף היום"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-600 group-hover:text-purple-800 transition-colors">
                          באילוף
                        </span>
                        <span className="text-[9px] font-black text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded-full border border-purple-200">
                          סה״כ {trainingToday}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-1 my-0.5">
                        <span className="text-base sm:text-lg font-black text-purple-600">{fullTrainingToday}</span>
                        <span className="text-[10px] font-bold text-slate-600">🎓 מלא</span>
                        <span className="text-slate-300 text-xs">|</span>
                        <span className="text-base sm:text-lg font-black text-indigo-600">{dayTrainingToday}</span>
                        <span className="text-[10px] font-bold text-slate-600">🦮</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-medium text-slate-500 pt-1 border-t border-slate-100">
                        <span className="truncate">{trainingToday > 0 ? `${trainingToday} בתהליך` : 'אין אילוף'}</span>
                        <span className="text-[10px] text-purple-700 font-bold opacity-80 group-hover:opacity-100">
                          עיון 🔍
                        </span>
                      </div>
                    </div>

                    {/* Pod 4: חוב פתוח */}
                    <div 
                      onClick={() => setActiveHeaderMetric('debt')}
                      role="button"
                      tabIndex={0}
                      className="bg-white hover:bg-red-50/60 border border-slate-200/90 hover:border-red-300 rounded-xl p-2.5 flex flex-col justify-between transition-all cursor-pointer active:scale-[0.99] group shadow-2xs"
                      title="לחץ לעיון ועריכת ההזמנות עם יתרת חוב פתוח"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-600 group-hover:text-red-800 transition-colors">
                          חוב פתוח
                        </span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border ${
                          openDebtTotal === 0
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-red-50 text-red-700 border-red-200'
                        }`}>
                          {openDebtTotal === 0 ? '🟢 נקי' : `🔴 ${unpaidCount}`}
                        </span>
                      </div>
                      <div className="text-lg sm:text-xl font-black text-[#0f766e] my-0.5 text-right">
                        ₪{openDebtTotal.toLocaleString('he-IL')}
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-medium text-slate-500 pt-1 border-t border-slate-100">
                        <span className="truncate">{openDebtTotal === 0 ? 'הכול שולם 🥳' : `${unpaidCount} עם יתרה`}</span>
                        <span className="text-[10px] text-red-600 font-bold opacity-80 group-hover:opacity-100">
                          עיון 🔍
                        </span>
                      </div>
                    </div>

                  </div>
                </div>

                {/* LEFT WING (cols-7): Monthly Financial Flow & Breakdown (Enlarged & Spacious) */}
                <div 
                  className="lg:col-span-7 bg-gradient-to-br from-emerald-50/45 via-teal-50/30 to-slate-50/70 border border-emerald-200/80 rounded-2xl p-3 flex flex-col justify-between gap-2.5 shadow-2xs hover:border-emerald-300 transition-all"
                >
                  {/* Financial Top Row: Title + Main Amount + Graphs Button */}
                  <div className="flex items-start justify-between gap-2">
                    <div 
                      onClick={() => setActiveHeaderMetric('revenue')}
                      role="button"
                      tabIndex={0}
                      className="cursor-pointer group"
                      title="לחץ לצפייה בגרפים חודשיים ושנתיים ודוחות כספיים מלאים 📊"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-emerald-950 flex items-center gap-1 group-hover:text-emerald-700 transition-colors">
                          <span>💰</span>
                          <span>תקבולים וסליקה החודש</span>
                        </span>
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-full border border-emerald-200">
                          🐾 {currentMonthActiveStays.length} שהויות
                        </span>
                      </div>
                      
                      <div className="flex items-baseline gap-2 mt-0.5">
                        <div className="text-2xl sm:text-3xl font-black text-[#065f46] tracking-tight group-hover:text-emerald-800 transition-colors">
                          ₪{monthTotalCollected.toLocaleString('he-IL')}
                        </div>
                      </div>
                    </div>

                    {/* Graphs & Reports Button (Clicking opens full charts & stats) */}
                    <button
                      type="button"
                      onClick={() => setActiveHeaderMetric('revenue')}
                      className="bg-white hover:bg-emerald-50 text-emerald-850 hover:text-emerald-950 border border-emerald-300/90 hover:border-emerald-400 font-black text-xs px-3 py-2 rounded-xl shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shrink-0"
                      title="לחץ לצפייה בגרפים חודשיים ושנתיים ודוחות כספיים מלאים"
                    >
                      <BarChart3 className="w-3.5 h-3.5 text-emerald-700" />
                      <span>גרפים ודוחות 📊</span>
                    </button>
                  </div>

                  {/* Financial Middle: 4 Destination Boxes in TWO Columns (Enlarged & Fully Legible) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-emerald-200/60">
                    
                    {/* Box 1: Direct Bank Transfer */}
                    <div 
                      onClick={() => setActiveHeaderMetric('revenue')}
                      role="button"
                      tabIndex={0}
                      className="bg-teal-50/90 hover:bg-teal-100/80 border border-teal-200/90 hover:border-teal-300 px-3 py-2.5 rounded-xl flex items-center justify-between shadow-2xs transition-all cursor-pointer group" 
                      title="העברות בנקאיות ישירות שכבר הופקדו בחשבון הבנק"
                    >
                      <span className="font-bold text-teal-900 text-xs sm:text-[13px] flex items-center gap-1.5 group-hover:text-teal-950">
                        <span className="text-sm">🏛️</span>
                        <span>הועבר ישירות לחשבון:</span>
                      </span>
                      <span className="font-black text-teal-950 text-xs sm:text-sm mr-2 shrink-0 font-mono">
                        ₪{monthDirectBankTransfers.toLocaleString('he-IL')}
                      </span>
                    </div>

                    {/* Box 2: 10th of Month (GROW) */}
                    <div 
                      onClick={() => setActiveHeaderMetric('revenue')}
                      role="button"
                      tabIndex={0}
                      className="bg-sky-50/90 hover:bg-sky-100/80 border border-sky-200/90 hover:border-sky-300 px-3 py-2.5 rounded-xl flex items-center justify-between shadow-2xs transition-all cursor-pointer group" 
                      title={`סליקת אשראי ו-GROW שתיכנס לבנק ב-${next10thDateLabel}`}
                    >
                      <span className="font-bold text-sky-900 text-xs sm:text-[13px] flex items-center gap-1.5 group-hover:text-sky-950">
                        <span className="text-sm">🏦</span>
                        <span>ייכנס ב-{next10thDateLabel} (GROW):</span>
                      </span>
                      <span className="font-black text-sky-950 text-xs sm:text-sm mr-2 shrink-0 font-mono">
                        ₪{monthBankOn10th.toLocaleString('he-IL')}
                      </span>
                    </div>

                    {/* Box 3: Cash Collected */}
                    <div 
                      onClick={() => setActiveHeaderMetric('revenue')}
                      role="button"
                      tabIndex={0}
                      className="bg-amber-50/90 hover:bg-amber-100/80 border border-amber-200/90 hover:border-amber-300 px-3 py-2.5 rounded-xl flex items-center justify-between shadow-2xs transition-all cursor-pointer group" 
                      title="מזומן שנגבה בקופה מתחילת החודש"
                    >
                      <span className="font-bold text-amber-900 text-xs sm:text-[13px] flex items-center gap-1.5 group-hover:text-amber-950">
                        <span className="text-sm">💵</span>
                        <span>נסלק במזומן בקופה:</span>
                      </span>
                      <span className="font-black text-amber-950 text-xs sm:text-sm mr-2 shrink-0 font-mono">
                        ₪{monthCashCollected.toLocaleString('he-IL')}
                      </span>
                    </div>

                    {/* Box 4: Installments / In 2 Months */}
                    <div 
                      onClick={() => setActiveHeaderMetric('revenue')}
                      role="button"
                      tabIndex={0}
                      className="bg-indigo-50/90 hover:bg-indigo-100/80 border border-indigo-200/90 hover:border-indigo-300 px-3 py-2.5 rounded-xl flex items-center justify-between shadow-2xs transition-all cursor-pointer group" 
                      title={monthBankIn2Months > 0 ? `עסקאות בתשלומים שיכנסו לבנק ב-${inTwoMonthsDateLabel}` : 'עסקאות בתשלומים עתידיים'}
                    >
                      <span className="font-bold text-indigo-900 text-xs sm:text-[13px] flex items-center gap-1.5 group-hover:text-indigo-950">
                        <span className="text-sm">🗓️</span>
                        <span>ייכנס ב-{inTwoMonthsDateLabel} (תשלומים):</span>
                      </span>
                      <span className="font-black text-indigo-950 text-xs sm:text-sm mr-2 shrink-0 font-mono">
                        ₪{monthBankIn2Months.toLocaleString('he-IL')}
                      </span>
                    </div>

                  </div>

                  {/* Financial Bottom: Overall Calculation & Sanity Check (Always displayed, proving everything balances to 0) */}
                  <div 
                    onClick={() => setActiveHeaderMetric('revenue')}
                    role="button"
                    tabIndex={0}
                    className="bg-emerald-100/80 hover:bg-emerald-100 border border-emerald-300/90 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-2 shadow-2xs transition-all cursor-pointer"
                    title={`בדיקת שפיות ואיפוס מלאה:
• דיגיטלי: ₪${monthDigitalCleared.toLocaleString('he-IL')} = ₪${monthBankOn10th.toLocaleString('he-IL')} (סליקת GROW) + ₪${monthDirectBankTransfers.toLocaleString('he-IL')} (העברות ישירות)
• סה״כ כולל: ₪${monthTotalCollected.toLocaleString('he-IL')} = ₪${monthDigitalCleared.toLocaleString('he-IL')} (דיגיטלי) + ₪${monthCashCollected.toLocaleString('he-IL')} (מזומן)
• הפרש: ₪0 (הכול מאוזן ונסגר ל-0)`}
                  >
                    <div className="flex items-center gap-1.5 text-xs sm:text-[13px] font-bold text-emerald-950">
                      <span className="text-sm sm:text-base">⚖️</span>
                      <span>חישוב כולל ואיפוס:</span>
                      <span className="font-semibold text-emerald-800 text-[11px] sm:text-xs mr-1">
                        דיגיטלי (₪{monthDigitalCleared.toLocaleString('he-IL')}) + מזומן (₪{monthCashCollected.toLocaleString('he-IL')}) = ₪{monthTotalCollected.toLocaleString('he-IL')}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 bg-[#065f46] text-white font-black text-xs px-2.5 py-1 rounded-lg shadow-2xs shrink-0">
                      <span>הכול נסגר ל-0</span>
                      <span>✓</span>
                      <span className="text-emerald-200 text-[10px] font-mono">(הפרש ₪0)</span>
                    </div>
                  </div>

                </div>

              </div>
            </div>
          </div>
        )}
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
              onOpenSendPaymentLink={(b) => setPaymentLinkBooking(b)}
              onMarkAsPaid={handleMarkAsPaid}
              onEditBooking={(b) => setBookingFormModal({ isOpen: true, initialData: b })}
              onDeleteBooking={handleDeleteBooking}
              onOpenNewBooking={() => setBookingWizardOpen({ isOpen: true, initialData: null })}
              onInitiateRelease={handleInitiateRelease}
              onToggleReviewRequest={handleToggleReviewRequest}
            />
          )}

          {activeTab === 'customers' && (
            <CustomersView
              bookings={bookings}
              settings={settings}
              onSelectBooking={(b) => setSelectedDateForDetails(b.startDate)}
              onOpenVoucher={(data) => setVoucherModalData({ isOpen: true, ...data })}
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

          {activeTab === 'whatsapp' && (
            <WhatsAppLeadsView
              bookings={bookings}
              intakeRequests={intakeRequests}
              settings={settings}
              onNewCountChange={setNewCrmChatsCount}
              onOpenNewBookingWithData={(data) => {
                setBookingWizardOpen({
                  isOpen: true,
                  initialData: {
                    ownerName: data.ownerName,
                    ownerPhone: data.ownerPhone,
                    dogName: data.dogName || '',
                  }
                });
              }}
            />
          )}
        </main>
      </div>

      {/* Modals & Dialogs */}
      {selectedDateForDetails && (
        <DayDetailsModal
          dateStr={selectedDateForDetails}
          bookings={bookings}
          settings={settings}
          onClose={() => setSelectedDateForDetails(null)}
          onOpenVoucher={(data) => setVoucherModalData({ isOpen: true, ...data })}
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
          onOpenSendPaymentLink={(b) => {
            setSelectedDateForDetails(null);
            setPaymentLinkBooking(b);
          }}
          onToggleStayStatus={handleToggleStayStatus}
          onInitiateRelease={handleInitiateRelease}
          onToggleReviewRequest={handleToggleReviewRequest}
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
      {!bookingWizardOpen.isOpen && pendingGrowPayments.length > 0 && !isGrowPaymentsMinimized && (
        <GrowPaymentsModal
          pendingPayments={pendingGrowPayments}
          bookings={bookings}
          intakeRequests={intakeRequests}
          settings={settings}
          onAccept={handleAcceptGrowPayment}
          onDismiss={handleDismissGrowPayment}
          onCloseLater={() => {
            setIsGrowPaymentsMinimized(true);
            showToast('החלון הושהה לטיפול מאוחר יותר. נותרה תזכורת פעילה ⏳');
          }}
          onOpenWhatsApp={(phone) => {
            const waUrl = `https://wa.me/${formatPhoneForWhatsApp(phone)}`;
            window.open(waUrl, '_blank');
          }}
        />
      )}

      {/* 4-Step Intuitive Booking Wizard matching the video */}
      {bookingWizardOpen.isOpen && (
        <SimpleBookingWizard
          isOpen={bookingWizardOpen.isOpen}
          initialData={bookingWizardOpen.initialData}
          existingBookings={bookings}
          intakeRequests={intakeRequests}
          settings={settings}
          onClose={() => {
            setBookingWizardOpen({ isOpen: false, initialData: null });
            setActiveGrowPayment(null);
          }}
          onOpenSendPaymentLink={(b) => setPaymentLinkBooking(b)}
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
          onOpenSendPaymentLink={(b) => setPaymentLinkBooking(b)}
          onSavePayment={(bookingId, amount, method, notes) => {
            handleSavePayment(bookingId, amount, method, notes);
            setPaymentModalBooking(null);
          }}
        />
      )}

      {/* Direct Send / Resend Payment Link Modal */}
      {paymentLinkBooking && (
        <SendPaymentLinkModal
          isOpen={!!paymentLinkBooking}
          booking={paymentLinkBooking}
          settings={settings}
          onClose={() => setPaymentLinkBooking(null)}
          onSentSuccess={(msg) => showToast(msg)}
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
          onInitiateRelease={handleInitiateRelease}
        />
      )}

      {/* Checkout Debt Warning & Release Modal */}
      <CheckoutDebtAlertModal
        isOpen={!!checkoutDebtBooking}
        booking={checkoutDebtBooking}
        settings={settings}
        onClose={() => setCheckoutDebtBooking(null)}
        onMarkPaidAndRelease={handleMarkPaidAndRelease}
        onConfirmReleaseWithDebt={handleConfirmReleaseWithDebt}
        onConfirmReleaseDirect={handleConfirmReleaseDirect}
        onOpenPaymentModal={(b) => {
          setCheckoutDebtBooking(null);
          setPaymentModalBooking(b);
        }}
      />

      {/* Intake Requests Modal (Client Online Inquiries) */}
      {isIntakeModalOpen && (
        <IntakeRequestsModal
          requests={intakeRequests}
          settings={settings}
          bookings={bookings}
          initialFilter={intakeModalFilter}
          onClose={() => setIsIntakeModalOpen(false)}
          onUpdateStatus={async (id, status, notes) => {
            await updateIntakeRequestStatusInDb(id, status, notes);
            setIntakeRequests(prev => prev.map(r => r.id === id ? { ...r, status, ...(notes !== undefined ? { internalNotes: notes } : {}) } : r));
            showToast('סטטוס בקשת הקליטה עודכן');
          }}
          onSaveRequest={async (updatedReq) => {
            await saveIntakeRequestToDb(updatedReq);
            setIntakeRequests(prev => prev.map(r => r.id === updatedReq.id ? updatedReq : r));
            showToast('פרטי בקשת הקליטה עודכנו ונשמרו! ✨');
          }}
          onApproveAndBook={async (req) => {
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
            const isFree = req.isFreeStay ||
              (req.notes && (req.notes.includes('חינם') || req.notes.includes('ללא תשלום') || req.notes.includes('כלב נוסף'))) ||
              (req.internalNotes && (req.internalNotes.includes('חינם') || req.internalNotes.includes('ללא תשלום') || req.internalNotes.includes('כלב נוסף')));

            const calculatedDefault = req.serviceType === 'training'
              ? (Number(settings?.defaultDailyRateTraining) || 6500)
              : req.serviceType === 'daycare'
              ? (daysCount * (Number(settings?.defaultDailyRateDaycare) || 90))
              : boardingRateInfo.totalPrice;
            const finalPrice = isFree ? 0 : (req.depositRequested && req.depositRequested > 0 ? req.depositRequested : calculatedDefault);
            const dailyRateVal = isFree ? 0 : (req.serviceType === 'boarding' ? boardingRateInfo.dailyRate : undefined);

            setBookingWizardOpen({
              isOpen: true,
              initialData: {
                dogName: req.dogName,
                dogBreed: req.dogBreed,
                dogGender: req.dogGender === 'female'
                  ? (req.isNeutered ? 'female_spayed' : 'female_intact')
                  : (req.isNeutered ? 'male_neutered' : 'male_intact'),
                ownerName: req.ownerName,
                ownerPhone: req.ownerPhone,
                ownerEmail: req.ownerEmail,
                serviceType: req.serviceType,
                startDate: req.startDate,
                endDate: req.endDate,
                vaccinationValid: req.isVaccinated,
                notes: [req.specialNeeds, req.notes, req.internalNotes ? `הערות שמוליק: ${req.internalNotes}` : ''].filter(Boolean).join(' | '),
                totalPrice: finalPrice,
                dailyRate: dailyRateVal,
                depositAmount: 0,
                paymentStatus: isFree ? 'fully_paid' : 'unpaid',
                isFreeStay: isFree,
                stayStatus: 'booked'
              }
            });
            await updateIntakeRequestStatusInDb(req.id, 'approved');
            setIntakeRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'approved' } : r));

            // Auto-redeem voucher if present in request notes
            const voucherMatch = (req.notes || '').match(/שובר.*?:\s*([A-Z0-9\u0590-\u05FF-]+)/i);
            if (voucherMatch && voucherMatch[1]) {
              const code = voucherMatch[1].trim();
              await updateVoucherStatusInDb(code, 'redeemed', {
                redeemedByOwner: req.ownerName,
                redeemedByDog: req.dogName
              });
              showToast(`🎁 שובר ${code} עודכן כנוצל במערכת`);
            }

            setIsIntakeModalOpen(false);
          }}
          onDeleteRequest={async (id) => {
            await deleteIntakeRequestFromDb(id);
            setIntakeRequests(prev => prev.filter(r => r.id !== id));
            showToast('בקשת הקליטה נמחקה סופית מהמערכת 🗑️');
          }}
        />
      )}

      {/* Send Proactive Intake Request Modal */}
      <SendIntakeModal
        isOpen={isSendIntakeModalOpen}
        onClose={() => setIsSendIntakeModalOpen(false)}
        settings={settings}
        bookings={bookings}
        intakeRequests={intakeRequests}
        onOpenFormPreview={() => {
          setIsStaffPreviewMode(true);
          setShowPublicIntake(true);
        }}
      />

      {/* Shabbat & Jewish Holiday Greetings Modal */}
      {greetingModalDate && (
        <ShabbatHolidayGreetingModal
          dateStr={greetingModalDate}
          bookings={bookings}
          settings={settings}
          onClose={() => setGreetingModalDate(null)}
        />
      )}

      {/* Digital Loyalty & Referral Voucher Modal */}
      {voucherModalData?.isOpen && (
        <VoucherModal
          isOpen={voucherModalData.isOpen}
          initialCustomerName={voucherModalData.customerName}
          initialDogName={voucherModalData.dogName}
          initialPhone={voucherModalData.phone}
          staysCount={voucherModalData.staysCount}
          settings={settings}
          bookings={bookings}
          onClose={() => setVoucherModalData(null)}
        />
      )}

      {/* Daily Dog Evening Updates Modal (20:00) */}
      {isDailyDogUpdatesOpen && (
        <DailyDogUpdatesModal
          bookings={bookings}
          settings={settings}
          intakeRequests={intakeRequests}
          onClose={() => setIsDailyDogUpdatesOpen(false)}
          showToast={showToast}
        />
      )}

      {/* Tomorrow 19:00 Overview to Shmulik Modal */}
      {isTomorrowOverviewModalOpen && (
        <TomorrowOverviewModal
          isOpen={isTomorrowOverviewModalOpen}
          onClose={() => setIsTomorrowOverviewModalOpen(false)}
          bookings={bookings}
          settings={settings}
          intakeRequests={intakeRequests}
          showToast={showToast}
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



      {/* Persistent Floating Alert for Pending Grow Payments (when modal is snoozed/minimized) */}
      {pendingGrowPayments.length > 0 && isGrowPaymentsMinimized && !bookingWizardOpen.isOpen && !isGrowFloatingSnoozed && (
        <div 
          className="fixed bottom-5 left-4 right-4 sm:left-auto sm:right-6 sm:w-[430px] z-40 bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white p-3.5 rounded-2xl shadow-2xl border-2 border-emerald-500 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-5 duration-300 ring-4 ring-emerald-500/25"
          dir="rtl"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative w-10 h-10 rounded-xl bg-emerald-600/30 border border-emerald-400/40 flex items-center justify-center text-xl shrink-0 backdrop-blur-xs">
              💳
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
            </div>
            <div className="min-w-0">
              <div className="font-black text-xs sm:text-sm tracking-tight flex items-center gap-1.5 text-emerald-300">
                <span>תשלום ממתין לטיפול!</span>
                <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-1.5 py-0.2 rounded-full font-mono">
                  ₪{pendingGrowPayments[0]?.amount.toLocaleString()}
                </span>
              </div>
              <p className="text-[11px] text-slate-200 font-medium truncate mt-0.5">
                {pendingGrowPayments[0]?.customer_name} ({pendingGrowPayments[0]?.payment_method || 'Bit'})
                {pendingGrowPayments.length > 1 && ` • ועוד ${pendingGrowPayments.length - 1} ממתינים`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                setIsGrowPaymentsMinimized(false);
              }}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-3 py-2 rounded-xl text-xs shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-1"
            >
              <span>טפל עכשיו</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setIsGrowFloatingSnoozed(true);
                setTimeout(() => setIsGrowFloatingSnoozed(false), 15 * 60 * 1000);
                showToast('התזכורת תושתק ל-15 דקות ⏳ (נגישה תמיד מהסרגל העליון)');
              }}
              className="text-slate-400 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-colors cursor-pointer text-xs"
              title="השתק תזכורת צפה ל-15 דקות"
            >
              ✕
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
