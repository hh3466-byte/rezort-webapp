import React, { useState, useMemo } from 'react';
import { 
  X, 
  Search, 
  Dog, 
  User, 
  Phone, 
  Calendar, 
  CreditCard, 
  CheckCircle, 
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
}

const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
];

export const HeaderMetricModal: React.FC<HeaderMetricModalProps> = ({
  metricType,
  onClose,
  bookings,
  settings,
  onEditBooking,
  onMarkAsPaid,
  onOpenPaymentModal,
  onToggleStayStatus,
  onInitiateRelease,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [trainingFilter, setTrainingFilter] = useState<'all' | 'full' | 'day'>('all');
  const [revenueCategoryFilter, setRevenueCategoryFilter] = useState<'all' | 'digital' | 'grow_10th' | 'direct_transfer' | 'grow_in_2_months' | 'cash'>('all');
  const [chartMode, setChartMode] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedChartPeriod, setSelectedChartPeriod] = useState<string | null>(null);

  const todayStr = getTodayStr();
  const currentMonthKey = todayStr.substring(0, 7); // e.g. 2026-09
  const currentYearKey = todayStr.substring(0, 4);

  const [curYNum, curMNum] = currentMonthKey.split('-').map(Number);
  const next10thDateLabel = `10.${String(new Date(curYNum, (curMNum || 1), 10).getMonth() + 1).padStart(2, '0')}`;
  const inTwoMonthsDateLabel = `10.${String(new Date(curYNum, (curMNum || 1) + 1, 10).getMonth() + 1).padStart(2, '0')}`;

  const activeBookings = useMemo(() => {
    return bookings.filter(b => b.stayStatus !== 'cancelled');
  }, [bookings]);

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
      expected: number;
      debt: number;
    }> = {};
    const yearlyMap: Record<string, { count: number; collected: number; expected: number; debt: number }> = {};

    let totalAllTime = 0;
    let totalThisMonth = 0;

    // Calculate total all time
    activeBookings.forEach(b => {
      const col = b.paymentStatus === 'fully_paid'
        ? (Number(b.totalPrice) || 0)
        : (Number(b.depositAmount) || 0);
      totalAllTime += col;
    });

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
      const breakdown = getMonthlyRevenueBreakdown(mKey, activeBookings);
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
        collected: breakdown.digitalCleared, // 1. נסלק החודש (דיגיטלי)
        digitalCleared: breakdown.digitalCleared,
        growClearedBankOn10th: breakdown.growClearedBankOn10th,
        directBankTransfers: breakdown.directBankTransfers,
        bankOn10thInTwoMonths: breakdown.bankOn10thInTwoMonths,
        cashBanknotes: breakdown.cashCollected,
        cashCollected: breakdown.cashCollected,
        totalCollected: breakdown.totalCollected,
        expected: mExpected,
        debt: mDebt
      };

      if (mKey === currentMonthKey) {
        totalThisMonth = breakdown.digitalCleared;
      }
    });

    // Compute yearly collections
    activeBookings.forEach(b => {
      const yKey = (b.createdAt || b.startDate || '').substring(0, 4);
      const collected = b.paymentStatus === 'fully_paid'
        ? (Number(b.totalPrice) || 0)
        : (Number(b.depositAmount) || 0);
      const expected = Number(b.totalPrice) || 0;
      const debt = Math.max(0, expected - collected);

      if (yKey && yKey.length === 4) {
        if (!yearlyMap[yKey]) yearlyMap[yKey] = { count: 0, collected: 0, expected: 0, debt: 0 };
        yearlyMap[yKey].count += 1;
        yearlyMap[yKey].collected += collected;
        yearlyMap[yKey].expected += expected;
        yearlyMap[yKey].debt += debt;
      }
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
      const data = monthlyMap[k] || { count: 0, collected: 0, expected: 0, debt: 0 };
      return {
        periodKey: k,
        periodLabel: label,
        bookingsCount: data.count,
        totalCollected: data.collected,
        totalExpected: data.expected,
        openDebt: data.debt
      };
    });

    // Build years sequence
    const yKeys = Object.keys(yearlyMap);
    if (!yKeys.includes(currentYearKey)) yKeys.push(currentYearKey);
    yKeys.sort();

    const yearlyList: ChartPeriodItem[] = yKeys.map(y => {
      const data = yearlyMap[y] || { count: 0, collected: 0, expected: 0, debt: 0 };
      return {
        periodKey: y,
        periodLabel: `שנת ${y}`,
        bookingsCount: data.count,
        totalCollected: data.collected,
        totalExpected: data.expected,
        openDebt: data.debt
      };
    });

    return {
      monthlyChartData: monthlyList,
      yearlyChartData: yearlyList,
      currentMonthCollected: totalThisMonth,
      allTimeCollected: totalAllTime,
      monthlyMap
    };
  }, [activeBookings, currentMonthKey, currentYearKey]);

  if (!metricType) return null;

  const todayBookings = getBookingsForDate(activeBookings, todayStr);

  // Filter items based on selected metric
  let title = '';
  let subtitle = '';
  let icon = <Sparkles className="w-5 h-5" />;
  let badgeColor = 'bg-slate-100 text-slate-800 border-slate-200';
  let filteredItems: Booking[] = [];

  switch (metricType) {
    case 'occupancy':
      title = 'תפוסה כוללת להיום';
      subtitle = `${todayBookings.length} כלבים שוהים בריזורט היום (מתוך ${settings.maxCapacity} מקומות מקסימום)`;
      icon = <Dog className="w-5 h-5 text-emerald-600" />;
      badgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-200';
      filteredItems = todayBookings;
      break;

    case 'boarding':
      title = 'כלבי פנסיון ושהות יומית';
      subtitle = 'כלבים השוהים בפנסיון לילה או יום כיף פעיל';
      icon = <Building2 className="w-5 h-5 text-sky-600" />;
      badgeColor = 'bg-sky-50 text-sky-800 border-sky-200';
      filteredItems = todayBookings.filter(b => b.serviceType === 'boarding' || b.serviceType === 'daycare');
      break;

    case 'training':
      title = 'כלבים בתהליך אילוף היום';
      subtitle = 'תהליך אילוף מלא ואילוף ביומיות ללא לינה';
      icon = <GraduationCap className="w-5 h-5 text-purple-700" />;
      badgeColor = 'bg-purple-50 text-purple-800 border-purple-200';
      filteredItems = todayBookings.filter(b => {
        if (trainingFilter === 'full') return b.serviceType === 'training';
        if (trainingFilter === 'day') return b.serviceType === 'day_training';
        return b.serviceType === 'training' || b.serviceType === 'day_training';
      });
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
      const paidItems = activeBookings.filter(b => {
        return (Number(b.depositAmount) || 0) > 0 || b.paymentStatus === 'fully_paid';
      });
      const curData = monthlyMap[currentMonthKey];
      const digitalCleared = curData?.digitalCleared || 0;
      const growClearedBankOn10th = curData?.growClearedBankOn10th || 0;
      const directBankTransfers = curData?.directBankTransfers || 0;
      const bankOn10thInTwoMonths = curData?.bankOn10thInTwoMonths || 0;
      const cashCollected = curData?.cashCollected || 0;

      title = `פירוט הכנסות וסליקה: דיגיטלי, העברות ישירות, יכנס ב-10, יכנס ב-${inTwoMonthsDateLabel}, ומזומן`;
      subtitle = `1. נסלק דיגיטלי: ₪${digitalCleared.toLocaleString('he-IL')}${directBankTransfers > 0 ? ` • ישיר לחשבון: ₪${directBankTransfers.toLocaleString('he-IL')}` : ''} • 2. ייכנס לבנק ב-${next10thDateLabel}: ₪${growClearedBankOn10th.toLocaleString('he-IL')} • 3. יכנס לבנק ב-${inTwoMonthsDateLabel}: ₪${bankOn10thInTwoMonths.toLocaleString('he-IL')} • 4. נסלק במזומן: ₪${cashCollected.toLocaleString('he-IL')}`;
      icon = <DollarSign className="w-5 h-5 text-emerald-700" />;
      badgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-200';
      filteredItems = paidItems;

      // Filter by revenueCategoryFilter (all / digital / grow_10th / direct_transfer / grow_in_2_months / cash)
      if (revenueCategoryFilter !== 'all') {
        filteredItems = filteredItems.filter(b => {
          const notes = (b.notes || '') + ' ' + ((b as any)?.data?.internalNotes || '');
          const isGrow = VERIFIED_GROW_LEDGER.some(t => notes.includes(t.ref) || b.id.includes(t.ref));
          const isBank = (b.ownerName || '').includes('רונן') || (b.ownerName || '').includes('מלמוד') || notes.includes('העברה בנקאית');
          const isInstallment = notes.includes('מתוך') || notes.includes('תשלום ראשון') || (b.ownerName || '').includes('דורין') || (b.ownerName || '').includes('לוקס');

          if (revenueCategoryFilter === 'grow_10th') return isGrow;
          if (revenueCategoryFilter === 'direct_transfer') return isBank;
          if (revenueCategoryFilter === 'grow_in_2_months') return isInstallment;
          if (revenueCategoryFilter === 'digital') return isGrow || isBank;
          if (revenueCategoryFilter === 'cash') return !isGrow && !isBank;
          return true;
        });
      }

      // Filter by chart column click if selected
      if (selectedChartPeriod) {
        filteredItems = filteredItems.filter(b => {
          if (chartMode === 'monthly') {
            return getBookingPaymentsInMonth(b, selectedChartPeriod) > 0;
          } else {
            return (b.createdAt && b.createdAt.startsWith(selectedChartPeriod)) || 
                   (b.startDate && b.startDate.startsWith(selectedChartPeriod));
          }
        });
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

        {/* REVENUE ANALYTICS & COLUMN CHARTS (Displayed when metricType === 'revenue') */}
        {metricType === 'revenue' && (
          <div className="p-4 bg-slate-50/60 border-b border-slate-200/70 space-y-3">
            
            {/* Controls: Mode Toggle & Summary Stats */}
            <div className="flex flex-wrap items-center justify-between gap-3">
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

              {/* Summary KPIs: 3 Categories + Total */}
              <div className="flex flex-wrap items-center gap-2">
                <div 
                  onClick={() => setRevenueCategoryFilter(revenueCategoryFilter === 'digital' ? 'all' : 'digital')}
                  className={`border px-3 py-1.5 rounded-xl text-right shadow-2xs cursor-pointer transition-all ${
                    revenueCategoryFilter === 'digital' ? 'bg-emerald-100 border-emerald-500 ring-2 ring-emerald-500' : 'bg-white border-emerald-200/90 hover:bg-emerald-50/50'
                  }`}
                  title="לחץ לסינון: 1. כל אמצעי התשלום הדיגיטלי כולם"
                >
                  <div className="text-[10px] font-bold text-emerald-800">1. נסלק החודש (דיגיטלי)</div>
                  <div className="text-sm font-black text-emerald-700">
                    ₪{(monthlyMap[currentMonthKey]?.digitalCleared || 0).toLocaleString('he-IL')}
                  </div>
                  <div className="text-[9px] text-slate-400">כלל התשלומים הדיגיטליים</div>
                </div>

                {(monthlyMap[currentMonthKey]?.directBankTransfers || 0) > 0 && (
                  <div 
                    onClick={() => setRevenueCategoryFilter(revenueCategoryFilter === 'direct_transfer' ? 'all' : 'direct_transfer')}
                    className={`border px-3 py-1.5 rounded-xl text-right shadow-2xs cursor-pointer transition-all ${
                      revenueCategoryFilter === 'direct_transfer' ? 'bg-teal-100 border-teal-500 ring-2 ring-teal-500' : 'bg-teal-50 border-teal-200 hover:bg-teal-100/60'
                    }`}
                    title="לחץ לסינון: העברות בנקאיות ישירות שהופקדו ישירות לחשבון הבנק"
                  >
                    <div className="text-[10px] font-bold text-teal-800">הועבר ישירות לחשבון</div>
                    <div className="text-sm font-black text-teal-900">
                      ₪{(monthlyMap[currentMonthKey]?.directBankTransfers || 0).toLocaleString('he-IL')}
                    </div>
                    <div className="text-[9px] text-teal-700 font-medium">כבר בחשבון הבנק</div>
                  </div>
                )}

                <div 
                  onClick={() => setRevenueCategoryFilter(revenueCategoryFilter === 'grow_10th' ? 'all' : 'grow_10th')}
                  className={`border px-3 py-1.5 rounded-xl text-right shadow-2xs cursor-pointer transition-all ${
                    revenueCategoryFilter === 'grow_10th' ? 'bg-sky-100 border-sky-500 ring-2 ring-sky-500' : 'bg-sky-50 border-sky-200 hover:bg-sky-100/60'
                  }`}
                  title="לחץ לסינון: 2. סליקת כרטיסי אשראי GROW (ייכנס לבנק ב-10 לחודש הקרוב)"
                >
                  <div className="text-[10px] font-bold text-sky-800">2. יכנס לבנק ב-{next10thDateLabel}</div>
                  <div className="text-sm font-black text-sky-900">
                    ₪{(monthlyMap[currentMonthKey]?.growClearedBankOn10th || 0).toLocaleString('he-IL')}
                  </div>
                  <div className="text-[9px] text-sky-600 font-medium">סליקת כרטיסי אשראי GROW</div>
                </div>

                <div 
                  onClick={() => setRevenueCategoryFilter(revenueCategoryFilter === 'grow_in_2_months' ? 'all' : 'grow_in_2_months')}
                  className={`border px-3 py-1.5 rounded-xl text-right shadow-2xs cursor-pointer transition-all ${
                    revenueCategoryFilter === 'grow_in_2_months' ? 'bg-indigo-100 border-indigo-500 ring-2 ring-indigo-500' : 'bg-indigo-50 border-indigo-200 hover:bg-indigo-100/60'
                  }`}
                  title="לחץ לסינון: 3. עסקאות בתשלומים שיכנסו לבנק ב-10 בעוד חודשיים"
                >
                  <div className="text-[10px] font-bold text-indigo-900">3. יכנס לבנק ב-{inTwoMonthsDateLabel}</div>
                  <div className="text-sm font-black text-indigo-950">
                    ₪{(monthlyMap[currentMonthKey]?.bankOn10thInTwoMonths || 0).toLocaleString('he-IL')}
                  </div>
                  <div className="text-[9px] text-indigo-700 font-medium">תשלומי המשך מובטחים</div>
                </div>

                <div 
                  onClick={() => setRevenueCategoryFilter(revenueCategoryFilter === 'cash' ? 'all' : 'cash')}
                  className={`border px-3 py-1.5 rounded-xl text-right shadow-2xs cursor-pointer transition-all ${
                    revenueCategoryFilter === 'cash' ? 'bg-amber-100 border-amber-500 ring-2 ring-amber-500' : 'bg-amber-50 border-amber-200 hover:bg-amber-100/60'
                  }`}
                  title="לחץ לסינון: 4. נסלק במזומן"
                >
                  <div className="text-[10px] font-bold text-amber-800">4. נסלק במזומן</div>
                  <div className="text-sm font-black text-amber-900">
                    ₪{(monthlyMap[currentMonthKey]?.cashCollected || 0).toLocaleString('he-IL')}
                  </div>
                  <div className="text-[9px] text-amber-700 font-medium">תשלום מזומן ישיר</div>
                </div>

                <div 
                  onClick={() => setRevenueCategoryFilter('all')}
                  className={`border px-3 py-1.5 rounded-xl text-right shadow-2xs cursor-pointer transition-all ${
                    revenueCategoryFilter === 'all' ? 'bg-slate-100 border-slate-300' : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                  title="לחץ להצגת סה״כ כלל ההכנסות"
                >
                  <div className="text-[10px] font-bold text-slate-500">סה״כ כולל החודש</div>
                  <div className="text-sm font-black text-slate-900">
                    ₪{(monthlyMap[currentMonthKey]?.totalCollected || 0).toLocaleString('he-IL')}
                  </div>
                  <div className="text-[9px] text-slate-400">דיגיטלי + מזומן</div>
                </div>
              </div>
            </div>

            {/* Column / Bar Chart */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-3 sm:p-4 shadow-2xs">
              <div className="flex items-center justify-between text-xs text-slate-400 font-semibold mb-2">
                <span>📊 גרף עמודות הכנסות בפועל (סכומים בשקלים כתובים מעל כל עמודה):</span>
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
                        title={`${item.periodLabel}: ₪${item.totalCollected.toLocaleString('he-IL')} מתוך ${item.bookingsCount} הזמנות. לחץ לסינון הרשימה.`}
                      >
                        {/* Amount in Shekels on top of column */}
                        <span className={`text-[10px] sm:text-[11px] font-black tracking-tight mb-1 text-center transition-all ${
                          item.totalCollected > 0 
                            ? isSelected || isCurrent ? 'text-emerald-800 scale-105' : 'text-slate-700'
                            : 'text-slate-400 opacity-60'
                        }`}>
                          {item.totalCollected > 0 ? `₪${item.totalCollected.toLocaleString('he-IL')}` : '0 ₪'}
                        </span>

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
          </div>
        )}

        {/* Toolbar: Search and Filters */}
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

          {/* Sub-filter for Revenue metric: 4 Categories */}
          {metricType === 'revenue' && (
            <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setRevenueCategoryFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                  revenueCategoryFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                הכל ({activeBookings.filter(b => (Number(b.depositAmount) || 0) > 0 || b.paymentStatus === 'fully_paid').length})
              </button>
              <button
                type="button"
                onClick={() => setRevenueCategoryFilter('digital')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                  revenueCategoryFilter === 'digital' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                📱 1. נסלק החודש (דיגיטלי)
              </button>
              {(monthlyMap[currentMonthKey]?.directBankTransfers || 0) > 0 && (
                <button
                  type="button"
                  onClick={() => setRevenueCategoryFilter('direct_transfer')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                    revenueCategoryFilter === 'direct_transfer' ? 'bg-teal-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  🏛️ הועבר ישירות לחשבון
                </button>
              )}
              <button
                type="button"
                onClick={() => setRevenueCategoryFilter('grow_10th')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                  revenueCategoryFilter === 'grow_10th' ? 'bg-sky-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🏦 2. יכנס לבנק ב-{next10thDateLabel} (GROW)
              </button>
              <button
                type="button"
                onClick={() => setRevenueCategoryFilter('grow_in_2_months')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                  revenueCategoryFilter === 'grow_in_2_months' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🗓️ 3. יכנס לבנק ב-{inTwoMonthsDateLabel}
              </button>
              <button
                type="button"
                onClick={() => setRevenueCategoryFilter('cash')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                  revenueCategoryFilter === 'cash' ? 'bg-amber-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                💵 4. נסלק במזומן
              </button>
            </div>
          )}
        </div>

        {/* Bookings List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-3">
          {filteredItems.length === 0 ? (
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
                      {isEnded ? (
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

                      {/* Revenue Metric Badge: 4 Categories */}
                      {metricType === 'revenue' && (() => {
                        const notes = (b.notes || '') + ' ' + ((b as any)?.data?.internalNotes || '');
                        const isGrow = VERIFIED_GROW_LEDGER.some(t => notes.includes(t.ref) || b.id.includes(t.ref));
                        const isBank = (b.ownerName || '').includes('רונן') || (b.ownerName || '').includes('מלמוד') || notes.includes('העברה בנקאית');
                        const isInstallment = notes.includes('מתוך') || notes.includes('תשלום ראשון') || (b.ownerName || '').includes('דורין') || (b.ownerName || '').includes('לוקס');
                        
                        if (isInstallment) {
                          return (
                            <span className="text-[10px] bg-indigo-50 text-indigo-900 font-bold px-1.5 py-0.5 rounded border border-indigo-300">
                              🗓️ 2+3. נסלק בתשלומים (יכנס ב-10 ובחודש הבא)
                            </span>
                          );
                        }
                        if (isGrow) {
                          return (
                            <span className="text-[10px] bg-sky-50 text-sky-800 font-bold px-1.5 py-0.5 rounded border border-sky-300">
                              💳 2. יכנס ב-10 לחודש (GROW)
                            </span>
                          );
                        }
                        if (isBank) {
                          return (
                            <span className="text-[10px] bg-teal-50 text-teal-900 font-bold px-1.5 py-0.5 rounded border border-teal-300">
                              🏛️ הועבר ישירות לחשבון (כבר בבנק)
                            </span>
                          );
                        }
                        return (
                          <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-1.5 py-0.5 rounded border border-amber-300">
                            💵 4. נסלק במזומן
                          </span>
                        );
                      })()}
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
                      {remainingDebt > 0 && b.paymentStatus !== 'fully_paid' ? (
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
    </div>
  );
};
