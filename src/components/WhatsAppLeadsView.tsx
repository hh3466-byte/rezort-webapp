import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  Search, 
  Send, 
  Phone, 
  ExternalLink, 
  Calendar, 
  User, 
  Dog, 
  RotateCcw, 
  Check, 
  Clock, 
  Mic, 
  MicOff, 
  MapPin, 
  CreditCard, 
  FileText, 
  Sparkles,
  AlertCircle,
  PlusCircle,
  Filter,
  X,
  PenTool
} from 'lucide-react';
import { Booking, IntakeRequest, ResortSettings } from '../types';
import { cleanPhoneNumber, getFirstName } from '../utils/whatsappUtils';
import { 
  WhatsAppChat, 
  WhatsAppMessage, 
  EnrichedWhatsAppChat, 
  fetchGreenApiChats, 
  fetchGreenApiChatHistory, 
  sendGreenApiChatMessage, 
  enrichChatWithSystemData,
  formatFullMessageDateIL,
  extractSelfIdentifiedName
} from '../services/whatsappCrmService';

export const CRM_PRIORITY_ORDER: Record<'new' | 'needs_treatment' | 'handled', number> = {
  'new': 1,
  'needs_treatment': 2,
  'handled': 3
};

interface WhatsAppLeadsViewProps {
  bookings: Booking[];
  intakeRequests: IntakeRequest[];
  settings: ResortSettings;
  onOpenNewBookingWithData?: (data: { ownerName: string; ownerPhone: string; dogName?: string }) => void;
}

export const WhatsAppLeadsView: React.FC<WhatsAppLeadsViewProps> = ({
  bookings,
  intakeRequests,
  settings,
  onOpenNewBookingWithData
}) => {
  const [chats, setChats] = useState<EnrichedWhatsAppChat[]>([]);
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [chatsError, setChatsError] = useState<string | null>(null);

  const [selectedChat, setSelectedChat] = useState<EnrichedWhatsAppChat | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'new' | 'needs_treatment' | 'handled'>('new');
  
  // Status Overrides per phone (סדר חשיבות מובהק: חדשים -> נדרש טיפול -> טופל)
  const [statusOverrides, setStatusOverrides] = useState<Record<string, 'new' | 'needs_treatment' | 'handled'>>(() => {
    try {
      const raw = localStorage.getItem('crm_status_overrides');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  // Name Overrides per phone (שם לקוח אמיתי לאחר שהזדהה)
  const [nameOverrides, setNameOverrides] = useState<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem('crm_name_overrides');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const updateChatName = (phone: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setNameOverrides(prev => {
      const updated = { ...prev, [phone]: trimmed };
      try {
        localStorage.setItem('crm_name_overrides', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    setChats(prev => prev.map(c => (c.cleanPhone === phone || c.id.includes(phone)) ? { ...c, name: trimmed, isCustomName: true } : c));
    if (selectedChat && (selectedChat.cleanPhone === phone || selectedChat.id.includes(phone))) {
      setSelectedChat(prev => prev ? { ...prev, name: trimmed, isCustomName: true } : null);
    }
  };

  const updateChatStatus = (phone: string, newStatus: 'new' | 'needs_treatment' | 'handled') => {
    setStatusOverrides(prev => {
      const updated = { ...prev, [phone]: newStatus };
      try {
        localStorage.setItem('crm_status_overrides', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    // If marked handled, clear unread count locally for smooth UX
    if (newStatus === 'handled') {
      setChats(prev => prev.map(c => c.cleanPhone === phone ? { ...c, unreadCount: 0 } : c));
    }
  };

  // Cycle status on card click: חדש -> לטיפול -> טופל -> חדש
  const cycleChatStatus = (chat: EnrichedWhatsAppChat, e: React.MouseEvent) => {
    e.stopPropagation();
    const current = getChatTreatmentStatus(chat);
    const nextMap: Record<'new' | 'needs_treatment' | 'handled', 'new' | 'needs_treatment' | 'handled'> = {
      'new': 'needs_treatment',
      'needs_treatment': 'handled',
      'handled': 'new'
    };
    updateChatStatus(chat.cleanPhone, nextMap[current]);
  };

  const getChatTreatmentStatus = (chat: EnrichedWhatsAppChat): 'new' | 'needs_treatment' | 'handled' => {
    // 1. לקוח שמילא שאלון קליטה -> חד משמעית בסטטוס "לטיפול" (אלא אם אושר ביומן או סומן ידנית כטופל)
    if (chat.classification === 'intake_submitted') {
      if (statusOverrides[chat.cleanPhone] === 'handled' || chat.matchedIntake?.status === 'approved') {
        return 'handled';
      }
      return 'needs_treatment';
    }

    // 2. לקוח שיש לו הזמנה קיימת ביומן -> תמיד טופל (handled)
    if (chat.classification === 'customer_with_booking') {
      if (statusOverrides[chat.cleanPhone] === 'needs_treatment') return 'needs_treatment';
      return 'handled';
    }

    // 3. קביעה ידנית של המשתמש בעלת עדיפות לשאר הפניות
    if (statusOverrides[chat.cleanPhone]) {
      return statusOverrides[chat.cleanPhone];
    }

    // 4. פנייה חדשה שיש בה הודעה שלא נקראה -> חדש (חשיבות 1)
    if (chat.unreadCount && chat.unreadCount > 0) return 'new';

    // 5. ברירת מחדל לפנייה חדשה -> חדש
    if (chat.classification === 'new_lead') return 'new';

    return 'new';
  };

  const [messageInput, setMessageInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendSuccessToast, setSendSuccessToast] = useState(false);
  const [confirmResendModal, setConfirmResendModal] = useState(false);

  // Voice dictation
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Messages auto-scroll container ref
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 1. Fetch chats on load & sort immediately by Priority Order
  const loadChats = async () => {
    setIsLoadingChats(true);
    setChatsError(null);
    try {
      const raw = await fetchGreenApiChats(settings);
      const enriched = raw.map(c => enrichChatWithSystemData(c, bookings, intakeRequests, nameOverrides));
      
      const sorted = [...enriched].sort((a, b) => {
        const statusA = getChatTreatmentStatus(a);
        const statusB = getChatTreatmentStatus(b);
        if (CRM_PRIORITY_ORDER[statusA] !== CRM_PRIORITY_ORDER[statusB]) {
          return CRM_PRIORITY_ORDER[statusA] - CRM_PRIORITY_ORDER[statusB];
        }
        const unreadA = a.unreadCount || 0;
        const unreadB = b.unreadCount || 0;
        if (unreadA !== unreadB) return unreadB - unreadA;
        return (b.timestamp || 0) - (a.timestamp || 0);
      });

      setChats(sorted);
      if (sorted.length > 0 && !selectedChat) {
        setSelectedChat(sorted[0]);
      }
    } catch (err: any) {
      console.warn('Error loading Green-API chats:', err);
      setChatsError('לא ניתן לטעון שיחות כרגע. אנא ודא חיבור אינטרנט או בדוק את הגדרות Green-API.');
    } finally {
      setIsLoadingChats(false);
    }
  };

  useEffect(() => {
    loadChats();
  }, [settings?.greenApiIdInstance, settings?.greenApiToken]);

  // Re-enrich chats whenever bookings, intakeRequests or nameOverrides change
  useEffect(() => {
    if (chats.length > 0) {
      setChats(prev => prev.map(c => enrichChatWithSystemData(c, bookings, intakeRequests, nameOverrides)));
    }
  }, [bookings, intakeRequests, nameOverrides]);

  // Inline editing state for contact name
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');

  // Detect self-identified name from incoming messages
  const detectedSenderName = React.useMemo(() => {
    if (!selectedChat || messages.length === 0) return null;
    if (selectedChat.isCustomName) return null;

    for (const msg of messages) {
      if (msg.type === 'incoming') {
        const found = extractSelfIdentifiedName(msg.textMessage);
        if (found && found.toLowerCase() !== selectedChat.name.toLowerCase()) {
          return found;
        }
      }
    }
    return null;
  }, [selectedChat, messages]);

  // 2. Fetch messages when selected chat changes
  const loadChatMessages = async (chat: EnrichedWhatsAppChat) => {
    setIsLoadingMessages(true);
    // Mark as read locally in chat list for seamless feedback
    setChats(prev => prev.map(c => c.id === chat.id ? { ...c, unreadCount: 0 } : c));
    try {
      const msgs = await fetchGreenApiChatHistory(chat.id, 50, settings);
      setMessages(msgs);
      setTimeout(scrollToBottom, 100);
    } catch (err) {
      console.warn('Error fetching messages for chat:', chat.id, err);
      setMessages([]);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (selectedChat) {
      loadChatMessages(selectedChat);
    }
  }, [selectedChat?.id]);

  // 3. Send text message
  const handleSendMessage = async (customText?: string) => {
    const textToSend = (customText !== undefined ? customText : messageInput).trim();
    if (!textToSend || !selectedChat || isSending) return;

    setIsSending(true);
    try {
      await sendGreenApiChatMessage(selectedChat.id, textToSend, settings);

      // Optimistically append outgoing message to chat
      const newMsg: WhatsAppMessage = {
        idMessage: String(Date.now()),
        type: 'outgoing',
        timestamp: Date.now(),
        textMessage: textToSend
      };
      setMessages(prev => [...prev, newMsg]);
      setMessageInput('');
      setSendSuccessToast(true);
      setTimeout(() => setSendSuccessToast(false), 2500);
      setTimeout(scrollToBottom, 50);
    } catch (err) {
      console.error('Failed to send message:', err);
      alert('שליחת ההודעה נכשלה. אנא נסה שוב או פתח את השיחה בוואטסאפ ווב.');
    } finally {
      setIsSending(false);
    }
  };

  // 4. Voice dictation (SpeechRecognition)
  const toggleVoiceDictation = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('זיהוי קולי אינו נתמך בדפדפן זה. מומלץ להשתמש ב-Google Chrome או Microsoft Edge.');
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
      setIsListening(false);
      return;
    }

    try {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = false;
      rec.lang = 'he-IL';

      rec.onstart = () => setIsListening(true);
      rec.onresult = (e: any) => {
        let chunk = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) {
            chunk += e.results[i][0].transcript + ' ';
          }
        }
        if (chunk.trim()) {
          setMessageInput(prev => prev ? `${prev} ${chunk.trim()}` : chunk.trim());
        }
      };
      rec.onerror = () => setIsListening(false);
      rec.onend = () => setIsListening(false);

      recognitionRef.current = rec;
      rec.start();
    } catch (err) {
      setIsListening(false);
    }
  };

  // 5. Filter, Search and Strict Priority Sorting:
  // סדר חשיבות מובהק: 1. חדשים -> 2. נדרש טיפול -> 3. טופל
  const filteredChats = chats
    .filter(chat => {
      const status = getChatTreatmentStatus(chat);
      if (filter === 'new' && status !== 'new') return false;
      if (filter === 'needs_treatment' && status !== 'needs_treatment') return false;
      if (filter === 'handled' && status !== 'handled') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = chat.name.toLowerCase().includes(q);
        const matchPhone = chat.cleanPhone.includes(q);
        const matchDog = (chat.matchedDogName || '').toLowerCase().includes(q);
        return matchName || matchPhone || matchDog;
      }
      return true;
    })
    .sort((a, b) => {
      const statusA = getChatTreatmentStatus(a);
      const statusB = getChatTreatmentStatus(b);

      // 1. מיון לפי סדר חשיבות מבוקש (חדשים -> נדרש טיפול -> טופל)
      if (CRM_PRIORITY_ORDER[statusA] !== CRM_PRIORITY_ORDER[statusB]) {
        return CRM_PRIORITY_ORDER[statusA] - CRM_PRIORITY_ORDER[statusB];
      }

      // 2. הודעות שלא נקראו קודמות בתוך אותה קבוצה
      const unreadA = a.unreadCount || 0;
      const unreadB = b.unreadCount || 0;
      if (unreadA !== unreadB) {
        return unreadB - unreadA;
      }

      // 3. לפי עדכניות ההודעה
      return (b.timestamp || 0) - (a.timestamp || 0);
    });

  // Count metrics for Priority Tabs & Groups
  const newCount = chats.filter(c => getChatTreatmentStatus(c) === 'new').length;
  const needsTreatmentCount = chats.filter(c => getChatTreatmentStatus(c) === 'needs_treatment').length;
  const handledCount = chats.filter(c => getChatTreatmentStatus(c) === 'handled').length;

  const newChats = filteredChats.filter(c => getChatTreatmentStatus(c) === 'new');
  const needsTreatmentChats = filteredChats.filter(c => getChatTreatmentStatus(c) === 'needs_treatment');
  const handledChats = filteredChats.filter(c => getChatTreatmentStatus(c) === 'handled');

  // Render individual chat list item
  const renderChatCard = (chat: EnrichedWhatsAppChat) => {
    const isSelected = selectedChat?.id === chat.id;
    const status = getChatTreatmentStatus(chat);

    return (
      <div
        key={chat.id}
        onClick={() => setSelectedChat(chat)}
        className={`p-3 transition-all cursor-pointer flex items-start gap-3 select-none ${
          isSelected
            ? 'bg-emerald-50/90 border-r-4 border-r-emerald-600'
            : 'hover:bg-slate-50'
        }`}
      >
        {/* Status Circle Avatar with Priority Ring */}
        <div className="relative shrink-0 mt-0.5">
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm shadow-2xs ${
            status === 'new'
              ? 'bg-rose-100 text-rose-800 border-2 border-rose-300'
              : status === 'needs_treatment'
              ? 'bg-amber-100 text-amber-900 border-2 border-amber-300'
              : 'bg-emerald-100 text-emerald-800 border-2 border-emerald-300'
          }`}>
            {chat.matchedDogName ? '🐕' : '👤'}
          </div>
          <span className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white shadow-2xs ${
            status === 'new' ? 'bg-rose-500' :
            status === 'needs_treatment' ? 'bg-amber-500' : 'bg-emerald-500'
          }`} />
        </div>

        {/* Chat Text Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <div className="min-w-0 flex-1">
              <h4 className="text-xs sm:text-sm font-black text-slate-900 truncate">
                {chat.name}
              </h4>
              {chat.whatsappPushName && chat.whatsappPushName !== chat.name && (
                <span className="text-[10px] text-slate-400 block truncate" title={`כינוי בוואטסאפ: ${chat.whatsappPushName}`}>
                  בוואטסאפ: {chat.whatsappPushName}
                </span>
              )}
            </div>
            {chat.unreadCount && chat.unreadCount > 0 ? (
              <span className="bg-rose-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full shadow-2xs shrink-0 animate-pulse">
                {chat.unreadCount}
              </span>
            ) : null}
          </div>

          {/* Phone & Dog pill */}
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="text-[11px] font-mono text-slate-500" dir="ltr">
              {chat.cleanPhone}
            </span>
            {chat.matchedDogName && (
              <span className="text-[10px] font-black bg-amber-50 text-amber-900 border border-amber-200 px-1.5 py-0.2 rounded-md truncate max-w-[120px]">
                🐾 {chat.matchedDogName}
              </span>
            )}
          </div>

          {/* Timestamp: Day of week, DD/MM, HH:MM */}
          <div className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5 mt-1.5 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 w-fit shadow-2xs">
            <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span>{formatFullMessageDateIL(chat.timestamp || Date.now())}</span>
          </div>

          {/* Priority Treatment Badge (Interactive 1-click cycle!) */}
          <div className="mt-1.5 flex items-center justify-between gap-1 flex-wrap">
            <button
              type="button"
              onClick={(e) => cycleChatStatus(chat, e)}
              title={
                status === 'new'
                  ? 'פנייה חדשה. לחץ להעברה ל-🟡 לטיפול'
                  : status === 'needs_treatment'
                  ? 'בטיפול. לחץ להעברה ל-🟢 טופל'
                  : 'טופל. לחץ להחזרה ל-🔴 חדש'
              }
              className={`text-[10px] font-black px-2 py-0.5 rounded-md inline-flex items-center gap-1 border transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-2xs ${
                status === 'new'
                  ? 'bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-200'
                  : status === 'needs_treatment'
                  ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                  : 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200'
              }`}
            >
              {status === 'new' ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse"></span>
                  <span>🔴 חדש</span>
                </>
              ) : status === 'needs_treatment' ? (
                <>
                  <span>🟡 לטיפול</span>
                </>
              ) : (
                <>
                  <span>🟢 טופל</span>
                </>
              )}
              <span className="text-[8px] text-slate-400 mr-0.5 font-sans">↺</span>
            </button>

            <div className="flex items-center gap-1">
              {chat.classification === 'intake_submitted' && (
                <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-200">
                  📋 שאלון
                </span>
              )}
              {chat.classification === 'customer_with_booking' && (
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200">
                  📅 ביומן
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-slate-100 rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-140px)] min-h-[580px]" dir="rtl">
      
      {/* Top Bar / Status */}
      <div className="bg-white px-4 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5 shadow-2xs shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black text-lg shadow-2xs shrink-0">
            💬
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2 flex-wrap">
              <span>מרכז וואטסאפ ופניות (CRM)</span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-300 shrink-0">
                Green-API מחובר 🟢
              </span>
            </h2>
            <p className="text-[11px] text-slate-500 font-medium truncate hidden sm:block">
              ניהול שיחות וואטסאפ, סדר חשיבות וזיהוי לקוחות מהיר
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={loadChats}
            disabled={isLoadingChats}
            className="bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer border border-slate-200 shadow-2xs"
            title="רענן רשימת שיחות"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isLoadingChats ? 'animate-spin text-emerald-600' : ''}`} />
            <span>{isLoadingChats ? 'מרענן...' : 'רענן'}</span>
          </button>
        </div>
      </div>

      {/* Main Two-Pane Splitter */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT COLUMN: Chats & Leads List (Sidebar) */}
        <div className="w-full sm:w-88 md:w-[380px] lg:w-[410px] bg-white border-l border-slate-200 flex flex-col shrink-0">
          
          {/* Search Bar */}
          <div className="p-3 border-b border-slate-100 bg-slate-50/70 space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="חפש לפי שם, כלב או טלפון..."
                className="w-full bg-white border border-slate-200 focus:border-emerald-500 rounded-xl pr-9 pl-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-2xs"
              />
            </div>

            {/* Classification Filter Tabs - 4 equal columns by Priority order */}
            <div className="grid grid-cols-4 gap-1 pt-0.5">
              {[
                { id: 'all', label: 'הכל', count: chats.length },
                { id: 'new', label: '🔴 חדשים', count: newCount },
                { id: 'needs_treatment', label: '🟡 לטיפול', count: needsTreatmentCount },
                { id: 'handled', label: '🟢 טופל', count: handledCount },
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id as any)}
                  className={`py-1.5 px-1 rounded-xl text-[11px] font-black transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1 shrink-0 ${
                    filter === tab.id
                      ? 'bg-[#065f46] text-white shadow-2xs'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  <span className="truncate">{tab.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${filter === tab.id ? 'bg-emerald-800 text-white' : 'bg-slate-100 text-slate-700'}`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Chats Scroll List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {isLoadingChats && chats.length === 0 ? (
              <div className="p-8 text-center space-y-2 text-slate-400">
                <RotateCcw className="w-6 h-6 animate-spin mx-auto text-emerald-600" />
                <p className="text-xs font-bold">טוען שיחות מוואטסאפ...</p>
              </div>
            ) : chatsError ? (
              <div className="p-4 m-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-bold text-center">
                {chatsError}
              </div>
            ) : filteredChats.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs font-medium">
                לא נמצאו שיחות התואמות את הסינון
              </div>
            ) : filter === 'all' ? (
              /* Divided strictly into 3 Priority Sections: חדשים -> נדרש טיפול -> טופל */
              <div>
                {/* 1. חדשים (Priority 1) */}
                {newChats.length > 0 && (
                  <div>
                    <div className="sticky top-0 z-10 bg-rose-50/95 backdrop-blur-xs px-3 py-1.5 border-y border-rose-200 flex items-center justify-between shadow-2xs">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse"></span>
                        <span className="text-xs font-black text-rose-950">🔴 פניות חדשות ({newChats.length})</span>
                      </div>
                      <span className="text-[10px] text-rose-700 font-bold">חשיבות 1</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {newChats.map(renderChatCard)}
                    </div>
                  </div>
                )}

                {/* 2. נדרש טיפול (Priority 2) */}
                {needsTreatmentChats.length > 0 && (
                  <div>
                    <div className="sticky top-0 z-10 bg-amber-50/95 backdrop-blur-xs px-3 py-1.5 border-y border-amber-200 flex items-center justify-between shadow-2xs">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        <span className="text-xs font-black text-amber-950">🟡 נדרש טיפול ({needsTreatmentChats.length})</span>
                      </div>
                      <span className="text-[10px] text-amber-700 font-bold">חשיבות 2</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {needsTreatmentChats.map(renderChatCard)}
                    </div>
                  </div>
                )}

                {/* 3. טופל (Priority 3) */}
                {handledChats.length > 0 && (
                  <div>
                    <div className="sticky top-0 z-10 bg-emerald-50/95 backdrop-blur-xs px-3 py-1.5 border-y border-emerald-200 flex items-center justify-between shadow-2xs">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                        <span className="text-xs font-black text-emerald-950">🟢 טופל ({handledChats.length})</span>
                      </div>
                      <span className="text-[10px] text-emerald-700 font-bold">חשיבות 3</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {handledChats.map(renderChatCard)}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredChats.map(renderChatCard)}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Chat Conversation & Quick Actions */}
        <div className="flex-1 bg-slate-50/50 flex flex-col min-w-0">
          {selectedChat ? (
            <>
              {/* Active Chat Header */}
              <div className="bg-white px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5 shadow-2xs shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-lg shadow-2xs shrink-0 ${
                    selectedChat.classification === 'customer_with_booking'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : selectedChat.classification === 'intake_submitted'
                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                      : 'bg-slate-100 text-slate-700 border border-slate-200'
                  }`}>
                    {selectedChat.matchedDogName ? '🐕' : '👤'}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isEditingName ? (
                        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-emerald-300">
                          <input
                            type="text"
                            value={editNameValue}
                            onChange={(e) => setEditNameValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                updateChatName(selectedChat.cleanPhone, editNameValue);
                                setIsEditingName(false);
                              }
                              if (e.key === 'Escape') setIsEditingName(false);
                            }}
                            className="bg-white border border-slate-300 rounded-lg px-2 py-0.5 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 w-44"
                            placeholder="הזן שם לקוח אמיתי..."
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => {
                              updateChatName(selectedChat.cleanPhone, editNameValue);
                              setIsEditingName(false);
                            }}
                            className="bg-emerald-600 text-white p-1 rounded-lg hover:bg-emerald-700 cursor-pointer"
                            title="שמור שם לקוח"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsEditingName(false)}
                            className="bg-slate-200 text-slate-700 p-1 rounded-lg hover:bg-slate-300 cursor-pointer"
                            title="ביטול"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-base font-black text-slate-900 truncate">
                            {selectedChat.name}
                          </h3>
                          <button
                            type="button"
                            onClick={() => {
                              setEditNameValue(selectedChat.name);
                              setIsEditingName(true);
                            }}
                            className="text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 p-1 rounded-lg transition-colors cursor-pointer"
                            title="ערוך שם לקוח (שנה כינוי וואטסאפ לשם אמיתי)"
                          >
                            <PenTool className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {selectedChat.whatsappPushName && selectedChat.whatsappPushName !== selectedChat.name && (
                        <span className="text-[11px] font-medium text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg shrink-0">
                          כינוי בוואטסאפ: {selectedChat.whatsappPushName}
                        </span>
                      )}

                      {selectedChat.matchedDogName && (
                        <span className="bg-amber-100 text-amber-900 border border-amber-300 text-xs font-black px-2.5 py-0.5 rounded-lg">
                          הכלב: {selectedChat.matchedDogName}
                        </span>
                      )}
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                        selectedChat.classification === 'customer_with_booking'
                          ? 'bg-emerald-100 text-emerald-800'
                          : selectedChat.classification === 'intake_submitted'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {selectedChat.classification === 'customer_with_booking' ? '🟢 לקוח פעיל ביומן' :
                         selectedChat.classification === 'intake_submitted' ? '🟡 מילא שאלון קליטה' : '⚪ פנייה בוואטסאפ'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                      <span className="font-mono font-bold" dir="ltr">{selectedChat.cleanPhone}</span>
                      {selectedChat.timestamp && (
                        <>
                          <span className="text-slate-300">•</span>
                          <span className="flex items-center gap-1 font-bold text-slate-600">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>מועד אחרון: {formatFullMessageDateIL(selectedChat.timestamp)}</span>
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Header Action Buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Direct SIM Call */}
                  <a
                    href={`tel:${cleanPhoneNumber(selectedChat.cleanPhone)}`}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 shadow-2xs transition-all"
                    title="חיוג סלולרי רגיל"
                  >
                    <Phone className="w-3.5 h-3.5 text-slate-600" />
                    <span>חיוג</span>
                  </a>

                  {/* Open in WhatsApp Web / App */}
                  <a
                    href={`https://wa.me/972${cleanPhoneNumber(selectedChat.cleanPhone).replace(/^0+/, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-[#25D366] hover:bg-[#1EBE5D] text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 shadow-2xs transition-all"
                    title="פתח שיחה בוואטסאפ ווב"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>וואטסאפ</span>
                  </a>

                  {/* Priority Status Changer for Shmulik */}
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => updateChatStatus(selectedChat.cleanPhone, 'new')}
                      className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                        getChatTreatmentStatus(selectedChat) === 'new'
                          ? 'bg-rose-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="סמן כפנייה חדשה (בראש הרשימה)"
                    >
                      🔴 חדש
                    </button>
                    <button
                      type="button"
                      onClick={() => updateChatStatus(selectedChat.cleanPhone, 'needs_treatment')}
                      className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                        getChatTreatmentStatus(selectedChat) === 'needs_treatment'
                          ? 'bg-amber-500 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="סמן כדורש טיפול"
                    >
                      🟡 לטיפול
                    </button>
                    <button
                      type="button"
                      onClick={() => updateChatStatus(selectedChat.cleanPhone, 'handled')}
                      className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                        getChatTreatmentStatus(selectedChat) === 'handled'
                          ? 'bg-emerald-700 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="סמן כטופל (מעביר לתחתית הרשימה)"
                    >
                      🟢 טופל
                    </button>
                  </div>

                  {/* "קלוט להזמנה ביומן" */}
                  {onOpenNewBookingWithData && (
                    <button
                      type="button"
                      onClick={() => {
                        updateChatStatus(selectedChat.cleanPhone, 'handled');
                        onOpenNewBookingWithData({
                          ownerName: selectedChat.name,
                          ownerPhone: selectedChat.cleanPhone,
                          dogName: selectedChat.matchedDogName || ''
                        });
                      }}
                      className="bg-[#065f46] hover:bg-[#044e45] text-white font-black px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                      title="פתח את אשף ההזמנה עם פרטי הלקוח ממולאים מראש"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>קלוט ליומן 🟢</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Detected Name Banner */}
              {detectedSenderName && (
                <div className="bg-emerald-50/95 border-b border-emerald-200/80 px-4 py-2 flex items-center justify-between gap-3 text-xs shrink-0">
                  <div className="flex items-center gap-2 text-emerald-950 font-bold min-w-0">
                    <span className="text-emerald-800 font-black shrink-0">💡 זוהה שם שולח בהודעה:</span>
                    <span className="bg-white text-emerald-900 px-2 py-0.5 rounded-md border border-emerald-300 font-black">
                      "{detectedSenderName}"
                    </span>
                    <span className="text-slate-500 text-[11px] truncate hidden sm:inline">
                      (האם תרצה לעדכן את שם השיחה לשם המזוהה במקום כינוי הוואטסאפ?)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateChatName(selectedChat.cleanPhone, detectedSenderName)}
                    className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold px-3 py-1 rounded-lg text-xs flex items-center gap-1 shadow-2xs transition-all cursor-pointer shrink-0"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>עדכן שם ל-"{detectedSenderName}"</span>
                  </button>
                </div>
              )}

              {/* Status Safeguard Banner: Intake Questionnaire Deduplication */}
              {selectedChat.classification === 'new_lead' && (
                <div className="bg-emerald-50/90 border-b border-emerald-200/80 px-4 py-2 flex items-center justify-between gap-3 text-xs shrink-0">
                  <div className="flex items-center gap-2 text-emerald-950 font-bold min-w-0">
                    <span className="text-emerald-800 font-black shrink-0">🤖 שאלון קליטה נשלח אוטומטית בפנייה הראשונה</span>
                    <span className="text-emerald-400 hidden sm:inline">|</span>
                    <span className="text-emerald-800 font-medium text-[11px] truncate hidden sm:inline">
                      שמוליק שולח שוב קישור אך ורק אם הלקוח מבקש זאת במפורש במהלך ההתכתבות
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirmResendModal(true)}
                    className="bg-white hover:bg-emerald-100 active:scale-95 text-emerald-900 border border-emerald-300 px-2.5 py-1 rounded-lg text-[11px] font-black shrink-0 shadow-2xs transition-all cursor-pointer flex items-center gap-1"
                    title="שלח שוב שאלון לבקשת הלקוח"
                  >
                    <RotateCcw className="w-3 h-3 text-emerald-700" />
                    <span>שלח שוב לבקשתו</span>
                  </button>
                </div>
              )}

              {selectedChat.classification === 'intake_submitted' && (
                <div className="bg-amber-50/90 border-b border-amber-200/80 px-4 py-2 flex items-center justify-between gap-3 text-xs shrink-0">
                  <div className="flex items-center gap-2 text-amber-950 font-bold min-w-0">
                    <span className="font-black shrink-0">📋 שאלון קליטה כבר מולא ונקלט במערכת</span>
                    {selectedChat.matchedDogName && (
                      <span className="bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.2 rounded-md text-[11px]">
                        עבור {selectedChat.matchedDogName}
                      </span>
                    )}
                    <span className="text-amber-400 hidden sm:inline">|</span>
                    <span className="text-amber-800 font-medium text-[11px] truncate hidden sm:inline">
                      אין צורך בשליחה נוספת אלא אם הלקוח ביקש קישור מחדש
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirmResendModal(true)}
                    className="bg-white hover:bg-amber-100 active:scale-95 text-amber-950 border border-amber-300 px-2.5 py-1 rounded-lg text-[11px] font-black shrink-0 shadow-2xs transition-all cursor-pointer flex items-center gap-1"
                    title="שלח שוב שאלון לבקשת הלקוח"
                  >
                    <RotateCcw className="w-3 h-3 text-amber-700" />
                    <span>שלח שוב לבקשתו</span>
                  </button>
                </div>
              )}

              {selectedChat.classification === 'customer_with_booking' && (
                <div className="bg-slate-100/90 border-b border-slate-200 px-4 py-1.5 flex items-center gap-2 text-xs text-slate-700 shrink-0">
                  <span className="font-black text-emerald-800">🟢 לקוח רשום ביומן</span>
                  {selectedChat.matchedDogName && (
                    <span className="font-bold text-slate-900">🐾 {selectedChat.matchedDogName}</span>
                  )}
                  <span className="text-slate-300">|</span>
                  <span className="text-slate-500 text-[11px]">ללקוח זה כבר יש הזמנה רשמית – אין צורך בשאלון קליטה</span>
                </div>
              )}

              {/* Chat Messages Thread */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {isLoadingMessages ? (
                  <div className="p-8 text-center space-y-2 text-slate-400">
                    <RotateCcw className="w-6 h-6 animate-spin mx-auto text-emerald-600" />
                    <p className="text-xs font-bold">טוען היסטוריית הודעות...</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 space-y-2">
                    <MessageSquare className="w-8 h-8 mx-auto text-slate-300" />
                    <p className="text-xs font-bold">אין היסטוריית הודעות טקסט להצגה עבור שיחה זו.</p>
                    <p className="text-[11px]">תוכל לשלוח הודעה ישירה למטה באמצעות תבנית מהירה או הקלדה חופשית.</p>
                  </div>
                ) : (
                  messages.map(msg => {
                    const isOutgoing = msg.type === 'outgoing';

                    return (
                      <div
                        key={msg.idMessage}
                        className={`flex flex-col ${isOutgoing ? 'items-start' : 'items-end'}`}
                      >
                        <div
                          className={`max-w-[85%] sm:max-w-[70%] rounded-2xl p-3 text-xs sm:text-sm font-medium shadow-2xs whitespace-pre-wrap leading-relaxed ${
                            isOutgoing
                              ? 'bg-[#d9fdd3] text-slate-950 border border-emerald-200 rounded-br-xs'
                              : 'bg-white text-slate-900 border border-slate-200 rounded-bl-xs'
                          }`}
                        >
                          {msg.textMessage}
                          <div className={`flex items-center gap-1 justify-end text-[10px] text-slate-400 pt-1 mt-1 border-t border-black/5`}>
                            <span>{formatFullMessageDateIL(msg.timestamp)}</span>
                            {isOutgoing && <Check className="w-3 h-3 text-emerald-600" />}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Action Template Bar */}
              <div className="bg-white border-t border-slate-200 px-3 py-2 flex flex-wrap items-center gap-1.5 shrink-0 shadow-2xs">
                <span className="text-[11px] font-black text-slate-400 shrink-0 ml-1">
                  תגובה מהירה:
                </span>

                {/* 1. Intake Questionnaire Deduplication Button */}
                {selectedChat.classification === 'customer_with_booking' ? (
                  <div
                    className="bg-slate-100 text-slate-500 border border-slate-200 font-bold px-3 py-1 rounded-xl text-xs flex items-center gap-1 shrink-0 select-none cursor-default"
                    title="ללקוח יש הזמנה פעילה ביומן - אין צורך בשאלון קליטה"
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>לקוח ביומן ({selectedChat.matchedDogName || 'פעיל'})</span>
                  </div>
                ) : selectedChat.classification === 'intake_submitted' ? (
                  <button
                    type="button"
                    onClick={() => setConfirmResendModal(true)}
                    className="bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 font-bold px-2.5 py-1 rounded-xl text-xs flex items-center gap-1.5 shrink-0 transition-all cursor-pointer shadow-2xs active:scale-95"
                    title="השאלון כבר נקלט במערכת. לחץ לשליחה חוזרת רק אם הלקוח ביקש זאת במפורש"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
                    <span>🔁 שלח שוב שאלון (לבקשת הלקוח)</span>
                    <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded-md font-black">
                      הוגש ✅
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmResendModal(true)}
                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-950 border border-emerald-300 font-bold px-2.5 py-1 rounded-xl text-xs flex items-center gap-1.5 shrink-0 transition-all cursor-pointer shadow-2xs active:scale-95"
                    title="הלקוח כבר קיבל שאלון במענה האוטומטי. שלח שוב רק אם ביקש זאת מפורשות לאחר שיחה"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-emerald-700" />
                    <span>🔁 שלח שוב שאלון (לבקשת הלקוח)</span>
                    <span className="text-[10px] bg-emerald-200/80 text-emerald-900 px-1.5 py-0.2 rounded-md font-bold">
                      נשלח אוטומטית 🤖
                    </span>
                  </button>
                )}

                {/* 2. Send Location */}
                <button
                  type="button"
                  onClick={() => {
                    const text = `שלום ${getFirstName(selectedChat.name)}! 🐾 להגעה ל${settings.resortName}:\n📍 מיקום וניווט ב-Waze / Google Maps:\nhttps://maps.app.goo.gl/8bm2Rdt7DtHeUS5J9\n\nשעות פעילות:\n• ימים א׳–ה׳: 09:00–19:00\n• שישי וערבי חג: עד 14:00\nמחכים לכם! צוות הריזורט 🐾 (${settings.managerPhone})`;
                    handleSendMessage(text);
                  }}
                  className="bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-300 font-bold px-2.5 py-1 rounded-xl text-xs flex items-center gap-1 shrink-0 transition-all cursor-pointer shadow-2xs active:scale-95"
                >
                  <MapPin className="w-3.5 h-3.5 text-blue-600" />
                  <span>📍 שלח מיקום Waze/Maps</span>
                </button>

                {/* 3. Send Official Price List */}
                <button
                  type="button"
                  onClick={() => {
                    const text = `🐾 *מחירון פנסיון לילה בריזורט לכלב:*\n• שהות של 1–6 לילות: ₪180 ללילה\n• שהות של 7–20 לילות (משבוע ומעלה): ₪150 ללילה\n• שהות של 21+ לילות (מעל 3 שבועות): ₪120 ללילה\n\n* כלבי בידוד / טיפול מיוחד: ₪230 ללילה\n* אילוף בתנאי פנסיון: ₪6,500\n* יום כיף (דייקר): ₪90 ליום\n\nנשמח לעמוד לרשותכם לכל שאלה! צוות ${settings.resortName} 🐾`;
                    handleSendMessage(text);
                  }}
                  className="bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 font-bold px-2.5 py-1 rounded-xl text-xs flex items-center gap-1 shrink-0 transition-all cursor-pointer shadow-2xs active:scale-95"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                  <span>💵 שלח מחירון רשמי</span>
                </button>

                {/* 4. Send Grow Payment Link */}
                <button
                  type="button"
                  onClick={() => {
                    const payUrl = settings.growPaymentLink || 'https://pay.grow.link/MjcyNjk~3d59a40e0ae26ce0d41b50b4eebdff04-MzczNjYzMg';
                    const text = `שלום ${getFirstName(selectedChat.name)}! 🐾 בהמשך לתיאום מול הריזורט לכלב, מצורף קישור לתשלום מאובטח (Bit, Apple Pay ואשראי):\n${payUrl}\n\nלאחר ביצוע התשלום המקום משוריין רשמית ביומן!`;
                    handleSendMessage(text);
                  }}
                  className="bg-purple-50 hover:bg-purple-100 text-purple-950 border border-purple-300 font-bold px-2.5 py-1 rounded-xl text-xs flex items-center gap-1 shrink-0 transition-all cursor-pointer shadow-2xs active:scale-95"
                >
                  <CreditCard className="w-3.5 h-3.5 text-purple-700" />
                  <span>💳 שלח קישור Grow</span>
                </button>
              </div>

              {/* Message Composer & Dictation Input */}
              <div className="bg-white p-3 border-t border-slate-200 flex items-center gap-2 shrink-0">
                
                {/* Voice Dictation Button */}
                <button
                  type="button"
                  onClick={toggleVoiceDictation}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer shadow-2xs active:scale-95 shrink-0 ${
                    isListening
                      ? 'bg-red-600 text-white animate-pulse ring-2 ring-red-400 border-red-600'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                  }`}
                  title="לחץ להכתבה קולית בעברית"
                >
                  {isListening ? <MicOff className="w-4 h-4 animate-bounce" /> : <Mic className="w-4 h-4" />}
                </button>

                {/* Textarea */}
                <div className="flex-1 relative">
                  <textarea
                    rows={1}
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder={isListening ? 'מקליט... דבר עכשיו 🎙️' : 'הקלד הודעת וואטסאפ ישירה ללקוח (Enter לשליחה)...'}
                    className="w-full bg-slate-50 focus:bg-white text-slate-900 border border-slate-300 focus:border-emerald-500 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none max-h-24 transition-all"
                  />
                </div>

                {/* Send Button */}
                <button
                  type="button"
                  disabled={!messageInput.trim() || isSending}
                  onClick={() => handleSendMessage()}
                  className="bg-[#25D366] hover:bg-[#1EBE5D] active:scale-95 disabled:opacity-40 disabled:scale-100 text-white font-black px-4 py-2.5 rounded-xl text-xs sm:text-sm flex items-center gap-1.5 shadow-xs transition-all cursor-pointer shrink-0"
                  title="שלח עכשיו בוואטסאפ דרך Green-API"
                >
                  <Send className="w-4 h-4" />
                  <span>{isSending ? 'שולח...' : 'שלח'}</span>
                </button>
              </div>

              {/* Toast for successful send */}
              {sendSuccessToast && (
                <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xl animate-in fade-in">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>ההודעה נשלחה בהצלחה בוואטסאפ! 📲</span>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-3">
              <div className="w-16 h-16 rounded-3xl bg-slate-100 text-slate-400 flex items-center justify-center text-3xl">
                💬
              </div>
              <h3 className="text-base font-black text-slate-700">בחר שיחה מרשימת הפניות</h3>
              <p className="text-xs max-w-sm">
                בחר שיחה מהרשימה בצד ימין לצפייה בהיסטוריה המלאה, מענה מהיר או שליחת שאלון קליטה.
              </p>
            </div>
          )}
        </div>

      </div>

      {/* Confirmation Modal: Resend Intake Link Only Upon Customer Request */}
      {confirmResendModal && selectedChat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full p-5 space-y-4 animate-in zoom-in-95 duration-200" dir="rtl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center text-xl shrink-0">
                  ⚠️
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900">
                    שליחה חוזרת של שאלון קליטה
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    מניעת כפילויות – שליחה אך ורק לבקשת הלקוח
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConfirmResendModal(false)}
                className="w-7 h-7 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-2xl text-xs space-y-2 leading-relaxed text-amber-950">
              {selectedChat.classification === 'intake_submitted' ? (
                <p>
                  הלקוח <strong>{selectedChat.name}</strong> כבר מילא שאלון קליטה במערכת{selectedChat.matchedDogName ? ` עבור ${selectedChat.matchedDogName}` : ''}.
                  <br />
                  האם הלקוח ביקש קישור נוסף על מנת למלא מחדש?
                </p>
              ) : selectedChat.classification === 'customer_with_booking' ? (
                <p>
                  הלקוח <strong>{selectedChat.name}</strong> כבר משוריין ביומן הנופש עם הזמנה פעילה.
                </p>
              ) : (
                <p>
                  לקוח זה (<strong>{selectedChat.name}</strong>) כבר קיבל את שאלון הקליטה <strong>באופן אוטומטי במענה הראשוני</strong>.
                  <br />
                  שמוליק שולח את הקישור שוב <strong>רק אם אחרי ההתנהלות מולו הלקוח ביקש את השאלון שוב על מנת למלא אותו</strong>.
                </p>
              )}
              <p className="font-black text-slate-900 pt-1">
                האם לשלוח את קישור השאלון שוב בוואטסאפ?
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmResendModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
              >
                ביטול (לא לשלוח)
              </button>
              <button
                type="button"
                onClick={() => {
                  const intakeUrl = `${window.location.origin}/?intake=true`;
                  const firstName = getFirstName(selectedChat.name);
                  const text = `שלום ${firstName}! 🐾\nלבקשתך ובהמשך להתכתבות שלנו, מצורף שוב הקישור לשאלון בקשת הקליטה בריזורט לכלב:\n${intakeUrl}\n\nנשמח לעמוד לרשותך לכל שאלה! צוות ${settings.resortName} 🐾`;
                  setConfirmResendModal(false);
                  handleSendMessage(text);
                }}
                className="bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white font-black px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>כן, הלקוח ביקש – שלח שוב</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
