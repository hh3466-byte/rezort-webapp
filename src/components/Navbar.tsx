import React from 'react';
import { 
  Calendar as CalendarIcon, 
  BarChart3, 
  ListOrdered, 
  Users, 
  PieChart, 
  HelpCircle, 
  Plus, 
  Settings as SettingsIcon,
  Smartphone,
  Dog,
  AlertCircle,
  Menu,
  X
} from 'lucide-react';
import { Booking, ResortSettings } from '../types';
import { getDailyBreakdown, getTodayStr } from '../utils/dateUtils';

interface NavbarProps {
  activeTab: 'calendar' | 'forecast' | 'bookings' | 'customers';
  onSelectTab: (tab: 'calendar' | 'forecast' | 'bookings' | 'customers') => void;
  bookings: Booking[];
  settings: ResortSettings;
  onOpenNewBooking: () => void;
  onOpenSettings: () => void;
  onOpenGuide: () => void;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  bookings,
  settings,
  onOpenNewBooking,
  onOpenSettings,
  onOpenGuide,
  isSidebarOpen = false,
  onToggleSidebar,
}) => {
  const todayStr = getTodayStr();
  const daily = getDailyBreakdown(bookings, todayStr);
  
  // Calculate revenue & debt
  const totalCollected = bookings
    .filter(b => b.stayStatus !== 'cancelled')
    .reduce((acc, b) => acc + b.depositAmount, 0);

  const openDebtTotal = bookings
    .filter(b => b.stayStatus !== 'cancelled')
    .reduce((acc, b) => acc + Math.max(0, b.totalPrice - b.depositAmount), 0);

  const unpaidCount = bookings.filter(
    b => b.stayStatus !== 'cancelled' && b.paymentStatus === 'unpaid'
  ).length;

  return (
    <>
      {/* Sleek Sidebar Navigation */}
      <aside className={`fixed inset-y-0 right-0 z-50 w-64 bg-slate-900 text-white flex flex-col h-full shadow-2xl transition-transform duration-300 md:translate-x-0 ${
        isSidebarOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'
      }`}>
        {/* Brand Header */}
        <div className="p-6 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full overflow-hidden bg-white p-1 shadow-lg shadow-black/30 shrink-0 border border-amber-200/40 flex items-center justify-center">
              <img 
                src="/resort-logo.svg" 
                alt="הריזורט לכלב" 
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h1 className="font-bold text-base leading-tight text-white">
                {settings.resortName}
              </h1>
              <span className="text-amber-400 text-xs font-semibold">
                של {settings.managerName}
              </span>
            </div>
          </div>

          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="md:hidden text-slate-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Sidebar Nav Links */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <button
            onClick={() => {
              onSelectTab('calendar');
              if (onToggleSidebar) onToggleSidebar();
            }}
            className={`w-full flex items-center gap-3 p-3 rounded-xl font-bold text-sm transition-all cursor-pointer ${
              activeTab === 'calendar'
                ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            <span className="text-lg">📅</span>
            <span>יומן הזמנות</span>
          </button>

          <button
            onClick={() => {
              onSelectTab('forecast');
              if (onToggleSidebar) onToggleSidebar();
            }}
            className={`w-full flex items-center gap-3 p-3 rounded-xl font-bold text-sm transition-all cursor-pointer ${
              activeTab === 'forecast'
                ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            <span className="text-lg">📊</span>
            <span>תפוסה ומכסות</span>
          </button>

          <button
            onClick={() => {
              onSelectTab('bookings');
              if (onToggleSidebar) onToggleSidebar();
            }}
            className={`w-full flex items-center justify-between p-3 rounded-xl font-bold text-sm transition-all cursor-pointer ${
              activeTab === 'bookings'
                ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">📋</span>
              <span>כל ההזמנות</span>
            </div>
            {unpaidCount > 0 && (
              <span className="bg-red-500/20 text-red-400 border border-red-500/40 text-[10px] px-2 py-0.5 rounded-full font-bold">
                {unpaidCount} פתוחות
              </span>
            )}
          </button>

          <button
            onClick={() => {
              onSelectTab('customers');
              if (onToggleSidebar) onToggleSidebar();
            }}
            className={`w-full flex items-center gap-3 p-3 rounded-xl font-bold text-sm transition-all cursor-pointer ${
              activeTab === 'customers'
                ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            <span className="text-lg">🐶</span>
            <span>רשימת לקוחות</span>
          </button>

          <button
            onClick={() => {
              onOpenGuide();
              if (onToggleSidebar) onToggleSidebar();
            }}
            className="w-full flex items-center gap-3 p-3 text-slate-400 hover:bg-slate-800/60 hover:text-white rounded-xl font-bold text-sm transition-all cursor-pointer"
          >
            <span className="text-lg">📖</span>
            <span>הדרכה אינטראקטיבית</span>
          </button>

          <button
            onClick={() => {
              onOpenSettings();
              if (onToggleSidebar) onToggleSidebar();
            }}
            className="w-full flex items-center gap-3 p-3 text-slate-400 hover:bg-slate-800/60 hover:text-white rounded-xl font-bold text-sm transition-all cursor-pointer"
          >
            <span className="text-lg">⚙️</span>
            <span>הגדרות ותעריפים</span>
          </button>
        </nav>

        {/* Sidebar Footer Status */}
        <div className="p-4 bg-slate-950 mt-auto border-t border-slate-800/80">
          <div className="text-xs text-slate-500 mb-1 font-mono">גרסה 2.4.1</div>
          <div className="flex items-center gap-2 text-green-400 text-xs font-semibold">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span>סנכרון פעיל ומאובטח</span>
          </div>
        </div>
      </aside>

      {/* Backdrop for mobile */}
      {isSidebarOpen && (
        <div
          onClick={onToggleSidebar}
          className="fixed inset-0 bg-slate-950/60 z-40 md:hidden backdrop-blur-xs"
        />
      )}

      {/* Sleek Top Header Bar with Metrics */}
      <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-8 sticky top-0 z-30 shadow-xs">
        
        {/* Mobile menu button & logo */}
        <div className="flex items-center gap-3 md:hidden">
          <button
            onClick={onToggleSidebar}
            className="p-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="font-extrabold text-slate-900 text-base flex items-center gap-2">
            <div className="w-9 h-9 rounded-full overflow-hidden bg-white p-0.5 border border-amber-300 shadow-xs flex items-center justify-center">
              <img 
                src="/resort-logo.svg" 
                alt="הריזורט לכלב" 
                className="w-full h-full object-contain"
              />
            </div>
            <span className="truncate max-w-[170px]">{settings.resortName}</span>
          </div>
        </div>

        {/* Desktop Metrics Bar & Cloud Sync Status */}
        <div className="hidden md:flex items-center gap-6">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold" title="מסד נתונים מסונכרן בזמן אמת בין כל המכשירים">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>ענן מסונכרן חי ☁️</span>
          </div>

          <div className="h-6 w-px bg-slate-200" />

          <div className="text-right">
            <div className="text-xs text-slate-400 font-medium">תפוסה היום</div>
            <div className="font-bold text-lg text-slate-900">
              {daily.total} / {settings.maxCapacity}
            </div>
          </div>

          <div className="h-8 w-px bg-slate-200" />

          <div className="text-right">
            <div className="text-xs text-slate-400 font-medium">סה"כ גבייה</div>
            <div className="font-bold text-lg text-green-600">
              ₪{totalCollected.toLocaleString()}
            </div>
          </div>

          <div className="h-8 w-px bg-slate-200" />

          <div className="text-right">
            <div className="text-xs text-slate-400 font-medium">חובות פתוחים</div>
            <div className={`font-bold text-lg ${openDebtTotal > 0 ? 'text-red-500' : 'text-slate-700'}`}>
              ₪{openDebtTotal.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenNewBooking}
            id="btn-nav-new-booking"
            className="bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-indigo-600/20 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>+ הזמנה ידנית</span>
          </button>

          <button
            onClick={onOpenGuide}
            title="הדרכה אינטראקטיבית"
            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          <button
            onClick={onOpenSettings}
            title="הגדרות"
            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>

          <div className="w-9 h-9 bg-green-500/20 text-green-700 font-extrabold rounded-full border-2 border-green-400 flex items-center justify-center text-sm shadow-xs">
            {settings.managerName.slice(0, 1) || 'ש'}
          </div>
        </div>

      </header>
    </>
  );
};
