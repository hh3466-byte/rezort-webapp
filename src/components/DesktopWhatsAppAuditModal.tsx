import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  MessageSquare,
  RefreshCw,
  X,
  Phone,
  User,
  Dog,
  Calendar,
  Filter,
  ArrowRight,
  Clock
} from 'lucide-react';
import { EnrichedWhatsAppChat, fetchGreenApiChatHistory } from '../services/whatsappCrmService';
import { Booking, IntakeRequest, ResortSettings, WhatsAppMessage } from '../types';

interface DesktopWhatsAppAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  chats: EnrichedWhatsAppChat[];
  settings: ResortSettings;
  bookings: Booking[];
  intakeRequests: IntakeRequest[];
  onOpenChatInCrm?: (chat: EnrichedWhatsAppChat) => void;
}

// Preset issue categories for quick discovery
const AUDIT_PRESETS = [
  {
    id: 'all',
    label: 'כל השיחות',
    icon: '💬',
    keywords: []
  },
  {
    id: 'issues',
    label: '⚠️ תלונות ובעיות',
    icon: '⚠️',
    keywords: ['טעות', 'שגוי', 'בעיה', 'תקלה', 'לא קיבלתי', 'לא נכון', 'כועס', 'לחכות', 'הבטחתם', 'ביטול', 'מאוכזב', 'החזר']
  },
  {
    id: 'payments',
    label: '💳 תשלומים ולינקים',
    icon: '💳',
    keywords: ['תשלום', 'קישור', 'לינק', 'מקדמה', 'שולם', 'גרו', 'grow', 'קבלה', 'חשבונית', 'אשראי', 'העברה']
  },
  {
    id: 'dates',
    label: '📅 תאריכים ושריונים',
    icon: '📅',
    keywords: ['תאריך', 'שריון', 'הזמנה', 'מתי', 'כניסה', 'יציאה', 'שעה', 'תפוס', 'פנוי', 'מלא']
  },
  {
    id: 'intake',
    label: '📋 טפסי קליטה ושאלונים',
    icon: '📋',
    keywords: ['טופס', 'שאלון', 'קליטה', 'פרטים', 'חיסונים', 'תוקף']
  }
];

export const DesktopWhatsAppAuditModal: React.FC<DesktopWhatsAppAuditModalProps> = ({
  isOpen,
  onClose,
  chats,
  settings,
  bookings,
  intakeRequests,
  onOpenChatInCrm
}) => {
  const [activePreset, setActivePreset] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedChat, setSelectedChat] = useState<EnrichedWhatsAppChat | null>(null);
  const [chatMessages, setChatMessages] = useState<WhatsAppMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(false);
  const [inChatSearch, setInChatSearch] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  // When modal opens, select first chat if available
  useEffect(() => {
    if (isOpen && chats.length > 0 && !selectedChat) {
      setSelectedChat(chats[0]);
    }
  }, [isOpen, chats]);

  // Load deep message history whenever selected chat changes
  useEffect(() => {
    if (!selectedChat) {
      setChatMessages([]);
      return;
    }

    let isMounted = true;
    const loadDeepHistory = async () => {
      setIsLoadingMessages(true);
      try {
        const history = await fetchGreenApiChatHistory(selectedChat.id, 100, settings);
        if (isMounted) {
          setChatMessages(history);
        }
      } catch (err) {
        console.warn('Could not fetch deep chat history for audit:', err);
        // Fallback to chat's last message if available
        if (isMounted && selectedChat.lastMessage) {
          setChatMessages([
            {
              idMessage: 'last-msg',
              type: selectedChat.lastMessage.type === 'incoming' ? 'incoming' : 'outgoing',
              timestamp: selectedChat.lastMessage.timestamp,
              textMessage: selectedChat.lastMessage.textMessage || ''
            }
          ]);
        }
      } finally {
        if (isMounted) setIsLoadingMessages(false);
      }
    };

    loadDeepHistory();
    return () => {
      isMounted = false;
    };
  }, [selectedChat, settings]);

  // Handle manual deep reload
  const handleReloadDeepHistory = async () => {
    if (!selectedChat) return;
    setIsLoadingMessages(true);
    try {
      const history = await fetchGreenApiChatHistory(selectedChat.id, 150, settings);
      setChatMessages(history);
    } catch (err) {
      console.error('Error reloading history:', err);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  // Filter chats by search query and active preset keywords
  const filteredChats = useMemo(() => {
    const preset = AUDIT_PRESETS.find(p => p.id === activePreset);
    const keywords = preset?.keywords || [];
    const query = searchTerm.trim().toLowerCase();

    return chats.filter(chat => {
      const nameMatch = chat.name?.toLowerCase().includes(query) || false;
      const phoneMatch = chat.cleanPhone?.includes(query) || chat.id.includes(query);
      const dogMatch = chat.matchedDogName?.toLowerCase().includes(query) || false;
      const lastMsgText = chat.lastMessage?.textMessage?.toLowerCase() || '';
      const textMatch = lastMsgText.includes(query);

      const matchesSearch = !query || nameMatch || phoneMatch || dogMatch || textMatch;
      if (!matchesSearch) return false;

      // Check preset keywords
      if (keywords.length > 0) {
        const matchesKeyword = keywords.some(kw => lastMsgText.includes(kw.toLowerCase()));
        return matchesKeyword;
      }

      return true;
    });
  }, [chats, activePreset, searchTerm]);

  // Messages in current chat matching in-chat search
  const displayedMessages = useMemo(() => {
    if (!inChatSearch.trim()) return chatMessages;
    const q = inChatSearch.trim().toLowerCase();
    return chatMessages.filter(m => m.textMessage.toLowerCase().includes(q));
  }, [chatMessages, inChatSearch]);

  // Highlight keywords inside text
  const highlightMatches = (text: string, term: string) => {
    if (!term.trim()) return text;
    const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-amber-300 text-slate-950 font-bold px-0.5 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  // Copy chat transcript to clipboard
  const handleCopyTranscript = () => {
    if (!selectedChat || chatMessages.length === 0) return;
    const header = `--- תמליל שיחה: ${selectedChat.name} (${selectedChat.cleanPhone}) | ריזורט לכלב ---\n\n`;
    const body = chatMessages
      .map(m => {
        const timeStr = new Date(m.timestamp).toLocaleString('he-IL');
        const sender = m.type === 'incoming' ? selectedChat.name : 'ריזורט לכלב';
        return `[${timeStr}] ${sender}: ${m.textMessage}`;
      })
      .join('\n\n');

    navigator.clipboard.writeText(header + body).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-150"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-6xl h-[90vh] max-h-[850px] shadow-2xl flex flex-col overflow-hidden text-slate-100"
        onClick={e => e.stopPropagation()}
      >
        {/* Top Header Bar */}
        <div className="bg-slate-950/90 border-b border-slate-800 px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/30 border border-indigo-400/40 text-indigo-300 flex items-center justify-center text-xl shadow-inner font-black">
              🖥️
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-black text-white tracking-tight">
                  סורק היסטוריית וואטסאפ ואיתור בעיות (Desktop Audit)
                </h2>
                <span className="bg-indigo-950 text-indigo-300 border border-indigo-700/60 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full">
                  מחשב בלבד
                </span>
                <span className="bg-emerald-950 text-emerald-300 border border-emerald-700/60 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {filteredChats.length} שיחות מתאימות
                </span>
              </div>
              <p className="text-xs text-slate-400">
                חיפוש חופשי בכל השיחות, צפייה בעד 150 הודעות אחרונות לשיחה, איתור תלונות ובעיות תשלום
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer border border-slate-700"
              title="סגור חלון (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter & Search Toolbar */}
        <div className="bg-slate-950/50 border-b border-slate-800 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          {/* Preset Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {AUDIT_PRESETS.map(preset => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setActivePreset(preset.id)}
                className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                  activePreset === preset.id
                    ? 'bg-indigo-600 border-indigo-400 text-white shadow-md shadow-indigo-600/30'
                    : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                }`}
              >
                <span>{preset.icon}</span>
                <span>{preset.label}</span>
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative min-w-[260px] flex-1 sm:max-w-xs">
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="חפש מילה, שם, כלב או טלפון..."
              className="w-full bg-slate-800/90 border border-slate-700 focus:border-indigo-500 rounded-xl pr-9 pl-8 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all font-medium"
            />
            <Search className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Main Content: Split View (Left Chats List, Right Transcript Viewer) */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Chat List Column (Sidebar) */}
          <div className="w-80 md:w-96 border-l border-slate-800 flex flex-col bg-slate-900/60 overflow-hidden shrink-0">
            <div className="px-4 py-2 bg-slate-950/40 border-b border-slate-800 text-[11px] font-bold text-slate-400 flex items-center justify-between">
              <span>רשימת שיחות ({filteredChats.length})</span>
              {activePreset !== 'all' && (
                <span className="text-amber-400 text-[10px]">מסונן לפי: {AUDIT_PRESETS.find(p => p.id === activePreset)?.label}</span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
              {filteredChats.length === 0 ? (
                <div className="p-8 text-center text-slate-400 space-y-2">
                  <div className="text-3xl">🔍</div>
                  <p className="font-bold text-sm text-slate-300">לא נמצאו שיחות תואמות</p>
                  <p className="text-xs">נסה להחליף מילת חיפוש או לבחור בקטגוריה אחרת</p>
                </div>
              ) : (
                filteredChats.map(chat => {
                  const isSelected = selectedChat?.id === chat.id;
                  const lastMsg = chat.lastMessage;
                  const timeStr = lastMsg?.timestamp
                    ? new Date(lastMsg.timestamp).toLocaleDateString('he-IL', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : '';

                  return (
                    <div
                      key={chat.id}
                      onClick={() => setSelectedChat(chat)}
                      className={`p-3 transition-all cursor-pointer select-none ${
                        isSelected
                          ? 'bg-indigo-950/70 border-r-4 border-r-indigo-500 shadow-inner'
                          : 'hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-black text-sm text-white truncate">{chat.name}</span>
                          {chat.matchedDogName && (
                            <span className="text-[10px] bg-slate-800 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 rounded shrink-0">
                              🐾 {chat.matchedDogName}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono shrink-0">{timeStr}</span>
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                        <span className="font-mono text-[11px] text-slate-300">{chat.cleanPhone}</span>
                        {chat.classification === 'customer_with_booking' && (
                          <span className="text-[9px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-1 rounded">
                            📅 ביומן
                          </span>
                        )}
                        {chat.classification === 'intake_submitted' && (
                          <span className="text-[9px] bg-amber-950 text-amber-400 border border-amber-800 px-1 rounded">
                            📋 שאלון
                          </span>
                        )}
                      </div>

                      {lastMsg?.textMessage && (
                        <p className="text-xs text-slate-300 line-clamp-2 bg-slate-950/40 p-1.5 rounded-lg border border-slate-800/60 font-sans">
                          {highlightMatches(lastMsg.textMessage, searchTerm)}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Transcript Viewer Column (Main) */}
          <div className="flex-1 flex flex-col bg-slate-900 overflow-hidden">
            {selectedChat ? (
              <>
                {/* Chat Action Header */}
                <div className="bg-slate-950/80 px-6 py-3.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-emerald-700/30 border border-emerald-500/40 flex items-center justify-center text-lg font-black text-emerald-300">
                      🐶
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-black text-white truncate">{selectedChat.name}</h3>
                        <span className="font-mono text-xs text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-2 py-0.5 rounded-md">
                          {selectedChat.cleanPhone}
                        </span>
                        {selectedChat.matchedDogName && (
                          <span className="text-xs font-bold text-slate-300 bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700">
                            כלב: {selectedChat.matchedDogName}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {chatMessages.length} הודעות נטענו • Green-API סריקה
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* In-chat search */}
                    <div className="relative w-44">
                      <input
                        type="text"
                        value={inChatSearch}
                        onChange={e => setInChatSearch(e.target.value)}
                        placeholder="חיפוש בשיחה זו..."
                        className="w-full bg-slate-800 border border-slate-700 focus:border-indigo-400 rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-400 focus:outline-none"
                      />
                      {inChatSearch && (
                        <button
                          type="button"
                          onClick={() => setInChatSearch('')}
                          className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Reload Deep History */}
                    <button
                      type="button"
                      onClick={handleReloadDeepHistory}
                      disabled={isLoadingMessages}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-2.5 py-1.5 rounded-xl border border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer"
                      title="טען עד 150 הודעות אחרונות לשיחה זו מגרין-אייפי"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoadingMessages ? 'animate-spin text-indigo-400' : ''}`} />
                      <span>{isLoadingMessages ? 'טוען...' : 'רענן 150 הודעות'}</span>
                    </button>

                    {/* Copy Transcript */}
                    <button
                      type="button"
                      onClick={handleCopyTranscript}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-2.5 py-1.5 rounded-xl border border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer"
                      title="העתק את כל תוכן השיחה ללוח"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'הועתק!' : 'העתק תמליל'}</span>
                    </button>

                    {/* Open in WhatsApp Web */}
                    <a
                      href={`https://web.whatsapp.com/send?phone=${selectedChat.cleanPhone}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold px-2.5 py-1.5 rounded-xl flex items-center gap-1 transition-all shadow-xs"
                      title="פתח צ'אט זה ישירות ב-WhatsApp Web"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>פתח בווב</span>
                    </a>

                    {/* Jump to CRM */}
                    {onOpenChatInCrm && (
                      <button
                        type="button"
                        onClick={() => {
                          onOpenChatInCrm(selectedChat);
                          onClose();
                        }}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black px-3 py-1.5 rounded-xl flex items-center gap-1 transition-all shadow-xs cursor-pointer active:scale-95"
                        title="עבור לשיחה זו במסך ה-CRM הרגיל כדי לשלוח הודעה"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>טפל ב-CRM</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Messages Stream */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-950/30">
                  {isLoadingMessages ? (
                    <div className="py-16 text-center space-y-3">
                      <RefreshCw className="w-8 h-8 animate-spin text-indigo-400 mx-auto" />
                      <p className="text-sm font-bold text-slate-300">טוען היסטוריית שיחה מלאה...</p>
                    </div>
                  ) : displayedMessages.length === 0 ? (
                    <div className="py-16 text-center text-slate-400 space-y-2">
                      <div className="text-4xl">💬</div>
                      <p className="font-bold text-slate-300">אין הודעות להצגה בטווח זה</p>
                      <p className="text-xs">לחץ על &quot;רענן 150 הודעות&quot; כדי לטעון היסטוריה ישירות מהשרת</p>
                    </div>
                  ) : (
                    displayedMessages.map(msg => {
                      const isIncoming = msg.type === 'incoming';
                      const timeStr = new Date(msg.timestamp).toLocaleTimeString('he-IL', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      });
                      const dateStr = new Date(msg.timestamp).toLocaleDateString('he-IL', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                      });

                      return (
                        <div
                          key={msg.idMessage}
                          className={`flex flex-col ${isIncoming ? 'items-start' : 'items-end'}`}
                        >
                          <div
                            className={`max-w-xl rounded-2xl p-3.5 text-xs shadow-md border ${
                              isIncoming
                                ? 'bg-slate-800 text-slate-100 border-slate-700/80 rounded-tr-none'
                                : 'bg-emerald-950/90 text-emerald-50 border-emerald-700/60 rounded-tl-none'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-4 text-[10px] text-slate-400 mb-1 pb-1 border-b border-slate-700/40">
                              <span className="font-bold text-slate-300">
                                {isIncoming ? `👤 ${selectedChat.name}` : '🐾 הריזורט לכלב (שמוליק)'}
                              </span>
                              <div className="flex items-center gap-1.5 font-mono">
                                <span>{dateStr}</span>
                                <span>•</span>
                                <span>{timeStr}</span>
                                {msg.statusMessage && (
                                  <span className="text-[9px] text-slate-400">({msg.statusMessage})</span>
                                )}
                              </div>
                            </div>

                            <p className="whitespace-pre-wrap leading-relaxed text-sm font-sans selection:bg-indigo-500">
                              {highlightMatches(msg.textMessage, inChatSearch || searchTerm)}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8 space-y-3">
                <div className="text-5xl">📋</div>
                <p className="text-base font-bold text-slate-300">בחר שיחה מהרשימה מימין לצפייה בהיסטוריה המלאה</p>
                <p className="text-xs text-slate-400">
                  ניתן לבחור קטגוריית בעיות למעלה כדי לסנן שיחות שיש בהן תלונות, בעיות תשלום או שריוני תאריכים
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
