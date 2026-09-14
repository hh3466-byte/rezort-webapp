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
  Filter
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
  enrichChatWithSystemData 
} from '../services/whatsappCrmService';

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
  const [filter, setFilter] = useState<'all' | 'customer_with_booking' | 'intake_submitted' | 'new_lead' | 'unread'>('all');

  const [messageInput, setMessageInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendSuccessToast, setSendSuccessToast] = useState(false);

  // Voice dictation
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Messages auto-scroll container ref
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 1. Fetch chats on load
  const loadChats = async () => {
    setIsLoadingChats(true);
    setChatsError(null);
    try {
      const raw = await fetchGreenApiChats(settings);
      const enriched = raw.map(c => enrichChatWithSystemData(c, bookings, intakeRequests));
      setChats(enriched);
      if (enriched.length > 0 && !selectedChat) {
        setSelectedChat(enriched[0]);
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

  // Re-enrich chats whenever bookings or intakeRequests change
  useEffect(() => {
    if (chats.length > 0) {
      setChats(prev => prev.map(c => enrichChatWithSystemData(c, bookings, intakeRequests)));
    }
  }, [bookings, intakeRequests]);

  // 2. Fetch messages when selected chat changes
  const loadChatMessages = async (chat: EnrichedWhatsAppChat) => {
    setIsLoadingMessages(true);
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

  // 5. Filter and Search
  const filteredChats = chats.filter(chat => {
    if (filter === 'customer_with_booking' && chat.classification !== 'customer_with_booking') return false;
    if (filter === 'intake_submitted' && chat.classification !== 'intake_submitted') return false;
    if (filter === 'new_lead' && chat.classification !== 'new_lead') return false;
    if (filter === 'unread' && (!chat.unreadCount || chat.unreadCount <= 0)) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = chat.name.toLowerCase().includes(q);
      const matchPhone = chat.cleanPhone.includes(q);
      const matchDog = (chat.matchedDogName || '').toLowerCase().includes(q);
      return matchName || matchPhone || matchDog;
    }
    return true;
  });

  // Count metrics
  const customerCount = chats.filter(c => c.classification === 'customer_with_booking').length;
  const intakeCount = chats.filter(c => c.classification === 'intake_submitted').length;
  const newLeadCount = chats.filter(c => c.classification === 'new_lead').length;

  return (
    <div className="bg-slate-100 rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-140px)] min-h-[580px]" dir="rtl">
      
      {/* Top Bar / Status */}
      <div className="bg-white px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-2xs shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black text-xl shadow-2xs">
            💬
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
              <span>מרכז וואטסאפ ופניות לקוחות</span>
              <span className="text-[11px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                Green-API מחובר 🟢
              </span>
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              נהל את כל שיחות הוואטסאפ, זהה לקוחות קיימים ופניות חדשות, וענה ישירות עם תבניות מהירות
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadChats}
            disabled={isLoadingChats}
            className="bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer border border-slate-200 shadow-2xs"
            title="רענן רשימת שיחות"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isLoadingChats ? 'animate-spin text-emerald-600' : ''}`} />
            <span>{isLoadingChats ? 'מרענן...' : 'רענן שיחות'}</span>
          </button>
        </div>
      </div>

      {/* Main Two-Pane Splitter */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT COLUMN: Chats & Leads List (Sidebar) */}
        <div className="w-full sm:w-80 md:w-96 bg-white border-l border-slate-200 flex flex-col shrink-0">
          
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

            {/* Classification Filter Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5">
              {[
                { id: 'all', label: 'הכל', count: chats.length },
                { id: 'customer_with_booking', label: '🟢 לקוחות ביומן', count: customerCount },
                { id: 'intake_submitted', label: '🟡 שאלון קליטה', count: intakeCount },
                { id: 'new_lead', label: '⚪ פניות חדשות', count: newLeadCount },
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id as any)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 shrink-0 ${
                    filter === tab.id
                      ? 'bg-[#065f46] text-white shadow-2xs'
                      : 'bg-white hover:bg-slate-200 text-slate-600 border border-slate-200'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${filter === tab.id ? 'bg-emerald-800 text-white' : 'bg-slate-100 text-slate-700'}`}>
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
                לא נמצאו שיחות התואמות את החיפוש
              </div>
            ) : (
              filteredChats.map(chat => {
                const isSelected = selectedChat?.id === chat.id;
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
                    {/* Status Circle Avatar */}
                    <div className="relative shrink-0 mt-0.5">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm shadow-2xs ${
                        chat.classification === 'customer_with_booking'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : chat.classification === 'intake_submitted'
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}>
                        {chat.matchedDogName ? '🐕' : '👤'}
                      </div>
                      <span className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white shadow-2xs ${
                        chat.classification === 'customer_with_booking' ? 'bg-emerald-500' :
                        chat.classification === 'intake_submitted' ? 'bg-amber-500' : 'bg-slate-400'
                      }`} />
                    </div>

                    {/* Chat Text Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="text-xs sm:text-sm font-black text-slate-900 truncate">
                          {chat.name}
                        </h4>
                        {chat.unreadCount && chat.unreadCount > 0 ? (
                          <span className="bg-emerald-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full shadow-2xs shrink-0">
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

                      {/* Classification Badge */}
                      <div className="mt-1">
                        <span className={`text-[10px] font-bold px-2 py-0.2 rounded-md inline-block ${
                          chat.classification === 'customer_with_booking'
                            ? 'bg-emerald-100/90 text-emerald-800'
                            : chat.classification === 'intake_submitted'
                            ? 'bg-amber-100/90 text-amber-800'
                            : 'bg-slate-100 text-slate-500'
                        }`}>
                          {chat.classification === 'customer_with_booking' ? '🟢 לקוח עם הזמנה' :
                           chat.classification === 'intake_submitted' ? '🟡 מילא שאלון קליטה' : '⚪ פנייה חדשה'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
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
                      <h3 className="text-base font-black text-slate-900 truncate">
                        {selectedChat.name}
                      </h3>
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

                    <div className="flex items-center gap-2 text-xs text-slate-500 font-mono mt-0.5" dir="ltr">
                      <span>{selectedChat.cleanPhone}</span>
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

                  {/* "קלוט להזמנה ביומן" */}
                  {onOpenNewBookingWithData && (
                    <button
                      type="button"
                      onClick={() => onOpenNewBookingWithData({
                        ownerName: selectedChat.name,
                        ownerPhone: selectedChat.cleanPhone,
                        dogName: selectedChat.matchedDogName || ''
                      })}
                      className="bg-[#065f46] hover:bg-[#044e45] text-white font-black px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                      title="פתח את אשף ההזמנה עם פרטי הלקוח ממולאים מראש"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>קלוט ליומן 🟢</span>
                    </button>
                  )}
                </div>
              </div>

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
                    const timeStr = new Date(msg.timestamp).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
                    const dateStr = new Date(msg.timestamp).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });

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
                            <span>{dateStr} {timeStr}</span>
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
              <div className="bg-white border-t border-slate-200 px-3 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0 shadow-2xs">
                <span className="text-[11px] font-black text-slate-400 shrink-0 ml-1">
                  תגובה מהירה:
                </span>

                {/* 1. Send Intake Link */}
                <button
                  type="button"
                  onClick={() => {
                    const intakeUrl = `${window.location.origin}/?intake=true`;
                    const text = `שלום ${getFirstName(selectedChat.name)}! 🐾\nכדי שנוכל לבדוק זמינות ולשריין מקום עבור הכלב שלכם ב${settings.resortName}, אנא מלאו את שאלון בקשת הקליטה הקצר:\n${intakeUrl}\n\nנשמח לארח אתכם! צוות הריזורט לכלב 🐾`;
                    handleSendMessage(text);
                  }}
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold px-2.5 py-1 rounded-xl text-xs flex items-center gap-1 shrink-0 transition-all cursor-pointer shadow-2xs active:scale-95"
                >
                  <FileText className="w-3.5 h-3.5 text-emerald-700" />
                  <span>📝 שלח שאלון קליטה</span>
                </button>

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

    </div>
  );
};
