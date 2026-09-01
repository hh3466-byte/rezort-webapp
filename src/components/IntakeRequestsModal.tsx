import React, { useState } from 'react';
import { IntakeRequest, IntakeRequestStatus, ResortSettings, Booking } from '../types';
import { cleanPhoneNumber, getServiceTypeHebrew } from '../utils/whatsappUtils';
import { formatClientPaymentLinkMessage } from '../services/notificationService';
import { 
  X, 
  Phone, 
  MessageCircle, 
  CreditCard, 
  CheckCircle, 
  XCircle, 
  Calendar, 
  User, 
  Heart, 
  ShieldCheck, 
  Clock, 
  Filter,
  Search,
  ExternalLink,
  ChevronDown
} from 'lucide-react';

interface IntakeRequestsModalProps {
  requests: IntakeRequest[];
  settings: ResortSettings;
  onClose: () => void;
  onUpdateStatus: (id: string, status: IntakeRequestStatus, internalNotes?: string) => Promise<void>;
  onApproveAndBook: (request: IntakeRequest) => void;
  onDeleteRequest: (id: string) => Promise<void>;
}

export const IntakeRequestsModal: React.FC<IntakeRequestsModalProps> = ({
  requests,
  settings,
  onClose,
  onUpdateStatus,
  onApproveAndBook,
  onDeleteRequest
}) => {
  const [filter, setFilter] = useState<'all' | 'pending' | 'payment_requested' | 'approved' | 'rejected'>('pending');
  const [searchQuery, setSearchQuery] = useState('');

  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const paymentRequestedCount = requests.filter(r => r.status === 'payment_requested').length;
  const approvedCount = requests.filter(r => r.status === 'approved').length;

  const filteredRequests = requests.filter(r => {
    if (filter !== 'all' && r.status !== filter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = r.ownerName.toLowerCase().includes(q);
      const matchDog = r.dogName.toLowerCase().includes(q);
      const matchPhone = r.ownerPhone.includes(q);
      const matchBreed = r.dogBreed.toLowerCase().includes(q);
      return matchName || matchDog || matchPhone || matchBreed;
    }
    return true;
  });

  const handleSendGrowPaymentLink = async (request: IntakeRequest) => {
    const cleanPhone = cleanPhoneNumber(request.ownerPhone);
    const intlPhone = cleanPhone.startsWith('0') ? '972' + cleanPhone.substring(1) : cleanPhone;
    const msg = formatClientPaymentLinkMessage(request, settings);
    const whatsappUrl = `https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`;

    // Open WhatsApp
    window.open(whatsappUrl, '_blank');

    // Update status in DB
    await onUpdateStatus(request.id, 'payment_requested');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200" dir="rtl">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black text-lg shadow-2xs">
              📥
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-[#0f4c3a]">
                  בקשות קליטה מלקוחות
                </h2>
                {pendingCount > 0 && (
                  <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-black animate-pulse">
                    {pendingCount} חדשות
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium">
                נהל את פניות הלקוחות: חייג לשיחת היכרות, שלח קישור לתשלום ב-Grow, וקלוט ליומן לאחר תשלום
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center cursor-pointer transition-colors border border-slate-200 shadow-2xs"
            title="סגור"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters & Search Toolbar */}
        <div className="p-3 sm:p-4 border-b border-slate-100 bg-white flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
            {[
              { id: 'pending', label: 'ממתינות לבדיקה', count: pendingCount, color: 'emerald' },
              { id: 'payment_requested', label: 'נשלח קישור תשלום', count: paymentRequestedCount, color: 'blue' },
              { id: 'approved', label: 'נקלטו ביומן', count: approvedCount, color: 'slate' },
              { id: 'rejected', label: 'נדחו', count: requests.filter(r => r.status === 'rejected').length, color: 'slate' },
              { id: 'all', label: 'הכול', count: requests.length, color: 'slate' },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  filter === tab.id
                    ? 'bg-[#065f46] text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  filter === tab.id ? 'bg-emerald-800 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="relative min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="חיפוש לפי שם, כלב או טלפון..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-1.5 text-xs font-semibold text-slate-900 focus:bg-white focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Requests List Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-50/50">
          {filteredRequests.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <div className="text-4xl">📭</div>
              <h3 className="text-base font-bold text-slate-700">
                אין בקשות קליטה {filter === 'pending' ? 'ממתינות לבדיקה' : 'להצגה כעת'}
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                לקוחות שימלאו את שאלון הקליטה המקוון יופיעו כאן מיד עם כל הפרטים לצורך תיאום טלפוני ושליחת קישור לתשלום.
              </p>
            </div>
          ) : (
            filteredRequests.map((req) => {
              const serviceLabel = getServiceTypeHebrew(req.serviceType);
              const cleanPhone = cleanPhoneNumber(req.ownerPhone);
              const intlPhone = cleanPhone.startsWith('0') ? '972' + cleanPhone.substring(1) : cleanPhone;
              const formattedDate = new Date(req.createdAt).toLocaleDateString('he-IL', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
              });

              return (
                <div
                  key={req.id}
                  className={`bg-white rounded-2xl border p-4 sm:p-5 shadow-xs transition-all space-y-4 ${
                    req.status === 'pending' 
                      ? 'border-emerald-300 ring-1 ring-emerald-500/20' 
                      : req.status === 'payment_requested'
                      ? 'border-blue-200'
                      : req.status === 'approved'
                      ? 'border-slate-200 opacity-90'
                      : 'border-slate-200 opacity-60'
                  }`}
                >
                  {/* Card Top: Dog & Owner Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-center font-black text-xl shadow-2xs">
                        🐕
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-black text-slate-900">
                            {req.dogName}
                          </h3>
                          <span className="text-xs text-slate-500 font-semibold">
                            ({req.dogBreed || 'מעורב'}{req.dogAge ? `, ${req.dogAge}` : ''})
                          </span>
                          
                          {/* Status Badge */}
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                            req.status === 'pending'
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : req.status === 'payment_requested'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : req.status === 'approved'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            {req.status === 'pending' ? 'ממתין לשיחה' :
                             req.status === 'payment_requested' ? 'נשלח קישור לתשלום' :
                             req.status === 'approved' ? 'נקלט ביומן' : 'נדחה'}
                          </span>
                        </div>

                        <div className="text-xs text-slate-600 font-medium flex items-center gap-2 mt-0.5">
                          <span className="font-bold text-slate-800">בעלים: {req.ownerName}</span>
                          <span>·</span>
                          <span className="font-mono">{req.ownerPhone}</span>
                          <span>·</span>
                          <span className="text-[11px] text-slate-400">התקבל: {formattedDate}</span>
                        </div>
                      </div>
                    </div>

                    {/* Quick Dates Badge */}
                    <div className="flex items-center gap-2 self-start sm:self-center bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700">
                      <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{serviceLabel}: {req.startDate} ➔ {req.endDate}</span>
                    </div>
                  </div>

                  {/* Card Middle: Key Vetting Indicators */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    {/* Friendly with dogs */}
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 block font-semibold mb-0.5">
                        מסתדר עם כלבים:
                      </span>
                      <span className={`font-bold ${
                        req.isFriendlyWithDogs === 'yes' ? 'text-emerald-700' :
                        req.isFriendlyWithDogs === 'no' ? 'text-red-700' : 'text-amber-700'
                      }`}>
                        {req.isFriendlyWithDogs === 'yes' ? 'חברותי מאוד 🟢' :
                         req.isFriendlyWithDogs === 'no' ? 'תוקפני / לבד 🔴' : 'תלוי בסיטואציה 🟡'}
                      </span>
                    </div>

                    {/* Neutered */}
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 block font-semibold mb-0.5">
                        מסורס / מעוקרת:
                      </span>
                      <span className="font-bold text-slate-800">
                        {req.isNeutered ? 'כן ✂️' : 'לא'}
                      </span>
                    </div>

                    {/* Vaccinated */}
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 block font-semibold mb-0.5">
                        חיסונים בתוקף:
                      </span>
                      <span className={`font-bold ${req.isVaccinated ? 'text-emerald-700' : 'text-red-600'}`}>
                        {req.isVaccinated ? 'בתוקף מלא 💉' : 'חסר / לא בטוח ⚠️'}
                      </span>
                    </div>

                    {/* Dog Size */}
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 block font-semibold mb-0.5">
                        גודל כלב:
                      </span>
                      <span className="font-bold text-slate-800">
                        {req.dogSize === 'small' ? 'קטן (עד 10 ק״ג)' :
                         req.dogSize === 'medium' ? 'בינוני (10-25 ק״ג)' :
                         req.dogSize === 'large' ? 'גדול (25-45 ק״ג)' : 'ענק (45+ ק״ג)'}
                      </span>
                    </div>
                  </div>

                  {/* Special Needs & Notes if any */}
                  {(req.specialNeeds || req.notes) && (
                    <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-2.5 text-xs text-amber-950 space-y-1">
                      {req.specialNeeds && (
                        <div>
                          <strong className="font-bold">🩺 צרכים מיוחדים/תרופות:</strong> {req.specialNeeds}
                        </div>
                      )}
                      {req.notes && (
                        <div>
                          <strong className="font-bold">📝 הערות הלקוח:</strong> {req.notes}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Card Bottom: Shmulik Action Buttons */}
                  <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    
                    {/* Left: Contact actions */}
                    <div className="flex items-center gap-2">
                      <a
                        href={`tel:${cleanPhone}`}
                        className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-2xs"
                        title="חייג לשיחת תיאום והיכרות עם הלקוח"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>חייג ללקוח</span>
                      </a>

                      <a
                        href={`https://wa.me/${intlPhone}`}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-2xs"
                        title="פתח שיחת וואטסאפ עם הלקוח"
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-[#25D366]" />
                        <span>צ׳אט וואטסאפ</span>
                      </a>
                    </div>

                    {/* Right: Booking decision actions (Manual after call) */}
                    <div className="flex items-center gap-2">
                      {/* Send Grow Payment Link button */}
                      <button
                        type="button"
                        onClick={() => handleSendGrowPaymentLink(req)}
                        className="bg-blue-50 hover:bg-blue-100 active:scale-98 text-blue-900 border border-blue-300 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                        title="שלח קישור מאובטח לתשלום מקדמה ב-Grow ישירות לוואטסאפ של הלקוח"
                      >
                        <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                        <span>שלח קישור תשלום Grow 💬</span>
                      </button>

                      {/* Approve and Book on calendar */}
                      <button
                        type="button"
                        onClick={() => onApproveAndBook(req)}
                        className="bg-[#065f46] hover:bg-[#044e45] active:scale-98 text-white font-black px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                        title="לאחר קבלת תשלום / אישור סופי: קלוט להזמנה פעילה ביומן הראשי"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>קלוט ליומן הראשי 🟢</span>
                      </button>

                      {/* Reject / Dismiss */}
                      {req.status !== 'rejected' && (
                        <button
                          type="button"
                          onClick={() => onUpdateStatus(req.id, 'rejected')}
                          className="bg-white hover:bg-red-50 text-red-600 border border-slate-200 hover:border-red-200 font-bold px-2.5 py-1.5 rounded-xl text-xs transition-colors cursor-pointer"
                          title="סגור / דחה בקשה"
                        >
                          דחה
                        </button>
                      )}
                    </div>

                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <div>
            סה״כ {requests.length} בקשות קליטה במערכת
          </div>
          <button
            type="button"
            onClick={onClose}
            className="bg-white hover:bg-slate-200 text-slate-800 font-bold px-4 py-2 rounded-xl border border-slate-200 cursor-pointer shadow-2xs"
          >
            סגור חלון
          </button>
        </div>

      </div>
    </div>
  );
};
