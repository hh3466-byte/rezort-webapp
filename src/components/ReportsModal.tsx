import React from 'react';
import { X, TrendingUp, DollarSign, Calendar, Users, Award, Download } from 'lucide-react';
import { Booking, ResortSettings } from '../types';
import { formatDateIL, getTodayStr } from '../utils/dateUtils';
import { getServiceTypeHebrew } from '../utils/whatsappUtils';

interface ReportsModalProps {
  bookings: Booking[];
  settings: ResortSettings;
  onClose: () => void;
}

export const ReportsModal: React.FC<ReportsModalProps> = ({
  bookings,
  settings,
  onClose,
}) => {
  const activeBookings = bookings.filter(b => b.stayStatus !== 'cancelled');

  const totalRevenue = activeBookings.reduce((sum, b) => sum + b.totalPrice, 0);
  const totalCollected = activeBookings.reduce((sum, b) => sum + b.depositAmount, 0);
  const totalOpenDebt = activeBookings.reduce((sum, b) => sum + Math.max(0, b.totalPrice - b.depositAmount), 0);

  // Service breakdown
  const serviceStats = {
    boarding: activeBookings.filter(b => b.serviceType === 'boarding'),
    training: activeBookings.filter(b => b.serviceType === 'training'),
    combined: activeBookings.filter(b => b.serviceType === 'combined'),
    daycare: activeBookings.filter(b => b.serviceType === 'daycare'),
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-xl">
              💰
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">דוחות כספיים ותפוסה</h2>
              <p className="text-xs text-slate-500 font-medium">סיכום ביצועים, הכנסות וחובות של {settings.resortName}</p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Financial Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-5">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center">
            <div className="text-xs text-slate-500 font-bold mb-1">סה״כ הכנסות צפויות</div>
            <div className="text-2xl font-black text-slate-900">₪{totalRevenue.toLocaleString()}</div>
          </div>

          <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-4 text-center">
            <div className="text-xs text-emerald-800 font-bold mb-1">נגבה בפועל</div>
            <div className="text-2xl font-black text-emerald-700">₪{totalCollected.toLocaleString()}</div>
          </div>

          <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 text-center">
            <div className="text-xs text-amber-800 font-bold mb-1">יתרת חוב פתוח לגבייה</div>
            <div className="text-2xl font-black text-amber-700">₪{totalOpenDebt.toLocaleString()}</div>
          </div>
        </div>

        {/* Breakdown by Service */}
        <div className="space-y-3">
          <h3 className="text-sm font-black text-slate-800">פילוח לפי שירותים:</h3>
          
          <div className="space-y-2">
            {[
              { label: '🏨 פנסיון לילה', items: serviceStats.boarding, color: 'bg-emerald-500' },
              { label: '🎓 תהליך אילוף (70 יום)', items: serviceStats.training, color: 'bg-purple-500' },
              { label: '✂️ יום כיף / שהות יומית', items: serviceStats.daycare, color: 'bg-amber-500' },
            ].map((srv) => {
              const srvRevenue = srv.items.reduce((s, b) => s + b.totalPrice, 0);
              const percentage = totalRevenue > 0 ? Math.round((srvRevenue / totalRevenue) * 100) : 0;
              return (
                <div key={srv.label} className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-sm text-slate-900">{srv.label}</span>
                    <span className="text-xs text-slate-500 mr-2">({srv.items.length} הזמנות)</span>
                  </div>
                  <div className="text-left">
                    <span className="font-black text-slate-900 text-sm">₪{srvRevenue.toLocaleString()}</span>
                    <span className="text-xs text-slate-400 font-medium mr-1.5">({percentage}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-[#065f46] hover:bg-[#044e45] text-white font-bold text-sm rounded-xl transition-all"
          >
            סגור
          </button>
        </div>

      </div>
    </div>
  );
};
