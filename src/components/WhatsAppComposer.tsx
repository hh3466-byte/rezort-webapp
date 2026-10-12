import React, { useState, useRef, forwardRef, useImperativeHandle } from 'react';
import { Mic, MicOff, Send } from 'lucide-react';

export interface WhatsAppComposerHandle {
  setText: (text: string | ((prev: string) => string)) => void;
  getText: () => string;
  focus: () => void;
  clear: () => void;
}

interface WhatsAppComposerProps {
  onSendMessage: (text: string) => Promise<void> | void;
  isSending: boolean;
  disabled?: boolean;
}

export const WhatsAppComposer = forwardRef<WhatsAppComposerHandle, WhatsAppComposerProps>(({
  onSendMessage,
  isSending,
  disabled
}, ref) => {
  const [text, setText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  useImperativeHandle(ref, () => ({
    setText: (newVal) => {
      setText(prev => {
        const val = typeof newVal === 'function' ? newVal(prev) : newVal;
        return val;
      });
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.style.height = 'auto';
          textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
        }
      }, 50);
    },
    getText: () => text,
    focus: () => textareaRef.current?.focus(),
    clear: () => {
      setText('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    }
  }));

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || isSending || disabled) return;
    onSendMessage(trimmed);
    setText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

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
          setText(prev => {
            const updated = prev ? `${prev} ${chunk.trim()}` : chunk.trim();
            if (textareaRef.current) {
              textareaRef.current.style.height = 'auto';
              textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
            }
            return updated;
          });
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

  return (
    <div className="bg-white p-2.5 sm:p-3 border-t border-slate-200 flex items-center gap-2 shrink-0">
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

      {/* Textarea - local state isolated from parent to eliminate mobile typing lag */}
      <div className="flex-1 relative">
        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={isListening ? 'מקליט... דבר עכשיו 🎙️' : 'הקלד הודעת וואטסאפ ישירה ללקוח (Enter לשליחה)...'}
          className="w-full bg-slate-50 focus:bg-white text-slate-900 border border-slate-300 focus:border-emerald-500 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none max-h-32 transition-colors"
        />
      </div>

      {/* Send Button */}
      <button
        type="button"
        disabled={!text.trim() || isSending || disabled}
        onClick={handleSend}
        className="bg-[#25D366] hover:bg-[#1EBE5D] active:scale-95 disabled:opacity-40 disabled:scale-100 text-white font-black px-4 py-2.5 rounded-xl text-xs sm:text-sm flex items-center gap-1.5 shadow-xs transition-all cursor-pointer shrink-0"
        title="שלח עכשיו בוואטסאפ דרך Green-API"
      >
        <Send className="w-4 h-4" />
        <span>{isSending ? 'שולח...' : 'שלח'}</span>
      </button>
    </div>
  );
});

WhatsAppComposer.displayName = 'WhatsAppComposer';
