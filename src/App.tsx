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
import { getTodayStr, getBookingsForDate, addDays, HEBREW_MONTHS, getBookingPaymentsInMonth, calculateDaysCount } from './utils/dateUtils';

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
import { Settings as SettingsIcon, Star, ChevronUp, ChevronDown, MessageCircle, Bell, Volume2 } from 'lucide-react';
import { SettingsModal } from './components/SettingsModal';
import { ReportsModal } from './components/ReportsModal';
import { Guide } from './components/Guide';
import { HeaderMetricModal, HeaderMetricType } from './components/HeaderMetricModal';
import { IntakeRequestsModal, calculateBoardingRate } from './components/IntakeRequestsModal';
import { CheckoutDebtAlertModal } from './components/CheckoutDebtAlertModal';
import { PublicIntakePage } from './components/PublicIntakePage';
import { SendIntakeModal } from './components/SendIntakeModal';
import { getDateShabbatOrHoliday } from './utils/jewishCalendar';
import { ShabbatHolidayGreetingModal } from './components/ShabbatHolidayGreetingModal';
import { VoucherModal } from './components/VoucherModal';
import { DailyDogUpdatesModal } from './components/DailyDogUpdatesModal';
import { WhatsAppLeadsView } from './components/WhatsAppLeadsView';
import { playNotificationChime, testSystemNotification } from './utils/soundUtils';

export default function App() {
  // Core application state with live Cloud synchronization
  const [bookings, setBookings] = useState<Booking[]>(() => loadStoredBookings());
  const [settings, setSettings] = useState<ResortSettings>(() => loadStoredSettings());
  const [activeTab, setActiveTab] = useState<'calendar' | 'forecast' | 'bookings' | 'customers' | 'whatsapp'>('calendar');

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
  const [isSendIntakeModalOpen, setIsSendIntakeModalOpen] = useState(false);
  const [isDailyDogUpdatesOpen, setIsDailyDogUpdatesOpen] = useState(false);
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

  // 11:00 AM Scheduled Push & In-App Auto Reminder for Shabbat / Holiday (Disabled on Yom Kippur)
  useEffect(() => {
    if (!todayHolidayInfo.isSpecial || todayHolidayInfo.isYomKippur || totalDogsToday === 0) return;

    const checkAndTrigger11AmReminder = () => {
      const now = new Date();
      const hour = now.getHours();

      // Trigger at 11:00 AM or later today
      if (hour >= 11) {
        let sentCount = 0;
        try {
          const saved = localStorage.getItem(`shabbat_greetings_${todayStr}`);
          const map = saved ? JSON.parse(saved) : {};
          sentCount = todayBookings.filter(b => map[b.id]).length;
        } catch {}

        const unsent = todayBookings.length - sentCount;
        if (unsent > 0) {
          // 1. In-App Auto Popup: Pop up greeting modal directly on screen with audio chime
          const inAppOpenedKey = `shabbat_11am_inapp_opened_${todayStr}`;
          if (!sessionStorage.getItem(inAppOpenedKey)) {
            sessionStorage.setItem(inAppOpenedKey, 'true');
            playNotificationChime();
            setGreetingModalDate(todayStr);
            showToast(`🔔 שעה 11:00! נפתחה רשימת ד״ש ${todayHolidayInfo.label} לשליחה בוואטסאפ ל-${unsent} כלבים.`);
          }

          // 2. Browser Native Push Notification (fires if browser/tab is in background)
          const pushSentKey = `shabbat_11am_push_sent_${todayStr}`;
          if (!localStorage.getItem(pushSentKey) && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            try {
              const notif = new Notification(`🐾 תזכורת לשמוליק: ד״ש ${todayHolidayInfo.label}!`, {
                body: `השעה 11:00! ישנם ${totalDogsToday} כלבים בריזורט (${unsent} טרם קיבלו ד״ש). לחץ כאן לשליחה בוואטסאפ לבעלים.`,
                icon: '/favicon.ico',
                tag: `shabbat-greeting-${todayStr}`,
                requireInteraction: true
              });
              notif.onclick = () => {
                window.focus();
                playNotificationChime();
                setGreetingModalDate(todayStr);
                notif.close();
              };
              localStorage.setItem(pushSentKey, 'true');
            } catch (err) {
              console.warn('Native notification error:', err);
            }
          }
        }
      }
    };

    checkAndTrigger11AmReminder();
    const interval = setInterval(checkAndTrigger11AmReminder, 15000);
    return () => clearInterval(interval);
  }, [todayHolidayInfo.isSpecial, todayHolidayInfo.label, totalDogsToday, todayBookings, todayStr]);

  // Accurate real-time money calculation across all bookings
  const totalCollected = activeBookings.reduce((acc, b) => {
    if (b.paymentStatus === 'fully_paid') {
      return acc + (Number(b.totalPrice) || 0);
    }
    return acc + (Number(b.depositAmount) || 0);
  }, 0);

  // Month-to-date collections calculation (הכנסות שנפרעו בפועל מתחילת החודש הנוכחי - Cash Basis)
  const currentMonthKey = todayStr.substring(0, 7);
  const monthToDateCollected = activeBookings.reduce((acc, b) => {
    return acc + getBookingPaymentsInMonth(b, currentMonthKey);
  }, 0);
  const monthPaidCount = activeBookings.filter(b => getBookingPaymentsInMonth(b, currentMonthKey) > 0).length;

  // Active stays and dogs in current month
  const currentMonthStart = `${todayStr.substring(0, 7)}-01`;
  const [curY, curM] = todayStr.split('-').map(Number);
  const curMonthLastDay = new Date(curY, curM, 0).getDate();
  const currentMonthEnd = `${todayStr.substring(0, 7)}-${String(curMonthLastDay).padStart(2, '0')}`;
  const currentMonthActiveStays = activeBookings.filter(b => b.startDate <= currentMonthEnd && b.endDate >= currentMonthStart);
  const currentMonthUniqueDogs = new Set(currentMonthActiveStays.map(b => b.dogName)).size;

  // Mini columns data for the last 4 months (עמודות לחודשים אחרונים לפי פירעון בפועל)
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
      const rev = activeBookings.reduce((sum, b) => {
        return sum + getBookingPaymentsInMonth(b, ymPrefix);
      }, 0);
      list.push({
        label: HEBREW_MONTHS[m].slice(0, 3),
        fullName: `${HEBREW_MONTHS[m]} ${y}`,
        revenue: rev,
        isCurrent: i === 0
      });
    }
    return list;
  }, [activeBookings, todayStr]);
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
  const handleAcceptGrowPayment = (payment: GrowIncomingPayment) => {
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

    setBookingWizardOpen({
      isOpen: true,
      initialData: {
        ownerName: matchedIntake?.ownerName || payment.customer_name,
        ownerPhone: payment.customer_phone || matchedIntake?.ownerPhone || '',
        ownerEmail: payment.customer_email || matchedIntake?.ownerEmail || '',
        dogName: matchedIntake?.dogName || '',
        dogBreed: matchedIntake?.dogBreed || '',
        serviceType: matchedIntake?.serviceType || 'boarding',
        startDate: matchedIntake?.startDate || getTodayStr(),
        endDate: matchedIntake?.endDate || addDays(getTodayStr(), 3),
        vaccinationValid: matchedIntake?.isVaccinated ?? true,
        depositAmount: payment.amount,
        totalPrice: payment.amount,
        paymentStatus: 'deposit_paid',
        paymentMethod: payMethod,
        stayStatus: 'booked',
        notes: [
          matchedIntake?.specialNeeds ? `צרכים מיוחדים: ${matchedIntake.specialNeeds}` : '',
          matchedIntake?.notes ? `הערות מטופס בקשת הקליטה: ${matchedIntake.notes}` : '',
          `עסקת Grow (אסמכתא: ${payment.reference_id})`
        ].filter(Boolean).join(' | '),
      }
    });

    if (matchedIntake) {
      updateIntakeRequestStatusInDb(matchedIntake.id, 'approved');
      showToast(`✨ תאריכים ופרטי ${matchedIntake.dogName} נטענו אוטומטית מטופס בקשת הקליטה!`);
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

        {/* All Controls in One Single Unified Horizontal Row */}
        <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-3 pb-2.5 border-b border-slate-200">
          
          {/* Action Buttons (Right in RTL) */}
          <div className="flex items-center gap-2 overflow-x-auto py-1">
            {/* 1. First from right: Intake Requests Modal (with prominent live count) */}
            <button
              type="button"
              onClick={() => setIsIntakeModalOpen(true)}
              id="btn-intake-requests-top"
              className={`font-black px-3.5 py-2 rounded-xl text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer relative shadow-2xs shrink-0 ${
                pendingIntakeCount > 0
                  ? 'bg-gradient-to-r from-emerald-50 via-white to-emerald-50 hover:from-emerald-100 hover:to-emerald-50 border-2 border-emerald-600 text-emerald-950 shadow-md shadow-emerald-700/15 ring-2 ring-emerald-500/25 hover:scale-[1.02] active:scale-95'
                  : 'bg-white hover:bg-slate-50 active:scale-95 border border-slate-200 hover:border-emerald-300 text-slate-800'
              }`}
              title="צפייה בבקשות קליטה חדשות מלקוחות, חיוג לתיאום, ושליחת קישור לתשלום"
            >
              <span className="text-base">📥</span>
              <span className="font-black">בקשות קליטה</span>
              {pendingIntakeCount > 0 && (
                <span className="relative flex items-center justify-center mr-0.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex items-center justify-center min-w-[26px] h-[26px] px-1.5 bg-gradient-to-r from-red-600 to-rose-600 text-white text-sm sm:text-base font-black font-mono rounded-full shadow-md ring-2 ring-white">
                    {pendingIntakeCount}
                  </span>
                </span>
              )}
            </button>

            {/* 2. Attached right next to Intake Requests: Send Intake Questionnaire */}
            <button
              type="button"
              onClick={() => setIsSendIntakeModalOpen(true)}
              className="bg-white hover:bg-slate-50 active:scale-95 border border-slate-200 hover:border-emerald-300 text-slate-800 font-bold px-3 py-2 rounded-xl text-xs sm:text-sm shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
              title="שליחת שאלון בקשה לקליטה בוואטסאפ ללקוח שהתקשר, או העתקת הקישור"
            >
              <span className="text-base">🔗</span>
              <span>שלח שאלון בקשה לקליטה</span>
            </button>

            {/* 2.5. Daily Evening Dog Update (20:00) */}
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

            {/* 3. New Booking */}
            <button
              onClick={() => setBookingWizardOpen({ isOpen: true, initialData: null })}
              id="btn-new-booking-top"
              className="bg-[#065f46] hover:bg-[#044e45] active:scale-95 text-white font-black px-3.5 py-2 rounded-xl text-xs sm:text-sm shadow-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
            >
              <span className="text-base font-bold">+</span>
              <span>הזמנה חדשה</span>
            </button>

            {/* 4. Reports Button */}
            <button
              type="button"
              onClick={() => setIsReportsOpen(true)}
              className="bg-white hover:bg-slate-50 active:scale-95 border border-slate-200 hover:border-amber-300 text-slate-700 font-bold px-3 py-2 rounded-xl text-xs sm:text-sm shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
              title="דוחות כספיים ותפוסה"
            >
              <span className="text-base">💰</span>
              <span>דוחות</span>
            </button>

            {/* 5. Settings Button */}
            <button
              onClick={handleOpenSettingsWithAuth}
              id="btn-settings-top"
              className="bg-white hover:bg-slate-50 active:scale-95 border border-slate-200 hover:border-slate-300 text-slate-700 font-bold px-3 py-2 rounded-xl text-xs sm:text-sm shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
              title="הגדרות תפוסה, תעריפים, ביט וגיבוי (אישור מנהל)"
            >
              <span className="text-base">⚙️</span>
              <span>הגדרות</span>
            </button>

          </div>

          {/* Main View Navigation Tabs (Left in RTL) */}
          <div className="flex items-center bg-slate-100/90 p-1 rounded-2xl border border-slate-200 shadow-2xs shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('calendar')}
              className={`text-xs sm:text-sm font-black px-3.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'calendar'
                  ? 'bg-[#065f46] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
              }`}
            >
              <span>📅</span>
              <span>יומן</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('forecast')}
              className={`text-xs sm:text-sm font-black px-3.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'forecast'
                  ? 'bg-[#065f46] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
              }`}
            >
              <span>📊</span>
              <span>תפוסה</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('bookings')}
              className={`text-xs sm:text-sm font-black px-3.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'bookings'
                  ? 'bg-[#065f46] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
              }`}
            >
              <span>📋</span>
              <span>הזמנות ({activeBookings.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('customers')}
              className={`text-xs sm:text-sm font-black px-3.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'customers'
                  ? 'bg-[#065f46] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
              }`}
            >
              <span>⭐</span>
              <span>לקוחות</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('whatsapp')}
              className={`text-xs sm:text-sm font-black px-3.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'whatsapp'
                  ? 'bg-[#065f46] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
              }`}
            >
              <span>💬</span>
              <span>וואטסאפ ופניות</span>
            </button>
          </div>

        </div>

        {/* Shabbat / Jewish Holiday Dog Greetings Reminder Banner for Shmulik */}
        {todayHolidayInfo.isSpecial && totalDogsToday > 0 && !isGreetingBannerDismissed && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-300">
            {todayUnsentGreetingsCount > 0 ? (
              <div className="bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white rounded-2xl p-3 sm:p-4 shadow-md border border-red-500/60 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-2xl shrink-0 shadow-xs ring-1 ring-white/30">
                    {todayHolidayInfo.icon || '🕯️'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-sm sm:text-base tracking-tight">
                        תזכורת לשמוליק – ד״ש {todayHolidayInfo.label} לבעלי הכלבים!
                      </span>
                      <span className="bg-amber-400 text-slate-950 text-[11px] font-black px-2.5 py-0.5 rounded-full shadow-2xs">
                        נותרו {todayUnsentGreetingsCount} לשליחה
                      </span>
                      {notificationPermission === 'granted' ? (
                        <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-md border border-white/30 flex items-center gap-1">
                          <span>🔔</span>
                          <span>תזכורת פוש ב-11:00 פעילה</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={requestNotificationPermission}
                          className="bg-white/20 hover:bg-white/30 text-white text-[10px] font-bold px-2 py-0.5 rounded-md border border-white/30 flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                          title="אפשר קבלת התראת פוש ב-11:00 בבוקר"
                        >
                          <span>🔔</span>
                          <span>הפעל תזכורת פוש ב-11:00</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleTestNotification}
                        className="bg-white/20 hover:bg-white/30 text-white text-[10px] font-bold px-2 py-0.5 rounded-md border border-white/30 flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                        title="בדוק השמעת צליל והתראת פוש עכשיו"
                      >
                        <Volume2 className="w-3 h-3" />
                        <span>בדוק צליל והתראה</span>
                      </button>
                    </div>
                    <p className="text-xs text-red-100 font-medium mt-0.5">
                      נוכחים היום {totalDogsToday} כלבים בריזורט ({todayGreetingsSentCount} נשלחו עד כה). שלח להם ד״ש משמח בוואטסאפ בקליק!
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
                  <button
                    type="button"
                    onClick={() => setGreetingModalDate(todayStr)}
                    className="w-full sm:w-auto bg-white hover:bg-red-50 text-red-950 font-black px-4 py-2.5 rounded-xl text-xs sm:text-sm shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95 shrink-0"
                  >
                    <MessageCircle className="w-4 h-4 text-red-600" />
                    <span>שלח ד״ש עכשיו לבעלים</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl px-3.5 py-2.5 text-xs font-bold flex items-center justify-between shadow-2xs">
                <div className="flex items-center gap-2">
                  <span className="text-base">🎉</span>
                  <span className="font-black text-emerald-950">
                    מעולה שמוליק! כל {totalDogsToday} הודעות הד״ש ל{todayHolidayInfo.label} נשלחו בהצלחה לבעלים.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setGreetingModalDate(todayStr)}
                  className="text-emerald-700 hover:text-emerald-900 underline font-black text-xs cursor-pointer"
                >
                  פתח רשימה
                </button>
              </div>
            )}
          </div>
        )}

        {/* Header Metrics Section: Ultra-Compact & Space-Efficient with Collapse Option */}
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
                className="cursor-pointer hover:text-emerald-700 transition-colors shrink-0"
                title="לחץ לפתיחת גרפי הכנסות ודוחות"
              >
                💰 הכנסות החודש: <strong className="text-[#0f766e]">₪{monthToDateCollected.toLocaleString('he-IL')}</strong>
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

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
              
              {/* Card 1 (Right in RTL): תפוסה כללית */}
              <div 
                onClick={() => setActiveHeaderMetric('occupancy')}
                role="button"
                tabIndex={0}
                className="bg-white border border-slate-200 rounded-xl p-2.5 sm:p-3 shadow-2xs flex flex-col justify-between hover:border-emerald-400 hover:shadow-xs cursor-pointer transition-all active:scale-[0.99] group"
                title="לחץ לעיון ועריכת כלבי התפוסה הכללית היום"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 group-hover:text-emerald-700 transition-colors truncate">
                    תפוסה כללית
                  </span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full border ${
                    totalDogsToday >= settings.maxCapacity 
                      ? 'bg-red-50 text-red-700 border-red-200' 
                      : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  }`}>
                    {Math.round((totalDogsToday / Math.max(1, settings.maxCapacity)) * 100)}%
                  </span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-slate-900 my-0.5 text-right">
                  {totalDogsToday} <span className="text-[11px] font-semibold text-slate-400">/ {settings.maxCapacity}</span>
                </div>
                <div className="flex items-center justify-between text-[10px] font-medium text-slate-500 pt-1 border-t border-slate-100">
                  <span className="truncate">{freeSlots > 0 ? `${freeSlots} פנויים` : 'מלא 🔴'}</span>
                  <span className="text-[10px] text-emerald-700 font-bold opacity-80 group-hover:opacity-100">
                    עיון 🔍
                  </span>
                </div>
              </div>

              {/* Card 2: פנסיון ומשפחתון */}
              <div 
                onClick={() => setActiveHeaderMetric('boarding')}
                role="button"
                tabIndex={0}
                className="bg-white border border-slate-200 rounded-xl p-2.5 sm:p-3 shadow-2xs flex flex-col justify-between hover:border-sky-400 hover:shadow-xs cursor-pointer transition-all active:scale-[0.99] group"
                title="לחץ לעיון ועריכת כלבי הפנסיון והדייקר היום"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 group-hover:text-sky-700 transition-colors truncate">
                    פנסיון ומשפחתון
                  </span>
                  <span className="text-[10px] font-bold text-sky-700 bg-sky-50 px-1.5 py-0.2 rounded-full border border-sky-200">
                    🏨 לינה
                  </span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-slate-900 my-0.5 text-right">
                  {boardingToday} <span className="text-[11px] font-semibold text-slate-400">כלבים</span>
                </div>
                <div className="flex items-center justify-between text-[10px] font-medium text-slate-500 pt-1 border-t border-slate-100">
                  <span className="truncate">{boardingToday === 0 ? 'אין לינה' : `${boardingToday} בפנסיון`}</span>
                  <span className="text-[10px] text-sky-700 font-bold opacity-80 group-hover:opacity-100">
                    עיון 🔍
                  </span>
                </div>
              </div>

              {/* Card 3: באילוף היום */}
              <div 
                onClick={() => setActiveHeaderMetric('training')}
                role="button"
                tabIndex={0}
                className="bg-white border border-slate-200 rounded-xl p-2.5 sm:p-3 shadow-2xs flex flex-col justify-between hover:border-purple-400 hover:shadow-xs cursor-pointer transition-all active:scale-[0.99] group col-span-2 sm:col-span-1"
                title="לחץ לעיון ועריכת כלבי האילוף היום"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 group-hover:text-purple-700 transition-colors truncate">
                    באילוף היום
                  </span>
                  <span className="text-[10px] font-black text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded-full border border-purple-200">
                    סה״כ {trainingToday}
                  </span>
                </div>

                {/* Compact Split: תהליך אילוף vs אילוף ביומיות */}
                <div className="flex items-center justify-between gap-1 my-0.5 pt-0.5">
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg sm:text-xl font-black text-purple-600">{fullTrainingToday}</span>
                    <span className="text-[10px] font-bold text-slate-600">🎓 מלא</span>
                  </div>
                  <div className="text-slate-200">|</div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg sm:text-xl font-black text-indigo-600">{dayTrainingToday}</span>
                    <span className="text-[10px] font-bold text-slate-600">🦮 יומיות</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] font-medium text-slate-500 pt-1 border-t border-slate-100">
                  <span className="truncate">{fullTrainingToday} מלא · {dayTrainingToday} ביומיות</span>
                  <span className="text-[10px] text-purple-700 font-bold opacity-80 group-hover:opacity-100">
                    עיון 🔍
                  </span>
                </div>
              </div>

              {/* Card 4: חוב פתוח */}
              <div 
                onClick={() => setActiveHeaderMetric('debt')}
                role="button"
                tabIndex={0}
                className="bg-white border border-slate-200 rounded-xl p-2.5 sm:p-3 shadow-2xs flex flex-col justify-between hover:border-red-400 hover:shadow-xs cursor-pointer transition-all active:scale-[0.99] group"
                title="לחץ לעיון ועריכת ההזמנות עם יתרת חוב פתוח"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 group-hover:text-red-700 transition-colors truncate">
                    חוב פתוח
                  </span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full border ${
                    openDebtTotal === 0
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-red-50 text-red-700 border-red-200'
                  }`}>
                    {openDebtTotal === 0 ? '🟢 הכול שולם' : `🔴 ${unpaidCount} ממתינות`}
                  </span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-[#0f766e] my-0.5 text-right">
                  ₪{openDebtTotal.toLocaleString('he-IL')}
                </div>
                <div className="flex items-center justify-between text-[10px] font-medium text-slate-500 pt-1 border-t border-slate-100">
                  <span className="truncate">{openDebtTotal === 0 ? 'הכול שולם 🥳' : `${unpaidCount} עם יתרה`}</span>
                  <span className="text-[10px] text-red-600 font-bold opacity-80 group-hover:opacity-100">
                    עיון 🔍
                  </span>
                </div>
              </div>

              {/* Card 5 (Left in RTL): הכנסות מתחילת החודש ועמודות לחודשים אחרונים */}
              <div 
                onClick={() => setActiveHeaderMetric('revenue')}
                role="button"
                tabIndex={0}
                className="bg-white border border-slate-200 rounded-xl p-2.5 sm:p-3 shadow-2xs flex flex-col justify-between hover:border-emerald-400 hover:shadow-xs cursor-pointer transition-all active:scale-[0.99] group"
                title="לחץ לצפייה בגרפי עמודות חודשיים ושנתיים וייצוא לאקסל"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 group-hover:text-emerald-700 transition-colors truncate">
                    הכנסות החודש
                  </span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded-full border border-emerald-200">
                    🐾 {currentMonthActiveStays.length} שהויות
                  </span>
                </div>

                {/* Revenue Amount + Mini Column Bars Side-by-Side */}
                <div className="flex items-end justify-between gap-1.5 my-0.5">
                  <div>
                    <div className="text-xl sm:text-2xl font-black text-[#0f766e] leading-tight">
                      ₪{monthToDateCollected.toLocaleString('he-IL')}
                    </div>
                    <div className="text-[9px] text-slate-400 font-medium">
                      {currentMonthUniqueDogs} כלבים · {monthPaidCount} שולמו
                    </div>
                  </div>

                  {/* 4 Mini Month Bars in same row! */}
                  <div className="flex items-end gap-1 h-7 pb-0.5 shrink-0" title="עמודות 4 חודשים אחרונים (לחץ לגרפים מפורטים)">
                    {recentMonthsMiniData.map((mItem, idx) => {
                      const barHeight = Math.max(18, Math.round((mItem.revenue / maxRecentMiniRev) * 100));
                      return (
                        <div key={idx} className="flex flex-col items-center gap-0.5 h-full justify-end w-2.5 sm:w-3">
                          <div
                            className={`w-full rounded-t-xs transition-all ${
                              mItem.isCurrent
                                ? 'bg-emerald-600 group-hover:bg-emerald-700'
                                : 'bg-slate-300 group-hover:bg-slate-400'
                            }`}
                            style={{ height: `${barHeight}%` }}
                          />
                          <span className={`text-[7px] sm:text-[8px] leading-none ${mItem.isCurrent ? 'text-emerald-900 font-black' : 'text-slate-400'}`}>
                            {mItem.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] font-medium text-slate-500 pt-1 border-t border-slate-100">
                  <span className="truncate">{monthPaidCount} שולמו</span>
                  <span className="text-[10px] text-emerald-700 font-bold opacity-80 group-hover:opacity-100">
                    גרפים 📊
                  </span>
                </div>
              </div>

            </div>
          </div>
        )}





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
          intakeRequests={intakeRequests}
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
            const calculatedDefault = req.serviceType === 'training'
              ? (Number(settings?.defaultDailyRateTraining) || 6500)
              : req.serviceType === 'daycare'
              ? (daysCount * (Number(settings?.defaultDailyRateDaycare) || 90))
              : boardingRateInfo.totalPrice;
            const finalPrice = req.depositRequested && req.depositRequested > 0 ? req.depositRequested : calculatedDefault;
            const dailyRateVal = req.serviceType === 'boarding' ? boardingRateInfo.dailyRate : undefined;

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
                depositAmount: req.depositRequested || 0,
                paymentStatus: req.depositRequested ? 'deposit_paid' : 'fully_paid',
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
        onOpenFormPreview={() => setShowPublicIntake(true)}
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

      {/* Persistent Floating 11:00 Alert Bar for Shabbat / Holiday (Never on Yom Kippur) */}
      {todayHolidayInfo.isSpecial && !todayHolidayInfo.isYomKippur && todayUnsentGreetingsCount > 0 && new Date().getHours() >= 11 && !greetingModalDate && !isGreetingFloatingSnoozed && (
        <div 
          className="fixed bottom-5 left-4 right-4 sm:left-auto sm:right-6 sm:w-[420px] z-40 bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white p-3.5 rounded-2xl shadow-2xl border-2 border-white/40 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-5 duration-300 ring-4 ring-red-600/20"
          dir="rtl"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-xl shrink-0 backdrop-blur-xs ring-1 ring-white/30">
              ⏰
            </div>
            <div className="min-w-0">
              <div className="font-black text-xs sm:text-sm tracking-tight flex items-center gap-1.5">
                <span>שמוליק, שעה 11:00 חלפה!</span>
                <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-1.5 py-0.2 rounded-full">
                  {todayUnsentGreetingsCount}
                </span>
              </div>
              <p className="text-[11px] text-red-100 font-medium truncate mt-0.5">
                נותרו {todayUnsentGreetingsCount} כלבים ללא ד״ש {todayHolidayInfo.label}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                playNotificationChime();
                setGreetingModalDate(todayStr);
              }}
              className="bg-white hover:bg-red-50 text-red-950 font-black px-3.5 py-2 rounded-xl text-xs shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
            >
              <MessageCircle className="w-3.5 h-3.5 text-red-600" />
              <span>שלח עכשיו</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsGreetingFloatingSnoozed(true);
                setTimeout(() => setIsGreetingFloatingSnoozed(false), 15 * 60 * 1000);
                showToast('התזכורת תושתק ל-15 דקות ⏳');
              }}
              className="text-white/70 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-colors cursor-pointer text-xs"
              title="השתק ל-15 דקות"
            >
              ✕
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
