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
  const totalGrossCollected = activeBookings.reduce((sum, b) => sum + b.depositAmount, 0);

  // All refunds tracking across the system
  const allRefunds = bookings.filter(b => {
    const d = (b as any).data || {};
    return Number(b.refundAmount ?? d.refundAmount ?? 0) > 0;
  });

  const totalRefunds = allRefunds.reduce((sum, b) => {
    const d = (b as any).data || {};
    return sum + Number(b.refundAmount ?? d.refundAmount ?? 0);
  }, 0);

  const totalNetCollected = Math.max(0, totalGrossCollected - totalRefunds);
  const totalOpenDebt = activeBookings.reduce((sum, b) => sum + Math.max(0, b.totalPrice - b.depositAmount), 0);

  // Service breakdown
  const serviceStats = {
    boarding: activeBookings.filter(b => b.serviceType === 'boarding'),
    training: activeBookings.filter(b => b.serviceType === 'training'),
    day_training: activeBookings.filter(b => b.serviceType === 'day_training'),
    daycare: activeBookings.filter(b => b.serviceType === 'daycare'),
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" dir="rtl">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-xl">
              💰
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">דוחות כספיים, תפוסה ומעקב החזרים</h2>
              <p className="text-xs text-slate-500 font-medium">סיכום ביצועים, הכנסות נטו, החזרים וחובות של {settings.resortName}</p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Financial Highlights (4 Cards: הצפוי, ברוטו, החזרים, נטו) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-5">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-center">
            <div className="text-[11px] text-slate-500 font-bold mb-0.5">סה״כ צפוי</div>
            <div className="text-lg sm:text-xl font-black text-slate-900 font-mono">₪{totalRevenue.toLocaleString()}</div>
            <div className="text-[10px] text-slate-400">שווי הזמנות פעילות</div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-center">
            <div className="text-[11px] text-slate-600 font-bold mb-0.5">נגבה ברוטו</div>
            <div className="text-lg sm:text-xl font-black text-slate-800 font-mono">₪{totalGrossCollected.toLocaleString()}</div>
            <div className="text-[10px] text-slate-400">לפני ניכוי החזרים</div>
          </div>

          <div className="bg-rose-50/80 border border-rose-200 rounded-2xl p-3 text-center">
            <div className="text-[11px] text-rose-800 font-bold mb-0.5">החזרים בביטולים</div>
            <div className="text-lg sm:text-xl font-black text-rose-600 font-mono">-₪{totalRefunds.toLocaleString()}</div>
            <div className="text-[10px] text-rose-600/80 font-bold">{allRefunds.length} החזרים בוצעו</div>
          </div>

          <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-3 text-center">
            <div className="text-[11px] text-emerald-800 font-bold mb-0.5">תקבולים נטו</div>
            <div className="text-lg sm:text-xl font-black text-emerald-700 font-mono">₪{totalNetCollected.toLocaleString()}</div>
            <div className="text-[10px] text-emerald-600 font-bold">לאחר קיזוז החזרים</div>
          </div>
        </div>

        {/* Detailed Refunds Section */}
        {allRefunds.length > 0 && (
          <div className="my-5 p-4 bg-rose-50/60 border border-rose-200 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-rose-950 flex items-center gap-1.5">
                <span>🔄</span>
                <span>פירוט החזרים כספיים שבוצעו ({allRefunds.length}):</span>
              </h3>
              <span className="text-xs font-black text-rose-700 font-mono">
                סה״כ החזרים: -₪{totalRefunds.toLocaleString()}
              </span>
            </div>

            <div className="space-y-2">
              {allRefunds.map(b => {
                const d = (b as any).data || {};
                const amt = Number(b.refundAmount ?? d.refundAmount ?? 0);
                const rDate = b.refundDate || d.refundDate || b.startDate || '';
                const rReason = b.refundReason || d.refundReason || 'הזמנה בוטלה';

                return (
                  <div key={b.id} className="p-2.5 bg-white border border-rose-200 rounded-xl flex items-center justify-between gap-2 shadow-2xs">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-black text-xs text-slate-900">{b.ownerName}</span>
                        <span className="bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded-md text-[11px] font-bold">
                          🐕 {b.dogName}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 font-mono">
                          {formatDateIL(rDate)}
                        </span>
                      </div>
                      <div className="text-[11px] text-rose-900 font-bold mt-0.5 flex items-center gap-1">
                        <span>סיבה:</span>
                        <span className="bg-rose-100 text-rose-900 px-2 py-0.2 rounded-md text-[10px]">{rReason}</span>
                      </div>
                    </div>

                    <div className="text-left shrink-0">
                      <div className="text-sm font-black text-rose-600 font-mono">-₪{amt.toLocaleString()}</div>
                      <span className="text-[10px] text-slate-400">הוחזר ללקוח</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Breakdown by Service */}
        <div className="space-y-3">
          <h3 className="text-sm font-black text-slate-800">פילוח לפי שירותים:</h3>
          
          <div className="space-y-2">
            {[
              { label: '🏨 פנסיון לילה', items: serviceStats.boarding, color: 'bg-emerald-500' },
              { label: '🎓 תהליך אילוף (70 יום)', items: serviceStats.training, color: 'bg-amber-500' },
              { label: '🦮 אילוף ביומיות (ללא לינה)', items: serviceStats.day_training, color: 'bg-purple-500' },
              { label: '✂️ יום כיף / שהות יומית', items: serviceStats.daycare, color: 'bg-sky-500' },
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
        <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-center text-xs">
          <span className="text-slate-500 font-medium">יתרת חוב פתוח לגבייה: <strong className="text-amber-700 font-mono">₪{totalOpenDebt.toLocaleString()}</strong></span>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-[#065f46] hover:bg-[#044e45] text-white font-bold text-sm rounded-xl transition-all cursor-pointer"
          >
            סגור
          </button>
        </div>

      </div>
    </div>
  );
};
