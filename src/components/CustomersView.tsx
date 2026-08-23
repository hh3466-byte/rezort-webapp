import React, { useState } from 'react';
import { 
  Users, 
  Search, 
  Dog, 
  Phone, 
  Calendar, 
  DollarSign, 
  Plus, 
  Crown, 
  MessageSquare, 
  AlertCircle,
  Clock,
  Sparkles
} from 'lucide-react';
import { Booking, Customer, ResortSettings } from '../types';
import { extractCustomers } from '../utils/storage';
import { formatDateIL } from '../utils/dateUtils';
import { openWhatsAppMessage } from '../utils/whatsappUtils';

interface CustomersViewProps {
  bookings: Booking[];
  settings: ResortSettings;
  onNewBookingForCustomer: (customer: Customer) => void;
  onSelectBooking: (booking: Booking) => void;
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  bookings,
  settings,
  onNewBookingForCustomer,
  onSelectBooking,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [vipFilter, setVipFilter] = useState<'all' | 'vip' | 'debt'>('all');

  const customers = extractCustomers(bookings);

  const filteredCustomers = customers.filter(c => {
    if (vipFilter === 'vip' && !c.isVip) return false;
    if (vipFilter === 'debt' && c.openDebt <= 0) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = c.name.toLowerCase().includes(q);
      const matchPhone = c.phone.includes(q);
      const matchDog = c.dogs.some(d => d.name.toLowerCase().includes(q) || (d.breed && d.breed.toLowerCase().includes(q)));
      return matchName || matchPhone || matchDog;
    }
    return true;
  });

  const vipCount = customers.filter(c => c.isVip).length;
  const debtCount = customers.filter(c => c.openDebt > 0).length;

  return (
    <div className="space-y-4">
      
      {/* Header & Stats */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-50 text-green-700 border border-green-200 flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900">
              כרטיסי לקוח וכלבים (מועדון לקוחות)
            </h2>
            <p className="text-xs text-slate-500">
              כרטיסי לקוח נבנים אוטומטית מתוך היסטוריית ההזמנות ביומן
            </p>
          </div>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
          <button
            onClick={() => setVipFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              vipFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            כל הלקוחות ({customers.length})
          </button>
          <button
            onClick={() => setVipFilter('vip')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
              vipFilter === 'vip' ? 'bg-amber-500 text-slate-950 font-black' : 'text-amber-600 hover:text-amber-800'
            }`}
          >
            <Crown className="w-3.5 h-3.5" />
            <span>לקוחות קבועים ({vipCount})</span>
          </button>
          <button
            onClick={() => setVipFilter('debt')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
              vipFilter === 'debt' ? 'bg-red-50 text-red-700 border border-red-300' : 'text-red-600 hover:text-red-800'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            <span>בעלי חוב ({debtCount})</span>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="חיפוש לפי שם לקוח, טלפון או שם כלב..."
          className="w-full bg-white text-slate-900 text-xs sm:text-sm pl-4 pr-10 py-3 rounded-xl border border-slate-200 focus:border-green-500 focus:outline-none shadow-xs"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs"
          >
            ✕
          </button>
        )}
      </div>

      {/* Customer Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredCustomers.length === 0 ? (
          <div className="col-span-full bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-500">
            <Users className="w-10 h-10 mx-auto text-slate-400 mb-2" />
            <p className="font-bold text-slate-700">לא נמצאו לקוחות מתאימים</p>
          </div>
        ) : (
          filteredCustomers.map(customer => {
            const customerBookings = bookings.filter(
              b => (b.ownerPhone === customer.phone || b.ownerName === customer.name) && b.stayStatus !== 'cancelled'
            );

            return (
              <div
                key={customer.id}
                className={`bg-white border rounded-2xl p-5 shadow-xs space-y-4 transition-all hover:shadow-md ${
                  customer.openDebt > 0 ? 'border-red-300 ring-1 ring-red-100' : customer.isVip ? 'border-amber-300 ring-1 ring-amber-100' : 'border-slate-200'
                }`}
              >
                {/* Header: Name, VIP Tag, Debt Tag */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-lg text-slate-900">{customer.name}</h3>
                      {customer.isVip && (
                        <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[11px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                          <Crown className="w-3 h-3 text-amber-600" /> לקוח קבוע (VIP)
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                      <span className="flex items-center gap-1 font-mono text-slate-800">
                        <Phone className="w-3 h-3 text-green-600" /> {customer.phone}
                      </span>
                      {customer.lastVisit && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" /> ביקור אחרון: {formatDateIL(customer.lastVisit)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Financial Overview Tag */}
                  <div className="text-left">
                    <span className="text-xs text-slate-500 block">סה״כ שילם</span>
                    <span className="font-extrabold text-sm text-green-600">
                      ₪{customer.totalSpent.toLocaleString()}
                    </span>
                    {customer.openDebt > 0 && (
                      <span className="text-[11px] font-bold text-red-500 block mt-0.5">
                        חוב: ₪{customer.openDebt}
                      </span>
                    )}
                  </div>
                </div>

                {/* Dogs Info Chips */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                  <span className="text-[11px] text-slate-500 block font-semibold">
                    כלבים רשומים ({customer.dogs.length}):
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {customer.dogs.map((dog, i) => (
                      <div
                        key={i}
                        className="bg-white border border-slate-200 px-2.5 py-1 rounded-lg text-xs flex items-center gap-1.5 shadow-xs"
                      >
                        <Dog className="w-3.5 h-3.5 text-green-600" />
                        <span className="font-extrabold text-slate-900">{dog.name}</span>
                        {dog.breed && (
                          <span className="text-slate-500 text-[11px]">({dog.breed})</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Stays History preview */}
                <div className="text-xs space-y-1 text-slate-500">
                  <span className="font-semibold block text-slate-700">
                    ביקורים בריזורט: <span className="text-green-600 font-bold">{customer.totalVisits}</span>
                  </span>
                </div>

                {/* Action Buttons: New Booking for this Customer, WhatsApp, Call */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onNewBookingForCustomer(customer)}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold text-xs py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4 stroke-[3]" />
                    <span>הזמנה חדשה ללקוח זה</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openWhatsAppMessage(customer.phone, `שלום ${customer.name}, כאן ${settings.managerName} מ${settings.resortName} 🐾`)}
                    className="p-2 bg-slate-100 hover:bg-green-50 text-slate-700 hover:text-green-800 rounded-xl transition-colors cursor-pointer border border-slate-200"
                    title="פתח שיחת וואטסאפ"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </button>

                  <a
                    href={`tel:${customer.phone}`}
                    className="p-2 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-800 rounded-xl transition-colors cursor-pointer border border-slate-200"
                    title="חייג ללקוח"
                  >
                    <Phone className="w-4 h-4" />
                  </a>
                </div>

              </div>
            );
          })
        )}
      </div>

    </div>
  );
};
