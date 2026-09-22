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
  PenTool,
  PhoneCall,
  ChevronRight,
  UserCheck
} from 'lucide-react';
import { Booking, IntakeRequest, ResortSettings } from '../types';
import { DesktopWhatsAppAuditModal } from './DesktopWhatsAppAuditModal';
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
  extractSelfIdentifiedName,
  generateFollowUpReminderText,
  generateResortMarketingValueText,
  generateTrainingOnlyMarketingText,
  generateBoardingOnlyMarketingText,
  generateAvailableToTalkText,
  generateUnansweredFollowUpMarketingText,
  detectCustomerIntent,
  DetectedIntent,
  getChatTreatmentStatus as getChatStatusFromService,
  getReadChatTimestamps,
  markChatAsRead,
  markAllChatsAsRead
} from '../services/whatsappCrmService';

export const CRM_PRIORITY_ORDER: Record<'new' | 'in_chat' | 'waiting_reply' | 'handled', number> = {
  'new': 1,
  'in_chat': 2,
  'waiting_reply': 3,
  'handled': 4
};

interface WhatsAppLeadsViewProps {
  bookings: Booking[];
  intakeRequests: IntakeRequest[];
  settings: ResortSettings;
  onOpenNewBookingWithData?: (data: { ownerName: string; ownerPhone: string; dogName?: string }) => void;
  onNewCountChange?: (count: number) => void;
}

export const WhatsAppLeadsView: React.FC<WhatsAppLeadsViewProps> = ({
  bookings,
  intakeRequests,
  settings,
  onOpenNewBookingWithData,
  onNewCountChange
}) => {
  const [chats, setChats] = useState<EnrichedWhatsAppChat[]>([]);
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [chatsError, setChatsError] = useState<string | null>(null);

  const [selectedChat, setSelectedChat] = useState<EnrichedWhatsAppChat | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'new' | 'in_chat' | 'waiting_reply' | 'all'>('in_chat');
  const hasUserSelectedFilter = useRef(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  
  // Stealth Reading Mode (מצב קריאה סמויה - אי סימון הודעות כנקראות עם קוד 3466)
  const [isStealthMode, setIsStealthMode] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('crm_stealth_mode_active') === 'true';
    } catch {
      return false;
    }
  });
  const [isStealthPinModalOpen, setIsStealthPinModalOpen] = useState(false);
  const [stealthPinInput, setStealthPinInput] = useState('');
  const [stealthPinError, setStealthPinError] = useState(false);
  const stealthInputRef = useRef<HTMLInputElement>(null);

  const handleOpenStealthPinModal = () => {
    setIsStealthPinModalOpen(true);
    setStealthPinInput('');
    setStealthPinError(false);
    setTimeout(() => stealthInputRef.current?.focus(), 150);
  };

  const handleToggleStealthMode = () => {
    if (isStealthMode) {
      if (confirm('האם ברצונך לכבות את מצב הקריאה הסמויה ולחזור למצב קריאה רגיל?')) {
        setIsStealthMode(false);
        try {
          sessionStorage.removeItem('crm_stealth_mode_active');
        } catch {}
      }
    } else {
      handleOpenStealthPinModal();
    }
  };

  const handleVerifyStealthPin = (pin: string) => {
    if (pin === '3466') {
      setIsStealthMode(true);
      try {
        sessionStorage.setItem('crm_stealth_mode_active', 'true');
      } catch {}
      setIsStealthPinModalOpen(false);
      setStealthPinInput('');
      setStealthPinError(false);
    } else {
      setStealthPinError(true);
      setStealthPinInput('');
      setTimeout(() => stealthInputRef.current?.focus(), 50);
    }
  };
  
  // Status Overrides per phone (חדשים למענה -> בהתכתבות -> ממתין לתגובה -> טופל)
  const [statusOverrides, setStatusOverrides] = useState<Record<string, 'new' | 'in_chat' | 'waiting_reply' | 'handled'>>(() => {
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

  const updateChatStatus = (phone: string, newStatus: 'new' | 'in_chat' | 'waiting_reply' | 'handled') => {
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

  // Cycle status on card click: חדש -> בהתכתבות -> ממתין לתגובה -> טופל
  const cycleChatStatus = (chat: EnrichedWhatsAppChat, e: React.MouseEvent) => {
    e.stopPropagation();
    const current = getChatTreatmentStatus(chat);
    if (current === 'new') {
      updateChatStatus(chat.cleanPhone, 'in_chat');
    } else if (current === 'in_chat') {
      updateChatStatus(chat.cleanPhone, 'waiting_reply');
    } else if (current === 'waiting_reply') {
      updateChatStatus(chat.cleanPhone, 'handled');
    } else {
      updateChatStatus(chat.cleanPhone, 'new');
    }
  };

  const getChatTreatmentStatus = (chat: EnrichedWhatsAppChat): 'new' | 'in_chat' | 'waiting_reply' | 'handled' => {
    return getChatStatusFromService(chat, statusOverrides);
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
        return (b.timestamp || 0) - (a.timestamp || 0);
      });

      setChats(sorted);

      // ברירת מחדל חכמה: אם יש שיחות חדשות שממתינות למענה - הצג חדשות. אחרת - שיחות מתנהלות!
      if (!hasUserSelectedFilter.current) {
        const computedNewCount = sorted.filter(c => getChatTreatmentStatus(c) === 'new').length;
        if (computedNewCount > 0) {
          setFilter('new');
        } else {
          setFilter('in_chat');
        }
      }

      // לעולם לא לבחור שיחה אוטומטית בעת טעינה!
      // המשתמש תמיד נשאר ברשימת השיחות הראשית עם כפתורי המיון הגלויים, ושיחה נפתחת אך ורק בלחיצה יזומה שלו.
      if (selectedChat) {
        const updated = sorted.find(c => c.id === selectedChat.id);
        if (updated) setSelectedChat(updated);
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
    // סימון אוטומטי של השיחה כנקראה ברגע ששמוליק פתח אותה
    markChatAsRead(chat.cleanPhone || chat.id, chat.timestamp || Date.now());
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
      // חוק ברזל: ברגע שנשלח מענה בפועל ללקוח, השיחה עוברת לסטטוס ממתין לתגובה
      setChats(prev => prev.map(c => c.id === selectedChat.id ? {
        ...c,
        lastMessageType: 'outgoing',
        unreadCount: 0,
        lastMessage: textToSend,
        timestamp: Date.now()
      } : c));
      setMessageInput('');
      setSendSuccessToast(true);
      setTimeout(() => setSendSuccessToast(false), 2500);
      setTimeout(scrollToBottom, 50);
    } catch (err: any) {
      console.error('Failed to send message:', err);
      alert(err?.message || 'שליחת ההודעה נכשלה. אנא נסה שוב או פתח את השיחה בוואטסאפ ווב.');
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

  // 5. Filter, Search and Priority Sorting:
  const filteredChats = chats
    .filter(chat => {
      const status = getChatTreatmentStatus(chat);

      // חיפוש טקסט חופשי מאפשר למצוא כל שיחה
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const qNorm = q.replace(/[״"׳']/g, '').replace(/[יו]/g, '');
        const matchName = chat.name.toLowerCase().includes(q) || (chat.whatsappPushName || '').toLowerCase().includes(q);
        const matchPhone = chat.cleanPhone.includes(q.replace(/\D/g, ''));
        const matchDog = (chat.matchedDogName || '').toLowerCase().includes(q);
        const matchDogNorm = (chat.matchedDogName || '').replace(/[״"׳']/g, '').replace(/[יו]/g, '').includes(qNorm) && qNorm.length >= 2;
        const matchMsg = (chat.lastMessage || '').toLowerCase().includes(q);
        return matchName || matchPhone || matchDog || matchDogNorm || matchMsg;
      }

      // ללא חיפוש טקסט - מציג לפי הטאב הפעיל (חדשות, מתנהלות, ממתינות לתגובה או כל השיחות)
      if (filter === 'all') return true;
      return status === filter;
    })
    .sort((a, b) => {
      return (b.timestamp || 0) - (a.timestamp || 0);
    });

  // מונים לטאבים הפעילים
  const newCount = chats.filter(c => getChatTreatmentStatus(c) === 'new').length;
  const inChatCount = chats.filter(c => getChatTreatmentStatus(c) === 'in_chat').length;
  const waitingReplyCount = chats.filter(c => getChatTreatmentStatus(c) === 'waiting_reply').length;
  const allCount = chats.length;

  useEffect(() => {
    onNewCountChange?.(newCount);
  }, [newCount, onNewCountChange]);

  // Render individual chat list item
  const renderChatCard = (chat: EnrichedWhatsAppChat) => {
    const isSelected = selectedChat?.id === chat.id;
    const status = getChatTreatmentStatus(chat);
    const detectedIntent = chat.lastMessageType === 'incoming'
      ? detectCustomerIntent(chat.lastMessage, chat.name, chat.matchedDogName)
      : null;

    return (
      <div
        key={chat.id}
        onClick={() => {
          setSelectedChat(chat);
          markChatAsRead(chat.cleanPhone || chat.id, chat.timestamp || Date.now());
          setChats(prev => prev.map(c => c.id === chat.id ? { ...c, unreadCount: 0 } : c));
        }}
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
              : (status === 'in_chat' || status === 'waiting_reply')
              ? 'bg-amber-100 text-amber-900 border-2 border-amber-300'
              : 'bg-emerald-100 text-emerald-800 border-2 border-emerald-300'
          }`}>
            {chat.matchedDogName ? '🐕' : '👤'}
          </div>
          <span className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white shadow-2xs ${
            status === 'new' ? 'bg-rose-500' :
            (status === 'in_chat' || status === 'waiting_reply') ? 'bg-amber-500' : 'bg-emerald-500'
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

          {/* Timestamp & Smart Intent Badge */}
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <div className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 w-fit shadow-2xs">
              <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span>{formatFullMessageDateIL(chat.timestamp || Date.now())}</span>
            </div>
            {detectedIntent && (
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border truncate max-w-[160px] shadow-2xs ${detectedIntent.badgeClass}`} title={detectedIntent.label}>
                {detectedIntent.badge}
              </span>
            )}
          </div>

          {/* Priority Treatment Badge (Interactive 1-click cycle!) */}
          <div className="mt-1.5 flex items-center justify-between gap-1 flex-wrap">
            <button
              type="button"
              onClick={(e) => cycleChatStatus(chat, e)}
              title={
                status === 'new'
                  ? 'שיחה חדשה. לחץ להעברה ל-💬 שיחה מתנהלת'
                  : status === 'in_chat'
                  ? 'שיחה מתנהלת. לחץ להעברה ל-⏳ ממתינים לתגובה'
                  : status === 'waiting_reply'
                  ? 'ממתין לתגובה. לחץ לסימון כטופל'
                  : 'טופל. לחץ להחזרה ל-🔴 שיחה חדשה'
              }
              className={`text-[10px] font-black px-2 py-0.5 rounded-md inline-flex items-center gap-1 border transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-2xs ${
                status === 'new'
                  ? 'bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-200'
                  : status === 'in_chat'
                  ? 'bg-blue-100 text-blue-900 border-blue-300 hover:bg-blue-200'
                  : status === 'waiting_reply'
                  ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                  : 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200'
              }`}
            >
              {status === 'new' ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse"></span>
                  <span>🔴 שלא נקרא</span>
                </>
              ) : status === 'in_chat' ? (
                <>
                  <span>💬 מתנהלת</span>
                </>
              ) : status === 'waiting_reply' ? (
                <>
                  <span>⏳ ממתין</span>
                </>
              ) : (
                <>
                  <span>✓ טופל</span>
                </>
              )}
              <span className="text-[8px] text-slate-400 mr-0.5 font-sans">↺</span>
            </button>

            {status === 'new' && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedChat(chat);
                  const text = generateAvailableToTalkText(chat.name, chat.matchedDogName);
                  setMessageInput(text);
                }}
                className="text-[10px] font-black bg-sky-50 hover:bg-sky-100 text-sky-950 border border-sky-300 px-2 py-0.5 rounded-md inline-flex items-center gap-1 transition-all active:scale-95 cursor-pointer shadow-2xs"
                title="טען הודעת פנייה מכבדת ללקוח: האם אפשר לדבר עכשיו? פנוי לשיחה?"
              >
                <span>📞 פנוי לשיחה?</span>
              </button>
            )}

            {status === 'waiting_reply' && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedChat(chat);
                    const intakeUrl = `${window.location.origin}/?intake=true`;
                    const text = generateResortMarketingValueText(chat.name, chat.matchedDogName, intakeUrl);
                    setMessageInput(text);
                  }}
                  className="text-[10px] font-black bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 px-2 py-0.5 rounded-md inline-flex items-center gap-1 transition-all active:scale-95 cursor-pointer shadow-2xs"
                  title="טען הודעת שיווק מקיפה המפרטת על יתרונות הפנסיון והאילוף"
                >
                  <span>🌟 שיווק פנסיון</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    updateChatStatus(chat.cleanPhone, 'handled');
                  }}
                  className="text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-300 px-1.5 py-0.5 rounded-md inline-flex items-center gap-0.5 transition-all active:scale-95 cursor-pointer shadow-2xs"
                  title="לא ענה - הסר מרשימת הממתינים. השיחה תחזור אוטומטית ברגע שהלקוח יכתוב שוב"
                >
                  <span>🚫 לא ענה</span>
                </button>
              </div>
            )}

            <div className="flex items-center gap-1">
              {chat.matchedIntake && chat.matchedIntake.additionalDogs && chat.matchedIntake.additionalDogs.length > 0 && (
                <span className="text-[10px] font-black text-orange-950 bg-orange-100/90 px-1.5 py-0.5 rounded-md border border-orange-300 animate-pulse">
                  🐾 {1 + chat.matchedIntake.additionalDogs.length} כלבים בטופס
                </span>
              )}
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
    <div className="bg-slate-100 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[calc(100dvh-130px)] sm:h-[calc(100vh-140px)] min-h-[480px] sm:min-h-[580px]" dir="rtl">
      
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
          {/* Small Person Icon Button for Stealth Reading Mode (קוד 3466) */}
          {!isStealthMode ? (
            <button
              type="button"
              onClick={handleOpenStealthPinModal}
              id="btn-stealth-mode-trigger"
              className="bg-slate-100 hover:bg-purple-50 active:scale-95 text-slate-700 hover:text-purple-900 border border-slate-200 hover:border-purple-300 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
              title="קריאת הודעות מבלי שיסומנו כנקראות (דורש קוד 3466)"
            >
              <User className="w-4 h-4 text-purple-700" />
              <span className="hidden sm:inline">קריאה סמויה (קוד)</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleToggleStealthMode}
              id="btn-stealth-mode-active"
              className="bg-purple-100 hover:bg-purple-200 active:scale-95 text-purple-950 border-2 border-purple-400 font-black px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ring-2 ring-purple-400/40"
              title="מצב קריאה סמויה פעיל (קוד 3466)! הודעות שאתה פותח לא מסומנות כנקראות ויישארו לשמוליק. לחץ לכיבוי"
            >
              <UserCheck className="w-4 h-4 text-purple-700" />
              <span className="flex items-center gap-1.5">
                <span>קריאה סמויה (3466)</span>
                <span className="w-2 h-2 rounded-full bg-purple-600 animate-ping" />
              </span>
            </button>
          )}

          {/* Desktop Only: Full WhatsApp History Audit & Problem Detector Button */}
          <button
            type="button"
            onClick={() => setIsAuditModalOpen(true)}
            id="btn-desktop-audit-whatsapp"
            className="hidden md:inline-flex items-center gap-1.5 bg-gradient-to-r from-indigo-700 via-purple-700 to-indigo-800 hover:from-indigo-800 hover:to-purple-800 active:scale-95 text-white font-black px-3.5 py-1.5 rounded-xl text-xs transition-all cursor-pointer shadow-sm shadow-indigo-700/20 border border-indigo-500/40"
            title="סריקת היסטוריית וואטסאפ מלאה, חיפוש חופשי ואיתור בעיות/תלונות/תשלומים (מחשב בלבד)"
          >
            <span>🔍</span>
            <span>סריקת היסטוריה ואיתור בעיות (מחשב) 🖥️</span>
          </button>

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
        
        {/* LEFT COLUMN: Chats & Leads List (Sidebar - hidden on mobile when a chat is open) */}
        <div className={`w-full sm:w-88 md:w-[380px] lg:w-[410px] bg-white border-l border-slate-200 flex-col shrink-0 ${
          selectedChat ? 'hidden sm:flex' : 'flex'
        }`}>
          
          {/* Search Bar with interactive button */}
          <div className="p-3 border-b border-slate-100 bg-slate-50/70 space-y-2">
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1 flex items-center">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="חפש לפי שם, כלב או טלפון..."
                  className="w-full bg-white border border-slate-200 focus:border-emerald-500 rounded-xl pr-9 pl-8 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-2xs"
                />
                <button
                  type="button"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-600 p-0.5"
                  title="חפש"
                >
                  <Search className="w-4 h-4" />
                </button>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs p-0.5"
                    title="נקה חיפוש"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Stealth Mode Button in Sidebar */}
              <button
                type="button"
                onClick={handleToggleStealthMode}
                className={`p-2 rounded-xl border font-bold text-xs transition-all active:scale-95 cursor-pointer shrink-0 shadow-2xs flex items-center justify-center ${
                  isStealthMode 
                    ? 'bg-purple-100 text-purple-900 border-purple-400 ring-2 ring-purple-400/40'
                    : 'bg-white hover:bg-purple-50 text-slate-600 hover:text-purple-800 border-slate-200 hover:border-purple-300'
                }`}
                title={isStealthMode ? 'מצב קריאה סמויה פעיל (קוד 3466) - לחץ לכיבוי' : 'לקרוא הודעות מבלי שיסומנו כנקראו (לחץ להקשת קוד 3466)'}
              >
                {isStealthMode ? (
                  <UserCheck className="w-4 h-4 text-purple-700" />
                ) : (
                  <User className="w-4 h-4 text-slate-600" />
                )}
              </button>
            </div>

            {/* Classification Filter Tabs - 4 explicit sorting buttons: שלא נקראו/חדשות, שיחות מתנהלות, ממתינים לתגובה, כל השיחות */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-0.5">
              {[
                { id: 'new', label: '🔴 שלא נקראו / חדשות', count: newCount, title: 'שיחות והודעות נכנסות שטרם נענו – נשארות לשמוליק ב-שלא נקראו' },
                { id: 'in_chat', label: '💬 שיחות מתנהלות', count: inChatCount, title: 'שיחות מתנהלות בהתכתבות פעילה' },
                { id: 'waiting_reply', label: '⏳ ממתינים לתגובה', count: waitingReplyCount, title: 'שיחות שנשלחה אליהן הודעה/שאלון וממתינים לתגובת הלקוח' },
                { id: 'all', label: '🌐 כל השיחות', count: allCount, title: 'כל השיחות שנמצאו במערכת' },
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    hasUserSelectedFilter.current = true;
                    setFilter(tab.id as any);
                  }}
                  className={`py-2 px-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-between gap-1 shrink-0 ${
                    filter === tab.id
                      ? 'bg-[#065f46] text-white shadow-sm ring-1 ring-emerald-500 scale-[1.02]'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs'
                  }`}
                  title={tab.title}
                >
                  <span className="truncate">{tab.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold shrink-0 ${
                    filter === tab.id 
                      ? 'bg-emerald-800 text-white' 
                      : tab.id === 'new' && tab.count > 0 
                      ? 'bg-rose-100 text-rose-800 border border-rose-200 animate-pulse' 
                      : 'bg-slate-100 text-slate-700'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Quick "Mark All as Read" toolbar row when there are unread chats */}
            {newCount > 0 && (
              <div className="pt-2 flex items-center justify-between gap-2 px-1 bg-rose-50/60 p-2 rounded-xl border border-rose-200/80 mt-1.5">
                <span className="text-[11px] text-rose-800 font-black flex items-center gap-1">
                  <span className="animate-pulse">🔥</span>
                  <span>{newCount} פניות ממתינות</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    markAllChatsAsRead(chats);
                    setChats(prev => prev.map(c => ({ ...c, unreadCount: 0 })));
                    setFilter('in_chat');
                  }}
                  className="bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white text-[11px] font-black px-2.5 py-1 rounded-lg shadow-2xs flex items-center gap-1 transition-all cursor-pointer shrink-0"
                  title="סמן את כל ההודעות כנקראו ואפס את המונה"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>סמן הכל כנקרא ✅</span>
                </button>
              </div>
            )}
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
              <div className="p-6 text-center text-slate-500 text-xs font-medium space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-2xl mx-auto text-slate-400">
                  {filter === 'new' ? '🎉' : '💬'}
                </div>
                <div>
                  <p className="font-black text-sm text-slate-800">
                    {filter === 'new'
                      ? 'אין פניות חדשות שממתינות למענה 🎉'
                      : filter === 'in_chat'
                      ? 'אין שיחות מתנהלות כרגע'
                      : filter === 'waiting_reply'
                      ? 'אין פניות שממתינות לתגובה כרגע 👍'
                      : 'לא נמצאו שיחות התואמות את החיפוש'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {searchQuery
                      ? 'לא נמצאו תוצאות התואמות את החיפוש. נסה לנקות את שורת החיפוש.'
                      : filter === 'new'
                      ? 'כל הפניות החדשות כבר נענו ונמצאות בשיחות מתנהלות.'
                      : 'בחר לשונית אחרת כדי לצפות בכל השיחות.'}
                  </p>
                </div>
                {filter === 'new' && (inChatCount > 0 || allCount > 0) && (
                  <div className="pt-2 flex items-center justify-center gap-2 flex-wrap">
                    {inChatCount > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          hasUserSelectedFilter.current = true;
                          setFilter('in_chat');
                        }}
                        className="bg-emerald-700 hover:bg-emerald-800 text-white font-black px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95 transition-all"
                      >
                        <span>💬 עבור לשיחות מתנהלות</span>
                        <span className="bg-emerald-900 text-emerald-100 text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold">
                          {inChatCount}
                        </span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        hasUserSelectedFilter.current = true;
                        setFilter('all');
                      }}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1 cursor-pointer active:scale-95 transition-all border border-slate-200"
                    >
                      <span>🌐 כל השיחות ({allCount})</span>
                    </button>
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

        {/* RIGHT COLUMN: Chat Conversation & Quick Actions (takes full width on mobile when chat selected) */}
        <div className={`flex-1 bg-slate-50/50 flex-col min-w-0 ${
          selectedChat ? 'flex w-full' : 'hidden sm:flex'
        }`}>
          {selectedChat ? (
            <>
              {/* Active Chat Header */}
              <div className="bg-white px-3 sm:px-4 py-2.5 sm:py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shadow-2xs shrink-0">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  
                  {/* Mobile Back Button (Screens < sm) */}
                  <button
                    type="button"
                    onClick={() => setSelectedChat(null)}
                    className="sm:hidden flex items-center gap-1.5 bg-[#065f46] hover:bg-[#044e45] text-white px-3 py-1.5 rounded-xl text-xs font-black shrink-0 active:scale-95 transition-all shadow-xs cursor-pointer ring-1 ring-emerald-400"
                    title="חזור לרשימת השיחות"
                  >
                    <ChevronRight className="w-4 h-4" />
                    <span>חזור לשיחות</span>
                  </button>

                  <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center font-black text-base sm:text-lg shadow-2xs shrink-0 ${
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

                  {/* Status Changer */}
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => updateChatStatus(selectedChat.cleanPhone, 'new')}
                      className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                        getChatTreatmentStatus(selectedChat) === 'new'
                          ? 'bg-rose-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="סמן כשיחה שלא נקראה / חדשה למענה"
                    >
                      🔴 שלא נקרא
                    </button>
                    <button
                      type="button"
                      onClick={() => updateChatStatus(selectedChat.cleanPhone, 'in_chat')}
                      className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                        getChatTreatmentStatus(selectedChat) === 'in_chat'
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="סמן כשיחה מתנהלת פעילה"
                    >
                      💬 מתנהלת
                    </button>
                    <button
                      type="button"
                      onClick={() => updateChatStatus(selectedChat.cleanPhone, 'waiting_reply')}
                      className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                        getChatTreatmentStatus(selectedChat) === 'waiting_reply'
                          ? 'bg-amber-500 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="סמן כממתין לתגובת הלקוח"
                    >
                      ⏳ ממתין
                    </button>
                    <button
                      type="button"
                      onClick={() => updateChatStatus(selectedChat.cleanPhone, 'handled')}
                      className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                        getChatTreatmentStatus(selectedChat) === 'handled'
                          ? 'bg-emerald-700 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50'
                      }`}
                      title="סמן כטופל (הסר מרשימת הפניות הפעילות)"
                    >
                      ✓ {getChatTreatmentStatus(selectedChat) === 'handled' ? 'טופל (בארכיון)' : 'סמן כטופל'}
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

              {/* Stealth Reading Mode Banner */}
              {isStealthMode && (
                <div className="bg-purple-100 border-b border-purple-300/90 px-3 sm:px-4 py-2 flex items-center justify-between gap-3 text-xs shrink-0 shadow-2xs">
                  <div className="flex items-center gap-2 text-purple-950 font-bold min-w-0">
                    <span className="text-base">🕵️</span>
                    <span>מצב קריאה סמויה פעיל (קוד 3466): שיחה זו לא תסומן כנקראה ותישאר לשמוליק ב-״שלא נקראו״</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsStealthMode(false);
                      try { sessionStorage.removeItem('crm_stealth_mode_active'); } catch {}
                    }}
                    className="text-[11px] font-bold text-purple-800 hover:text-purple-950 underline cursor-pointer shrink-0"
                  >
                    כיבוי ✕
                  </button>
                </div>
              )}

              {/* Handled Notice Banner */}
              {getChatTreatmentStatus(selectedChat) === 'handled' && (
                <div className="bg-emerald-50 border-b border-emerald-200/80 px-4 py-2 flex items-center justify-between gap-3 text-xs shrink-0">
                  <div className="flex items-center gap-2 text-emerald-950 font-bold min-w-0">
                    <span className="text-emerald-800 font-black shrink-0">✓ פנייה זו סומנה כטופלה</span>
                    <span className="text-slate-500 text-[11px] truncate hidden sm:inline">
                      (הפנייה אינה מופיעה ברשימת הפניות הפעילות)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateChatStatus(selectedChat.cleanPhone, 'in_chat')}
                    className="bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold px-3 py-1 rounded-lg text-xs flex items-center gap-1 shadow-2xs transition-all cursor-pointer shrink-0"
                  >
                    <span>החזר לטיפול</span>
                  </button>
                </div>
              )}

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

                {/* 🌟 1.0 Smart Intent Quick Action: Tailored response to client's intent */}
                {(() => {
                  const intent = selectedChat.lastMessageType === 'incoming'
                    ? detectCustomerIntent(selectedChat.lastMessage, selectedChat.name, selectedChat.matchedDogName)
                    : null;
                  if (!intent?.suggestedActionLabel || !intent?.suggestedResponse) return null;
                  return (
                    <button
                      type="button"
                      onClick={() => setMessageInput(intent.suggestedResponse || '')}
                      className={`font-black px-3 py-1 rounded-xl text-xs flex items-center gap-1.5 shrink-0 transition-all cursor-pointer shadow-xs active:scale-95 border animate-pulse ${
                        intent.type === 'price_objection'
                          ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600'
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-700'
                      }`}
                      title={intent.label}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-yellow-200" />
                      <span>{intent.suggestedActionLabel}</span>
                    </button>
                  );
                })()}

                {/* 1.1 Available to Talk (Apology for delay + check availability) */}
                <button
                  type="button"
                  onClick={() => {
                    const text = generateAvailableToTalkText(selectedChat.name, selectedChat.matchedDogName);
                    setMessageInput(text);
                  }}
                  className="bg-sky-50 hover:bg-sky-100 text-sky-950 border border-sky-300 font-bold px-2.5 py-1 rounded-xl text-xs flex items-center gap-1 shrink-0 transition-all cursor-pointer shadow-2xs active:scale-95"
                  title="שליחת הודעה מכבדת ללקוח שהתעכבנו איתו: האם אפשר לדבר עכשיו? פנוי לשיחה?"
                >
                  <PhoneCall className="w-3.5 h-3.5 text-sky-700" />
                  <span>📞 אפשר לדבר עכשיו? פנוי?</span>
                </button>

                {/* 1. Send Grow Payment Link (Always loads to input for editing!) */}
                <button
                  type="button"
                  onClick={() => {
                    const payUrl = settings.growPaymentLink || 'https://pay.grow.link/MjcyNjk~3d59a40e0ae26ce0d41b50b4eebdff04-MzczNjYzMg';
                    const text = `שלום ${getFirstName(selectedChat.name)}! 🐾 בהמשך לתיאום מול הריזורט לכלב, מצורף קישור לתשלום מאובטח (Bit, Apple Pay ואשראי):\n👉 ${payUrl}\n\nלאחר ביצוע התשלום המקום משוריין רשמית ביומן! נשמח לראותכם 🐶✨`;
                    setMessageInput(text);
                  }}
                  className="bg-purple-50 hover:bg-purple-100 text-purple-950 border border-purple-300 font-bold px-2.5 py-1 rounded-xl text-xs flex items-center gap-1 shrink-0 transition-all cursor-pointer shadow-2xs active:scale-95"
                  title="טען קישור לתשלום מאובטח ב-Grow לעריכה ושליחה"
                >
                  <CreditCard className="w-3.5 h-3.5 text-purple-700" />
                  <span>💳 קישור תשלום Grow</span>
                </button>

                {/* 2. Send Intake Questionnaire Link */}
                <button
                  type="button"
                  onClick={() => {
                    const intakeUrl = `${window.location.origin}/?intake=true`;
                    const text = `שלום ${getFirstName(selectedChat.name)}! 🐾\nלקראת האירוח בריזורט לכלב, מצורף שאלון קליטה קצרצר (כדקה למילוי) לרישום הכלב, העדפות ופרטים רפואיים:\n👉 ${intakeUrl}\n\nנשמח לעמוד לרשותכם לכל שאלה! צוות ${settings.resortName} 🐾`;
                    setMessageInput(text);
                  }}
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-950 border border-emerald-300 font-bold px-2.5 py-1 rounded-xl text-xs flex items-center gap-1 shrink-0 transition-all cursor-pointer shadow-2xs active:scale-95"
                  title="טען קישור לשאלון קליטה לעריכה ושליחה"
                >
                  <FileText className="w-3.5 h-3.5 text-emerald-700" />
                  <span>📋 שאלון קליטה</span>
                </button>

                {/* 3. Official Price List */}
                <button
                  type="button"
                  onClick={() => {
                    const text = `🐾 *מחירון פנסיון לילה בריזורט לכלב:*\n• שהות של 1–6 לילות: ₪180 ללילה\n• שהות של 7–20 לילות (משבוע ומעלה): ₪150 ללילה\n• שהות של 21+ לילות (מעל 3 שבועות): ₪120 ללילה\n\n* כלבי בידוד / טיפול מיוחד: ₪230 ללילה\n* אילוף בתנאי פנסיון מלאים: ₪6,500\n* יום כיף (דייקר): ₪90 ליום\n\nנשמח לעמוד לרשותכם לכל שאלה! צוות ${settings.resortName} 🐾`;
                    setMessageInput(text);
                  }}
                  className="bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 font-bold px-2.5 py-1 rounded-xl text-xs flex items-center gap-1 shrink-0 transition-all cursor-pointer shadow-2xs active:scale-95"
                  title="טען מחירון רשמי לעריכה ושליחה"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                  <span>💵 מחירון ועלויות</span>
                </button>

                {/* 4. Operating & Arrival/Pickup Hours */}
                <button
                  type="button"
                  onClick={() => {
                    const text = `שלום ${getFirstName(selectedChat.name)}! 🐾\nזמני הגעה ואיסוף בריזורט לכלב:\n• ימים א׳–ה׳: 09:00 עד 19:00\n• ימי שישי וערבי חג: 09:00 עד 14:00 בדיוק\n• שבתות וחגים: הריזורט סגור לקבלת/שחרור קהל.\nבאיזו שעה משוערת תרצו להגיע? נערך לקראתכם! 🐕`;
                    setMessageInput(text);
                  }}
                  className="bg-sky-50 hover:bg-sky-100 text-sky-950 border border-sky-300 font-bold px-2.5 py-1 rounded-xl text-xs flex items-center gap-1 shrink-0 transition-all cursor-pointer shadow-2xs active:scale-95"
                  title="טען שעות פעילות וזמני קבלה/שחרור לעריכה ושליחה"
                >
                  <Clock className="w-3.5 h-3.5 text-sky-700" />
                  <span>⏰ שעות פעילות והגעה</span>
                </button>

                {/* 5. Health & Vaccination Requirements */}
                <button
                  type="button"
                  onClick={() => {
                    const text = `שלום ${getFirstName(selectedChat.name)}! 🐾\nדרישות בריאות וחיסונים לכניסה לריזורט לכלב:\n1. חיסון משושה בתוקף (בשנה האחרונה)\n2. חיסון כלבת בתוקף + שבב אלקטרוני\n3. טיפול מונע נגד פרעושים וקרציות\n4. מומלץ: חיסון נגד שעלת המכלאות.\nנשמח אם תוכל/י לשלוח לנו כאן צילום של פנקס החיסונים! 📋🐕`;
                    setMessageInput(text);
                  }}
                  className="bg-teal-50 hover:bg-teal-100 text-teal-950 border border-teal-300 font-bold px-2.5 py-1 rounded-xl text-xs flex items-center gap-1 shrink-0 transition-all cursor-pointer shadow-2xs active:scale-95"
                  title="טען דרישות חיסונים ופנקס וטרינרי לעריכה ושליחה"
                >
                  <span>💉 חיסונים ודרישות</span>
                </button>

                {/* 6. Holiday & Peak Season Advance Reservation */}
                <button
                  type="button"
                  onClick={() => {
                    const payUrl = settings.growPaymentLink || 'https://pay.grow.link/MjcyNjk~3d59a40e0ae26ce0d41b50b4eebdff04-MzczNjYzMg';
                    const text = `שלום ${getFirstName(selectedChat.name)}! 🐾\nלקראת תקופת החגים/עונת השיא הריזורט בתפוסה כמעט מלאה!\nכדי להבטיח ולשריין את הסוויטה עבור ${selectedChat.matchedDogName || 'הכלב'}, נדרש שריון מראש עם מקדמה מאובטחת:\n👉 ${payUrl}\nנשמח לשריין לכם מקום!`;
                    setMessageInput(text);
                  }}
                  className="bg-rose-50 hover:bg-rose-100 text-rose-950 border border-rose-300 font-bold px-2.5 py-1 rounded-xl text-xs flex items-center gap-1 shrink-0 transition-all cursor-pointer shadow-2xs active:scale-95"
                  title="טען הודעת שריון מקום בעונות שיא וחגים לעריכה ושליחה"
                >
                  <span>🏝️ שריון חגים ומקדמה</span>
                </button>

                {/* 7. Apology for Delay Response */}
                <button
                  type="button"
                  onClick={() => {
                    const firstName = getFirstName(selectedChat.name);
                    const nameGreeting = firstName && firstName !== selectedChat.cleanPhone ? `היי ${firstName}, ` : 'היי, ';
                    const dogMention = selectedChat.matchedDogName ? ` עבור ${selectedChat.matchedDogName}` : '';
                    const text = `${nameGreeting}סליחה שלקח לנו זמן לחזור אלייך! 🙏🐾\nהיינו ממש עסוקים עם הכלבים בריזורט, לקח לנו זמן לחזור ואנחנו ממש מתנצלים על ההמתנה.\n\nעכשיו אנחנו כאן איתך ובמלוא תשומת הלב – אפשר להתקדם! במה נוכל לעזור${dogMention}? 😊`;
                    setMessageInput(text);
                  }}
                  className="bg-orange-50 hover:bg-orange-100 text-orange-950 border border-orange-300 font-bold px-2.5 py-1 rounded-xl text-xs flex items-center gap-1 shrink-0 transition-all cursor-pointer shadow-2xs active:scale-95"
                  title="טען הודעת התנצלות חמה: היינו בחצר הכלבים, עכשיו אפשר להתקדם"
                >
                  <span>🐾 סליחה שלא חזרנו מהר</span>
                </button>

                {/* 8. Photos & Videos During Stay */}
                <button
                  type="button"
                  onClick={() => {
                    const text = `שלום ${getFirstName(selectedChat.name)}! 🐾\n${selectedChat.matchedDogName || 'הכלב/ה'} מרגיש/ה נהדר, שמח/ה ומשחק/ת במדשאות הירוקות שלנו! 🐶❤️\nנמשיך לשלוח תמונות, סרטונים ועדכונים שוטפים בכל יום סביב 20:00 בערב. תמיד כאן בשבילכם! צוות הריזורט לכלב 🐾`;
                    setMessageInput(text);
                  }}
                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-950 border border-indigo-300 font-bold px-2.5 py-1 rounded-xl text-xs flex items-center gap-1 shrink-0 transition-all cursor-pointer shadow-2xs active:scale-95"
                  title="טען הודעת עדכון ותמונות מהשהות לעריכה ושליחה"
                >
                  <span>📸 תמונות וסרטונים מהשהות</span>
                </button>

                {/* 9. Friendly Follow-up for unanswered questionnaire */}
                <button
                  type="button"
                  onClick={() => {
                    const text = generateFollowUpReminderText(selectedChat.name, selectedChat.matchedDogName);
                    setMessageInput(text);
                  }}
                  className="bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 font-bold px-2.5 py-1 rounded-xl text-xs flex items-center gap-1 shrink-0 transition-all cursor-pointer shadow-2xs active:scale-95"
                  title="טען תזכורת חמה לשאלון קליטה לעריכה ושליחה"
                >
                  <span>🔔 תזכורת חמה לשאלון</span>
                </button>

                {/* 10. Marketing Value Proposition (Resort Advantages & Professional Training) */}
                <button
                  type="button"
                  onClick={() => {
                    const intakeUrl = `${window.location.origin}/?intake=true`;
                    const text = generateResortMarketingValueText(selectedChat.name, selectedChat.matchedDogName, intakeUrl);
                    setMessageInput(text);
                  }}
                  className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black px-3 py-1 rounded-xl text-xs flex items-center gap-1.5 shrink-0 transition-all cursor-pointer shadow-xs active:scale-95"
                  title="טען הודעה שיווקית עשירה: יתרונות הריזורט ותוכנית האילוף של שמוליק"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                  <span>🌟 יתרונות הריזורט והאילוף</span>
                </button>

                {/* 11. Training-focused Marketing Message */}
                <button
                  type="button"
                  onClick={() => {
                    const intakeUrl = `${window.location.origin}/?intake=true`;
                    const text = generateTrainingOnlyMarketingText(selectedChat.name, selectedChat.matchedDogName, intakeUrl);
                    setMessageInput(text);
                  }}
                  className="bg-purple-50 hover:bg-purple-100 text-purple-950 border border-purple-300 font-bold px-2.5 py-1 rounded-xl text-xs flex items-center gap-1 shrink-0 transition-all cursor-pointer shadow-2xs active:scale-95"
                  title="טען הודעה שיווקית ממוקדת באילוף כלבים בהובלת שמוליק"
                >
                  <span>🎓 שיווק אילוף</span>
                </button>

                {/* 12. Boarding-focused Marketing Message */}
                <button
                  type="button"
                  onClick={() => {
                    const intakeUrl = `${window.location.origin}/?intake=true`;
                    const text = generateBoardingOnlyMarketingText(selectedChat.name, selectedChat.matchedDogName, intakeUrl);
                    setMessageInput(text);
                  }}
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-950 border border-emerald-300 font-bold px-2.5 py-1 rounded-xl text-xs flex items-center gap-1 shrink-0 transition-all cursor-pointer shadow-2xs active:scale-95"
                  title="טען הודעה שיווקית ממוקדת בפנסיון הבוטיק ותנאי ה-VIP"
                >
                  <span>🏡 שיווק פנסיון</span>
                </button>

                {/* 13. Send Location / Waze */}
                <button
                  type="button"
                  onClick={() => {
                    const text = `שלום ${getFirstName(selectedChat.name)}! 🐾 להגעה ל${settings.resortName}:\n📍 מיקום וניווט ב-Waze / Google Maps:\nhttps://maps.app.goo.gl/8bm2Rdt7DtHeUS5J9\n\nשעות פעילות:\n• ימים א׳–ה׳: 09:00–19:00\n• שישי וערבי חג: עד 14:00\nמחכים לכם! צוות הריזורט 🐾 (${settings.managerPhone || '050-6336896'})`;
                    setMessageInput(text);
                  }}
                  className="bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-300 font-bold px-2.5 py-1 rounded-xl text-xs flex items-center gap-1 shrink-0 transition-all cursor-pointer shadow-2xs active:scale-95"
                  title="טען מיקום וקישור Waze לעריכה ושליחה"
                >
                  <MapPin className="w-3.5 h-3.5 text-blue-600" />
                  <span>📍 מיקום Waze/Maps</span>
                </button>

                {/* 14. Unanswered button - Remove from active queue until client writes again */}
                <button
                  type="button"
                  onClick={() => {
                    updateChatStatus(selectedChat.cleanPhone, 'handled');
                    setSendSuccessToast(true);
                  }}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-bold px-2.5 py-1 rounded-xl text-xs flex items-center gap-1 shrink-0 transition-all cursor-pointer shadow-2xs active:scale-95"
                  title="לא ענה - הסר מהרשימה עכשיו. השיחה תחזור אוטומטית לקדמת הרשימה בפעם הבאה שהלקוח יכתוב"
                >
                  <X className="w-3.5 h-3.5 text-slate-500" />
                  <span>🚫 לא ענה (הסר עד שיכתוב)</span>
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

      {/* Desktop Only WhatsApp Audit & Deep History Modal */}
      <DesktopWhatsAppAuditModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        chats={chats}
        settings={settings}
        bookings={bookings}
        intakeRequests={intakeRequests}
        onOpenChatInCrm={(chat) => {
          setSelectedChat(chat);
          setIsAuditModalOpen(false);
        }}
      />

      {/* Stealth Reading Mode PIN Modal (קוד 3466) */}
      {isStealthPinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-150" dir="rtl">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-5 text-right animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-purple-100 border border-purple-300 text-purple-800 flex items-center justify-center shadow-inner text-xl">
                  👤
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 leading-tight">
                    קריאת הודעות סמויה
                  </h3>
                  <span className="text-[11px] text-purple-700 font-bold">אי סימון הודעות כנקראות 🛡️</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsStealthPinModalOpen(false);
                  setStealthPinInput('');
                  setStealthPinError(false);
                }}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Question requested by user */}
            <div className="bg-purple-50 p-4 rounded-2xl border border-purple-200 text-center">
              <p className="text-sm font-black text-purple-950 leading-relaxed">
                לקרוא הודעות מבלי שיסומנו כנקראות הקש קוד
              </p>
              <p className="text-[11px] text-purple-700 font-medium mt-1">
                הודעות שתפתח לא יסומנו כנקראות ויישארו לשמוליק ב-״שלא נקראו״
              </p>
            </div>

            {/* Passcode input */}
            <div className="space-y-2">
              <input
                ref={stealthInputRef}
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={stealthPinInput}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setStealthPinInput(val);
                  if (stealthPinError) setStealthPinError(false);
                  if (val.length === 4) {
                    handleVerifyStealthPin(val);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleVerifyStealthPin(stealthPinInput);
                  } else if (e.key === 'Escape') {
                    setIsStealthPinModalOpen(false);
                  }
                }}
                placeholder="••••"
                className={`w-full bg-white text-center text-3xl tracking-[1em] font-mono font-black py-3 rounded-2xl border-2 transition-all focus:outline-none ${
                  stealthPinError
                    ? 'border-rose-500 bg-rose-50 text-rose-700 animate-shake'
                    : 'border-purple-300 focus:border-purple-600 text-slate-900 shadow-inner'
                }`}
                autoFocus
              />

              {stealthPinError && (
                <div className="text-center text-xs font-bold text-rose-600 flex items-center justify-center gap-1">
                  <span>קוד שגוי. אנא נסה שוב (3466).</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleVerifyStealthPin(stealthPinInput)}
                disabled={stealthPinInput.length === 0}
                className="py-2.5 px-4 rounded-xl bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white font-bold text-xs shadow-md transition-all active:scale-98 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>הפעל קריאה סמויה</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsStealthPinModalOpen(false);
                  setStealthPinInput('');
                  setStealthPinError(false);
                }}
                className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all active:scale-98 flex items-center justify-center cursor-pointer border border-slate-200"
              >
                <span>ביטול</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
