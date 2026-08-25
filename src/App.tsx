import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';

import { Booking, ResortSettings, AgentActionProposal, PaymentMethod } from './types';
import { loadStoredBookings, loadStoredSettings } from './utils/storage';
import { 
  subscribeToBookings, 
  subscribeToSettings, 
  saveBookingToDb, 
  deleteBookingFromDb, 
  saveSettingsToDb, 
  batchRestoreToDb, 
  resetDbToDemo,
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
import { PaymentModal } from './components/PaymentModal';
import { Settings as SettingsIcon } from 'lucide-react';
import { SettingsModal } from './components/SettingsModal';
import { ReportsModal } from './components/ReportsModal';
import { Guide } from './components/Guide';

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

  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Real-time Cloud Sync from Firestore
  useEffect(() => {
    const unsubBookings = subscribeToBookings((updatedBookings) => {
      setBookings(updatedBookings);
    });

    const unsubSettings = subscribeToSettings((updatedSettings) => {
      setSettings(updatedSettings);
    });

    return () => {
      unsubBookings();
      unsubSettings();
    };
  }, []);

  // Today stats calculations
  const todayStr = getTodayStr();
  const activeBookings = bookings.filter(b => b.stayStatus !== 'cancelled');
  const todayBookings = getBookingsForDate(activeBookings, todayStr);

  const boardingToday = todayBookings.filter(b => b.serviceType === 'boarding' || b.serviceType === 'combined').length;
  const trainingToday = todayBookings.filter(b => b.serviceType === 'training' || b.serviceType === 'combined').length;
  const freeSlots = Math.max(0, settings.maxCapacity - boardingToday);

  const totalCollected = activeBookings.reduce((acc, b) => acc + b.depositAmount, 0);
  const openDebtTotal = activeBookings.reduce((acc, b) => acc + Math.max(0, b.totalPrice - b.depositAmount), 0);
  const unpaidCount = activeBookings.filter(b => b.paymentStatus === 'unpaid').length;

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
    const { intent, parsedBooking, targetTab, existingBookingId } = proposal;

    if (intent === 'new_booking') {
      const newBooking: Booking = {
        id: `b-${Date.now()}`,
        dogName: parsedBooking.dogName || 'כלב',
        dogBreed: parsedBooking.dogBreed || '',
        ownerName: parsedBooking.ownerName || 'לקוח',
        ownerPhone: parsedBooking.ownerPhone || '050-0000000',
        ownerEmail: parsedBooking.ownerEmail || '',
        serviceType: parsedBooking.serviceType || 'boarding',
        startDate: parsedBooking.startDate || new Date().toISOString().split('T')[0],
        endDate: parsedBooking.endDate || new Date().toISOString().split('T')[0],
        totalPrice: parsedBooking.totalPrice || 0,
        depositAmount: parsedBooking.depositAmount || 0,
        paymentStatus: parsedBooking.paymentStatus || (parsedBooking.depositAmount ? 'deposit_paid' : 'unpaid'),
        paymentMethod: parsedBooking.paymentMethod || 'bit',
        stayStatus: 'booked',
        notes: parsedBooking.notes || '',
        vaccinationValid: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveBookingToDb(newBooking);
      showToast(`✨ שריון ל${newBooking.dogName} נוסף וסונכרן לענן!`);
      
      if (newBooking.paymentStatus === 'fully_paid') {
        confetti({ particleCount: 60, spread: 60, origin: { y: 0.7 } });
      }
    } else if (intent === 'payment_update') {
      const target = existingBookingId 
        ? bookings.find(b => b.id === existingBookingId)
        : bookings.find(b => b.dogName.toLowerCase() === (parsedBooking.dogName || '').toLowerCase());

      if (target) {
        await handleSavePayment(target.id, parsedBooking.depositAmount || 0, parsedBooking.paymentMethod || 'bit');
        showToast(`💳 עודכן תשלום עבור ${target.dogName}`);
      } else {
        showToast('לא נמצאה הזמנה מתאימה לעדכון תשלום');
      }
    } else if (intent === 'cancel_booking') {
      const target = existingBookingId 
        ? bookings.find(b => b.id === existingBookingId)
        : bookings.find(b => b.dogName.toLowerCase() === (parsedBooking.dogName || '').toLowerCase());

      if (target) {
        await handleDeleteBooking(target.id);
        showToast(`🗑️ ההזמנה של ${target.dogName} בוטלה ונמחקה מהענן`);
      } else {
        showToast('לא נמצאה הזמנה מתאימה לביטול');
      }
    } else if (intent === 'clear_all_data') {
      await handleClearAllData();
    } else if (intent === 'reset_to_demo') {
      await handleResetToDemo();
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
        setIsSettingsOpen(true);
      }
      showToast('🧭 עברת למסך המבוקש');
    }

    setAgentProposal(null);
  };

  // Fast 1-click Mark as Paid
  const handleMarkAsPaid = async (bookingId: string) => {
    const booking = bookings.find(b => b.id === bookingId);
    if (booking) {
      const updated: Booking = {
        ...booking,
        depositAmount: booking.totalPrice,
        paymentStatus: 'fully_paid',
        updatedAt: new Date().toISOString(),
      };
      await saveBookingToDb(updated);

      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.6 }
      });

      showToast('🟢 ההזמנה סומנה כשולמה במלואו וסונכרנה');
    }
  };

  // Record partial / custom payment
  const handleSavePayment = async (bookingId: string, addedAmount: number, method: PaymentMethod, notes?: string) => {
    const booking = bookings.find(b => b.id === bookingId);
    if (booking) {
      const newDeposit = booking.depositAmount + addedAmount;
      const isFull = newDeposit >= booking.totalPrice;
      const updated: Booking = {
        ...booking,
        depositAmount: newDeposit,
        paymentStatus: isFull ? 'fully_paid' : 'deposit_paid',
        paymentMethod: method,
        notes: notes ? `${booking.notes ? booking.notes + ' | ' : ''}תשלום ₪${addedAmount} (${method})` : booking.notes,
        updatedAt: new Date().toISOString(),
      };
      await saveBookingToDb(updated);
      showToast(`💳 תשלום ע״ס ₪${addedAmount} נרשם וסונכרן לענן`);
    }
  };

  // Save from BookingFormModal (Add / Edit)
  const handleSaveBookingForm = async (booking: Booking) => {
    await saveBookingToDb(booking);
    setBookingFormModal({ isOpen: false, initialData: null });
    showToast(`💾 ההזמנה של ${booking.dogName} נשמרה וסונכרנה בענן`);
  };

  // Delete / Cancel Booking
  const handleDeleteBooking = async (bookingId: string) => {
    await deleteBookingFromDb(bookingId);
    showToast('🗑️ ההזמנה הוסרה מהענן');
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
      await saveBookingToDb(updated);

      if (newStatus === 'checked_in') showToast('🐾 נקלט בהצלחה בריזורט');
      if (newStatus === 'checked_out') showToast('🏡 שוחרר הביתה בהצלחה');
    }
  };

  // Reset to Demo Data
  const handleResetToDemo = async () => {
    await resetDbToDemo();
    showToast('🔄 הנתונים אופסו בענן לנתוני הדמו');
  };

  // Clear all bookings
  const handleClearAllData = async () => {
    await clearAllBookingsFromDb();
    setBookings([]);
    showToast('🧹 כל הנתונים נמחקו - היומן נקי לחלוטין!');
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans p-3 sm:p-6 pb-24 selection:bg-emerald-200">
      
      {/* Centered Main Layout Container matching the user's screenshot */}
      <div className="max-w-6xl mx-auto space-y-4">
        
        {/* Top Header Row */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1 pb-1">
          
          {/* Left Buttons in RTL (top left): + הזמנה חדשה & משותף */}
          <div className="flex items-center gap-3 order-2 sm:order-1">
            <button
              onClick={() => setBookingWizardOpen({ isOpen: true, initialData: null })}
              id="btn-new-booking-top"
              className="bg-[#065f46] hover:bg-[#044e45] active:scale-98 text-white font-bold px-4 py-2.5 rounded-xl text-sm shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <span>+</span>
              <span>הזמנה חדשה</span>
            </button>

            <div className="flex items-center gap-1.5 bg-[#eff6ff] border border-blue-100 text-blue-700 px-3 py-1.5 rounded-full text-xs font-semibold shadow-2xs">
              <span>🔮</span>
              <span>משותף</span>
            </div>

            <button
              onClick={() => setIsSettingsOpen(true)}
              id="btn-settings-top"
              className="bg-white hover:bg-slate-50 active:scale-98 border border-slate-200 hover:border-slate-300 text-slate-700 font-bold px-3 py-1.5 rounded-xl text-xs sm:text-sm shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
              title="הגדרות תפוסה, תעריפים, ביט וגיבוי"
            >
              <SettingsIcon className="w-4 h-4 text-emerald-700" />
              <span>⚙️ הגדרות ותעריפים</span>
            </button>
          </div>

          {/* Right Brand Title & Subtitle in RTL (top right) */}
          <div className="text-right order-1 sm:order-2">
            <h1 className="text-2xl sm:text-3xl font-black text-[#0f4c3a] tracking-tight flex items-center justify-end gap-2">
              <span>יומן הריזורט לכלב</span>
              <span>🐕</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
              דבר אליי — ואני אנהל את היומן: הזמנות, תשלומים ותפוסה
            </p>
          </div>

        </header>

        {/* 4 Metric Stat Cards (in a single row matching image) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          
          {/* Card 1 (Right in RTL): בפנסיון היום */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
            <div className="text-xs font-bold text-slate-500 text-right">בפנסיון היום</div>
            <div className="text-3xl sm:text-4xl font-black text-slate-900 my-1 text-right">
              {boardingToday}
            </div>
            <div className="text-[11px] font-medium text-slate-400 text-right">
              בריזורט: {boardingToday}/{settings.maxCapacity} · פנויים: {freeSlots}
            </div>
          </div>

          {/* Card 2: באילוף היום */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
            <div className="text-xs font-bold text-slate-500 text-right">באילוף היום</div>
            <div className="text-3xl sm:text-4xl font-black text-purple-600 my-1 text-right">
              {trainingToday}
            </div>
            <div className="text-[11px] font-medium text-slate-400 text-right">
              כלבים בתהליך אילוף
            </div>
          </div>

          {/* Card 3: חוב פתוח */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
            <div className="text-xs font-bold text-slate-500 text-right">חוב פתוח</div>
            <div className="text-3xl sm:text-4xl font-black text-[#0f766e] my-1 text-right">
              ₪{openDebtTotal.toLocaleString()}
            </div>
            <div className="text-[11px] font-medium text-slate-400 text-right">
              {openDebtTotal === 0 ? 'הכול שולם 🥳' : `${unpaidCount} הזמנות ממתינות`}
            </div>
          </div>

          {/* Card 4 (Left in RTL): נגבה עד כה */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
            <div className="text-xs font-bold text-slate-500 text-right">נגבה עד כה</div>
            <div className="text-3xl sm:text-4xl font-black text-[#0f766e] my-1 text-right">
              ₪{totalCollected.toLocaleString()}
            </div>
            <div className="text-[11px] font-medium text-slate-400 text-right">
              סה״כ מקדמות ותשלומים
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
              onClick={() => setIsSettingsOpen(true)}
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

      {/* 4-Step Intuitive Booking Wizard matching the video */}
      {bookingWizardOpen.isOpen && (
        <SimpleBookingWizard
          isOpen={bookingWizardOpen.isOpen}
          initialData={bookingWizardOpen.initialData}
          existingBookings={bookings}
          settings={settings}
          onClose={() => setBookingWizardOpen({ isOpen: false, initialData: null })}
          onSave={async (newBooking) => {
            await saveBookingToDb(newBooking);
            showToast(`💾 ההזמנה של ${newBooking.dogName} נשמרה וסונכרנה בענן`);
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
            await saveSettingsToDb(newSettings);
            showToast('⚙️ הגדרות הריזורט עודכנו וסונכרנו בענן');
          }}
          onRestoreBookings={async (imported) => {
            await batchRestoreToDb(imported);
            showToast('💾 הנתונים שוחזרו וסונכרנו בענן');
          }}
          onResetToDemo={handleResetToDemo}
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

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl text-xs sm:text-sm font-bold flex items-center gap-2 border border-slate-800 animate-bounce">
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
}
