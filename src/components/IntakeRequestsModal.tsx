import React, { useState } from 'react';
import { IntakeRequest, IntakeRequestStatus, ResortSettings, Booking } from '../types';
import { cleanPhoneNumber, getServiceTypeHebrew } from '../utils/whatsappUtils';
import { formatClientPaymentLinkMessage, formatClientRejectionMessage } from '../services/notificationService';
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
  ChevronDown,
  Copy,
  Check,
  Pencil,
  AlertCircle,
  Plus,
  Minus,
  Save,
  Trash2,
  RotateCcw
} from 'lucide-react';
import { calculateDaysCount, addDays, formatDateIL, getDayNameHebrew } from '../utils/dateUtils';

interface IntakeRequestsModalProps {
  requests: IntakeRequest[];
  settings: ResortSettings;
  onClose: () => void;
  onUpdateStatus: (id: string, status: IntakeRequestStatus, internalNotes?: string) => Promise<void>;
  onApproveAndBook: (request: IntakeRequest) => void;
  onDeleteRequest: (id: string) => Promise<void>;
  onSaveRequest?: (request: IntakeRequest) => Promise<void>;
}

export const IntakeRequestsModal: React.FC<IntakeRequestsModalProps> = ({
  requests,
  settings,
  onClose,
  onUpdateStatus,
  onApproveAndBook,
  onDeleteRequest,
  onSaveRequest
}) => {
  const [filter, setFilter] = useState<'all' | 'pending' | 'payment_requested' | 'approved' | 'rejected'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [editingRequest, setEditingRequest] = useState<IntakeRequest | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [paymentPromptRequest, setPaymentPromptRequest] = useState<IntakeRequest | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [customPaymentLink, setCustomPaymentLink] = useState<string>('');
  const [isSendingPayment, setIsSendingPayment] = useState<boolean>(false);
  const [rejectPromptRequest, setRejectPromptRequest] = useState<IntakeRequest | null>(null);
  const [rejectMessageText, setRejectMessageText] = useState<string>('');
  const [isProcessingReject, setIsProcessingReject] = useState<boolean>(false);

  const handleSaveEdit = async () => {
    if (!editingRequest) return;
    setEditError(null);

    if (!editingRequest.ownerName.trim()) {
      setEditError('נא למלא שם בעלים מלא');
      return;
    }
    if (!editingRequest.ownerPhone.trim()) {
      setEditError('נא למלא מספר טלפון נייד');
      return;
    }
    if (!editingRequest.dogName.trim()) {
      setEditError('נא למלא את שם הכלב/ה');
      return;
    }
    if (!editingRequest.startDate || !editingRequest.endDate) {
      setEditError('נא לבחור תאריכי שהות');
      return;
    }
    if (editingRequest.endDate < editingRequest.startDate) {
      setEditError('תאריך היציאה אינו יכול להיות מוקדם מתאריך הכניסה');
      return;
    }

    setIsSavingEdit(true);
    try {
      if (onSaveRequest) {
        await onSaveRequest(editingRequest);
      }
      setEditingRequest(null);
    } catch (err: any) {
      setEditError('אירעה שגיאה בשמירת השינויים, אנא נסה שוב');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleCopyIntakeLink = () => {
    const url = `${window.location.origin}/?intake=true`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

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

  const handleOpenPaymentPrompt = (request: IntakeRequest) => {
    setPaymentPromptRequest(request);
    setPaymentAmount(request.depositRequested ? String(request.depositRequested) : '');
    setCustomPaymentLink(settings.growPaymentLink || 'https://pay.grow.link/MjcyNjk~3d59a40e0ae26ce0d41b50b4eebdff04-MzczNjYzMg');
  };

  const handleConfirmSendPayment = async () => {
    if (!paymentPromptRequest) return;
    setIsSendingPayment(true);
    try {
      const numAmount = Number(paymentAmount) || 0;
      const updated: IntakeRequest = {
        ...paymentPromptRequest,
        depositRequested: numAmount,
        status: 'payment_requested'
      };

      if (onSaveRequest) {
        await onSaveRequest(updated);
      } else {
        await onUpdateStatus(paymentPromptRequest.id, 'payment_requested');
      }

      const cleanPhone = cleanPhoneNumber(paymentPromptRequest.ownerPhone);
      const intlPhone = cleanPhone.startsWith('0') ? '972' + cleanPhone.substring(1) : cleanPhone;
      const msg = formatClientPaymentLinkMessage(updated, settings, numAmount, customPaymentLink);
      const whatsappUrl = `https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`;

      window.open(whatsappUrl, '_blank');
      setPaymentPromptRequest(null);
    } finally {
      setIsSendingPayment(false);
    }
  };

  const handleOpenRejectPrompt = (request: IntakeRequest) => {
    setRejectPromptRequest(request);
    setRejectMessageText(formatClientRejectionMessage(request, settings));
  };

  const handleConfirmRejectWithWhatsApp = async () => {
    if (!rejectPromptRequest) return;
    setIsProcessingReject(true);
    try {
      await onUpdateStatus(rejectPromptRequest.id, 'rejected');
      const cleanPhone = cleanPhoneNumber(rejectPromptRequest.ownerPhone);
      const intlPhone = cleanPhone.startsWith('0') ? '972' + cleanPhone.substring(1) : cleanPhone;
      const whatsappUrl = `https://wa.me/${intlPhone}?text=${encodeURIComponent(rejectMessageText)}`;
      window.open(whatsappUrl, '_blank');
      setRejectPromptRequest(null);
    } catch (e) {
      console.warn('Reject error:', e);
    } finally {
      setIsProcessingReject(false);
    }
  };

  const handleConfirmRejectWithoutWhatsApp = async () => {
    if (!rejectPromptRequest) return;
    setIsProcessingReject(true);
    try {
      await onUpdateStatus(rejectPromptRequest.id, 'rejected');
      setRejectPromptRequest(null);
    } catch (e) {
      console.warn('Reject error:', e);
    } finally {
      setIsProcessingReject(false);
    }
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

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyIntakeLink}
              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
              title="העתקת הקישור לשאלון הקליטה לשליחה מהירה ללקוחות בוואטסאפ"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'הקישור הועתק!' : 'העתק קישור שאלון'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center cursor-pointer transition-colors border border-slate-200 shadow-2xs"
              title="סגור"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
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

          {/* Search Bar & Bulk Actions */}
          <div className="flex items-center gap-2">
            {filter === 'rejected' && filteredRequests.length > 0 && (
              <button
                type="button"
                onClick={async () => {
                  if (window.confirm(`האם למחוק לצמיתות את כל ${filteredRequests.length} בקשות הקליטה שנדחו מהמערכת?\nפעולה זו תמחק אותן לחלוטין ולא ניתנת לשחזור.`)) {
                    for (const req of filteredRequests) {
                      await onDeleteRequest(req.id);
                    }
                  }
                }}
                className="bg-red-50 hover:bg-red-100 active:scale-98 text-red-700 border border-red-200 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs whitespace-nowrap"
                title="מחיקה סופית של כל הבקשות שנדחו מהמערכת"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-600" />
                <span>מחק הכל ({filteredRequests.length})</span>
              </button>
            )}

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
                      <span>{serviceLabel}: {req.serviceType === 'training' ? `כניסה החל מ-${req.startDate}` : `${req.startDate} ➔ ${req.endDate}`}</span>
                    </div>
                  </div>

                  {/* Card Middle: Key Vetting Indicators */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-xs">
                    {/* Friendly with dogs */}
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 block font-semibold mb-0.5">
                        מסתדר עם כלבים:
                      </span>
                      <span className={`font-bold ${
                        req.isFriendlyWithDogs === 'yes' ? 'text-emerald-700' :
                        req.isFriendlyWithDogs === 'no' ? 'text-red-700' : 'text-amber-700'
                      }`}>
                        {req.isFriendlyWithDogs === 'yes' ? 'חברותי 🟢' :
                         req.isFriendlyWithDogs === 'no' ? 'תוקפני 🔴' : 'תלוי 🟡'}
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
                        {req.isVaccinated ? 'כן 💉' : 'חסר ⚠️'}
                      </span>
                    </div>

                    {/* House Trained */}
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 block font-semibold mb-0.5">
                        מחונך לצרכים:
                      </span>
                      <span className={`font-bold ${req.isHouseTrained !== false ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {req.isHouseTrained !== false ? 'כן 🚽' : 'לא ⚠️'}
                      </span>
                    </div>

                    {/* Treated for Parasites */}
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 block font-semibold mb-0.5">
                        נגד קרציות/פשפשים:
                      </span>
                      <span className={`font-bold ${req.isTreatedParasites !== false ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {req.isTreatedParasites !== false ? 'מטופל 🛡️' : 'לא ⚠️'}
                      </span>
                    </div>

                    {/* Dog Size */}
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 block font-semibold mb-0.5">
                        גודל כלב:
                      </span>
                      <span className="font-bold text-slate-800">
                        {req.dogSize === 'small' ? 'קטן' :
                         req.dogSize === 'medium' ? 'בינוני' :
                         req.dogSize === 'large' ? 'גדול' : 'ענק'}
                      </span>
                    </div>
                  </div>

                  {/* Special Needs, Client Notes & Shmulik Internal Notes */}
                  {(req.specialNeeds || req.notes || req.internalNotes || (req.depositRequested && req.depositRequested > 0)) && (
                    <div className="space-y-2">
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

                      {req.internalNotes && (
                        <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-2.5 text-xs text-blue-950 space-y-0.5">
                          <div className="font-bold flex items-center gap-1 text-blue-900">
                            <span>📌 סיכום שיחה והערות שמוליק:</span>
                          </div>
                          <div className="font-medium text-slate-800 pr-1 whitespace-pre-wrap">
                            {req.internalNotes}
                          </div>
                        </div>
                      )}

                      {req.depositRequested && req.depositRequested > 0 ? (
                        <div className="text-xs font-bold text-emerald-900 bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200 inline-flex items-center gap-1.5">
                          <span>💰 הסכום שסוכם הוא:</span>
                          <span className="font-mono text-sm">₪{req.depositRequested}</span>
                        </div>
                      ) : null}
                    </div>
                  )}

                  {/* Card Bottom: Shmulik Action Buttons */}
                  <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    
                    {/* Left: Contact actions */}
                    <div className="flex items-center gap-2">
                      {/* WhatsApp Call & Chat - Primary Green Button */}
                      <a
                        href={`https://wa.me/${intlPhone}?text=${encodeURIComponent(`שלום ${req.ownerName}, כאן שמוליק מ${settings.resortName} 🐾 בהמשך לשאלון הקליטה ששלחתם עבור ${req.dogName}`)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-[#25D366] hover:bg-[#1EBE5D] active:scale-98 text-white font-black px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                        title="שיחה לוואטסאפ של הריזורט"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>שיחה לוואטסאפ של הריזורט</span>
                      </a>

                      {/* Regular SIM Phone Call */}
                      <a
                        href={`tel:${cleanPhone}`}
                        className="bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-2xs"
                        title="חיוג סלולרי רגיל (מהסים של הטלפון)"
                      >
                        <Phone className="w-3.5 h-3.5 text-slate-500" />
                        <span>חיוג סלולרי</span>
                      </a>
                    </div>

                    {/* Right: Booking decision actions (Manual after call) */}
                    <div className="flex items-center gap-2">
                      {/* Edit Details Button */}
                      <button
                        type="button"
                        onClick={() => { setEditingRequest({ ...req }); setEditError(null); }}
                        className="bg-amber-50 hover:bg-amber-100 active:scale-98 text-amber-950 border border-amber-300 font-black px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                        title="ערוך את כל פרטי הבקשה (שירות, תאריכים, פרטי כלב, בעלים, חיסונים והערות)"
                      >
                        <Pencil className="w-3.5 h-3.5 text-amber-700" />
                        <span>ערוך פרטים ✏️</span>
                      </button>

                      {/* Send Grow Payment Link button */}
                      <button
                        type="button"
                        onClick={() => handleOpenPaymentPrompt(req)}
                        className="bg-blue-50 hover:bg-blue-100 active:scale-98 text-blue-900 border border-blue-300 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                        title="הגדר סכום שסוכם ושלח קישור תשלום Grow ישירות לוואטסאפ של הלקוח"
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

                      {/* Reject / Dismiss OR Restore & Permanent Deletion */}
                      {req.status !== 'rejected' ? (
                        <button
                          type="button"
                          onClick={() => handleOpenRejectPrompt(req)}
                          className="bg-white hover:bg-red-50 text-red-600 border border-slate-200 hover:border-red-200 font-bold px-2.5 py-1.5 rounded-xl text-xs transition-colors cursor-pointer"
                          title="דחה בקשה זו (עם אפשרות שליחת הודעת וואטסאפ מנומסת ללקוח)"
                        >
                          דחה
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          {/* Send rejection WhatsApp message */}
                          <button
                            type="button"
                            onClick={() => handleOpenRejectPrompt(req)}
                            className="bg-emerald-50 hover:bg-emerald-100 active:scale-98 text-emerald-800 border border-emerald-300 font-bold px-2.5 py-1.5 rounded-xl text-xs flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                            title="שלח הודעת דחייה מנומסת בוואטסאפ ללקוח"
                          >
                            <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                            <span>הודעת דחייה 💬</span>
                          </button>

                          {/* Restore / Reopen */}
                          <button
                            type="button"
                            onClick={() => onUpdateStatus(req.id, 'pending')}
                            className="bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-700 border border-slate-300 font-bold px-2.5 py-1.5 rounded-xl text-xs flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                            title="החזר את הבקשה לסטטוס ממתין לבדיקה"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
                            <span>שחזר</span>
                          </button>

                          {/* Permanent Deletion */}
                          <button
                            type="button"
                            onClick={async () => {
                              if (window.confirm(`האם למחוק סופית את בקשת הקליטה של ${req.dogName} (${req.ownerName})?\nפעולה זו תמחק את הבקשה לחלוטין מהמערכת ללא אפשרות שחזור.`)) {
                                await onDeleteRequest(req.id);
                              }
                            }}
                            className="bg-red-600 hover:bg-red-700 active:scale-98 text-white font-black px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                            title="מחיקה סופית ומוחלטת של ההזמנה/בקשה מהמערכת"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>מחיקה סופית 🗑️</span>
                          </button>
                        </div>
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

      {/* FULL EDIT INTAKE SUB-MODAL */}
      {editingRequest && (
        <div className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150" dir="rtl">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 bg-amber-50/60 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center font-black text-lg shadow-2xs">
                  ✏️
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900">
                    עריכת בקשת קליטה: {editingRequest.dogName}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    עדכן שינויים, תאריכים, סכומים והערות שסוכמו בשיחה עם {editingRequest.ownerName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingRequest(null)}
                className="w-8 h-8 rounded-xl bg-white hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer border border-slate-200 shadow-2xs"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
              {editError && (
                <div className="bg-red-50 text-red-700 border border-red-200 rounded-xl p-3 font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              {/* 1. Service Type */}
              <div className="space-y-1.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <label className="font-extrabold text-slate-800 block text-xs">
                  ✨ סוג השירות המבוקש
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'boarding', label: '🏨 פנסיון לינה' },
                    { id: 'training', label: '🎓 אילוף' },
                    { id: 'daycare', label: '✂️ יום כיף' },
                  ].map(st => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setEditingRequest({
                        ...editingRequest,
                        serviceType: st.id as any,
                        endDate: st.id === 'daycare' ? editingRequest.startDate : editingRequest.endDate
                      })}
                      className={`py-2 px-1 rounded-xl border text-center font-bold transition-all cursor-pointer ${
                        editingRequest.serviceType === st.id
                          ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Dates */}
              <div className="space-y-2 bg-emerald-50/40 p-3.5 rounded-2xl border border-emerald-200">
                <div className="flex items-center justify-between">
                  <label className="font-extrabold text-[#0f4c3a] block text-xs">
                    {editingRequest.serviceType === 'training' ? '🎓 תאריך כניסה לאילוף' : '📅 תאריכי שהות בריזורט'}
                  </label>
                  <span className="text-[11px] font-bold text-emerald-800 bg-white px-2 py-0.5 rounded-full border border-emerald-200">
                    {editingRequest.serviceType === 'training' 
                      ? 'תחילת אילוף (משך מותאם אישית)' 
                      : editingRequest.serviceType === 'daycare' 
                      ? 'שהות יומית' 
                      : `${Math.max(1, calculateDaysCount(editingRequest.startDate, editingRequest.endDate))} ימים (${Math.max(1, calculateDaysCount(editingRequest.startDate, editingRequest.endDate))} לילות)`}
                  </span>
                </div>

                {editingRequest.serviceType === 'training' ? (
                  <div>
                    <span className="text-[11px] text-slate-600 font-bold block mb-1">
                      🎓 תאריך הגעה / כניסה לאילוף:
                    </span>
                    <input
                      type="date"
                      value={editingRequest.startDate}
                      onChange={(e) => {
                        const s = e.target.value;
                        setEditingRequest({
                          ...editingRequest,
                          startDate: s,
                          endDate: s
                        });
                      }}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-mono text-slate-900 font-bold focus:border-emerald-500 focus:outline-none"
                    />
                    <div className="text-[10px] text-emerald-800 font-bold mt-1">
                      {editingRequest.startDate ? `יום ${getDayNameHebrew(editingRequest.startDate)}, ${formatDateIL(editingRequest.startDate)}` : ''}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <span className="text-[11px] text-slate-600 font-bold block mb-1">
                          🏨 תאריך הגעה / כניסה:
                        </span>
                        <input
                          type="date"
                          value={editingRequest.startDate}
                          onChange={(e) => {
                            const s = e.target.value;
                            const curNights = Math.max(1, calculateDaysCount(editingRequest.startDate, editingRequest.endDate));
                            setEditingRequest({
                              ...editingRequest,
                              startDate: s,
                              endDate: editingRequest.serviceType === 'daycare' ? s : addDays(s, curNights)
                            });
                          }}
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-mono text-slate-900 font-bold focus:border-emerald-500 focus:outline-none"
                        />
                        <div className="text-[10px] text-emerald-800 font-bold mt-1">
                          {editingRequest.startDate ? `יום ${getDayNameHebrew(editingRequest.startDate)}, ${formatDateIL(editingRequest.startDate)}` : ''}
                        </div>
                      </div>

                      <div>
                        <span className="text-[11px] text-slate-600 font-bold block mb-1">
                          🚗 תאריך איסוף / יציאה:
                        </span>
                        <input
                          type="date"
                          min={editingRequest.startDate}
                          value={editingRequest.endDate}
                          onChange={(e) => setEditingRequest({ ...editingRequest, endDate: e.target.value })}
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 font-mono text-slate-900 font-bold focus:border-emerald-500 focus:outline-none"
                        />
                        <div className="text-[10px] text-emerald-800 font-bold mt-1">
                          {editingRequest.endDate ? `יום ${getDayNameHebrew(editingRequest.endDate)}, ${formatDateIL(editingRequest.endDate)}` : ''}
                        </div>
                      </div>
                    </div>

                    {/* Quick nights adjust */}
                    {editingRequest.serviceType !== 'daycare' && (
                      <div className="flex items-center justify-between pt-1 text-xs">
                        <span className="text-slate-500 font-medium">כוונון לילות מהיר:</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              const n = Math.max(1, calculateDaysCount(editingRequest.startDate, editingRequest.endDate) - 1);
                              setEditingRequest({ ...editingRequest, endDate: addDays(editingRequest.startDate, n) });
                            }}
                            className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg font-bold text-slate-700"
                          >
                            -1 לילה
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const n = calculateDaysCount(editingRequest.startDate, editingRequest.endDate) + 1;
                              setEditingRequest({ ...editingRequest, endDate: addDays(editingRequest.startDate, n) });
                            }}
                            className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg font-bold text-slate-700"
                          >
                            +1 לילה
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingRequest({ ...editingRequest, endDate: addDays(editingRequest.startDate, 7) })}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-lg font-bold"
                          >
                            שבוע (7 לילות)
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* 3. Dog Details */}
              <div className="space-y-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <label className="font-extrabold text-slate-800 block text-xs">
                  🐕 פרטי הכלב/ה
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <span className="text-[11px] text-slate-600 font-bold block mb-1">שם הכלב *</span>
                    <input
                      type="text"
                      value={editingRequest.dogName}
                      onChange={(e) => setEditingRequest({ ...editingRequest, dogName: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-600 font-bold block mb-1">גזע</span>
                    <input
                      type="text"
                      value={editingRequest.dogBreed || ''}
                      onChange={(e) => setEditingRequest({ ...editingRequest, dogBreed: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-600 font-bold block mb-1">גיל</span>
                    <input
                      type="text"
                      value={editingRequest.dogAge || ''}
                      onChange={(e) => setEditingRequest({ ...editingRequest, dogAge: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <span className="text-[11px] text-slate-600 font-bold block mb-1">גודל כלב:</span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { id: 'small', label: 'קטן (עד 10)' },
                      { id: 'medium', label: 'בינוני (10-25)' },
                      { id: 'large', label: 'גדול (25-45)' },
                      { id: 'giant', label: 'ענק (45+)' },
                    ].map(s => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setEditingRequest({ ...editingRequest, dogSize: s.id as any })}
                        className={`py-1.5 px-1 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${
                          editingRequest.dogSize === s.id
                            ? 'bg-emerald-700 text-white border-emerald-700'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 4. Owner Details */}
              <div className="space-y-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <label className="font-extrabold text-slate-800 block text-xs">
                  👤 פרטי הבעלים
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <span className="text-[11px] text-slate-600 font-bold block mb-1">שם הבעלים *</span>
                    <input
                      type="text"
                      value={editingRequest.ownerName}
                      onChange={(e) => setEditingRequest({ ...editingRequest, ownerName: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-600 font-bold block mb-1">טלפון נייד *</span>
                    <input
                      type="tel"
                      value={editingRequest.ownerPhone}
                      onChange={(e) => setEditingRequest({ ...editingRequest, ownerPhone: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold focus:border-emerald-500 focus:outline-none font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-600 font-bold block mb-1">דוא״ל</span>
                    <input
                      type="email"
                      value={editingRequest.ownerEmail || ''}
                      onChange={(e) => setEditingRequest({ ...editingRequest, ownerEmail: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* 5. Vetting & Health Questions */}
              <div className="space-y-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <label className="font-extrabold text-slate-800 block text-xs">
                  🛡️ התאמה ובריאות
                </label>
                <div className="space-y-2">
                  {/* Friendly with dogs */}
                  <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-slate-200">
                    <span className="font-bold text-slate-700">מסתדר עם כלבים:</span>
                    <div className="flex items-center gap-1">
                      {[
                        { id: 'yes', label: 'חברותי 🟢' },
                        { id: 'depends', label: 'תלוי 🟡' },
                        { id: 'no', label: 'תוקפני 🔴' },
                      ].map(f => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setEditingRequest({ ...editingRequest, isFriendlyWithDogs: f.id as any })}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            editingRequest.isFriendlyWithDogs === f.id
                              ? 'bg-emerald-700 text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Booleans: Neutered, Vaccinated, House-trained, Parasites */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-slate-200">
                      <span className="font-bold text-slate-700">מסורס / מעוקרת:</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingRequest({ ...editingRequest, isNeutered: true })}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer ${editingRequest.isNeutered ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-700'}`}
                        >
                          כן
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingRequest({ ...editingRequest, isNeutered: false })}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer ${!editingRequest.isNeutered ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-700'}`}
                        >
                          לא
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-slate-200">
                      <span className="font-bold text-slate-700">חיסונים בתוקף:</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingRequest({ ...editingRequest, isVaccinated: true })}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer ${editingRequest.isVaccinated ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-700'}`}
                        >
                          כן
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingRequest({ ...editingRequest, isVaccinated: false })}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer ${!editingRequest.isVaccinated ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-700'}`}
                        >
                          לא
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-slate-200">
                      <span className="font-bold text-slate-700">מחונך לצרכים:</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingRequest({ ...editingRequest, isHouseTrained: true })}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer ${editingRequest.isHouseTrained !== false ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-700'}`}
                        >
                          כן
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingRequest({ ...editingRequest, isHouseTrained: false })}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer ${editingRequest.isHouseTrained === false ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-700'}`}
                        >
                          לא
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-slate-200">
                      <span className="font-bold text-slate-700">נגד קרציות/פשפשים:</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingRequest({ ...editingRequest, isTreatedParasites: true })}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer ${editingRequest.isTreatedParasites !== false ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-700'}`}
                        >
                          כן
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingRequest({ ...editingRequest, isTreatedParasites: false })}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer ${editingRequest.isTreatedParasites === false ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-700'}`}
                        >
                          לא
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 6. Notes & Special Needs */}
              <div className="space-y-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <label className="font-extrabold text-slate-800 block text-xs">
                  📝 הערות, צרכים מיוחדים וסיכום שיחה
                </label>
                <div className="space-y-2">
                  <div>
                    <span className="text-[11px] text-slate-600 font-bold block mb-1">
                      🩺 צרכים מיוחדים / תרופות:
                    </span>
                    <textarea
                      rows={2}
                      value={editingRequest.specialNeeds || ''}
                      onChange={(e) => setEditingRequest({ ...editingRequest, specialNeeds: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-xl p-2 text-slate-900 font-medium focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-600 font-bold block mb-1">
                      📝 הערות הלקוח:
                    </span>
                    <textarea
                      rows={2}
                      value={editingRequest.notes || ''}
                      onChange={(e) => setEditingRequest({ ...editingRequest, notes: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-xl p-2 text-slate-900 font-medium focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-blue-900 font-bold block mb-1">
                      📌 סיכום שיחה והערות שמוליק (פנימי):
                    </span>
                    <textarea
                      rows={2}
                      value={editingRequest.internalNotes || ''}
                      onChange={(e) => setEditingRequest({ ...editingRequest, internalNotes: e.target.value })}
                      placeholder="למשל: סוכם בשיחה שיביא את המזון שלו, מקדמה 500 ש״ח תועבר בביט..."
                      className="w-full bg-blue-50/60 border border-blue-200 rounded-xl p-2 text-slate-900 font-medium focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* 7. Agreed Amount & Status */}
              <div className="space-y-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <label className="font-extrabold text-slate-800 block text-xs">
                  💰 סכום שסוכם וסטטוס טיפול
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <span className="text-[11px] text-slate-600 font-bold block mb-1">
                      הסכום שסוכם (₪):
                    </span>
                    <input
                      type="number"
                      min={0}
                      value={editingRequest.depositRequested || ''}
                      onChange={(e) => setEditingRequest({ ...editingRequest, depositRequested: Number(e.target.value) || 0 })}
                      placeholder="0"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold font-mono focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-600 font-bold block mb-1">
                      סטטוס הבקשה:
                    </span>
                    <select
                      value={editingRequest.status}
                      onChange={(e) => setEditingRequest({ ...editingRequest, status: e.target.value as any })}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold focus:border-emerald-500 focus:outline-none cursor-pointer"
                    >
                      <option value="pending">ממתין לשיחה</option>
                      <option value="payment_requested">נשלח קישור לתשלום</option>
                      <option value="approved">נקלט ביומן</option>
                      <option value="rejected">נדחה</option>
                    </select>
                  </div>
                </div>
              </div>

            </div>

            {/* Sub-modal Footer */}
            <div className="p-3 sm:p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setEditingRequest(null)}
                className="bg-white hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl border border-slate-300 cursor-pointer shadow-2xs transition-colors"
              >
                ביטול
              </button>
              <button
                type="button"
                disabled={isSavingEdit}
                onClick={handleSaveEdit}
                className="bg-emerald-700 hover:bg-emerald-800 active:scale-98 text-white font-black px-5 py-2 rounded-xl shadow-xs cursor-pointer flex items-center gap-2 transition-all disabled:opacity-50"
              >
                {isSavingEdit ? 'שומר שינויים...' : '💾 שמור שינויים'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* QUICK PAYMENT PROMPT MODAL */}
      {paymentPromptRequest && (
        <div className="fixed inset-0 z-70 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150" dir="rtl">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 bg-blue-50/70 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-900 flex items-center justify-center font-black text-lg shadow-2xs">
                  💳
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900">
                    שליחת קישור לתשלום בוואטסאפ
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    עבור {paymentPromptRequest.ownerName} ({paymentPromptRequest.dogName})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPaymentPromptRequest(null)}
                className="w-8 h-8 rounded-xl bg-white hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer border border-slate-200 shadow-2xs"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-5 space-y-4 text-xs">
              {/* Amount input */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-900 block">
                  💰 הסכום שסוכם (₪):
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="לדוגמה: 500"
                    className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 focus:border-blue-500 rounded-xl px-4 py-2.5 text-base font-black font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    autoFocus
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">₪</span>
                </div>
              </div>

              {/* Payment Link (Optional override) */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">
                  🔗 קישור לתשלום (Grow):
                </label>
                <input
                  type="text"
                  value={customPaymentLink}
                  onChange={(e) => setCustomPaymentLink(e.target.value)}
                  className="w-full bg-slate-50 text-slate-800 text-xs px-3 py-2 rounded-xl border border-slate-200 focus:border-blue-500 focus:outline-none font-mono"
                  placeholder="https://pay.grow.link/..."
                />
                <span className="text-[10px] text-slate-400 block">
                  (ברירת מחדל: עמוד Grow של הריזורט לתשלום מאובטח ב-Bit, Apple Pay ואשראי. ניתן להדביק קישור ספציפי אם הפקת באפליקציית Grow).
                </span>
              </div>

              {/* Message preview snippet */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-[11px] text-slate-700 space-y-1">
                <span className="font-bold text-slate-500 block">תצוגה מקדימה של הודעת הוואטסאפ שתשלח:</span>
                <div className="text-slate-800 whitespace-pre-wrap font-sans bg-white p-2.5 rounded-xl border border-slate-200">
                  {`היי ${paymentPromptRequest.ownerName}, שמחנו לשוחח! 🐾🐶\nשמחים לעדכן שהמקום עבור *${paymentPromptRequest.dogName}* נשמר ${paymentPromptRequest.serviceType === 'training' ? `לתכנית אילוף בריזורט לכלב החל מתאריך ${paymentPromptRequest.startDate}` : `בריזורט לכלב בין התאריכים ${paymentPromptRequest.startDate} עד ${paymentPromptRequest.endDate}`}.${paymentAmount ? `\n💰 *הסכום שסוכם הוא:* ₪${paymentAmount}\n` : ''}\nלהשלמת השריון, מצורף הקישור המאובטח לתשלום${paymentAmount ? ` (יש להזין ₪${paymentAmount} בעמוד התשלום)` : ''}:\n👉 ${customPaymentLink}\n\n(בתוך הקישור ניתן לשלם בנוחות ב-Bit, Apple Pay, Google Pay או כרטיס אשראי)\n\n⏰ *נהלי שהות ושירות בסופ״ש וחגים:*\n• כניסה עד שעה 14:00 בשישי / ערב חג, והיציאה היא ביום ראשון / למחרת החג בשעה 09:30 (היציאה לא יכולה להיות ביום שבת).\n• בסוף שבוע אין שירות לקוחות, הצוות מתמקד בטיפול בכלבים בלבד. על הבעלים להתגבר ולהתאפק עד לחידוש שירות הלקוחות למחרת השבת / חג.\n\nבברכה חמה,\nצוות הריזורט לכלב 🐕🤍`}
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="p-3 sm:p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setPaymentPromptRequest(null)}
                className="bg-white hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl border border-slate-300 cursor-pointer shadow-2xs"
              >
                ביטול
              </button>
              <button
                type="button"
                disabled={isSendingPayment}
                onClick={handleConfirmSendPayment}
                className="bg-[#25D366] hover:bg-[#1EBE5D] active:scale-98 text-white font-black px-5 py-2 rounded-xl shadow-xs cursor-pointer flex items-center gap-2 transition-all"
              >
                <MessageCircle className="w-4 h-4" />
                <span>{isSendingPayment ? 'מעדכן ושולח...' : '📲 שלח עכשיו בוואטסאפ'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* REJECT WITH WHATSAPP SUB-MODAL */}
      {rejectPromptRequest && (
        <div className="fixed inset-0 z-70 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150" dir="rtl">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 bg-red-50/70 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-red-100 text-red-800 flex items-center justify-center font-black text-lg shadow-2xs">
                  💬
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900">
                    דחיית בקשת קליטה ושליחת הודעה ללקוח
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    עבור {rejectPromptRequest.ownerName} ({rejectPromptRequest.dogName}) · {rejectPromptRequest.ownerPhone}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRejectPromptRequest(null)}
                className="w-8 h-8 rounded-xl bg-white hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer border border-slate-200 shadow-2xs"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-5 space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-900 block flex items-center justify-between">
                  <span>נוסח הודעת הדחייה המנומסת (ניתן לערוך בחופשיות):</span>
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    שליחה ישירה לוואטסאפ
                  </span>
                </label>
                <textarea
                  rows={6}
                  value={rejectMessageText}
                  onChange={(e) => setRejectMessageText(e.target.value)}
                  className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 focus:border-red-400 rounded-xl p-3 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500/20 leading-relaxed font-sans"
                  placeholder="הזן נוסח הודעה..."
                />
              </div>

              <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-3 text-[11px] text-amber-900 space-y-1">
                <span className="font-bold block">💡 בחר כיצד להמשיך:</span>
                <p>
                  באפשרותך לדחות את הבקשה ולפתוח מיד הודעת וואטסאפ מנוסחת היטב ללקוח, או לדחות את הבקשה במערכת בלבד ללא יצירת קשר.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-3 sm:p-4 border-t border-slate-100 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setRejectPromptRequest(null)}
                className="bg-white hover:bg-slate-200 text-slate-700 font-bold px-3 py-2 rounded-xl border border-slate-300 cursor-pointer text-xs"
              >
                ביטול
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isProcessingReject}
                  onClick={handleConfirmRejectWithoutWhatsApp}
                  className="bg-white hover:bg-red-50 text-red-700 border border-red-200 font-bold px-3.5 py-2 rounded-xl text-xs cursor-pointer transition-colors shadow-2xs"
                  title="עדכן סטטוס לנדחה במערכת ללא פתיחת הודעת וואטסאפ"
                >
                  דחה בלבד (ללא הודעה)
                </button>

                <button
                  type="button"
                  disabled={isProcessingReject}
                  onClick={handleConfirmRejectWithWhatsApp}
                  className="bg-[#25D366] hover:bg-[#1EBE5D] active:scale-98 text-white font-black px-4 py-2 rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 text-xs transition-all"
                  title="עדכן לנדחה ופתח שיחת וואטסאפ עם ההודעה המנוסחת ללקוח"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>📲 דחה ושלח בוואטסאפ</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
