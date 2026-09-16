import React, { useState, useEffect, useMemo } from 'react';
import { 
  Sparkles, 
  CheckCircle, 
  X, 
  ArrowLeft, 
  CreditCard, 
  Phone, 
  Mail, 
  User, 
  ShieldCheck, 
  MessageCircle, 
  ExternalLink, 
  Search, 
  Dog, 
  Calendar, 
  Clock, 
  Link2, 
  Unlink, 
  RefreshCw,
  Check,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { GrowIncomingPayment, Booking, IntakeRequest, ResortSettings, ServiceType } from '../types';
import { cleanPhoneNumber, formatPhoneForWhatsApp, getServiceTypeHebrew } from '../utils/whatsappUtils';
import { formatDateIL } from '../utils/dateUtils';
import { WhatsAppChat, fetchGreenApiChats, formatFullMessageDateIL, extractPhoneFromChatId } from '../services/whatsappCrmService';

export interface LinkedPaymentDetails {
  ownerName: string;
  ownerPhone: string;
  ownerEmail?: string;
  dogName?: string;
  dogBreed?: string;
  serviceType?: ServiceType;
  startDate?: string;
  endDate?: string;
  specialNeeds?: string;
  notes?: string;
  source: 'whatsapp_chat' | 'intake_request' | 'existing_booking' | 'manual';
  sourceTitle: string;
  chatSnippet?: string;
  chatTimestamp?: number;
}

interface GrowPaymentsModalProps {
  pendingPayments: GrowIncomingPayment[];
  bookings?: Booking[];
  intakeRequests?: IntakeRequest[];
  settings?: ResortSettings;
  onAccept: (payment: GrowIncomingPayment, linkedDetails?: LinkedPaymentDetails) => void;
  onDismiss: (payment: GrowIncomingPayment) => void;
  onCloseLater: () => void;
  onOpenWhatsApp?: (phone: string) => void;
}

export const GrowPaymentsModal: React.FC<GrowPaymentsModalProps> = ({
  pendingPayments,
  bookings = [],
  intakeRequests = [],
  settings,
  onAccept,
  onDismiss,
  onCloseLater,
  onOpenWhatsApp,
}) => {
  if (!pendingPayments || pendingPayments.length === 0) return null;

  const current = pendingPayments[0]; // Process top/first payment
  const totalPending = pendingPayments.length;

  // Recent WhatsApp chats for linking
  const [waChats, setWaChats] = useState<WhatsAppChat[]>([]);
  const [isLoadingChats, setIsLoadingChats] = useState(false);

  // Manual search & override state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [manualOverride, setManualOverride] = useState<LinkedPaymentDetails | null | 'unlinked'>(null);

  // Fetch recent Green-API chats
  useEffect(() => {
    let isMounted = true;
    setIsLoadingChats(true);
    fetchGreenApiChats(settings)
      .then(chats => {
        if (isMounted) {
          setWaChats(chats || []);
        }
      })
      .catch(err => console.warn('Could not load chats for payment matcher:', err))
      .finally(() => {
        if (isMounted) setIsLoadingChats(false);
      });
    return () => {
      isMounted = false;
    };
  }, [settings?.greenApiIdInstance, settings?.greenApiToken]);

  // Reset override when the current payment changes
  useEffect(() => {
    setManualOverride(null);
    setIsSearchOpen(false);
    setSearchQuery('');
  }, [current.id]);

  // Clean current payment phone & name
  const payPhoneClean = cleanPhoneNumber(current.customer_phone || '');
  const payNameClean = (current.customer_name || '').trim().toLowerCase();

  // 1. Calculate best automatic match
  const autoMatch = useMemo<LinkedPaymentDetails | null>(() => {
    if (!current) return null;

    // A. Check Intake Requests first (highest data fidelity: dog name, breed, dates, notes)
    const matchedIntake = intakeRequests.find(req => {
      const reqPhone = cleanPhoneNumber(req.ownerPhone || '');
      if (payPhoneClean.length >= 7 && reqPhone.length >= 7) {
        if (reqPhone.includes(payPhoneClean) || payPhoneClean.includes(reqPhone) || reqPhone.slice(-7) === payPhoneClean.slice(-7)) {
          return true;
        }
      }
      return req.ownerName?.trim().toLowerCase() === payNameClean;
    });

    // B. Check active WhatsApp chats
    const matchedChat = waChats.find(chat => {
      const chatPhone = cleanPhoneNumber(extractPhoneFromChatId(chat.id));
      if (payPhoneClean.length >= 7 && chatPhone.length >= 7) {
        if (chatPhone.includes(payPhoneClean) || payPhoneClean.includes(chatPhone) || chatPhone.slice(-7) === payPhoneClean.slice(-7)) {
          return true;
        }
      }
      const chatName = (chat.name || '').trim().toLowerCase();
      if (payNameClean && chatName && (chatName.includes(payNameClean) || payNameClean.includes(chatName))) {
        return true;
      }
      return false;
    });

    // C. Check existing bookings / repeat customers
    const matchedBooking = bookings.find(b => {
      if (b.stayStatus === 'cancelled') return false;
      const bPhone = cleanPhoneNumber(b.ownerPhone || '');
      if (payPhoneClean.length >= 7 && bPhone.length >= 7) {
        if (bPhone.includes(payPhoneClean) || payPhoneClean.includes(bPhone) || bPhone.slice(-7) === payPhoneClean.slice(-7)) {
          return true;
        }
      }
      return b.ownerName?.trim().toLowerCase() === payNameClean;
    });

    // Combine into best linked details:
    if (matchedIntake) {
      return {
        ownerName: matchedIntake.ownerName || current.customer_name,
        ownerPhone: matchedIntake.ownerPhone || current.customer_phone || '',
        ownerEmail: matchedIntake.ownerEmail || current.customer_email || '',
        dogName: matchedIntake.dogName,
        dogBreed: matchedIntake.dogBreed,
        serviceType: matchedIntake.serviceType || 'boarding',
        startDate: matchedIntake.startDate,
        endDate: matchedIntake.endDate,
        specialNeeds: matchedIntake.specialNeeds,
        notes: matchedIntake.notes,
        source: 'intake_request',
        sourceTitle: 'שאלון קליטה תואם',
        chatSnippet: matchedChat?.lastMessage,
        chatTimestamp: matchedChat?.timestamp
      };
    }

    if (matchedChat) {
      return {
        ownerName: current.customer_name || matchedChat.name,
        ownerPhone: current.customer_phone || extractPhoneFromChatId(matchedChat.id),
        ownerEmail: current.customer_email,
        dogName: matchedBooking?.dogName,
        dogBreed: matchedBooking?.dogBreed,
        serviceType: matchedBooking?.serviceType || 'boarding',
        startDate: matchedBooking?.startDate,
        endDate: matchedBooking?.endDate,
        notes: `שיחת וואטסאפ: ${matchedChat.name}`,
        source: 'whatsapp_chat',
        sourceTitle: 'שיחת וואטסאפ פעילה',
        chatSnippet: matchedChat.lastMessage,
        chatTimestamp: matchedChat.timestamp
      };
    }

    if (matchedBooking) {
      return {
        ownerName: matchedBooking.ownerName || current.customer_name,
        ownerPhone: matchedBooking.ownerPhone || current.customer_phone || '',
        ownerEmail: matchedBooking.ownerEmail || current.customer_email,
        dogName: matchedBooking.dogName,
        dogBreed: matchedBooking.dogBreed,
        serviceType: matchedBooking.serviceType || 'boarding',
        source: 'existing_booking',
        sourceTitle: 'לקוח חוזר בריזורט',
        notes: `לקוח חוזר (כלב: ${matchedBooking.dogName})`
      };
    }

    return null;
  }, [current, intakeRequests, waChats, bookings, payPhoneClean, payNameClean]);

  // Active linked details (or null if unlinked)
  const activeLink: LinkedPaymentDetails | null = manualOverride === 'unlinked' 
    ? null 
    : (manualOverride || autoMatch);

  // Search results for manual override
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) {
      // Show top recent WhatsApp chats and intake requests
      const topChats = waChats.slice(0, 5).map(c => ({
        id: c.id,
        name: c.name || extractPhoneFromChatId(c.id),
        phone: extractPhoneFromChatId(c.id),
        type: 'whatsapp' as const,
        extra: c.lastMessage || 'שיחה בוואטסאפ',
        chat: c
      }));
      const topIntakes = intakeRequests.slice(0, 4).map(i => ({
        id: i.id,
        name: i.ownerName,
        phone: i.ownerPhone,
        type: 'intake' as const,
        extra: `כלב: ${i.dogName} (${i.dogBreed || ''})`,
        intake: i
      }));
      return [...topIntakes, ...topChats];
    }

    const q = searchQuery.trim().toLowerCase();
    const qPhone = cleanPhoneNumber(q);

    const filteredChats = waChats.filter(c => {
      const p = cleanPhoneNumber(extractPhoneFromChatId(c.id));
      const n = (c.name || '').toLowerCase();
      const m = (c.lastMessage || '').toLowerCase();
      return (qPhone && p.includes(qPhone)) || n.includes(q) || m.includes(q);
    }).slice(0, 5).map(c => ({
      id: c.id,
      name: c.name || extractPhoneFromChatId(c.id),
      phone: extractPhoneFromChatId(c.id),
      type: 'whatsapp' as const,
      extra: c.lastMessage || 'שיחה בוואטסאפ',
      chat: c
    }));

    const filteredIntakes = intakeRequests.filter(i => {
      const p = cleanPhoneNumber(i.ownerPhone);
      const n = (i.ownerName || '').toLowerCase();
      const d = (i.dogName || '').toLowerCase();
      return (qPhone && p.includes(qPhone)) || n.includes(q) || d.includes(q);
    }).slice(0, 5).map(i => ({
      id: i.id,
      name: i.ownerName,
      phone: i.ownerPhone,
      type: 'intake' as const,
      extra: `כלב: ${i.dogName} (${i.dogBreed || ''})`,
      intake: i
    }));

    const filteredBookings = bookings.filter(b => {
      const p = cleanPhoneNumber(b.ownerPhone);
      const n = (b.ownerName || '').toLowerCase();
      const d = (b.dogName || '').toLowerCase();
      return (qPhone && p.includes(qPhone)) || n.includes(q) || d.includes(q);
    }).slice(0, 5).map(b => ({
      id: b.id,
      name: b.ownerName,
      phone: b.ownerPhone,
      type: 'booking' as const,
      extra: `לקוח קיים | כלב: ${b.dogName} (${b.dogBreed || ''})`,
      booking: b
    }));

    return [...filteredIntakes, ...filteredChats, ...filteredBookings];
  }, [searchQuery, waChats, intakeRequests, bookings]);

  // Handle selecting a search result
  const handleSelectSearchResult = (item: any) => {
    if (item.type === 'intake') {
      const i: IntakeRequest = item.intake;
      setManualOverride({
        ownerName: i.ownerName,
        ownerPhone: i.ownerPhone,
        ownerEmail: i.ownerEmail,
        dogName: i.dogName,
        dogBreed: i.dogBreed,
        serviceType: i.serviceType || 'boarding',
        startDate: i.startDate,
        endDate: i.endDate,
        specialNeeds: i.specialNeeds,
        notes: i.notes,
        source: 'intake_request',
        sourceTitle: 'שאלון קליטה תואם'
      });
    } else if (item.type === 'whatsapp') {
      const c: WhatsAppChat = item.chat;
      setManualOverride({
        ownerName: c.name || current.customer_name,
        ownerPhone: extractPhoneFromChatId(c.id) || current.customer_phone || '',
        ownerEmail: current.customer_email,
        notes: `שיחת וואטסאפ: ${c.name}`,
        source: 'whatsapp_chat',
        sourceTitle: 'שיחת וואטסאפ מקושרת',
        chatSnippet: c.lastMessage,
        chatTimestamp: c.timestamp
      });
    } else if (item.type === 'booking') {
      const b: Booking = item.booking;
      setManualOverride({
        ownerName: b.ownerName,
        ownerPhone: b.ownerPhone,
        ownerEmail: b.ownerEmail,
        dogName: b.dogName,
        dogBreed: b.dogBreed,
        serviceType: b.serviceType,
        source: 'existing_booking',
        sourceTitle: 'לקוח חוזר מקושר',
        notes: `לקוח חוזר (כלב: ${b.dogName})`
      });
    }
    setIsSearchOpen(false);
  };

  // Open WhatsApp chat directly
  const handleOpenWhatsAppChat = (phone: string) => {
    if (onOpenWhatsApp) {
      onOpenWhatsApp(phone);
    } else {
      const waUrl = `https://wa.me/${formatPhoneForWhatsApp(phone)}`;
      window.open(waUrl, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-xs animate-in fade-in duration-300">
      <div 
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border-2 border-emerald-500 overflow-hidden flex flex-col my-auto animate-in zoom-in-95 duration-200 max-h-[92vh]"
        dir="rtl"
      >
        {/* Glowing Header with Close '✕' Button for later handling */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white p-5 sm:p-6 relative overflow-hidden shrink-0">
          {/* Subtle animated background glow */}
          <div className="absolute -top-10 -right-10 w-36 h-36 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-36 h-36 bg-amber-300/20 rounded-full blur-2xl pointer-events-none" />

          {/* Close button (top-left in RTL) */}
          <button
            type="button"
            onClick={onCloseLater}
            className="absolute top-4 left-4 w-9 h-9 rounded-xl bg-white/15 hover:bg-white/30 text-white flex items-center justify-center transition-all cursor-pointer z-20 border border-white/20 active:scale-95"
            title="סגור והשהה לטיפול מאוחר יותר (תופיע תזכורת מהבהבת)"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="relative z-10 flex items-start justify-between gap-3 pr-0 pl-10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner border border-white/30 text-2xl shrink-0">
                💳
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/50 text-[11px] font-extrabold text-emerald-100 border border-emerald-300/30 mb-1">
                  <Sparkles className="w-3 h-3 text-amber-300 animate-spin" />
                  <span>סונכרן אוטומטית מ-GROW (Gmail)</span>
                </div>
                <h3 className="text-lg sm:text-xl font-black text-white leading-tight">
                  התקבל תשלום חדש!
                </h3>
              </div>
            </div>

            {totalPending > 1 && (
              <span className="bg-amber-400 text-slate-900 font-extrabold text-xs px-2.5 py-1 rounded-full shadow-xs shrink-0">
                {totalPending} תשלומים ממתינים
              </span>
            )}
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-4 sm:p-6 space-y-3.5 overflow-y-auto max-h-[calc(92vh-180px)]">
          
          {/* Amount & Method Banner */}
          <div className="flex items-center justify-between bg-gradient-to-r from-emerald-50 to-teal-50/70 p-3.5 rounded-2xl border border-emerald-200/80 shadow-2xs">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <CreditCard className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-700 block">סכום ששולם:</span>
                <span className="text-[11px] text-slate-500">אמצעי: {current.payment_method || 'Bit'}</span>
              </div>
            </div>
            <div className="text-2xl font-black text-emerald-700 tracking-tight">
              ₪{current.amount.toLocaleString()}
            </div>
          </div>

          {/* Raw Payer Details from Grow */}
          <div className="bg-slate-50/90 rounded-2xl p-3 border border-slate-200/80 text-xs space-y-2">
            <div className="text-[11px] font-bold text-slate-500 flex items-center justify-between">
              <span>פרטי המשלם כפי שהתקבלו מ-GROW:</span>
              <span className="text-[10px] text-slate-400 font-mono">
                {new Date(current.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-100">
                <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <div className="overflow-hidden">
                  <span className="text-slate-400 block text-[10px]">שם:</span>
                  <span className="font-bold text-slate-800 truncate block text-xs">{current.customer_name}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-100">
                <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <div className="overflow-hidden">
                  <span className="text-slate-400 block text-[10px]">טלפון:</span>
                  <span className="font-bold text-slate-800 font-mono block text-xs">{current.customer_phone}</span>
                </div>
              </div>

              {current.customer_email && (
                <div className="sm:col-span-2 flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-100">
                  <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <div className="overflow-hidden">
                    <span className="text-slate-400 block text-[10px]">אימייל:</span>
                    <span className="font-bold text-slate-800 truncate block text-xs">{current.customer_email}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between pt-0.5 px-1">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                אסמכתא: {current.reference_id}
              </span>
            </div>
          </div>

          {/* Smart Recommendation & Linking Section */}
          <div className="rounded-2xl border-2 border-teal-500/40 bg-teal-50/40 p-3.5 space-y-2.5 transition-all">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-base">✨</span>
                <span className="text-xs font-black text-teal-950">המלצת קישור ללקוח / שיחה:</span>
              </div>

              <button
                type="button"
                onClick={() => setIsSearchOpen(prev => !prev)}
                className="text-[11px] font-bold text-teal-700 hover:text-teal-900 bg-white hover:bg-teal-100/70 border border-teal-200 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Search className="w-3 h-3" />
                <span>{isSearchOpen ? 'סגור חיפוש' : (activeLink ? 'שייך לאחר / חפש' : 'חפש לקוח לקישור')}</span>
              </button>
            </div>

            {/* If linked to a client / WhatsApp conversation */}
            {activeLink ? (
              <div className="bg-white rounded-xl p-3 border border-teal-200 shadow-2xs space-y-2 animate-in fade-in duration-150">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-black text-slate-800 text-sm">{activeLink.ownerName}</span>
                      <span className="bg-teal-100 text-teal-800 font-extrabold text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Check className="w-2.5 h-2.5" />
                        <span>{activeLink.sourceTitle}</span>
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 font-mono block">{activeLink.ownerPhone}</span>
                  </div>

                  {/* Direct WhatsApp chat button */}
                  {activeLink.ownerPhone && (
                    <button
                      type="button"
                      onClick={() => handleOpenWhatsAppChat(activeLink.ownerPhone)}
                      className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-2xs active:scale-95"
                      title="פתח שיחת וואטסאפ עם לקוח זה לבדיקת ההתכתבות"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                      <span>פתח שיחה</span>
                      <ExternalLink className="w-2.5 h-2.5 text-emerald-500" />
                    </button>
                  )}
                </div>

                {/* Dog & Service preview if detected from intake / booking */}
                {(activeLink.dogName || activeLink.serviceType || activeLink.startDate) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 text-[11px] bg-slate-50 p-2 rounded-lg border border-slate-100">
                    {activeLink.dogName && (
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <Dog className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span className="font-bold">כלב: {activeLink.dogName}</span>
                        {activeLink.dogBreed && <span className="text-slate-500">({activeLink.dogBreed})</span>}
                      </div>
                    )}
                    {activeLink.serviceType && (
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <Calendar className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                        <span>{getServiceTypeHebrew(activeLink.serviceType)}</span>
                        {activeLink.startDate && activeLink.endDate && (
                          <span className="text-slate-500 font-mono text-[10px]">
                            ({formatDateIL(activeLink.startDate)} - {formatDateIL(activeLink.endDate)})
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* WhatsApp message quote if available */}
                {activeLink.chatSnippet && (
                  <div className="bg-emerald-50/70 border-r-2 border-emerald-500 p-2 rounded-md text-[11px] text-slate-700">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                      <span className="flex items-center gap-1">
                        <MessageCircle className="w-3 h-3 text-emerald-600" />
                        הודעה אחרונה בוואטסאפ:
                      </span>
                      {activeLink.chatTimestamp && (
                        <span>{formatFullMessageDateIL(activeLink.chatTimestamp)}</span>
                      )}
                    </div>
                    <p className="italic font-medium line-clamp-2 text-slate-800">
                      "{activeLink.chatSnippet}"
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1 text-[10px] text-teal-700">
                  <span className="font-bold flex items-center gap-1">
                    ✓ פרטי הלקוח והכלב ייטענו אוטומטית להקמת ההזמנה
                  </span>
                  <button
                    type="button"
                    onClick={() => setManualOverride('unlinked')}
                    className="text-slate-400 hover:text-rose-600 underline cursor-pointer"
                  >
                    הסר שיוך
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white/80 rounded-xl p-3 border border-slate-200 text-center text-xs text-slate-600 space-y-1.5">
                <p>לא זוהה קישור אוטומטי מובהק לפי טלפון או שם.</p>
                <p className="text-[11px] text-slate-400">
                  האם התשלום שייך למישהו שהתכתב איתך בוואטסאפ או מילא שאלון?
                </p>
                <button
                  type="button"
                  onClick={() => setIsSearchOpen(true)}
                  className="bg-teal-600 hover:bg-teal-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>חפש שיחה או לקוח לשיוך</span>
                </button>
              </div>
            )}

            {/* Expandable Manual Link Search Drawer */}
            {isSearchOpen && (
              <div className="bg-white rounded-xl p-3 border border-teal-300 shadow-sm space-y-2 animate-in fade-in duration-200">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="חפש לפי שם לקוח, טלפון, שם כלב או תוכן הודעה..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pr-8 pl-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-teal-500 focus:bg-white"
                    autoFocus
                  />
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1 divide-y divide-slate-100 text-xs">
                  {searchResults.length === 0 ? (
                    <div className="text-center py-3 text-slate-400 text-[11px]">
                      לא נמצאו תוצאות תואמות לחיפוש
                    </div>
                  ) : (
                    searchResults.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => handleSelectSearchResult(item)}
                        className="p-2 hover:bg-teal-50/70 rounded-lg transition-colors cursor-pointer flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-800 truncate">{item.name}</span>
                            <span className={`text-[9px] font-black px-1.5 py-0.2 rounded-full ${
                              item.type === 'intake' 
                                ? 'bg-amber-100 text-amber-800' 
                                : item.type === 'whatsapp' 
                                ? 'bg-emerald-100 text-emerald-800' 
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {item.type === 'intake' ? 'שאלון קליטה' : item.type === 'whatsapp' ? 'שיחת וואטסאפ' : 'לקוח קיים'}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">{item.phone}</div>
                          <div className="text-[10px] text-slate-600 truncate mt-0.5">{item.extra}</div>
                        </div>

                        <button
                          type="button"
                          className="bg-teal-600 hover:bg-teal-700 text-white text-[10px] font-bold px-2 py-1 rounded-md shrink-0 cursor-pointer"
                        >
                          קשר לתשלום
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 text-center leading-relaxed">
            💡 <strong>הקמת הזמנה מהירה:</strong> לחיצה על הכפתור הירוק תעביר אותך לוויזארד עם כל הפרטים המשויכים מוכנים לשמירה.
          </div>
        </div>

        {/* Modal Action Buttons (Footer) */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => onDismiss(current)}
              className="w-1/2 sm:w-auto px-3 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-xs font-semibold text-slate-600 transition-colors cursor-pointer text-center"
              title="סמן כטופל ידנית והסר מרשימת התשלומים הממתינים"
            >
              התעלם / טופל ידנית
            </button>

            <button
              type="button"
              onClick={onCloseLater}
              className="w-1/2 sm:w-auto px-3 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1"
              title="סגור את החלון כעת כדי להמשיך לעבוד. תישאר תזכורת מהבהבת בסרגל ובפינת המסך"
            >
              <span>טפל מאוחר יותר ⏳</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => onAccept(current, activeLink || undefined)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white px-6 py-3 rounded-xl font-black text-sm shadow-md hover:shadow-lg transition-all cursor-pointer transform active:scale-98"
          >
            <span>הקם והשלם הזמנה עכשיו</span>
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
