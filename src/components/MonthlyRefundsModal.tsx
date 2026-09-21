import React, { useState } from 'react';
import { X, TrendingDown, Calendar, Phone, MessageCircle, AlertCircle, Edit3, Check, DollarSign } from 'lucide-react';
import { Booking } from '../types';
import { formatDateIL, HEBREW_MONTHS } from '../utils/dateUtils';
import { getLearnedRefundReasons, saveLearnedRefundReason } from '../utils/refundUtils';
import { openWhatsAppMessage } from '../utils/whatsappUtils';

interface MonthlyRefundsModalProps {
  isOpen: boolean;
  onClose: () => void;
  monthKey: string; // e.g. '2026-09'
  refundBookings: Booking[];
  monthGrossCollected: number;
  monthNetCollected: number;
  onUpdateBookingRefund?: (bookingId: string, updatedData: Partial<Booking>) => void;
}

export const MonthlyRefundsModal: React.FC<MonthlyRefundsModalProps> = ({
  isOpen,
  onClose,
  monthKey,
  refundBookings,
  monthGrossCollected,
  monthNetCollected,
  onUpdateBookingRefund
}) => {
  if (!isOpen) return null;

  const [y, m] = monthKey.split('-');
  const monthIdx = parseInt(m, 10) - 1;
  const monthName = `${HEBREW_MONTHS[monthIdx] || m} ${y}`;

  const totalRefundAmount = refundBookings.reduce((sum, b) => {
    const d = (b as any).data || {};
    return sum + (Number(b.refundAmount ?? d.refundAmount ?? 0));
  }, 0);

  // Editing state for a specific refund
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState<string>('');
  const [editReason, setEditReason] = useState<string>('');
  const [editCustomReason, setEditCustomReason] = useState<string>('');
  const [isOtherSelected, setIsOtherSelected] = useState<boolean>(false);

  const availableReasons = getLearnedRefundReasons(refundBookings);

  const startEditing = (b: Booking) => {
    const d = (b as any).data || {};
    setEditingBookingId(b.id);
    setEditAmount(String(b.refundAmount ?? d.refundAmount ?? ''));
    const curReason = b.refundReason || d.refundReason || '';
    if (availableReasons.includes(curReason)) {
      setEditReason(curReason);
      setIsOtherSelected(false);
      setEditCustomReason('');
    } else if (curReason) {
      setEditReason('אחר');
      setIsOtherSelected(true);
      setEditCustomReason(curReason);
    } else {
      setEditReason(availableReasons[0] || 'הזמנה בוטלה יותר משבוע לפני הקליטה');
      setIsOtherSelected(false);
      setEditCustomReason('');
    }
  };

  const handleSaveEdit = (b: Booking) => {
    let finalReason = editReason;
    if (isOtherSelected && editCustomReason.trim()) {
      finalReason = editCustomReason.trim();
      saveLearnedRefundReason(finalReason, refundBookings);
    }

    const newAmt = Math.max(0, Number(editAmount) || 0);

    onUpdateBookingRefund?.(b.id, {
      refundAmount: newAmt,
      refundReason: finalReason,
      notes: `${b.notes || ''} [עודכן החזר ₪${newAmt}: ${finalReason}]`.trim()
    });

    setEditingBookingId(null);
  };

  // Group by reason for stats
  const reasonStats: Record<string, { count: number; total: number }> = {};
  refundBookings.forEach(b => {
    const d = (b as any).data || {};
    const amt = Number(b.refundAmount ?? d.refundAmount ?? 0);
    const r = (b.refundReason || d.refundReason || 'ללא ציון סיבה').trim();
    if (!reasonStats[r]) reasonStats[r] = { count: 0, total: 0 };
    reasonStats[r].count += 1;
    reasonStats[r].total += amt;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200" dir="rtl">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden text-slate-900">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-gradient-to-r from-rose-50/80 via-amber-50/50 to-white flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-rose-100 text-rose-700 border border-rose-300 shadow-2xs text-xl">
              🔄
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-lg sm:text-xl text-slate-900">
                  החזרים כספיים שבוצעו החודש ({monthName})
                </h3>
                <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                  {refundBookings.length} החזרים
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                מעקב מסודר אחר סכומי ההחזר, סיבות הביטול וניכויים מההכנסות
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Financial Summary KPIs */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/60 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="bg-white p-3 rounded-2xl border border-rose-200 shadow-2xs text-center">
            <div className="text-[11px] font-bold text-rose-700">סה״כ הוחזר החודש</div>
            <div className="text-xl sm:text-2xl font-black text-rose-600 font-mono mt-0.5">
              -₪{totalRefundAmount.toLocaleString('he-IL')}
            </div>
            <div className="text-[10px] text-slate-400 font-medium">{refundBookings.length} ביטולים</div>
          </div>

          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs text-center">
            <div className="text-[11px] font-bold text-slate-600">הכנסות ברוטו</div>
            <div className="text-xl sm:text-2xl font-black text-slate-800 font-mono mt-0.5">
              ₪{monthGrossCollected.toLocaleString('he-IL')}
            </div>
            <div className="text-[10px] text-slate-400 font-medium">לפני ניכוי החזרים</div>
          </div>

          <div className="bg-white p-3 rounded-2xl border border-emerald-200 shadow-2xs text-center">
            <div className="text-[11px] font-bold text-emerald-800">הכנסות נטו (בקופה)</div>
            <div className="text-xl sm:text-2xl font-black text-emerald-700 font-mono mt-0.5">
              ₪{monthNetCollected.toLocaleString('he-IL')}
            </div>
            <div className="text-[10px] text-emerald-600 font-bold">לאחר החזרים</div>
          </div>

          <div className="bg-white p-3 rounded-2xl border border-amber-200 shadow-2xs text-center">
            <div className="text-[11px] font-bold text-amber-800">אחוז החזרים מסך הכל</div>
            <div className="text-xl sm:text-2xl font-black text-amber-700 font-mono mt-0.5">
              {monthGrossCollected > 0 ? `${((totalRefundAmount / monthGrossCollected) * 100).toFixed(1)}%` : '0%'}
            </div>
            <div className="text-[10px] text-slate-400 font-medium">שיעור ביטולים</div>
          </div>
        </div>

        {/* Reason breakdown chips */}
        {Object.keys(reasonStats).length > 0 && (
          <div className="px-4 sm:px-5 py-2.5 bg-rose-50/40 border-b border-rose-100 flex items-center gap-2 overflow-x-auto no-scrollbar text-xs">
            <span className="font-black text-rose-900 shrink-0">פילוח סיבות:</span>
            {Object.entries(reasonStats).map(([reason, stat]) => (
              <span key={reason} className="bg-white border border-rose-200 text-rose-900 px-2.5 py-0.5 rounded-full font-bold shadow-2xs shrink-0 flex items-center gap-1">
                <span>{reason}</span>
                <span className="bg-rose-100 text-rose-800 text-[10px] px-1.5 rounded-full font-mono font-black">
                  {stat.count} (₪{stat.total.toLocaleString()})
                </span>
              </span>
            ))}
          </div>
        )}

        {/* Refunds List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 divide-y divide-slate-100 space-y-3">
          {refundBookings.length === 0 ? (
            <div className="text-center py-10 text-slate-400 space-y-2">
              <div className="text-4xl">🎉</div>
              <div className="text-base font-bold text-slate-700">אין החזרים כספיים בחודש זה!</div>
              <div className="text-xs">כל ההכנסות והשריונים בחודש {monthName} נותרו מלאים וללא ביטולים.</div>
            </div>
          ) : (
            refundBookings.map((b) => {
              const d = (b as any).data || {};
              const amt = Number(b.refundAmount ?? d.refundAmount ?? 0);
              const rDate = b.refundDate || d.refundDate || b.startDate || '';
              const rReason = b.refundReason || d.refundReason || 'הזמנה בוטלה';
              const isEditing = editingBookingId === b.id;

              return (
                <div key={b.id} className="pt-3 first:pt-0 bg-white hover:bg-slate-50/70 transition-all rounded-2xl p-3 border border-slate-200/90 shadow-2xs mb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-black text-slate-900">{b.ownerName}</span>
                        <span className="bg-amber-100 text-amber-900 border border-amber-300 text-xs font-black px-2 py-0.5 rounded-lg">
                          🐕 {b.dogName}
                        </span>
                        <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md font-mono">
                          {formatDateIL(rDate)}
                        </span>
                      </div>

                      {/* Refund Reason Badge */}
                      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-rose-900 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-lg flex items-center gap-1 shadow-2xs">
                          <span>📋 סיבה:</span>
                          <span className="font-black">{rReason}</span>
                        </span>
                        {b.refundNotes && (
                          <span className="text-xs text-slate-500 font-medium">
                            ({b.refundNotes})
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Amount & Actions */}
                    <div className="text-left shrink-0">
                      <div className="text-lg sm:text-xl font-black text-rose-600 font-mono">
                        -₪{amt.toLocaleString('he-IL')}
                      </div>
                      <div className="flex items-center gap-1 mt-1 justify-end">
                        {onUpdateBookingRefund && (
                          <button
                            type="button"
                            onClick={() => startEditing(b)}
                            className="text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded-md cursor-pointer flex items-center gap-0.5 transition-all"
                            title="ערוך סיבת החזר או סכום"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>ערוך סיבה</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            const msg = `שלום ${b.ownerName}, בנוגע לביטול ולהחזר הכספי על סך ₪${amt} עבור ${b.dogName}...`;
                            openWhatsAppMessage(b.ownerPhone, msg);
                          }}
                          className="text-[11px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-md cursor-pointer flex items-center gap-0.5 transition-all"
                          title="שלח וואטסאפ ללקוח"
                        >
                          <MessageCircle className="w-3 h-3" />
                          <span>וואטסאפ</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Inline Editing Drawer */}
                  {isEditing && (
                    <div className="mt-3 p-3 bg-amber-50/70 border border-amber-300 rounded-xl space-y-2 animate-in fade-in duration-150">
                      <div className="text-xs font-black text-amber-950 flex items-center justify-between">
                        <span>✏️ עריכת פרטי החזר ל-{b.ownerName} ({b.dogName}):</span>
                        <button
                          type="button"
                          onClick={() => setEditingBookingId(null)}
                          className="text-slate-400 hover:text-slate-600 text-xs"
                        >
                          ביטול
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="text-[11px] font-bold text-slate-700 block mb-0.5">סכום שיוחזר (₪):</label>
                          <input
                            type="number"
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-black font-mono text-rose-950"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-slate-700 block mb-0.5">בחר סיבה מהירה:</label>
                          <div className="flex flex-wrap gap-1">
                            {availableReasons.map((r) => (
                              <button
                                key={r}
                                type="button"
                                onClick={() => {
                                  setEditReason(r);
                                  setIsOtherSelected(false);
                                }}
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-md cursor-pointer transition-all ${
                                  !isOtherSelected && editReason === r
                                    ? 'bg-rose-600 text-white shadow-2xs'
                                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                                }`}
                              >
                                {r}
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => {
                                setIsOtherSelected(true);
                                setEditReason('אחר');
                              }}
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md cursor-pointer transition-all ${
                                isOtherSelected
                                  ? 'bg-rose-600 text-white shadow-2xs'
                                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              אחר (הקלד סיבה)...
                            </button>
                          </div>
                        </div>
                      </div>

                      {isOtherSelected && (
                        <div className="mt-1">
                          <label className="text-[11px] font-bold text-slate-700 block mb-0.5">פרט סיבה אחרת (תתווסף לכפתורים המהירים):</label>
                          <input
                            type="text"
                            value={editCustomReason}
                            onChange={(e) => setEditCustomReason(e.target.value)}
                            placeholder="למשל: סגירת טיסה ברגע האחרון..."
                            className="w-full bg-white border border-rose-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-900"
                            autoFocus
                          />
                        </div>
                      )}

                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(b)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-3 py-1 rounded-lg shadow-2xs cursor-pointer flex items-center gap-1 active:scale-95 transition-all"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>שמור עדכון</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-medium">
            💡 ההחזרים מנוכים אוטומטית מקוביית ההכנסות החודשית ומשתקפים בדוחות השנתיים.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="bg-[#065f46] hover:bg-[#044e45] text-white font-black px-4 py-1.5 rounded-xl cursor-pointer shadow-xs transition-all active:scale-95"
          >
            סגור חלון
          </button>
        </div>

      </div>
    </div>
  );
};
