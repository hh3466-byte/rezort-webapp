import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  MessageSquare, 
  Phone, 
  Send, 
  Search, 
  RefreshCw, 
  ExternalLink, 
  Mic, 
  Play, 
  Pause, 
  Check, 
  CheckCheck, 
  Copy, 
  Sparkles, 
  AlertCircle,
  Clock,
  Volume2
} from 'lucide-react';
import { ResortSettings } from '../types';
import { cleanPhoneNumber, openWhatsAppMessage } from '../utils/whatsappUtils';
import { isShabbatOrHolidayRestricted } from '../utils/jewishCalendar';

interface WhatsAppChatHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  phone: string;
  customerName: string;
  dogName?: string;
  settings: ResortSettings;
}

interface ChatMessageItem {
  idMessage: string;
  type: 'incoming' | 'outgoing';
  timestamp: number;
  textMessage?: string;
  typeMessage?: string;
  downloadUrl?: string;
  caption?: string;
  senderName?: string;
  statusMessage?: string;
}

export const WhatsAppChatHistoryModal: React.FC<WhatsAppChatHistoryModalProps> = ({
  isOpen,
  onClose,
  phone,
  customerName,
  dogName,
  settings
}) => {
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Audio playback state
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});

  // Transcriptions map: idMessage -> string
  const [transcriptions, setTranscriptions] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('wa_audio_transcriptions');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [transcribingMap, setTranscribingMap] = useState<Record<string, boolean>>({});
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const cleanPhone = cleanPhoneNumber(phone);
  const formattedChatId = cleanPhone.startsWith('0') 
    ? `972${cleanPhone.slice(1)}@c.us` 
    : (cleanPhone.startsWith('972') ? `${cleanPhone}@c.us` : `972${cleanPhone}@c.us`);

  // Fetch messages from Green-API
  const fetchMessages = async () => {
    if (!cleanPhone) return;
    setLoading(true);
    setError(null);

    const greenId = settings?.greenApiIdInstance?.trim() || '710722735421';
    const greenToken = settings?.greenApiToken?.trim() || 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
    const cluster = greenId.length >= 4 ? greenId.slice(0, 4) : '7107';
    const url = `https://${cluster}.api.greenapi.com/waInstance${greenId}/getChatHistory/${greenToken}`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: formattedChatId, count: 50 })
      });

      if (!res.ok) {
        throw new Error(`שגיאה בטעינת הודעות (${res.status})`);
      }

      const raw = await res.json();
      if (Array.isArray(raw)) {
        // Green-API returns newest first; reverse so oldest is top, newest bottom
        const formatted: ChatMessageItem[] = raw.map((m: any) => ({
          idMessage: m.idMessage || String(Math.random()),
          type: (m.type === 'incoming' ? 'incoming' : 'outgoing') as 'incoming' | 'outgoing',
          timestamp: (m.timestamp ? (m.timestamp < 1e12 ? m.timestamp * 1000 : m.timestamp) : Date.now()),
          textMessage: m.textMessage || m.extendedTextMessageData?.text || m.extendedTextMessage?.text || '',
          typeMessage: m.typeMessage,
          downloadUrl: m.downloadUrl || m.fileMessageData?.downloadUrl || '',
          caption: m.caption || m.fileMessageData?.caption || '',
          senderName: m.senderName,
          statusMessage: m.statusMessage
        })).reverse();

        setMessages(formatted);

        // Auto-transcribe any audio message that isn't transcribed yet
        formatted.forEach(m => {
          const isAudio = m.typeMessage === 'audioMessage' || (m.downloadUrl && (m.downloadUrl.includes('.og') || m.downloadUrl.includes('.mp3') || m.downloadUrl.includes('.m4a') || m.downloadUrl.includes('.wav')));
          if (isAudio && m.downloadUrl && !transcriptions[m.idMessage]) {
            handleTranscribeAudio(m.idMessage, m.downloadUrl);
          }
        });
      }
    } catch (err: any) {
      console.warn('Error fetching WhatsApp history:', err);
      setError(err?.message || 'לא ניתן לטעון היסטוריית הודעות');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchMessages();
    }
  }, [isOpen, cleanPhone]);

  useEffect(() => {
    if (!loading && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading]);

  // Transcribe audio message
  const handleTranscribeAudio = async (msgId: string, audioUrl: string) => {
    if (!audioUrl || transcribingMap[msgId]) return;
    setTranscribingMap(prev => ({ ...prev, [msgId]: true }));

    try {
      // 1. Try server transcription endpoint
      const res = await fetch('/api/transcribe-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioUrl })
      });

      const data = await res.json();
      if (data.ok && data.text) {
        saveTranscription(msgId, data.text);
        return;
      }

      // 2. Client-side Speech Recognition fallback
      const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRec) {
        const recognition = new SpeechRec();
        recognition.lang = 'he-IL';
        recognition.continuous = true;
        recognition.interimResults = false;

        let accumulated = '';
        recognition.onresult = (ev: any) => {
          for (let i = ev.resultIndex; i < ev.results.length; i++) {
            if (ev.results[i].isFinal) {
              accumulated += ev.results[i][0].transcript + ' ';
            }
          }
        };

        recognition.onend = () => {
          if (accumulated.trim()) {
            saveTranscription(msgId, accumulated.trim());
          } else {
            saveTranscription(msgId, 'הודעה קולית (לחץ על הפליי להאזנה)');
          }
        };

        recognition.onerror = () => {
          saveTranscription(msgId, 'הודעה קולית (לחץ על הפליי להאזנה)');
        };

        recognition.start();

        // Play the audio so speech recognition captures it
        const audio = new Audio(audioUrl);
        audio.onended = () => {
          try { recognition.stop(); } catch {}
        };
        audio.play().catch(() => {
          try { recognition.stop(); } catch {}
          saveTranscription(msgId, 'הודעה קולית (לחץ להאזנה)');
        });
      } else {
        saveTranscription(msgId, 'הודעה קולית (ניתן להאזין בנגן)');
      }
    } catch (err) {
      console.warn('Transcription error:', err);
      saveTranscription(msgId, 'הודעה קולית (לחץ להאזנה)');
    } finally {
      setTranscribingMap(prev => ({ ...prev, [msgId]: false }));
    }
  };

  const saveTranscription = (msgId: string, text: string) => {
    setTranscriptions(prev => {
      const updated = { ...prev, [msgId]: text };
      try {
        localStorage.setItem('wa_audio_transcriptions', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // Play / Pause audio
  const togglePlayAudio = (msgId: string, url: string) => {
    if (playingAudioId === msgId) {
      audioRefs.current[msgId]?.pause();
      setPlayingAudioId(null);
    } else {
      if (playingAudioId && audioRefs.current[playingAudioId]) {
        audioRefs.current[playingAudioId].pause();
      }

      if (!audioRefs.current[msgId]) {
        const audio = new Audio(url);
        audio.onended = () => setPlayingAudioId(null);
        audioRefs.current[msgId] = audio;
      }

      audioRefs.current[msgId].play().catch(e => console.warn('Play error:', e));
      setPlayingAudioId(msgId);
    }
  };

  // Send WhatsApp message
  const handleSendReply = async () => {
    const text = replyText.trim();
    if (!text || sendingReply) return;

    // Check Shabbat / Holiday restriction
    const restriction = isShabbatOrHolidayRestricted();
    if (restriction.isRestricted) {
      alert(`שליחת הודעה נחסמה: ${restriction.reason}. חל איסור מוחלט על התקשרות עם לקוחות בערבי שבת/חג ובשבתות/חגים.`);
      return;
    }

    setSendingReply(true);
    const greenId = settings?.greenApiIdInstance?.trim() || '710722735421';
    const greenToken = settings?.greenApiToken?.trim() || 'ddcba65cfbbd48b1a70e87a9a20036b92b2d17d220d44d299b';
    const cluster = greenId.length >= 4 ? greenId.slice(0, 4) : '7107';
    const url = `https://${cluster}.api.greenapi.com/waInstance${greenId}/sendMessage/${greenToken}`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: formattedChatId, message: text })
      });

      if (!res.ok) {
        throw new Error(`שגיאה במשלוח (${res.status})`);
      }

      setReplyText('');
      // Refresh messages after 1 second
      setTimeout(fetchMessages, 1000);
    } catch (err: any) {
      alert(`שגיאה במשלוח הודעה: ${err?.message || err}`);
    } finally {
      setSendingReply(false);
    }
  };

  if (!isOpen) return null;

  // Filter messages by search query
  const filteredMessages = messages.filter(m => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const textMatch = (m.textMessage || '').toLowerCase().includes(q) || (m.caption || '').toLowerCase().includes(q);
    const transMatch = (transcriptions[m.idMessage] || '').toLowerCase().includes(q);
    return textMatch || transMatch;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
      <div 
        className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl flex flex-col h-[92vh] max-h-[850px] border border-slate-200 overflow-hidden"
        dir="rtl"
      >
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 text-white flex items-center justify-between gap-3 shrink-0 shadow-md">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-xl shrink-0">
              💬
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-black truncate">
                  היסטוריית וואטסאפ – {customerName}
                </h3>
                {dogName && (
                  <span className="text-xs bg-white/20 border border-white/20 px-2 py-0.5 rounded-full font-bold">
                    🐕 {dogName}
                  </span>
                )}
              </div>
              <p className="text-xs text-emerald-200/90 font-mono mt-0.5 flex items-center gap-2">
                <span>{phone}</span>
                <span>•</span>
                <span>{messages.length} הודעות מתועדות</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => openWhatsAppMessage(phone, '')}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all text-xs flex items-center gap-1 font-bold"
              title="פתח שיחה בוואטסאפ Web / App"
            >
              <ExternalLink className="w-4 h-4 text-emerald-300" />
              <span className="hidden sm:inline">וואטסאפ Web</span>
            </button>

            <button
              type="button"
              onClick={fetchMessages}
              disabled={loading}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all text-xs"
              title="רענן היסטוריית הודעות"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 bg-white/10 hover:bg-red-500/80 rounded-xl text-white transition-all"
              title="סגור"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2 shrink-0">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="חפש מילה בהיסטוריית ההודעות או בתמלולים..."
            className="w-full bg-transparent border-none text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-xs text-slate-400 hover:text-slate-600 font-bold"
            >
              נקה
            </button>
          )}
        </div>

        {/* Messages Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#e5ddd5]/30">
          {loading && messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2 py-16">
              <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
              <span className="text-xs font-bold">טוען היסטוריית שיחה מוואטסאפ...</span>
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-center text-xs space-y-2 my-8">
              <AlertCircle className="w-6 h-6 mx-auto text-rose-500" />
              <p className="font-bold">{error}</p>
              <button
                type="button"
                onClick={fetchMessages}
                className="px-3 py-1 bg-rose-600 text-white rounded-lg font-bold text-xs hover:bg-rose-700"
              >
                נסה שוב
              </button>
            </div>
          ) : filteredMessages.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-xs">
              <span>לא נמצאו הודעות בשיחה זו</span>
            </div>
          ) : (
            filteredMessages.map((m) => {
              const isOutgoing = m.type === 'outgoing';
              const isAudio = m.typeMessage === 'audioMessage' || (m.downloadUrl && (m.downloadUrl.includes('.og') || m.downloadUrl.includes('.mp3') || m.downloadUrl.includes('.m4a') || m.downloadUrl.includes('.wav')));
              const isImage = m.typeMessage === 'imageMessage';
              const transcribed = transcriptions[m.idMessage];
              const isTranscribing = transcribingMap[m.idMessage];

              const date = new Date(m.timestamp);
              const timeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
              const dateStr = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;

              return (
                <div
                  key={m.idMessage}
                  className={`flex flex-col ${isOutgoing ? 'items-end' : 'items-start'} transition-all`}
                >
                  <div
                    className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-3 shadow-xs space-y-1.5 ${
                      isOutgoing
                        ? 'bg-[#d9fdd3] text-slate-900 rounded-br-xs border border-emerald-200/60'
                        : 'bg-white text-slate-900 rounded-bl-xs border border-slate-200/80'
                    }`}
                  >
                    {/* Sender Label */}
                    <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500 font-semibold border-b border-black/5 pb-1">
                      <span>{isOutgoing ? 'ריזורט לכלב 🐾' : (m.senderName || customerName)}</span>
                      <span className="font-mono text-[9px]">{dateStr} {timeStr}</span>
                    </div>

                    {/* Image Message */}
                    {isImage && m.downloadUrl && (
                      <div className="rounded-xl overflow-hidden border border-slate-200/80 my-1 bg-slate-100">
                        <img
                          src={m.downloadUrl}
                          alt="תמונה בוואטסאפ"
                          className="max-h-60 w-auto object-cover rounded-xl hover:scale-101 transition-transform cursor-pointer"
                          onClick={() => window.open(m.downloadUrl, '_blank')}
                        />
                      </div>
                    )}

                    {/* Audio / Voice Note Message */}
                    {isAudio && (
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center gap-2 p-2 bg-emerald-50/80 rounded-xl border border-emerald-200/60">
                          <button
                            type="button"
                            onClick={() => togglePlayAudio(m.idMessage, m.downloadUrl || '')}
                            className="w-8 h-8 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-2xs cursor-pointer transition-all active:scale-95"
                          >
                            {playingAudioId === m.idMessage ? (
                              <Pause className="w-4 h-4" />
                            ) : (
                              <Play className="w-4 h-4 mr-0.5" />
                            )}
                          </button>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between text-[11px] font-bold text-emerald-950">
                              <span className="flex items-center gap-1">
                                <Volume2 className="w-3.5 h-3.5 text-emerald-700" />
                                <span>הודעה קולית / הקלטה</span>
                              </span>
                              {isTranscribing && (
                                <span className="text-[10px] text-amber-700 font-normal flex items-center gap-1">
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                  <span>מתמלל...</span>
                                </span>
                              )}
                            </div>
                            <div className="w-full bg-emerald-200/50 h-1.5 rounded-full mt-1.5 overflow-hidden">
                              <div className={`h-full bg-emerald-600 ${playingAudioId === m.idMessage ? 'animate-pulse w-full' : 'w-0'}`} />
                            </div>
                          </div>
                        </div>

                        {/* Transcribed Text Display */}
                        {transcribed ? (
                          <div className="bg-amber-50/90 border border-amber-300 rounded-xl p-2.5 text-xs text-amber-950 space-y-1 shadow-2xs">
                            <div className="flex items-center justify-between font-black text-[10px] text-amber-800">
                              <span className="flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-amber-600" />
                                <span>תמלול הקלטה כתוב:</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(transcribed);
                                  setCopiedId(m.idMessage);
                                  setTimeout(() => setCopiedId(null), 2000);
                                }}
                                className="hover:text-amber-900 flex items-center gap-0.5 text-[9px] font-bold cursor-pointer"
                              >
                                {copiedId === m.idMessage ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-600" />
                                    <span>הועתק!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    <span>העתק</span>
                                  </>
                                )}
                              </button>
                            </div>
                            <p className="font-medium whitespace-pre-wrap leading-relaxed">
                              "{transcribed}"
                            </p>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleTranscribeAudio(m.idMessage, m.downloadUrl || '')}
                            disabled={isTranscribing}
                            className="w-full py-1 px-2.5 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded-lg text-[11px] font-black flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                          >
                            <Mic className="w-3.5 h-3.5 text-amber-700" />
                            <span>תמלל הקלטה זו למילים כתובות ✨</span>
                          </button>
                        )}
                      </div>
                    )}

                    {/* Text Message */}
                    {m.textMessage && (
                      <p className="text-xs sm:text-sm whitespace-pre-wrap font-normal leading-relaxed text-slate-800">
                        {m.textMessage}
                      </p>
                    )}

                    {/* Caption */}
                    {m.caption && !m.textMessage && (
                      <p className="text-xs whitespace-pre-wrap text-slate-700">
                        {m.caption}
                      </p>
                    )}

                    {/* Message Status */}
                    <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400 pt-0.5">
                      {isOutgoing && (
                        m.statusMessage === 'read' ? (
                          <span title="נקרא"><CheckCheck className="w-3.5 h-3.5 text-sky-500" /></span>
                        ) : m.statusMessage === 'delivered' ? (
                          <span title="נמסר"><CheckCheck className="w-3.5 h-3.5 text-slate-400" /></span>
                        ) : (
                          <span title="נשלח"><Check className="w-3.5 h-3.5 text-slate-400" /></span>
                        )
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Reply Bar */}
        <div className="p-3 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0">
          <input
            type="text"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendReply();
              }
            }}
            placeholder={`כתוב מענה מהיר ל-${customerName}...`}
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          />
          <button
            type="button"
            onClick={handleSendReply}
            disabled={!replyText.trim() || sendingReply}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-xl text-xs sm:text-sm flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">שלח</span>
          </button>
        </div>
      </div>
    </div>
  );
};
