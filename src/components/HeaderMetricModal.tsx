import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { 
  X, 
  Search, 
  Dog, 
  User, 
  Phone, 
  Calendar, 
  CreditCard, 
  CheckCircle, 
  Check,
  Edit3, 
  MessageSquare, 
  Sparkles, 
  Building2, 
  GraduationCap, 
  DollarSign, 
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Download,
  TrendingUp,
  Home
} from 'lucide-react';
import { Booking, ResortSettings, StayStatus } from '../types';
import { getTodayStr, calculateDaysCount, formatDateIL, getBookingsForDate, getBookingPaymentsInMonth, getMonthlyRevenueBreakdown, VERIFIED_GROW_LEDGER } from '../utils/dateUtils';
import { generatePaymentReminderMessage, openWhatsAppMessage, getServiceTypeHebrew } from '../utils/whatsappUtils';
import { exportRevenueChartsToExcel, ChartPeriodItem } from '../utils/exportUtils';
import { TrainerReceipt, TrainerPaymentStage } from '../types';
import { 
  getTrainerReceipts, 
  saveTrainerReceipts, 
  applyReceiptToBookings, 
  computeTrainerMetrics, 
  getBookingTrainerStages, 
  getDeduplicatedTrainingBookings,
  formatManagerReceiptQuery,
  detectTrainerPaymentAnomalies,
  syncTrainerReceiptsFromWhatsAppChat,
  isRealTrainingBooking,
  TrainerAnomaly,
  HILA_TRAINER_INFO 
} from '../utils/trainerPaymentUtils';
import { TrainerReceiptIntakeModal } from './TrainerReceiptIntakeModal';

export type HeaderMetricType = 'occupancy' | 'boarding' | 'training' | 'debt' | 'revenue';

interface HeaderMetricModalProps {
  metricType: HeaderMetricType | null;
  onClose: () => void;
  bookings: Booking[];
  settings: ResortSettings;
  onEditBooking: (booking: Booking) => void;
  onMarkAsPaid: (bookingId: string) => void;
  onOpenPaymentModal: (booking: Booking) => void;
  onToggleStayStatus?: (bookingId: string, current: StayStatus) => void;
  onInitiateRelease?: (booking: Booking) => void;
  onUpdateBooking?: (booking: Booking) => void;
  onUpdateBookings?: (bookings: Booking[]) => void;
}

const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
];

export const HeaderMetricModal: React.FC<HeaderMetricModalProps> = ({
  metricType: initialMetricType,
  onClose,
  bookings,
  settings,
  onEditBooking,
  onMarkAsPaid,
  onOpenPaymentModal,
  onToggleStayStatus,
  onInitiateRelease,
  onUpdateBooking,
  onUpdateBookings,
}) => {
  const metricType = (initialMetricType as any) === 'hila_trainer' ? 'training' : initialMetricType;
  const [searchQuery, setSearchQuery] = useState('');
  const [trainingFilter, setTrainingFilter] = useState<'all' | 'full' | 'day'>('all');
  const [revenueViewTab, setRevenueViewTab] = useState<'cash' | 'digital' | 'grow_10th' | 'direct_transfer' | 'grow_in_2_months' | 'refunds' | 'all' | 'graphs'>('cash');
  const [chartMode, setChartMode] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedChartPeriod, setSelectedChartPeriod] = useState<string | null>(null);

  // Robust payment channel classifiers for revenue view
  const isGrowPayment = useCallback((b: Booking): boolean => {
    const notes = ((b.notes || '') + ' ' + ((b as any)?.data?.internalNotes || '')).toLowerCase();
    const id = b.id || '';
    const isLedger = VERIFIED_GROW_LEDGER.some(t => notes.includes(t.ref.toLowerCase()) || id.includes(t.ref));
    const isGrowMethod = b.paymentMethod === 'credit' || b.paymentMethod === 'grow';
    const hasGrowKeyword = notes.includes('grow') || notes.includes('אשראי') || notes.includes('סליקה') || notes.includes('gpay');
    const isBank = notes.includes('העברה בנקאית') || (b.ownerName || '').includes('רונן מלמוד');
    return (isLedger || isGrowMethod || hasGrowKeyword) && !isBank;
  }, []);

  const isDirectBankTransfer = useCallback((b: Booking): boolean => {
    const notes = ((b.notes || '') + ' ' + ((b as any)?.data?.internalNotes || '')).toLowerCase();
    const owner = (b.ownerName || '').toLowerCase();
    const isLedger = VERIFIED_DIRECT_TRANSFERS.some(t => owner.includes(t.customerName.toLowerCase()) || (b.id || '').includes(t.ref));
    const isBankMethod = b.paymentMethod === 'bank_transfer';
    const hasBankKeyword = notes.includes('העברה בנקאית') || notes.includes('ישיר לחשבון') || (owner.includes('רונן') && owner.includes('מלמוד'));
    return isLedger || isBankMethod || hasBankKeyword;
  }, []);

  const isInstallmentPayment = useCallback((b: Booking): boolean => {
    const notes = ((b.notes || '') + ' ' + ((b as any)?.data?.internalNotes || '')).toLowerCase();
    const owner = (b.ownerName || '').toLowerCase();
    const dog = (b.dogName || '').toLowerCase();
    const isKnown = KNOWN_FUTURE_INSTALLMENTS.some(inst => owner.includes(inst.customerName.toLowerCase()) || dog.includes(inst.dogName.toLowerCase()));
    const hasInstallmentKeyword = notes.includes('מתוך') || notes.includes('תשלום ראשון') || (owner.includes('דורין') && owner.includes('לוקס'));
    return isKnown || hasInstallmentKeyword;
  }, []);

  const isRefundBooking = useCallback((b: Booking): boolean => {
    return (Number(b.refundAmount) || 0) > 0;
  }, []);

  const isDigitalPayment = useCallback((b: Booking): boolean => {
    return isGrowPayment(b) || isDirectBankTransfer(b) || isInstallmentPayment(b);
  }, [isGrowPayment, isDirectBankTransfer, isInstallmentPayment]);

  const isCashPayment = useCallback((b: Booking): boolean => {
    if (isRefundBooking(b) && (Number(b.depositAmount) || 0) === 0 && b.paymentStatus !== 'fully_paid') {
      return false;
    }
    if (isGrowPayment(b)) return false;
    if (isDirectBankTransfer(b)) return false;
    if (isInstallmentPayment(b)) return false;

    const dog = (b.dogName || '').toLowerCase();
    if (dog.includes("ג'וי") || dog.includes("גו'י")) return false;

    const hasPaid = (Number(b.depositAmount) || 0) > 0 || b.paymentStatus === 'fully_paid';
    if (!hasPaid) return false;

    const notes = ((b.notes || '') + ' ' + ((b as any)?.data?.internalNotes || '')).toLowerCase();
    return b.paymentMethod === 'cash' || notes.includes('מזומן') || notes.includes('שטרות') || b.paymentMethod === 'bit' || !b.paymentMethod;
  }, [isRefundBooking, isGrowPayment, isDirectBankTransfer, isInstallmentPayment]);

  // Trainer Hila View States (Default to trainer_payments if opened via hila_trainer)
  const [trainingViewTab, setTrainingViewTab] = useState<'active' | 'completed' | 'trainer_payments'>(
    (initialMetricType as any) === 'hila_trainer' ? 'trainer_payments' : 'active'
  );
  const [isTrainerReceiptModalOpen, setIsTrainerReceiptModalOpen] = useState(false);
  const [selectedReceiptForEdit, setSelectedReceiptForEdit] = useState<TrainerReceipt | undefined>(undefined);
  const [trainerReceipts, setTrainerReceipts] = useState<TrainerReceipt[]>(() => getTrainerReceipts());
  const [trainerActionFeedback, setTrainerActionFeedback] = useState<string | null>(null);
  const [isSyncingHilaChat, setIsSyncingHilaChat] = useState(false);
  const [receiptImagePreview, setReceiptImagePreview] = useState<{ url: string; title: string } | null>(null);

  const handleSyncHilaReceipts = useCallback(async (isSilent = false) => {
    if (isSyncingHilaChat) return;
    setIsSyncingHilaChat(true);
    try {
      const res = await syncTrainerReceiptsFromWhatsAppChat(settings, bookings);
      setTrainerReceipts(res.receipts);
      if (!isSilent) {
        if (res.newReceiptsCount > 0) {
          setTrainerActionFeedback(`🎉 נמשכו בהצלחה ${res.newReceiptsCount} קבלות חדשות מהוואטסאפ של הילה!`);
        } else {
          setTrainerActionFeedback(`✓ שיחת הוואטסאפ של הילה סונכרנה (לא נמצאו קבלות חדשות שטרם נקלטו).`);
        }
      }
    } catch (e) {
      if (!isSilent) {
        setTrainerActionFeedback(`⚠️ שגיאה במשיכת קבלות מוואטסאפ הילה.`);
      }
    } finally {
      setIsSyncingHilaChat(false);
    }
  }, [settings, bookings, isSyncingHilaChat]);

  // Auto-sync from Hila's WhatsApp chat whenever training modal is opened
  useEffect(() => {
    if (metricType === 'training') {
      handleSyncHilaReceipts(true);
    }
  }, [metricType]);

  const todayStr = getTodayStr();
  const currentMonthKey = todayStr.substring(0, 7); // e.g. 2026-09
  const currentYearKey = todayStr.substring(0, 4);

  const [curYNum, curMNum] = currentMonthKey.split('-').map(Number);
  const next10thDateLabel = `10.${String(new Date(curYNum, (curMNum || 1), 10).getMonth() + 1).padStart(2, '0')}`;
  const inTwoMonthsDateLabel = `10.${String(new Date(curYNum, (curMNum || 1) + 1, 10).getMonth() + 1).padStart(2, '0')}`;

  const activeBookings = useMemo(() => {
    return bookings.filter(b => b.stayStatus !== 'cancelled');
  }, [bookings]);

  const allTrainingBookings = useMemo(() => {
    return getDeduplicatedTrainingBookings(bookings);
  }, [bookings]);

  const trainerMetrics = useMemo(() => {
    return computeTrainerMetrics(bookings, trainerReceipts);
  }, [bookings, trainerReceipts]);

  const trainerAnomalies = useMemo(() => {
    return detectTrainerPaymentAnomalies(bookings, trainerReceipts);
  }, [bookings, trainerReceipts]);

  const handleSaveReceipt = (receipt: TrainerReceipt) => {
    const updatedReceipts = [
      receipt,
      ...trainerReceipts.filter(r => r.id !== receipt.id)
    ];
    setTrainerReceipts(updatedReceipts);
    saveTrainerReceipts(updatedReceipts);

    const { updatedBookings, completedDogs } = applyReceiptToBookings(receipt, bookings);
    if (onUpdateBookings) {
      onUpdateBookings(updatedBookings);
    }
    for (const b of updatedBookings) {
      const orig = bookings.find(ob => ob.id === b.id);
      if (orig && (JSON.stringify(orig.trainerStages) !== JSON.stringify(b.trainerStages) || orig.isTrainingCompleted !== b.isTrainingCompleted)) {
        if (onUpdateBooking) onUpdateBooking(b);
      }
    }

    if (completedDogs.length > 0) {
      setTrainerActionFeedback(`🎉 הכלב/ים ${completedDogs.join(', ')} הגיעו לשלב 3/3 והועברו בהצלחה ללשונית "הסתיים האילוף"!`);
    } else {
      setTrainerActionFeedback(`✅ קבלה ${receipt.receiptNumber} נשמרה בהצלחה`);
    }
    setTimeout(() => setTrainerActionFeedback(null), 5000);
  };

  const handleMarkReceiptAsPaid = (receiptId: string) => {
    const updatedReceipts = trainerReceipts.map(r => {
      if (r.id === receiptId) {
        return {
          ...r,
          isPaidActually: true,
          paidDate: new Date().toISOString().substring(0, 10),
          status: 'paid' as const,
          updatedAt: new Date().toISOString(),
        };
      }
      return r;
    });
    setTrainerReceipts(updatedReceipts);
    saveTrainerReceipts(updatedReceipts);

    const paidRcpt = updatedReceipts.find(r => r.id === receiptId);
    if (paidRcpt) {
      const { updatedBookings } = applyReceiptToBookings(paidRcpt, bookings);
      if (onUpdateBookings) onUpdateBookings(updatedBookings);
      for (const b of updatedBookings) {
        if (onUpdateBooking) onUpdateBooking(b);
      }
    }
    setTrainerActionFeedback('✅ הקבלה סומנה כשולמה בביט והסטטוס סונכרן');
    setTimeout(() => setTrainerActionFeedback(null), 4000);
  };

  const handleGraduateDog = (bookingId: string) => {
    const updated = bookings.map(b => {
      if (b.id === bookingId) {
        return {
          ...b,
          isTrainingCompleted: true,
          trainingCompletedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }
      return b;
    });
    if (onUpdateBookings) onUpdateBookings(updated);
    const target = updated.find(b => b.id === bookingId);
    if (target && onUpdateBooking) onUpdateBooking(target);
    setTrainerActionFeedback(`🎓 ${target?.dogName || 'הכלב'} הועבר בהצלחה ללשונית "הסתיים האילוף"!`);
    setTimeout(() => setTrainerActionFeedback(null), 4000);
  };

  // Compute monthly and yearly aggregates for the charts
  const { monthlyChartData, yearlyChartData, currentMonthCollected, allTimeCollected, monthlyMap } = useMemo(() => {
    const monthlyMap: Record<string, {
      count: number;
      collected: number;
      digitalCleared: number;
      growClearedBankOn10th: number;
      directBankTransfers: number;
      bankOn10thInTwoMonths: number;
      cashBanknotes: number;
      cashCollected: number;
      totalCollected: number;
      totalRefunds: number;
      netCollected: number;
      expected: number;
      debt: number;
    }> = {};
    const yearlyMap: Record<string, { count: number; grossCollected: number; totalRefunds: number; netCollected: number; expected: number; debt: number }> = {};

    let totalAllTime = 0;
    let totalThisMonth = 0;

    // Calculate total all time gross
    activeBookings.forEach(b => {
      const col = b.paymentStatus === 'fully_paid'
        ? (Number(b.totalPrice) || 0)
        : (Number(b.depositAmount) || 0);
      totalAllTime += col;
    });

    // Deduct refunds from total all time
    bookings.forEach(b => {
      totalAllTime -= (Number(b.refundAmount) || 0);
    });
    if (totalAllTime < 0) totalAllTime = 0;

    // Build last 12 months sequence
    const recentKeys: string[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      recentKeys.push(`${y}-${m}`);
    }

    // Compute actual collections per month across the 4 categories
    recentKeys.forEach(mKey => {
      const breakdown = getMonthlyRevenueBreakdown(mKey, bookings);
      let mExpected = 0;
      let mDebt = 0;

      activeBookings.forEach(b => {
        if (b.startDate && b.startDate.startsWith(mKey)) {
          const exp = Number(b.totalPrice) || 0;
          mExpected += exp;
          const col = b.paymentStatus === 'fully_paid' ? exp : (Number(b.depositAmount) || 0);
          mDebt += Math.max(0, exp - col);
        }
      });

      monthlyMap[mKey] = {
        count: breakdown.digitalPaidCount + breakdown.cashPaidCount,
        collected: breakdown.netCollected, // נסלק נטו לאחר החזרים
        digitalCleared: breakdown.digitalCleared,
        growClearedBankOn10th: breakdown.growClearedBankOn10th,
        directBankTransfers: breakdown.directBankTransfers,
        bankOn10thInTwoMonths: breakdown.bankOn10thInTwoMonths,
        cashBanknotes: breakdown.cashCollected,
        cashCollected: breakdown.cashCollected,
        totalCollected: breakdown.totalCollected,
        totalRefunds: breakdown.totalRefunds,
        netCollected: breakdown.netCollected,
        expected: mExpected,
        debt: mDebt
      };

      if (mKey === currentMonthKey) {
        totalThisMonth = breakdown.digitalCleared;
      }
    });

    // Compute yearly collections from active bookings
    activeBookings.forEach(b => {
      const yKey = (b.createdAt || b.startDate || '').substring(0, 4);
      const collected = b.paymentStatus === 'fully_paid'
        ? (Number(b.totalPrice) || 0)
        : (Number(b.depositAmount) || 0);
      const expected = Number(b.totalPrice) || 0;
      const debt = Math.max(0, expected - collected);

      if (yKey && yKey.length === 4) {
        if (!yearlyMap[yKey]) yearlyMap[yKey] = { count: 0, grossCollected: 0, totalRefunds: 0, netCollected: 0, expected: 0, debt: 0 };
        yearlyMap[yKey].count += 1;
        yearlyMap[yKey].grossCollected += collected;
        yearlyMap[yKey].expected += expected;
        yearlyMap[yKey].debt += debt;
      }
    });

    // Include annual refunds from all bookings (including cancelled ones)
    bookings.forEach(b => {
      const refAmt = Number(b.refundAmount) || 0;
      if (refAmt > 0) {
        const yKey = (b.refundDate || b.startDate || b.createdAt || '').substring(0, 4);
        if (yKey && yKey.length === 4) {
          if (!yearlyMap[yKey]) yearlyMap[yKey] = { count: 0, grossCollected: 0, totalRefunds: 0, netCollected: 0, expected: 0, debt: 0 };
          yearlyMap[yKey].totalRefunds += refAmt;
        }
      }
    });

    // Compute net collected per year
    Object.keys(yearlyMap).forEach(y => {
      yearlyMap[y].netCollected = Math.max(0, yearlyMap[y].grossCollected - yearlyMap[y].totalRefunds);
    });

    // Merge any other months that have bookings
    Object.keys(monthlyMap).forEach(k => {
      if (!recentKeys.includes(k) && k.length === 7) {
        recentKeys.push(k);
      }
    });
    recentKeys.sort();

    const monthlyList: ChartPeriodItem[] = recentKeys.map(k => {
      const [y, m] = k.split('-');
      const mIdx = parseInt(m, 10) - 1;
      const label = `${HEBREW_MONTHS[mIdx] || m} '${y.substring(2)}`;
      const data = monthlyMap[k] || { count: 0, collected: 0, digitalCleared: 0, growClearedBankOn10th: 0, directBankTransfers: 0, bankOn10thInTwoMonths: 0, cashBanknotes: 0, cashCollected: 0, totalCollected: 0, totalRefunds: 0, netCollected: 0, expected: 0, debt: 0 };
      return {
        periodKey: k,
        periodLabel: label,
        bookingsCount: data.count,
        totalCollected: data.netCollected ?? data.collected,
        totalExpected: data.expected,
        openDebt: data.debt,
        totalRefunds: data.totalRefunds || 0,
        netCollected: data.netCollected ?? data.collected
      };
    });

    // Build years sequence
    const yKeys = Object.keys(yearlyMap);
    if (!yKeys.includes(currentYearKey)) yKeys.push(currentYearKey);
    yKeys.sort();

    const yearlyList: ChartPeriodItem[] = yKeys.map(y => {
      const data = yearlyMap[y] || { count: 0, grossCollected: 0, totalRefunds: 0, netCollected: 0, expected: 0, debt: 0 };
      return {
        periodKey: y,
        periodLabel: `שנת ${y}`,
        bookingsCount: data.count,
        totalCollected: data.netCollected, // נטו בפועל לאחר החזרים
        totalExpected: data.expected,
        openDebt: data.debt,
        totalRefunds: data.totalRefunds,
        netCollected: data.netCollected
      };
    });

    return {
      monthlyChartData: monthlyList,
      yearlyChartData: yearlyList,
      currentMonthCollected: totalThisMonth,
      allTimeCollected: totalAllTime,
      monthlyMap
    };
  }, [activeBookings, bookings, currentMonthKey, currentYearKey]);

  if (!metricType) return null;

  const todayBookings = getBookingsForDate(activeBookings, todayStr);

  // Filter items based on selected metric
  let title = '';
  let subtitle = '';
  let icon = <Sparkles className="w-5 h-5" />;
  let badgeColor = 'bg-slate-100 text-slate-800 border-slate-200';
  let filteredItems: Booking[] = [];

  switch (metricType) {
    case 'occupancy': {
      const stayingToday = todayBookings.filter(b => b.stayStatus !== 'checked_out');
      const checkedOutToday = todayBookings.filter(b => b.stayStatus === 'checked_out');
      title = 'תפוסה כוללת להיום';
      subtitle = `${stayingToday.length} כלבים שוהים כעת בריזורט מתוך ${settings.maxCapacity} מקומות מקסימום${checkedOutToday.length > 0 ? ` (${checkedOutToday.length} השתחרר/ו היום)` : ''}`;
      icon = <Dog className="w-5 h-5 text-emerald-600" />;
      badgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-200';
      filteredItems = todayBookings;
      break;
    }

    case 'boarding':
      title = 'כלבי פנסיון ושהות יומית';
      subtitle = 'כלבים השוהים בפנסיון לילה או יום כיף פעיל';
      icon = <Building2 className="w-5 h-5 text-sky-600" />;
      badgeColor = 'bg-sky-50 text-sky-800 border-sky-200';
      filteredItems = todayBookings.filter(b => b.serviceType === 'boarding' || b.serviceType === 'daycare');
      break;

    case 'training':
      if (trainingViewTab === 'completed') {
        title = '🏁 הסתיים האילוף (ארכיון)';
        subtitle = `${trainerMetrics.completedTrainingDogsCount} כלבים שהשלימו את תהליך האילוף ומלוא התשלומים (3/3) שולמו למאלפת הילה`;
        icon = <CheckCircle className="w-5 h-5 text-emerald-700" />;
        badgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-200';
        filteredItems = allTrainingBookings.filter(b => b.isTrainingCompleted);
      } else if (trainingViewTab === 'trainer_payments') {
        title = '🐾 ניהול תשלומי מאלפת (הילה קירזנר - Halodog)';
        subtitle = `מעקב קבלות ושלבים (1/3, 2/3, 3/3) • שולם בפועל: ₪${trainerMetrics.totalPaidActually.toLocaleString('he-IL')}${trainerMetrics.totalPendingPaymentAmount > 0 ? ` • 🚨 ממתין לתשלום בביט: ₪${trainerMetrics.totalPendingPaymentAmount.toLocaleString('he-IL')}` : ' • אין חובות פתוחים (הכל שולם)'} • יתרה לכלבים פעילים: ₪${trainerMetrics.totalRemainingLiability.toLocaleString('he-IL')}`;
        icon = <CreditCard className="w-5 h-5 text-indigo-700" />;
        badgeColor = 'bg-indigo-50 text-indigo-800 border-indigo-200';
        filteredItems = [];
      } else {
        title = '🎓 כלבים בתהליך אילוף פעיל';
        filteredItems = allTrainingBookings.filter(b => {
          if (b.isTrainingCompleted) return false;
          if (b.startDate > '2026-09-30') return false; // עתידיים באוקטובר
          if (trainingFilter === 'full') return b.serviceType === 'training';
          if (trainingFilter === 'day') return b.serviceType === 'day_training';
          return true;
        });
        subtitle = `${filteredItems.length} כלבים בתהליך אילוף פעיל • מעקב שלבים וחיוב ₪1,500 למאלפת`;
        icon = <GraduationCap className="w-5 h-5 text-purple-700" />;
        badgeColor = 'bg-purple-50 text-purple-800 border-purple-200';
      }
      break;

    case 'debt': {
      const debtItems = activeBookings.filter(b => {
        const debt = Math.max(0, (Number(b.totalPrice) || 0) - (Number(b.depositAmount) || 0));
        return b.paymentStatus !== 'fully_paid' && debt > 0;
      });
      const totalDebtSum = debtItems.reduce((acc, b) => {
        return acc + Math.max(0, (Number(b.totalPrice) || 0) - (Number(b.depositAmount) || 0));
      }, 0);
      const totalDepositSum = debtItems.reduce((acc, b) => {
        return acc + (Number(b.depositAmount) || 0);
      }, 0);
      title = 'הזמנות עם חוב פתוח לתשלום';
      subtitle = `${debtItems.length} הזמנות פעילות עם חוב פתוח (יתרת חוב כוללת: ₪${totalDebtSum.toLocaleString('he-IL')} • שולמו מקדמות: ₪${totalDepositSum.toLocaleString('he-IL')})`;
      icon = <AlertCircle className="w-5 h-5 text-red-600" />;
      badgeColor = 'bg-red-50 text-red-700 border-red-200';
      filteredItems = debtItems;
      break;
    }

    case 'revenue': {
      const curData = monthlyMap[currentMonthKey];
      const digitalCleared = curData?.digitalCleared || 0;
      const growClearedBankOn10th = curData?.growClearedBankOn10th || 0;
      const directBankTransfers = curData?.directBankTransfers || 0;
      const bankOn10thInTwoMonths = curData?.bankOn10thInTwoMonths || 0;
      const cashCollected = curData?.cashCollected || 0;
      const monthRefunds = curData?.totalRefunds || 0;
      const totalCol = curData?.totalCollected || 0;
      const netCol = curData?.netCollected || 0;

      // Base candidate bookings: any booking with payment or refund
      const paidItems = bookings.filter(b => {
        const hasPayment = (Number(b.depositAmount) || 0) > 0 || b.paymentStatus === 'fully_paid';
        const hasRefund = (Number(b.refundAmount) || 0) > 0;
        return (b.stayStatus !== 'cancelled' && hasPayment) || hasRefund;
      });

      if (revenueViewTab === 'graphs') {
        title = '📊 גרפים, דוחות וניתוח הכנסות';
        subtitle = `השוואה חודשית ושנתית • סה״כ נטו החודש: ₪${netCol.toLocaleString('he-IL')} • דיגיטלי: ₪${digitalCleared.toLocaleString('he-IL')} • מזומן: ₪${cashCollected.toLocaleString('he-IL')}`;
        icon = <BarChart3 className="w-5 h-5 text-emerald-700" />;
        badgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-200';

        if (selectedChartPeriod) {
          filteredItems = paidItems.filter(b => {
            if (chartMode === 'monthly') {
              const hasPayment = getBookingPaymentsInMonth(b, selectedChartPeriod) > 0;
              const hasRefund = (Number(b.refundAmount) || 0) > 0 && (b.refundDate || b.startDate || '').startsWith(selectedChartPeriod);
              return hasPayment || hasRefund;
            } else {
              const matchesYear = (b.createdAt && b.createdAt.startsWith(selectedChartPeriod)) || 
                                  (b.startDate && b.startDate.startsWith(selectedChartPeriod));
              const matchesRefundYear = (Number(b.refundAmount) || 0) > 0 && (b.refundDate || b.startDate || '').startsWith(selectedChartPeriod);
              return matchesYear || matchesRefundYear;
            }
          });
        } else {
          filteredItems = [];
        }
      } else if (revenueViewTab === 'cash') {
        title = '💵 נסלק במזומן (שטרות ישירים)';
        subtitle = `סה״כ נסלק במזומן החודש: ₪${cashCollected.toLocaleString('he-IL')} • מציג רק כלבים ששולמו במזומן בלבד`;
        icon = <DollarSign className="w-5 h-5 text-amber-700" />;
        badgeColor = 'bg-amber-50 text-amber-900 border-amber-300';
        filteredItems = paidItems.filter(b => isCashPayment(b));
      } else if (revenueViewTab === 'digital') {
        title = '📱 סליקה דיגיטלית (Grow / ביט / העברות)';
        subtitle = `סה״כ סליקה דיגיטלית החודש: ₪${digitalCleared.toLocaleString('he-IL')} • כלל התשלומים שעברו דרך הלינק המאובטח או הבנק`;
        icon = <CreditCard className="w-5 h-5 text-emerald-700" />;
        badgeColor = 'bg-emerald-50 text-emerald-900 border-emerald-300';
        filteredItems = paidItems.filter(b => isDigitalPayment(b));
      } else if (revenueViewTab === 'grow_10th') {
        title = `🏦 יכנס לבנק ב-${next10thDateLabel} (סליקת אשראי GROW)`;
        subtitle = `סה״כ עסקאות אשראי Grow שיופקדו לחשבון הבנק ב-10 לחודש: ₪${growClearedBankOn10th.toLocaleString('he-IL')}`;
        icon = <Building2 className="w-5 h-5 text-sky-700" />;
        badgeColor = 'bg-sky-50 text-sky-900 border-sky-300';
        filteredItems = paidItems.filter(b => isGrowPayment(b));
      } else if (revenueViewTab === 'direct_transfer') {
        title = '🏛️ הועבר ישירות לחשבון (העברות בנקאיות)';
        subtitle = `סה״כ כספים שכבר הופקדו ישירות לחשבון הבנק: ₪${directBankTransfers.toLocaleString('he-IL')}`;
        icon = <Building2 className="w-5 h-5 text-teal-700" />;
        badgeColor = 'bg-teal-50 text-teal-900 border-teal-300';
        filteredItems = paidItems.filter(b => isDirectBankTransfer(b));
      } else if (revenueViewTab === 'grow_in_2_months') {
        title = `🗓️ יכנס לבנק ב-${inTwoMonthsDateLabel} (תשלומי המשך מובטחים)`;
        subtitle = `סה״כ עסקאות תשלומים שייכנסו בעוד חודשיים: ₪${bankOn10thInTwoMonths.toLocaleString('he-IL')}`;
        icon = <Calendar className="w-5 h-5 text-indigo-700" />;
        badgeColor = 'bg-indigo-50 text-indigo-900 border-indigo-300';
        filteredItems = paidItems.filter(b => isInstallmentPayment(b));
      } else if (revenueViewTab === 'refunds') {
        title = '↩️ החזרים כספיים שבוצעו ונוכו מההכנסות';
        subtitle = `סה״כ החזרים שבוצעו החודש ללקוחות: -₪${monthRefunds.toLocaleString('he-IL')}`;
        icon = <AlertCircle className="w-5 h-5 text-rose-700" />;
        badgeColor = 'bg-rose-50 text-rose-900 border-rose-300';
        filteredItems = paidItems.filter(b => isRefundBooking(b));
      } else {
        title = '📋 כלל התקבולים וההכנסות החודש';
        subtitle = `סה״כ תקבולים: ₪${totalCol.toLocaleString('he-IL')} (דיגיטלי: ₪${digitalCleared.toLocaleString('he-IL')} + מזומן: ₪${cashCollected.toLocaleString('he-IL')})`;
        icon = <Sparkles className="w-5 h-5 text-slate-700" />;
        badgeColor = 'bg-slate-100 text-slate-900 border-slate-300';
        filteredItems = paidItems;
      }
      break;
    }
  }

  // Apply search query
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filteredItems = filteredItems.filter(b => {
      const matchDog = (b.dogName || '').toLowerCase().includes(q);
      const matchOwner = (b.ownerName || '').toLowerCase().includes(q);
      const matchPhone = (b.ownerPhone || '').includes(q);
      const matchNotes = (b.notes || '').toLowerCase().includes(q);
      return matchDog || matchOwner || matchPhone || matchNotes;
    });
  }

  const handleSendWhatsApp = (b: Booking, e: React.MouseEvent) => {
    e.stopPropagation();
    const msg = generatePaymentReminderMessage(b, settings);
    openWhatsAppMessage(b.ownerPhone, msg);
  };

  const activeChartData = chartMode === 'monthly' ? monthlyChartData : yearlyChartData;
  const maxCollectedInChart = Math.max(1, ...activeChartData.map(d => d.totalCollected));

  const handleExportExcel = () => {
    const periodTitle = chartMode === 'monthly' ? 'דוח_עמודות_הכנסות_לפי_חודשים' : 'דוח_עמודות_הכנסות_לפי_שנים';
    exportRevenueChartsToExcel(activeChartData, filteredItems, periodTitle);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200" dir="rtl">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden text-slate-900">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/80 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl border ${badgeColor} shadow-2xs`}>
              {icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-lg sm:text-xl text-slate-900">{title}</h3>
                <span className={`text-xs font-black px-2.5 py-0.5 rounded-full border ${badgeColor}`}>
                  {filteredItems.length} פריטים
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">{subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Direct Excel export for revenue graphs */}
            {metricType === 'revenue' && (
              <button
                type="button"
                onClick={handleExportExcel}
                className="bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                title="ייצא את נתוני הגרפים והטבלאות לקובץ אקסל"
              >
                <Download className="w-4 h-4" />
                <span>ייצוא לאקסל</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
              title="סגור חלון"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* TRAINING TABS & FEEDBACK (Displayed when metricType === 'training') */}
        {metricType === 'training' && (
          <div className="p-3 sm:p-4 bg-purple-50/70 border-b border-purple-200/80 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-1.5 bg-white p-1 rounded-2xl border border-purple-200 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setTrainingViewTab('active')}
                  className={`px-3 py-2 rounded-xl font-black text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                    trainingViewTab === 'active'
                      ? 'bg-purple-700 text-white shadow-2xs'
                      : 'text-slate-700 hover:text-purple-900 hover:bg-purple-50'
                  }`}
                >
                  <GraduationCap className="w-4 h-4" />
                  <span>🎓 כלבים בתהליך אילוף</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                    trainingViewTab === 'active' ? 'bg-purple-900 text-purple-100' : 'bg-purple-100 text-purple-800'
                  }`}>
                    {trainerMetrics.activeTrainingDogsCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setTrainingViewTab('completed')}
                  className={`px-3 py-2 rounded-xl font-black text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                    trainingViewTab === 'completed'
                      ? 'bg-emerald-700 text-white shadow-2xs'
                      : 'text-slate-700 hover:text-emerald-900 hover:bg-emerald-50'
                  }`}
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>🏁 הסתיים האילוף</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                    trainingViewTab === 'completed' ? 'bg-emerald-900 text-emerald-100' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {trainerMetrics.completedTrainingDogsCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setTrainingViewTab('trainer_payments')}
                  className={`px-3 py-2 rounded-xl font-black text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                    trainingViewTab === 'trainer_payments'
                      ? 'bg-indigo-700 text-white shadow-2xs'
                      : 'text-slate-700 hover:text-indigo-900 hover:bg-indigo-50'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>🐾 ניהול תשלומי הילה</span>
                  {trainerMetrics.totalPendingPaymentAmount > 0 && (
                    <span className="text-[10px] bg-rose-500 text-white font-black px-1.5 py-0.2 rounded-full animate-pulse" title="יש קבלות שממתינות לתשלום בביט">
                      !
                    </span>
                  )}
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                    trainingViewTab === 'trainer_payments' ? 'bg-indigo-900 text-indigo-100' : 'bg-indigo-100 text-indigo-800'
                  }`}>
                    {trainerReceipts.length}
                  </span>
                </button>
              </div>

              {/* Action Buttons: WhatsApp Sync & Ingest Receipt */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSyncHilaReceipts(false)}
                  disabled={isSyncingHilaChat}
                  className="bg-emerald-50 hover:bg-emerald-100 active:scale-95 text-emerald-900 border border-emerald-300 font-black text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                  title="משיכת קבלות והודעות שנשלחו מהילה (052-690-8943) לוואטסאפ של הריזורט"
                >
                  <span className={isSyncingHilaChat ? 'animate-spin' : ''}>🔄</span>
                  <span>{isSyncingHilaChat ? 'מושך קבלות מהוואטסאפ...' : 'משוך קבלות מוואטסאפ הילה'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedReceiptForEdit(undefined);
                    setIsTrainerReceiptModalOpen(true);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <span>➕</span>
                  <span>קליטת קבלה ידנית</span>
                </button>
              </div>
            </div>

            {trainerActionFeedback && (
              <div className="p-2.5 bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-bold rounded-xl flex items-center justify-between animate-in fade-in">
                <span>{trainerActionFeedback}</span>
                <button type="button" onClick={() => setTrainerActionFeedback(null)} className="text-emerald-700 hover:text-emerald-900">✕</button>
              </div>
            )}
          </div>
        )}

        {/* REVENUE TABS (Displayed when metricType === 'revenue') */}
        {metricType === 'revenue' && (
          <div className="p-3 sm:p-4 bg-emerald-50/60 border-b border-emerald-200/80 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-1.5 bg-white p-1 rounded-2xl border border-emerald-200 shadow-2xs">
                
                {/* 1. Cash Tab (Default - First!) */}
                <button
                  type="button"
                  onClick={() => {
                    setRevenueViewTab('cash');
                    setSelectedChartPeriod(null);
                  }}
                  className={`px-3 py-2 rounded-xl font-black text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                    revenueViewTab === 'cash'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'text-slate-700 hover:text-amber-900 hover:bg-amber-50'
                  }`}
                >
                  <span>💵 נסלק במזומן</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                    revenueViewTab === 'cash' ? 'bg-amber-800 text-amber-100' : 'bg-amber-100 text-amber-900'
                  }`}>
                    ₪{(monthlyMap[currentMonthKey]?.cashCollected || 0).toLocaleString('he-IL')}
                  </span>
                </button>

                {/* 2. Digital Clearing Tab */}
                <button
                  type="button"
                  onClick={() => {
                    setRevenueViewTab('digital');
                    setSelectedChartPeriod(null);
                  }}
                  className={`px-3 py-2 rounded-xl font-black text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                    revenueViewTab === 'digital'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-slate-700 hover:text-emerald-900 hover:bg-emerald-50'
                  }`}
                >
                  <span>📱 סליקה דיגיטלית (Grow / ביט)</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                    revenueViewTab === 'digital' ? 'bg-emerald-800 text-emerald-100' : 'bg-emerald-100 text-emerald-900'
                  }`}>
                    ₪{(monthlyMap[currentMonthKey]?.digitalCleared || 0).toLocaleString('he-IL')}
                  </span>
                </button>

                {/* 3. Grow 10th Tab */}
                <button
                  type="button"
                  onClick={() => {
                    setRevenueViewTab('grow_10th');
                    setSelectedChartPeriod(null);
                  }}
                  className={`px-3 py-2 rounded-xl font-black text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                    revenueViewTab === 'grow_10th'
                      ? 'bg-sky-600 text-white shadow-2xs'
                      : 'text-slate-700 hover:text-sky-900 hover:bg-sky-50'
                  }`}
                >
                  <span>🏦 יכנס ב-{next10thDateLabel} (Grow)</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                    revenueViewTab === 'grow_10th' ? 'bg-sky-800 text-sky-100' : 'bg-sky-100 text-sky-900'
                  }`}>
                    ₪{(monthlyMap[currentMonthKey]?.growClearedBankOn10th || 0).toLocaleString('he-IL')}
                  </span>
                </button>

                {/* 4. Direct Bank Transfer Tab */}
                {(monthlyMap[currentMonthKey]?.directBankTransfers || 0) > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setRevenueViewTab('direct_transfer');
                      setSelectedChartPeriod(null);
                    }}
                    className={`px-3 py-2 rounded-xl font-black text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                      revenueViewTab === 'direct_transfer'
                        ? 'bg-teal-600 text-white shadow-2xs'
                        : 'text-slate-700 hover:text-teal-900 hover:bg-teal-50'
                    }`}
                  >
                    <span>🏛️ ישיר לחשבון</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                      revenueViewTab === 'direct_transfer' ? 'bg-teal-800 text-teal-100' : 'bg-teal-100 text-teal-900'
                    }`}>
                      ₪{(monthlyMap[currentMonthKey]?.directBankTransfers || 0).toLocaleString('he-IL')}
                    </span>
                  </button>
                )}

                {/* 5. Future Installments Tab */}
                {(monthlyMap[currentMonthKey]?.bankOn10thInTwoMonths || 0) > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setRevenueViewTab('grow_in_2_months');
                      setSelectedChartPeriod(null);
                    }}
                    className={`px-3 py-2 rounded-xl font-black text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                      revenueViewTab === 'grow_in_2_months'
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'text-slate-700 hover:text-indigo-900 hover:bg-indigo-50'
                    }`}
                  >
                    <span>🗓️ יכנס ב-{inTwoMonthsDateLabel}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                      revenueViewTab === 'grow_in_2_months' ? 'bg-indigo-800 text-indigo-100' : 'bg-indigo-100 text-indigo-900'
                    }`}>
                      ₪{(monthlyMap[currentMonthKey]?.bankOn10thInTwoMonths || 0).toLocaleString('he-IL')}
                    </span>
                  </button>
                )}

                {/* 6. Refunds Tab */}
                {((monthlyMap[currentMonthKey]?.totalRefunds || 0) > 0 || bookings.some(b => (Number(b.refundAmount) || 0) > 0)) && (
                  <button
                    type="button"
                    onClick={() => {
                      setRevenueViewTab('refunds');
                      setSelectedChartPeriod(null);
                    }}
                    className={`px-3 py-2 rounded-xl font-black text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                      revenueViewTab === 'refunds'
                        ? 'bg-rose-600 text-white shadow-2xs'
                        : 'text-rose-700 hover:bg-rose-50 hover:text-rose-900'
                    }`}
                  >
                    <span>↩️ החזרים כספיים</span>
                    {(monthlyMap[currentMonthKey]?.totalRefunds || 0) > 0 && (
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                        revenueViewTab === 'refunds' ? 'bg-rose-900 text-rose-100' : 'bg-rose-100 text-rose-800'
                      }`}>
                        -₪{(monthlyMap[currentMonthKey]?.totalRefunds || 0).toLocaleString('he-IL')}
                      </span>
                    )}
                  </button>
                )}

                {/* 7. All Monthly Payments Tab */}
                <button
                  type="button"
                  onClick={() => {
                    setRevenueViewTab('all');
                    setSelectedChartPeriod(null);
                  }}
                  className={`px-3 py-2 rounded-xl font-black text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                    revenueViewTab === 'all'
                      ? 'bg-slate-800 text-white shadow-2xs'
                      : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <span>📋 כל התקבולים החודש</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                    revenueViewTab === 'all' ? 'bg-slate-950 text-slate-100' : 'bg-slate-200 text-slate-800'
                  }`}>
                    ₪{(monthlyMap[currentMonthKey]?.totalCollected || 0).toLocaleString('he-IL')}
                  </span>
                </button>

                {/* 8. Graphs & Analytics Tab (Separated at the end) */}
                <button
                  type="button"
                  onClick={() => {
                    setRevenueViewTab('graphs');
                    setSelectedChartPeriod(null);
                  }}
                  className={`px-3.5 py-2 rounded-xl font-black text-xs transition-all cursor-pointer flex items-center gap-1.5 border ${
                    revenueViewTab === 'graphs'
                      ? 'bg-emerald-700 text-white border-emerald-800 shadow-2xs'
                      : 'bg-emerald-50/80 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>📊 גרפים והשוואות</span>
                </button>

              </div>
            </div>
          </div>
        )}

        {/* Toolbar: Search and Filters (Displayed for standard metrics or when not in graphs view) */}
        {(metricType !== 'revenue' || revenueViewTab !== 'graphs') && (
          <div className="p-3 sm:p-4 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="חיפוש לפי שם כלב, בעלים, טלפון, הערות..."
                className="w-full pl-3 pr-9 py-2 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-900"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Sub-filter for Training metric */}
            {metricType === 'training' && (
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setTrainingFilter('all')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                    trainingFilter === 'all' ? 'bg-white text-purple-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  הכל
                </button>
                <button
                  type="button"
                  onClick={() => setTrainingFilter('full')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                    trainingFilter === 'full' ? 'bg-purple-50 text-purple-800 border border-purple-200' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  תהליך מלא
                </button>
                <button
                  type="button"
                  onClick={() => setTrainingFilter('day')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                    trainingFilter === 'day' ? 'bg-purple-50 text-purple-800 border border-purple-200' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ביומיות
                </button>
              </div>
            )}
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4">

          {/* REVENUE: 1. GRAPHS & ANALYTICS TAB VIEW */}
          {metricType === 'revenue' && revenueViewTab === 'graphs' && (
            <div className="space-y-4">
              
              {/* Controls: Mode Toggle & Summary Stats */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50/80 p-3 sm:p-4 rounded-2xl border border-slate-200/80">
                <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-slate-200 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => {
                      setChartMode('monthly');
                      setSelectedChartPeriod(null);
                    }}
                    className={`px-3 py-1.5 rounded-xl font-extrabold text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                      chartMode === 'monthly'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span>לפי חודשים (12 אחרונים)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setChartMode('yearly');
                      setSelectedChartPeriod(null);
                    }}
                    className={`px-3 py-1.5 rounded-xl font-extrabold text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                      chartMode === 'yearly'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>השוואה שנתית</span>
                  </button>
                </div>

                {/* Summary KPI Cards - Clickable to open specific payment tab */}
                <div className="flex flex-wrap items-center gap-2">
                  <div 
                    onClick={() => setRevenueViewTab('digital')}
                    className="border px-3 py-1.5 rounded-xl text-right shadow-2xs cursor-pointer transition-all bg-white border-emerald-200/90 hover:bg-emerald-50/70 hover:border-emerald-400 active:scale-95"
                    title="לחץ למעבר לרשימת כל התשלומים הדיגיטליים"
                  >
                    <div className="text-[10px] font-bold text-emerald-800">1. נסלק החודש (דיגיטלי) ↗</div>
                    <div className="text-sm font-black text-emerald-700">
                      ₪{(monthlyMap[currentMonthKey]?.digitalCleared || 0).toLocaleString('he-IL')}
                    </div>
                    <div className="text-[9px] text-slate-400">כלל התשלומים הדיגיטליים</div>
                  </div>

                  {(monthlyMap[currentMonthKey]?.directBankTransfers || 0) > 0 && (
                    <div 
                      onClick={() => setRevenueViewTab('direct_transfer')}
                      className="border px-3 py-1.5 rounded-xl text-right shadow-2xs cursor-pointer transition-all bg-teal-50 border-teal-200 hover:bg-teal-100/70 hover:border-teal-400 active:scale-95"
                      title="לחץ למעבר לרשימת ההעברות הבנקאיות הישירות"
                    >
                      <div className="text-[10px] font-bold text-teal-800">הועבר ישירות לחשבון ↗</div>
                      <div className="text-sm font-black text-teal-900">
                        ₪{(monthlyMap[currentMonthKey]?.directBankTransfers || 0).toLocaleString('he-IL')}
                      </div>
                      <div className="text-[9px] text-teal-700 font-medium">כבר בחשבון הבנק</div>
                    </div>
                  )}

                  <div 
                    onClick={() => setRevenueViewTab('grow_10th')}
                    className="border px-3 py-1.5 rounded-xl text-right shadow-2xs cursor-pointer transition-all bg-sky-50 border-sky-200 hover:bg-sky-100/70 hover:border-sky-400 active:scale-95"
                    title="לחץ למעבר לרשימת עסקאות Grow ב-10 לחודש"
                  >
                    <div className="text-[10px] font-bold text-sky-800">2. יכנס לבנק ב-{next10thDateLabel} ↗</div>
                    <div className="text-sm font-black text-sky-900">
                      ₪{(monthlyMap[currentMonthKey]?.growClearedBankOn10th || 0).toLocaleString('he-IL')}
                    </div>
                    <div className="text-[9px] text-sky-600 font-medium">סליקת כרטיסי אשראי GROW</div>
                  </div>

                  {(monthlyMap[currentMonthKey]?.bankOn10thInTwoMonths || 0) > 0 && (
                    <div 
                      onClick={() => setRevenueViewTab('grow_in_2_months')}
                      className="border px-3 py-1.5 rounded-xl text-right shadow-2xs cursor-pointer transition-all bg-indigo-50 border-indigo-200 hover:bg-indigo-100/70 hover:border-indigo-400 active:scale-95"
                      title="לחץ למעבר לרשימת עסקאות התשלומים בעוד חודשיים"
                    >
                      <div className="text-[10px] font-bold text-indigo-900">3. יכנס ב-{inTwoMonthsDateLabel} ↗</div>
                      <div className="text-sm font-black text-indigo-950">
                        ₪{(monthlyMap[currentMonthKey]?.bankOn10thInTwoMonths || 0).toLocaleString('he-IL')}
                      </div>
                      <div className="text-[9px] text-indigo-700 font-medium">תשלומי המשך מובטחים</div>
                    </div>
                  )}

                  <div 
                    onClick={() => setRevenueViewTab('cash')}
                    className="border px-3 py-1.5 rounded-xl text-right shadow-2xs cursor-pointer transition-all bg-amber-50 border-amber-200 hover:bg-amber-100/70 hover:border-amber-400 active:scale-95"
                    title="לחץ למעבר לרשימת התשלומים במזומן בלבד"
                  >
                    <div className="text-[10px] font-bold text-amber-800">4. נסלק במזומן ↗</div>
                    <div className="text-sm font-black text-amber-900">
                      ₪{(monthlyMap[currentMonthKey]?.cashCollected || 0).toLocaleString('he-IL')}
                    </div>
                    <div className="text-[9px] text-amber-700 font-medium">תשלום מזומן ישיר</div>
                  </div>

                  <div 
                    onClick={() => setRevenueViewTab('all')}
                    className="border px-3 py-1.5 rounded-xl text-right shadow-2xs cursor-pointer transition-all bg-white border-slate-200 hover:bg-slate-100 active:scale-95"
                    title="לחץ להצגת סה״כ כלל התקבולים"
                  >
                    <div className="text-[10px] font-bold text-slate-500">סה״כ כולל החודש ↗</div>
                    <div className="text-sm font-black text-slate-900">
                      ₪{(monthlyMap[currentMonthKey]?.totalCollected || 0).toLocaleString('he-IL')}
                    </div>
                    <div className="text-[9px] text-slate-400">דיגיטלי + מזומן</div>
                  </div>

                  {(monthlyMap[currentMonthKey]?.totalRefunds || 0) > 0 && (
                    <div 
                      onClick={() => setRevenueViewTab('refunds')}
                      className="border px-3 py-1.5 rounded-xl text-right shadow-2xs cursor-pointer transition-all bg-rose-50 border-rose-200 hover:bg-rose-100/70 hover:border-rose-400 active:scale-95"
                      title="לחץ למעבר לרשימת ההחזרים הכספיים"
                    >
                      <div className="text-[10px] font-bold text-rose-800">החזרים שבוצעו ↗</div>
                      <div className="text-sm font-black text-rose-700 font-mono">
                        -₪{(monthlyMap[currentMonthKey]?.totalRefunds || 0).toLocaleString('he-IL')}
                      </div>
                      <div className="text-[9px] text-rose-600 font-medium">נוכה מההכנסות</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Column / Bar Chart */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-3 sm:p-4 shadow-2xs">
                <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-2">
                  <span>📊 גרף עמודות הכנסות בפועל (סכומים בשקלים כתובים מעל כל עמודה • לחץ על עמודה לסינון):</span>
                  {selectedChartPeriod && (
                    <button
                      type="button"
                      onClick={() => setSelectedChartPeriod(null)}
                      className="text-xs text-emerald-700 hover:text-emerald-900 font-bold bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200 cursor-pointer flex items-center gap-1"
                    >
                      <span>הסר סינון תקופה</span>
                      <span>✕</span>
                    </button>
                  )}
                </div>

                {/* Horizontal Scrollable Chart Area */}
                <div className="overflow-x-auto pb-1 pt-4">
                  <div className="flex items-end justify-between gap-2 sm:gap-3 min-w-[580px] h-[175px] px-2">
                    {activeChartData.map((item) => {
                      const heightPercent = maxCollectedInChart > 0 
                        ? Math.max(10, Math.round((item.totalCollected / maxCollectedInChart) * 100))
                        : 10;
                      const isSelected = selectedChartPeriod === item.periodKey;
                      const isCurrent = item.periodKey === currentMonthKey || item.periodKey === currentYearKey;

                      return (
                        <div
                          key={item.periodKey}
                          onClick={() => {
                            setSelectedChartPeriod(isSelected ? null : item.periodKey);
                          }}
                          className={`flex-1 flex flex-col items-center justify-end h-full group cursor-pointer transition-all p-1 rounded-xl ${
                            isSelected 
                              ? 'bg-emerald-50/80 ring-2 ring-emerald-500 shadow-2xs' 
                              : 'hover:bg-slate-50'
                          }`}
                          title={`${item.periodLabel}: ₪${item.totalCollected.toLocaleString('he-IL')} נטו מתוך ${item.bookingsCount} הזמנות ${(item.totalRefunds || 0) > 0 ? `(הוחזרו ₪${item.totalRefunds?.toLocaleString('he-IL')})` : ''}. לחץ לסינון הרשימה למטה.`}
                        >
                          {/* Amount in Shekels on top of column */}
                          <div className="flex flex-col items-center mb-1">
                            {(item.totalRefunds || 0) > 0 && (
                              <span 
                                className="text-[9px] font-black text-rose-600 bg-rose-50 border border-rose-200 px-1 rounded-full mb-0.5 whitespace-nowrap"
                                title={`בוצעו החזרים כספיים בסך ₪${item.totalRefunds?.toLocaleString('he-IL')}`}
                              >
                                -₪{item.totalRefunds?.toLocaleString('he-IL')}
                              </span>
                            )}
                            <span className={`text-[10px] sm:text-[11px] font-black tracking-tight text-center transition-all ${
                              item.totalCollected > 0 
                                ? isSelected || isCurrent ? 'text-emerald-800 scale-105' : 'text-slate-700'
                                : 'text-slate-400 opacity-60'
                            }`}>
                              {item.totalCollected > 0 ? `₪${item.totalCollected.toLocaleString('he-IL')}` : '0 ₪'}
                            </span>
                          </div>

                          {/* The Bar Column */}
                          <div className="w-full max-w-[42px] bg-slate-100 rounded-t-xl overflow-hidden flex items-end justify-center h-[115px]">
                            <div
                              style={{ height: `${heightPercent}%` }}
                              className={`w-full rounded-t-lg transition-all duration-300 ${
                                item.totalCollected === 0
                                  ? 'bg-slate-200'
                                  : isSelected
                                  ? 'bg-gradient-to-t from-emerald-700 to-teal-500 shadow-sm'
                                  : isCurrent
                                  ? 'bg-gradient-to-t from-emerald-600 to-emerald-400'
                                  : 'bg-gradient-to-t from-emerald-500/90 to-teal-400/90 group-hover:from-emerald-600 group-hover:to-teal-500'
                              }`}
                            />
                          </div>

                          {/* Label beneath the bar */}
                          <span className={`text-[11px] font-bold mt-1.5 whitespace-nowrap text-center ${
                            isSelected ? 'text-emerald-900 font-black' : isCurrent ? 'text-emerald-800' : 'text-slate-600'
                          }`}>
                            {item.periodLabel}
                          </span>

                          {/* Booking Count beneath */}
                          <span className="text-[9px] text-slate-400 font-medium">
                            {item.bookingsCount} {item.bookingsCount === 1 ? 'הזמנה' : 'הזמנות'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Chart Period Drilldown Or Tip Banner */}
              {selectedChartPeriod ? (
                <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <h4 className="font-black text-sm text-slate-900 flex items-center gap-2">
                      <span>📋 פירוט תקבולים עבור {selectedChartPeriod}</span>
                      <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                        {filteredItems.length} הזמנות
                      </span>
                    </h4>
                    <button
                      type="button"
                      onClick={() => setSelectedChartPeriod(null)}
                      className="text-xs text-emerald-700 hover:text-emerald-900 font-bold bg-emerald-100/70 px-2.5 py-1 rounded-lg border border-emerald-200 cursor-pointer flex items-center gap-1"
                    >
                      <span>✕ הסר סינון</span>
                    </button>
                  </div>

                  {/* Search inside drilldown */}
                  <div className="relative">
                    <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="חיפוש בהזמנות התקופה הנבחרת..."
                      className="w-full pl-3 pr-9 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl text-emerald-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
                  <div className="space-y-0.5">
                    <div className="text-xs font-black flex items-center gap-1.5">
                      <span>💡 ניווט מהיר בתקבולים:</span>
                    </div>
                    <p className="text-xs text-emerald-800 font-medium">
                      לחץ על עמודת חודש בגרף כדי לראות את פירוט ההזמנות של אותו חודש, או עבור ללשוניות למעלה (<strong>💵 נסלק במזומן</strong>, <strong>📱 סליקה דיגיטלית</strong>) לצפייה ממוקדת בכלבים ששולמו בכל אמצעי תשלום.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRevenueViewTab('cash')}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-2xs cursor-pointer shrink-0 transition-all active:scale-95 flex items-center gap-1"
                  >
                    <span>💵 עבור לרשימת המזומן</span>
                  </button>
                </div>
              )}

            </div>
          )}

          {/* REVENUE: 2. PAYMENT METHODS HERO BANNERS (When NOT on graphs tab) */}
          {metricType === 'revenue' && revenueViewTab !== 'graphs' && (
            <div>
              {revenueViewTab === 'cash' && (
                <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 text-white p-4 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">💵</span>
                      <h4 className="font-black text-base sm:text-lg">תשלומים שנסלקו במזומן (שטרות ישירים)</h4>
                      <span className="bg-white/20 text-white text-xs font-black px-2 py-0.5 rounded-full font-mono">
                        {filteredItems.length} כלבים
                      </span>
                    </div>
                    <p className="text-xs text-amber-100 font-medium mt-0.5">
                      רשימת הכלבים שעבורם שולם במזומן ישירות לשמוליק בריזורט (אינו עובר דרך סליקת כרטיסי אשראי GROW או הבנק).
                    </p>
                  </div>
                  <div className="text-right sm:text-left bg-black/15 px-3.5 py-2 rounded-xl border border-white/20 shrink-0">
                    <div className="text-[11px] text-amber-100 font-bold">סה״כ מזומן החודש:</div>
                    <div className="text-xl font-black font-mono">
                      ₪{(monthlyMap[currentMonthKey]?.cashCollected || 0).toLocaleString('he-IL')}
                    </div>
                  </div>
                </div>
              )}

              {revenueViewTab === 'digital' && (
                <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-4 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">📱</span>
                      <h4 className="font-black text-base sm:text-lg">סליקה דיגיטלית (Grow / ביט / לינק תשלום / העברות)</h4>
                      <span className="bg-white/20 text-white text-xs font-black px-2 py-0.5 rounded-full font-mono">
                        {filteredItems.length} פריטים
                      </span>
                    </div>
                    <p className="text-xs text-emerald-100 font-medium mt-0.5">
                      כלל התשלומים והמקדמות שנסלקו דרך קישור התשלום המאובטח של Grow והעברות ישירות לחשבון.
                    </p>
                  </div>
                  <div className="text-right sm:text-left bg-black/15 px-3.5 py-2 rounded-xl border border-white/20 shrink-0">
                    <div className="text-[11px] text-emerald-100 font-bold">סה״כ דיגיטלי החודש:</div>
                    <div className="text-xl font-black font-mono">
                      ₪{(monthlyMap[currentMonthKey]?.digitalCleared || 0).toLocaleString('he-IL')}
                    </div>
                  </div>
                </div>
              )}

              {revenueViewTab === 'grow_10th' && (
                <div className="bg-gradient-to-r from-sky-600 to-blue-700 text-white p-4 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🏦</span>
                      <h4 className="font-black text-base sm:text-lg">סליקת כרטיסי אשראי GROW שתיכנס לבנק ב-10 לחודש ({next10thDateLabel})</h4>
                      <span className="bg-white/20 text-white text-xs font-black px-2 py-0.5 rounded-full font-mono">
                        {filteredItems.length} עסקאות
                      </span>
                    </div>
                    <p className="text-xs text-sky-100 font-medium mt-0.5">
                      סליקת אשראי Grow מחודש {currentMonthKey} שתוזרם אוטומטית לחשבון הבנק ב-10 לחודש הקרוב.
                    </p>
                  </div>
                  <div className="text-right sm:text-left bg-black/15 px-3.5 py-2 rounded-xl border border-white/20 shrink-0">
                    <div className="text-[11px] text-sky-100 font-bold">יופקד ב-{next10thDateLabel}:</div>
                    <div className="text-xl font-black font-mono">
                      ₪{(monthlyMap[currentMonthKey]?.growClearedBankOn10th || 0).toLocaleString('he-IL')}
                    </div>
                  </div>
                </div>
              )}

              {revenueViewTab === 'direct_transfer' && (
                <div className="bg-gradient-to-r from-teal-600 to-teal-800 text-white p-4 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🏛️</span>
                      <h4 className="font-black text-base sm:text-lg">העברות בנקאיות ישירות (כבר בחשבון הבנק)</h4>
                      <span className="bg-white/20 text-white text-xs font-black px-2 py-0.5 rounded-full font-mono">
                        {filteredItems.length} עסקאות
                      </span>
                    </div>
                    <p className="text-xs text-teal-100 font-medium mt-0.5">
                      כספים שהועברו ישירות לחשבון הבנק (כגון קבלות מילואים רונן מלמוד / העברות בנקאיות).
                    </p>
                  </div>
                  <div className="text-right sm:text-left bg-black/15 px-3.5 py-2 rounded-xl border border-white/20 shrink-0">
                    <div className="text-[11px] text-teal-100 font-bold">כבר בחשבון הבנק:</div>
                    <div className="text-xl font-black font-mono">
                      ₪{(monthlyMap[currentMonthKey]?.directBankTransfers || 0).toLocaleString('he-IL')}
                    </div>
                  </div>
                </div>
              )}

              {revenueViewTab === 'grow_in_2_months' && (
                <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 text-white p-4 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🗓️</span>
                      <h4 className="font-black text-base sm:text-lg">תשלומי המשך מובטחים שייכנסו לבנק ב-10 בעוד חודשיים ({inTwoMonthsDateLabel})</h4>
                      <span className="bg-white/20 text-white text-xs font-black px-2 py-0.5 rounded-full font-mono">
                        {filteredItems.length} עסקאות
                      </span>
                    </div>
                    <p className="text-xs text-indigo-100 font-medium mt-0.5">
                      עסקאות שבוצעו בפריסת תשלומים (כגון דורין לוקס / מגן) שתשלומיהן יופקדו בחודשים הבאים.
                    </p>
                  </div>
                  <div className="text-right sm:text-left bg-black/15 px-3.5 py-2 rounded-xl border border-white/20 shrink-0">
                    <div className="text-[11px] text-indigo-100 font-bold">יופקד ב-{inTwoMonthsDateLabel}:</div>
                    <div className="text-xl font-black font-mono">
                      ₪{(monthlyMap[currentMonthKey]?.bankOn10thInTwoMonths || 0).toLocaleString('he-IL')}
                    </div>
                  </div>
                </div>
              )}

              {revenueViewTab === 'refunds' && (
                <div className="bg-gradient-to-r from-rose-600 to-rose-700 text-white p-4 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">↩️</span>
                      <h4 className="font-black text-base sm:text-lg">החזרים כספיים שבוצעו ללקוחות</h4>
                      <span className="bg-white/20 text-white text-xs font-black px-2 py-0.5 rounded-full font-mono">
                        {filteredItems.length} החזרים
                      </span>
                    </div>
                    <p className="text-xs text-rose-100 font-medium mt-0.5">
                      החזרים כספיים שבוצעו בגין ביטולים או שינויי שהות ונוכו מסך ההכנסות.
                    </p>
                  </div>
                  <div className="text-right sm:text-left bg-black/15 px-3.5 py-2 rounded-xl border border-white/20 shrink-0">
                    <div className="text-[11px] text-rose-100 font-bold">סה״כ נוכה:</div>
                    <div className="text-xl font-black font-mono">
                      -₪{(monthlyMap[currentMonthKey]?.totalRefunds || 0).toLocaleString('he-IL')}
                    </div>
                  </div>
                </div>
              )}

              {revenueViewTab === 'all' && (
                <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white p-4 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">📋</span>
                      <h4 className="font-black text-base sm:text-lg">כלל התקבולים וההכנסות החודש (דיגיטלי + מזומן)</h4>
                      <span className="bg-white/20 text-white text-xs font-black px-2 py-0.5 rounded-full font-mono">
                        {filteredItems.length} הזמנות
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 font-medium mt-0.5">
                      ריכוז כלל התשלומים ששולמו החודש בכל אמצעי התשלום.
                    </p>
                  </div>
                  <div className="text-right sm:text-left bg-black/15 px-3.5 py-2 rounded-xl border border-white/20 shrink-0">
                    <div className="text-[11px] text-slate-300 font-bold">סה״כ תקבולים:</div>
                    <div className="text-xl font-black font-mono text-emerald-400">
                      ₪{(monthlyMap[currentMonthKey]?.totalCollected || 0).toLocaleString('he-IL')}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* TRAINER HILA PAYMENTS VIEW */}
          {metricType === 'training' && trainingViewTab === 'trainer_payments' ? (
            <div className="space-y-4">
              
              {/* Clean Trainer Header */}
              <div className="bg-slate-900 text-white p-4 sm:p-5 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-lg font-black">{HILA_TRAINER_INFO.name} ({HILA_TRAINER_INFO.businessName})</span>
                    <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700 font-bold">
                      ע.מ {HILA_TRAINER_INFO.dealerNumber}
                    </span>
                    <span className="text-xs bg-emerald-950/80 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-800/80 font-bold font-mono" dir="ltr">
                      📞 {HILA_TRAINER_INFO.phone}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 font-medium">
                    תעריף קבוע: <strong>₪1,500 לכלב</strong> (3 פעימות של ₪500: תחילת אילוף, אמצע, וסיום).
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedReceiptForEdit(undefined);
                      setIsTrainerReceiptModalOpen(true);
                    }}
                    className="bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  >
                    <span>➕ קליטת קבלה</span>
                  </button>
                </div>
              </div>

              {/* Simple Financial Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white border border-slate-200 p-3.5 rounded-2xl shadow-2xs text-right">
                  <div className="text-xs font-bold text-slate-500">💳 שולם בפועל להילה (ביט)</div>
                  <div className="text-lg sm:text-xl font-black text-emerald-800 font-mono mt-0.5">
                    ₪{trainerMetrics.totalPaidActually.toLocaleString('he-IL')}
                  </div>
                  <div className="text-[11px] text-slate-400">חשבונות שנסגרו</div>
                </div>

                <div className={`border p-3.5 rounded-2xl shadow-2xs text-right ${
                  trainerMetrics.totalPendingPaymentAmount > 0 
                    ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-400/40' 
                    : 'bg-white border-slate-200'
                }`}>
                  <div className="text-xs font-bold text-amber-900">⏳ ממתין לתשלום בביט</div>
                  <div className="text-lg sm:text-xl font-black text-amber-950 font-mono mt-0.5">
                    ₪{trainerMetrics.totalPendingPaymentAmount.toLocaleString('he-IL')}
                  </div>
                  <div className="text-[11px] text-amber-800 font-medium">
                    {trainerMetrics.totalPendingPaymentAmount > 0 ? 'קבלות שנקלטו וממתינות להעברה' : 'הכל משולם, אין חובות'}
                  </div>
                </div>

                <div className="bg-white border border-slate-200 p-3.5 rounded-2xl shadow-2xs text-right">
                  <div className="text-xs font-bold text-slate-500">📑 קבלות שנקלטו מהילה</div>
                  <div className="text-lg sm:text-xl font-black text-indigo-950 font-mono mt-0.5">
                    {trainerReceipts.length}
                  </div>
                  <div className="text-[11px] text-slate-400">קבלות במערכת</div>
                </div>
              </div>

              {/* Receipts List */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-sm text-slate-900 flex items-center gap-2">
                    <span>📑 פירוט קבלות של הילה</span>
                    <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                      {trainerReceipts.length}
                    </span>
                  </h4>
                </div>

                {trainerReceipts.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs">
                    אין כרגע קבלות רשומות במערכת
                  </div>
                ) : (
                  <div className="space-y-2">
                    {trainerReceipts.map(rcpt => (
                      <div 
                        key={rcpt.id}
                        className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-2.5 transition-all"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-sm text-slate-900">
                              קבלה מס׳ {rcpt.receiptNumber}
                            </span>
                            <span className="text-xs text-slate-500 font-mono">
                              {rcpt.receiptDate}
                            </span>
                            <span className="text-xs bg-indigo-50 text-indigo-900 border border-indigo-200 px-2 py-0.5 rounded-md font-black font-mono">
                              ₪{rcpt.totalAmount.toLocaleString('he-IL')} ({rcpt.paymentMethod})
                            </span>
                            
                            {rcpt.isPaidActually ? (
                              <span className="text-xs bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded-md font-bold flex items-center gap-1">
                                <Check className="w-3.5 h-3.5 text-emerald-700" />
                                <span>שולם בביט</span>
                                {rcpt.bitConfirmationNumber && (
                                  <span className="text-[10px] text-emerald-800 font-mono font-normal">
                                    (אישור {rcpt.bitConfirmationNumber})
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span className="text-xs bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-md font-bold flex items-center gap-1">
                                <span>⏳ ממתין לתשלום בביט</span>
                              </span>
                            )}
                          </div>

                          {rcpt.rawLineText && (
                            <p className="text-xs text-slate-600 font-medium">
                              פירוט: <span className="font-bold text-slate-800">{rcpt.rawLineText}</span>
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0 justify-end pt-1 md:pt-0">
                          {rcpt.receiptImageUrl && (
                            <button
                              type="button"
                              onClick={() => setReceiptImagePreview({ url: rcpt.receiptImageUrl!, title: `קבלה ${rcpt.receiptNumber} - ${rcpt.rawLineText || 'הילה קירזנר'}` })}
                              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 font-bold text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                              title="צפה בתמונת הקבלה המקורית"
                            >
                              <span>👁️</span>
                              <span>צפה בקבלה</span>
                            </button>
                          )}

                          {rcpt.bitConfirmationImageUrl && (
                            <button
                              type="button"
                              onClick={() => setReceiptImagePreview({ url: rcpt.bitConfirmationImageUrl!, title: `אישור ביט - קבלה ${rcpt.receiptNumber} (${rcpt.bitConfirmationNumber || 'אישור תשלום'})` })}
                              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                              title="צפה בצילום מסך אישור הביט"
                            >
                              <span>📱</span>
                              <span>אישור ביט</span>
                            </button>
                          )}

                          {!rcpt.isPaidActually && (
                            <button
                              type="button"
                              onClick={() => handleMarkReceiptAsPaid(rcpt.id)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg shadow-2xs cursor-pointer flex items-center gap-1"
                              title="סמן כי התשלום בביט בוצע בפועל"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>סמן כשולם</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedReceiptForEdit(rcpt);
                              setIsTrainerReceiptModalOpen(true);
                            }}
                            className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs px-2.5 py-1.5 rounded-lg cursor-pointer flex items-center gap-1"
                            title="ערוך קבלה"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>ערוך</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Training Dogs Payment Matrix */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
                <h4 className="font-black text-sm text-slate-900 flex items-center gap-2">
                  <span>🐕 מעקב 3 פעימות תשלום לכלבי אילוף (₪1,500 לכלב)</span>
                </h4>

                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 font-bold bg-slate-50">
                        <th className="p-2.5 rounded-tr-xl">שם הכלב והבעלים</th>
                        <th className="p-2.5 text-center">פעימה 1/3 (₪500)</th>
                        <th className="p-2.5 text-center">פעימה 2/3 (₪500)</th>
                        <th className="p-2.5 text-center">פעימה 3/3 (₪500)</th>
                        <th className="p-2.5 text-center">שולם להילה</th>
                        <th className="p-2.5 text-center">יתרה להילה</th>
                        <th className="p-2.5 text-center rounded-tl-xl">פעולות</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {allTrainingBookings.map(b => {
                        const stages = getBookingTrainerStages(b);
                        const s1 = stages.find(s => s.stage === '1/3');
                        const s2 = stages.find(s => s.stage === '2/3');
                        const s3 = stages.find(s => s.stage === '3/3');
                        const paidTotal = stages.filter(s => s.isPaidActually).reduce((sum, s) => sum + s.amount, 0);
                        const remaining = Math.max(0, 1500 - paidTotal);
                        const isCompleted = b.isTrainingCompleted || (s1?.isPaidActually && s2?.isPaidActually && s3?.isPaidActually);

                        return (
                          <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="p-2.5 font-bold text-slate-900">
                              <div className="flex items-center gap-1.5">
                                <span>🐾 {b.dogName}</span>
                                <span className="text-slate-500 font-normal">({b.ownerName})</span>
                                {isCompleted && (
                                  <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-0.2 rounded font-black">
                                    🏁 הושלם
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="p-2.5 text-center">
                              <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] inline-flex items-center gap-1 ${
                                s1?.isPaidActually
                                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                  : s1?.receiptNumber
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                  : 'bg-slate-100 text-slate-400'
                              }`}>
                                {s1?.isPaidActually ? `✓ שולם (קבלה ${s1.receiptNumber || '20056'})` : s1?.receiptNumber ? `⏳ קבלה ${s1.receiptNumber}` : 'טרם הגיע'}
                              </span>
                            </td>

                            <td className="p-2.5 text-center">
                              <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] inline-flex items-center gap-1 ${
                                s2?.isPaidActually
                                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                  : s2?.receiptNumber
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                  : 'bg-slate-100 text-slate-400'
                              }`}>
                                {s2?.isPaidActually ? `✓ שולם (קבלה ${s2.receiptNumber || '20056'})` : s2?.receiptNumber ? `⏳ קבלה ${s2.receiptNumber}` : 'טרם הגיע'}
                              </span>
                            </td>

                            <td className="p-2.5 text-center">
                              <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] inline-flex items-center gap-1 ${
                                s3?.isPaidActually
                                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                  : s3?.receiptNumber
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                  : 'bg-slate-100 text-slate-400'
                              }`}>
                                {s3?.isPaidActually ? '✓ שולם (סיום)' : s3?.receiptNumber ? `⏳ קבלה ${s3.receiptNumber}` : 'טרם הגיע'}
                              </span>
                            </td>

                            <td className="p-2.5 text-center font-black font-mono text-emerald-800">
                              ₪{paidTotal.toLocaleString('he-IL')}
                            </td>

                            <td className="p-2.5 text-center font-black font-mono text-slate-700">
                              ₪{remaining.toLocaleString('he-IL')}
                            </td>

                            <td className="p-2.5 text-center">
                              {!isCompleted ? (
                                <button
                                  type="button"
                                  onClick={() => handleGraduateDog(b.id)}
                                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-2 py-1 rounded-lg text-[10px] shadow-2xs cursor-pointer"
                                  title="סמן כי תהליך האילוף הושלם"
                                >
                                  🎓 סמן כהסתיים
                                </button>
                              ) : (
                                <span className="text-[10px] text-emerald-700 font-bold">✓ הושלם</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          ) : metricType === 'training' ? (
            /* CLEAN TRAINING CARDS VIEW (For Active & Completed tabs) */
            filteredItems.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <Dog className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                <p className="font-bold text-slate-700 text-sm">לא נמצאו כלבי אילוף להצגה</p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {filteredItems.map(b => {
                  const daysCount = calculateDaysCount(b.startDate, b.endDate);
                  const stages = getBookingTrainerStages(b);
                  const s1 = stages.find(s => s.stage === '1/3');
                  const s2 = stages.find(s => s.stage === '2/3');
                  const s3 = stages.find(s => s.stage === '3/3');
                  const paidStagesCount = stages.filter(s => s.isPaidActually).length;
                  const paidTotal = stages.filter(s => s.isPaidActually).reduce((sum, s) => sum + s.amount, 0);

                  return (
                    <div
                      key={b.id}
                      className="bg-white border border-slate-200 hover:border-purple-300 rounded-2xl p-4 sm:p-5 shadow-xs transition-all flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4"
                    >
                      {/* RIGHT: Dog Name (Owner Name), Dates, Phone & WhatsApp */}
                      <div className="lg:w-64 space-y-2 text-right shrink-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-lg text-slate-900">
                            🐾 {b.dogName}
                          </span>
                          <span className="text-sm font-bold text-slate-600">
                            ({b.ownerName})
                          </span>
                        </div>

                        <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5 flex-wrap">
                          <span className="bg-purple-50 text-purple-900 border border-purple-200 px-2 py-0.5 rounded-md font-bold">
                            אילוף ({daysCount} ימים)
                          </span>
                          <span className="text-slate-600 font-mono">
                            {formatDateIL(b.startDate)} עד {formatDateIL(b.endDate)}
                          </span>
                        </div>

                        {b.ownerPhone && (
                          <div className="pt-0.5">
                            <button
                              type="button"
                              onClick={(e) => handleSendWhatsApp(b, e)}
                              className="text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 font-bold px-2.5 py-1 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                              title="פתח שיחת וואטסאפ עם הלקוח"
                            >
                              <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                              <span dir="ltr">{b.ownerPhone}</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* CENTER: 3-TIER VERTICAL STACK (מלמעלה למטה בדיוק לפי הסקיצה) */}
                      <div className="flex-1 bg-slate-50/80 border border-slate-200/90 rounded-2xl p-3 sm:p-3.5 space-y-2">
                        {/* 1. תשלום ראשון */}
                        <div className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold transition-all ${
                          s1?.isPaidActually
                            ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                            : s1?.receiptNumber
                            ? 'bg-amber-50 border-amber-300 text-amber-950'
                            : 'bg-white border-slate-200 text-slate-500'
                        }`}>
                          <div className="flex items-center gap-2.5">
                            <div className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-black border transition-all ${
                              s1?.isPaidActually
                                ? 'bg-emerald-600 border-emerald-700 text-white'
                                : 'bg-white border-slate-300 text-transparent'
                            }`}>
                              ✓
                            </div>
                            <span className="text-xs font-black text-slate-800">
                              תשלום ראשון (1/3)
                            </span>
                            <span className="text-xs text-slate-500 font-mono font-normal">
                              — ₪500
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className={`text-[11px] px-2.5 py-0.5 rounded-md font-bold ${
                              s1?.isPaidActually
                                ? 'bg-emerald-200/80 text-emerald-900 font-black'
                                : s1?.receiptNumber
                                ? 'bg-amber-200/80 text-amber-900'
                                : 'bg-slate-100 text-slate-400'
                            }`}>
                              {s1?.isPaidActually 
                                ? (s1.receiptNumber ? `שולם (קבלה ${s1.receiptNumber})` : 'שולם בביט') 
                                : s1?.receiptNumber 
                                ? `קבלה ${s1.receiptNumber} (ממתין)` 
                                : 'טרם שולם'}
                            </span>
                            {s1?.receiptImageUrl && (
                              <button
                                type="button"
                                onClick={() => setReceiptImagePreview({ url: s1.receiptImageUrl!, title: `קבלה ${s1.receiptNumber} - ${b.dogName}` })}
                                className="text-indigo-600 hover:text-indigo-800 text-xs font-bold flex items-center gap-0.5 cursor-pointer"
                                title="צפה בקבלה"
                              >
                                <span>👁️</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* 2. תשלום שני */}
                        <div className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold transition-all ${
                          s2?.isPaidActually
                            ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                            : s2?.receiptNumber
                            ? 'bg-amber-50 border-amber-300 text-amber-950'
                            : 'bg-white border-slate-200 text-slate-500'
                        }`}>
                          <div className="flex items-center gap-2.5">
                            <div className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-black border transition-all ${
                              s2?.isPaidActually
                                ? 'bg-emerald-600 border-emerald-700 text-white'
                                : 'bg-white border-slate-300 text-transparent'
                            }`}>
                              ✓
                            </div>
                            <span className="text-xs font-black text-slate-800">
                              תשלום שני (2/3)
                            </span>
                            <span className="text-xs text-slate-500 font-mono font-normal">
                              — ₪500
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className={`text-[11px] px-2.5 py-0.5 rounded-md font-bold ${
                              s2?.isPaidActually
                                ? 'bg-emerald-200/80 text-emerald-900 font-black'
                                : s2?.receiptNumber
                                ? 'bg-amber-200/80 text-amber-900'
                                : 'bg-slate-100 text-slate-400'
                            }`}>
                              {s2?.isPaidActually 
                                ? (s2.receiptNumber ? `שולם (קבלה ${s2.receiptNumber})` : 'שולם בביט') 
                                : s2?.receiptNumber 
                                ? `קבלה ${s2.receiptNumber} (ממתין)` 
                                : 'טרם שולם'}
                            </span>
                            {s2?.receiptImageUrl && (
                              <button
                                type="button"
                                onClick={() => setReceiptImagePreview({ url: s2.receiptImageUrl!, title: `קבלה ${s2.receiptNumber} - ${b.dogName}` })}
                                className="text-indigo-600 hover:text-indigo-800 text-xs font-bold flex items-center gap-0.5 cursor-pointer"
                                title="צפה בקבלה"
                              >
                                <span>👁️</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* 3. תשלום שלישי */}
                        <div className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold transition-all ${
                          s3?.isPaidActually
                            ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                            : s3?.receiptNumber
                            ? 'bg-amber-50 border-amber-300 text-amber-950'
                            : paidStagesCount === 2
                            ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                            : 'bg-white border-slate-200 text-slate-500'
                        }`}>
                          <div className="flex items-center gap-2.5">
                            <div className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-black border transition-all ${
                              s3?.isPaidActually
                                ? 'bg-emerald-600 border-emerald-700 text-white'
                                : 'bg-white border-slate-300 text-transparent'
                            }`}>
                              ✓
                            </div>
                            <span className="text-xs font-black text-slate-800">
                              תשלום שלישי (3/3)
                            </span>
                            <span className="text-xs text-slate-500 font-mono font-normal">
                              — ₪500
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className={`text-[11px] px-2.5 py-0.5 rounded-md font-bold ${
                              s3?.isPaidActually
                                ? 'bg-emerald-200/80 text-emerald-900 font-black'
                                : s3?.receiptNumber
                                ? 'bg-amber-200/80 text-amber-900'
                                : paidStagesCount === 2
                                ? 'bg-amber-100 text-amber-900 font-black'
                                : 'bg-slate-100 text-slate-400'
                            }`}>
                              {s3?.isPaidActually 
                                ? 'שולם (סיום)' 
                                : s3?.receiptNumber 
                                ? `קבלה ${s3.receiptNumber}` 
                                : paidStagesCount === 2 
                                ? '⏳ נשאר תשלום אחרון' 
                                : 'טרם שולם'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* LEFT: TOTAL (ס"הכ) & ARCHIVE ACTION */}
                      <div className="lg:w-48 flex flex-col items-center lg:items-end justify-between gap-3 text-right shrink-0 bg-white border border-slate-200 p-3.5 rounded-2xl shadow-2xs">
                        <div className="w-full text-right space-y-0.5">
                          <div className="text-[11px] font-bold text-slate-400">סה״כ שולם להילה:</div>
                          <div className="text-xl font-black font-mono text-emerald-700">
                            ₪{paidTotal.toLocaleString('he-IL')} <span className="text-xs text-slate-400 font-normal">/ ₪1,500</span>
                          </div>
                          <div className="text-[11px] font-bold mt-1">
                            {paidTotal === 1500 ? (
                              <span className="text-emerald-700 font-black">✓ שולם במלואו</span>
                            ) : paidTotal === 1000 ? (
                              <span className="text-amber-700 font-black">⏳ נשאר תשלום אחרון (₪500)</span>
                            ) : paidTotal === 500 ? (
                              <span className="text-indigo-700 font-bold">נשארו 2 תשלומים (₪1,000)</span>
                            ) : (
                              <span className="text-slate-500 font-medium">טרם החלו תשלומים</span>
                            )}
                          </div>
                        </div>

                        {!b.isTrainingCompleted ? (
                          <button
                            type="button"
                            onClick={() => handleGraduateDog(b.id)}
                            className="w-full bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-bold text-xs py-2 px-3 rounded-xl shadow-2xs cursor-pointer transition-all flex items-center justify-center gap-1.5"
                            title="סמן כי האילוף הושלם והעבר ללשונית ארכיון"
                          >
                            <span>🎓</span>
                            <span>העבר לארכיון</span>
                          </button>
                        ) : (
                          <div className="text-xs bg-emerald-100 text-emerald-900 border border-emerald-300 px-3 py-1.5 rounded-xl font-black flex items-center justify-center gap-1 w-full">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-700" />
                            <span>בארכיון (הסתיים)</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <Dog className="w-12 h-12 mx-auto text-slate-300 mb-2" />
              <p className="font-bold text-slate-700 text-sm">לא נמצאו פריטים להצגה</p>
              <p className="text-xs text-slate-400 mt-1">
                {searchQuery ? 'נסה לשנות את מילות החיפוש' : 'אין כרגע נתונים בקטגוריה זו'}
              </p>
            </div>
          ) : (
            filteredItems.map(b => {
              const totalPrice = Number(b.totalPrice) || 0;
              const depositAmount = Number(b.depositAmount) || 0;
              const remainingDebt = Math.max(0, totalPrice - depositAmount);
              const daysCount = calculateDaysCount(b.startDate, b.endDate);
              const isEnded = b.stayStatus === 'checked_out' || (b.endDate < todayStr);

              return (
                <div
                  key={b.id}
                  className="bg-white border border-slate-200 hover:border-emerald-300 rounded-2xl p-3.5 sm:p-4 shadow-xs transition-all hover:shadow-md flex flex-col md:flex-row md:items-center justify-between gap-3"
                >
                  {/* Left / Info */}
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-black text-base sm:text-lg text-slate-900">
                        {b.dogName}
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-slate-500">
                        ({b.ownerName})
                      </span>
                      {b.dogBreed && (
                        <span className="text-xs text-slate-500 font-medium">
                          ({b.dogBreed})
                        </span>
                      )}
                      
                      {/* Service Tag */}
                      <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-semibold border border-slate-200">
                        {getServiceTypeHebrew(b.serviceType)}
                      </span>

                      {/* Stay Status Tag */}
                      {b.stayStatus === 'cancelled' ? (
                        <span className="text-xs bg-rose-100 text-rose-800 border border-rose-300 px-2 py-0.5 rounded-md font-bold flex items-center gap-1">
                          ❌ בוטל
                        </span>
                      ) : isEnded ? (
                        <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-md font-semibold">
                          🏁 הסתיים ושוחרר
                        </span>
                      ) : b.stayStatus === 'checked_in' ? (
                        <span className="text-xs bg-sky-50 text-sky-700 border border-sky-300 px-2 py-0.5 rounded-md font-bold flex items-center gap-1">
                          <ArrowDownLeft className="w-3 h-3" /> שוהה כעת
                        </span>
                      ) : (
                        <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md font-semibold">
                          📅 שוריין
                        </span>
                      )}

                      {/* Refund Tag */}
                      {(Number(b.refundAmount) || 0) > 0 && (
                        <span className="text-xs bg-rose-50 text-rose-800 border border-rose-300 px-2 py-0.5 rounded-md font-bold flex items-center gap-1">
                          <span>↩️ הוחזר: ₪{Number(b.refundAmount).toLocaleString('he-IL')}</span>
                          {b.refundReason && <span className="font-medium text-[11px] text-rose-700">({b.refundReason})</span>}
                        </span>
                      )}
                    </div>

                    {/* Metadata: Owner, Phone, Dates */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                      <span className="flex items-center gap-1 text-slate-800 font-medium">
                        <User className="w-3.5 h-3.5 text-indigo-500" />
                        {b.ownerName}
                      </span>
                      <span className="flex items-center gap-1 font-mono text-slate-800 font-semibold" dir="ltr">
                        <Phone className="w-3.5 h-3.5 text-green-600" />
                        {b.ownerPhone}
                      </span>
                      <span className="flex items-center gap-1 text-slate-800 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200">
                        <Calendar className="w-3.5 h-3.5 text-amber-600" />
                        <span>{formatDateIL(b.startDate)} עד {formatDateIL(b.endDate)}</span>
                        <span className="text-slate-400 font-semibold">({daysCount} ימים)</span>
                      </span>
                    </div>

                    {b.notes && (
                      <p className="text-xs text-amber-800/90 italic bg-amber-50/60 px-2 py-1 rounded-lg border border-amber-200/60 max-w-xl">
                        הערות: {b.notes}
                      </p>
                    )}
                  </div>

                  {/* Right / Finance & Actions */}
                  <div className="flex flex-wrap items-center justify-between md:justify-end gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                    
                    {/* Financial Badge */}
                    <div className="text-right pl-2 bg-slate-50/80 px-3 py-1.5 rounded-xl border border-slate-200/80 min-w-[130px]">
                      <div className="text-xs text-slate-600 font-medium flex items-center justify-between gap-2">
                        <span>סה״כ:</span>
                        <span className="font-bold text-slate-900">₪{totalPrice.toLocaleString('he-IL')}</span>
                      </div>
                      <div className="text-xs text-emerald-700 font-semibold flex items-center justify-between gap-2">
                        <span>שולם כמקדמה:</span>
                        <span className="font-bold">₪{depositAmount.toLocaleString('he-IL')}</span>
                      </div>
                      {(Number(b.refundAmount) || 0) > 0 && (
                        <div className="text-xs text-rose-700 font-bold flex items-center justify-between gap-2 border-t border-rose-200/80 pt-0.5 mt-0.5 bg-rose-50/70 px-1.5 py-0.5 rounded">
                          <span>הוחזר ללקוח:</span>
                          <span className="font-mono font-black">₪{Number(b.refundAmount).toLocaleString('he-IL')}</span>
                        </div>
                      )}
                      {b.stayStatus === 'cancelled' ? (
                        <div className="text-xs font-bold text-rose-600 flex items-center gap-1 border-t border-rose-200/60 pt-0.5 mt-0.5">
                          <span>הזמנה מבוטלת</span>
                        </div>
                      ) : remainingDebt > 0 && b.paymentStatus !== 'fully_paid' ? (
                        <div className="text-xs font-black text-red-600 flex items-center justify-between gap-2 border-t border-red-200/60 pt-0.5 mt-0.5">
                          <span>יתרת חוב:</span>
                          <span>₪{remainingDebt.toLocaleString('he-IL')}</span>
                        </div>
                      ) : (
                        <div className="text-xs font-bold text-green-600 flex items-center gap-1 border-t border-green-200/60 pt-0.5 mt-0.5">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>שולם מלא</span>
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5">
                      
                      {/* Mark Paid fast action */}
                      {remainingDebt > 0 && b.stayStatus !== 'cancelled' && (
                        <button
                          type="button"
                          onClick={() => onMarkAsPaid(b.id)}
                          className="bg-green-600 hover:bg-green-700 active:scale-98 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
                          title="סמן כעת כשולם במלואו"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>סמן כשולם</span>
                        </button>
                      )}

                      {/* Release Dog Button */}
                      {b.stayStatus !== 'checked_out' && b.stayStatus !== 'cancelled' && onInitiateRelease && (
                        <button
                          type="button"
                          onClick={() => onInitiateRelease(b)}
                          className="bg-amber-500 hover:bg-amber-600 active:scale-98 text-white text-xs font-bold px-2.5 py-1.5 rounded-xl flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
                          title="שחרר כלב (בדיקת חוב וסגירת שחרור)"
                        >
                          <Home className="w-3.5 h-3.5" />
                          <span>שחרור</span>
                        </button>
                      )}

                      {/* Custom payment */}
                      {b.stayStatus !== 'cancelled' && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenPaymentModal(b);
                          }}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-slate-200 flex items-center gap-1 transition-colors cursor-pointer"
                          title="הוסף תשלום או מקדמה"
                        >
                          <CreditCard className="w-3.5 h-3.5 text-green-600" />
                          <span>תשלום</span>
                        </button>
                      )}

                      {/* WhatsApp reminder */}
                      {b.ownerPhone && (
                        <button
                          type="button"
                          onClick={(e) => handleSendWhatsApp(b, e)}
                          className="bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 text-xs font-semibold px-2.5 py-1.5 rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                          title="שלח וואטסאפ"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-green-600" />
                          <span>וואטסאפ</span>
                        </button>
                      )}

                      {/* Edit Booking button */}
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onEditBooking(b);
                        }}
                        className="bg-[#0f766e] hover:bg-[#0f6760] active:scale-98 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
                        title="ערוך פרטי הזמנה"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>ערוך</span>
                      </button>
                    </div>

                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>💡 ניתן לערוך כל פרט בהזמנה, לסמן תשלומים או לעדכן תאריכים ישירות מכאן.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white border border-slate-200 font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            סגור
          </button>
        </div>

      </div>

      {/* Trainer Receipt Intake & Processing Modal */}
      {isTrainerReceiptModalOpen && (
        <TrainerReceiptIntakeModal
          isOpen={isTrainerReceiptModalOpen}
          onClose={() => {
            setIsTrainerReceiptModalOpen(false);
            setSelectedReceiptForEdit(undefined);
          }}
          onSaveReceipt={handleSaveReceipt}
          trainingBookings={allTrainingBookings}
          existingReceipt={selectedReceiptForEdit}
          greenApiId={settings?.greenApiIdInstance}
          greenApiToken={settings?.greenApiToken}
        />
      )}

      {/* Receipt Image Preview Lightbox Modal */}
      {receiptImagePreview && (
        <div 
          className="fixed inset-0 z-60 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in"
          onClick={() => setReceiptImagePreview(null)}
        >
          <div 
            className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h4 className="font-black text-sm text-slate-900 flex items-center gap-2">
                <span>📄 {receiptImagePreview.title}</span>
              </h4>
              <div className="flex items-center gap-2">
                <a
                  href={receiptImagePreview.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3 py-1.5 rounded-xl flex items-center gap-1 shadow-2xs"
                >
                  <span>⬇️ הורד מסמך</span>
                </a>
                <button
                  type="button"
                  onClick={() => setReceiptImagePreview(null)}
                  className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-4 overflow-y-auto flex items-center justify-center bg-slate-100 min-h-[300px]">
              <img
                src={receiptImagePreview.url}
                alt={receiptImagePreview.title}
                className="max-h-[70vh] w-auto rounded-xl shadow-md object-contain border border-slate-300"
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
