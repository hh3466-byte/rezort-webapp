import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  Square, 
  Keyboard, 
  Send, 
  Loader2, 
  X, 
  AlertTriangle 
} from 'lucide-react';
import { AgentActionProposal } from '../types';

interface VoiceAgentBarProps {
  onProcessCommand: (text: string) => Promise<AgentActionProposal>;
}

export const VoiceAgentBar: React.FC<VoiceAgentBarProps> = ({
  onProcessCommand,
}) => {
  const [mode, setMode] = useState<'voice' | 'text'>('voice');
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [textInput, setTextInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'he-IL';

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscript(currentTranscript);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setErrorMsg('הרשאת מיקרופון נחסמה בדפדפן. הועברת למצב הקלדה.');
          setMode('text');
        }
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const handleStartRecording = () => {
    setErrorMsg(null);
    setTranscript('');

    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (err) {
        try {
          recognitionRef.current.stop();
          setTimeout(() => {
            recognitionRef.current.start();
            setIsRecording(true);
          }, 200);
        } catch (e) {
          setErrorMsg('שגיאה בהפעלת המיקרופון. נסה שוב או עבור להקלדה.');
        }
      }
    } else {
      setErrorMsg('הדפדפן אינו תומך בהקלטה ישירה. הקלד ידנית או השתמש ב-Chrome.');
      setMode('text');
    }
  };

  const handleStopRecordingAndAnalyze = async () => {
    if (recognitionRef.current && isRecording) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
    setIsRecording(false);

    const speechToProcess = transcript.trim();
    if (!speechToProcess) {
      setErrorMsg('לא נקלט דיבור. לחץ, דבר וסיים.');
      return;
    }

    await handleExecute(speechToProcess);
  };

  const handleTextSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!textInput.trim()) return;
    await handleExecute(textInput);
    setTextInput('');
  };

  const handleExecute = async (rawString: string) => {
    setIsProcessing(true);
    setErrorMsg(null);
    try {
      await onProcessCommand(rawString);
      setTranscript('');
    } catch (err: any) {
      setErrorMsg(err.message || 'שגיאה בניתוח ההודעה. נסה שוב.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full space-y-2">
      {/* Error or Notice Alert */}
      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-2xl flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Quick Prompt Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar text-xs">
        <span className="text-slate-400 font-semibold shrink-0 text-[11px]">הוראות מהירות לסוכן:</span>
        <button
          type="button"
          onClick={() => handleExecute('שריין מקום לפנסיון לכלב לאקי של דני ממחר עד סוף השבוע 500 שח שילם מקדמה 150')}
          disabled={isProcessing}
          className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-lg shrink-0 font-medium cursor-pointer transition-colors"
        >
          ✨ שריון לפנסיון
        </button>
        <button
          type="button"
          onClick={() => handleExecute('הורד קובץ גיבוי של כל הנתונים')}
          disabled={isProcessing}
          className="bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 px-2.5 py-1 rounded-lg shrink-0 font-medium cursor-pointer transition-colors"
        >
          💾 בצע גיבוי
        </button>
        <button
          type="button"
          onClick={() => handleExecute('למחוק את כל הנתונים ביומן')}
          disabled={isProcessing}
          className="bg-red-50 hover:bg-red-100 text-red-800 border border-red-200 px-2.5 py-1 rounded-lg shrink-0 font-medium cursor-pointer transition-colors"
        >
          🧹 מחק את כל הנתונים
        </button>
        <button
          type="button"
          onClick={() => handleExecute('רשום תהליך אילוף 70 יום לכלב')}
          disabled={isProcessing}
          className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-lg shrink-0 font-medium cursor-pointer transition-colors"
        >
          🎓 תהליך אילוף (70 יום)
        </button>
        <button
          type="button"
          onClick={() => handleExecute('עבור למסך דוחות כספיים')}
          disabled={isProcessing}
          className="bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 px-2.5 py-1 rounded-lg shrink-0 font-medium cursor-pointer transition-colors"
        >
          💰 עבור לדוחות
        </button>
      </div>

      {/* Main Bottom Control Row matching the screenshot */}
      <div className="flex items-center gap-3 w-full">
        
        {/* Left Side: Type Mode Switch Button */}
        <button
          onClick={() => {
            setErrorMsg(null);
            setMode(mode === 'voice' ? 'text' : 'voice');
          }}
          className="bg-white hover:bg-slate-50 active:scale-98 border border-slate-200 text-slate-700 rounded-2xl p-3 flex flex-col items-center justify-center min-w-[95px] sm:min-w-[110px] h-[72px] shadow-xs transition-all cursor-pointer select-none"
        >
          <span className="text-lg">⌨️</span>
          <span className="text-xs font-bold text-slate-700 mt-0.5">
            {mode === 'voice' ? 'עבור להקלדה' : 'חזור לקול'}
          </span>
        </button>

        {/* Right Side: Main Large Action Button */}
        {mode === 'voice' ? (
          <button
            onClick={isRecording ? handleStopRecordingAndAnalyze : handleStartRecording}
            disabled={isProcessing}
            className={`flex-1 rounded-2xl p-3 sm:px-6 h-[72px] flex flex-col items-center justify-center shadow-md transition-all active:scale-99 cursor-pointer select-none ${
              isRecording
                ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
                : isProcessing
                ? 'bg-[#044e45] text-white opacity-90 cursor-wait'
                : 'bg-[#044e45] hover:bg-[#033b34] text-white'
            }`}
          >
            {isProcessing ? (
              <div className="flex items-center gap-2 font-black text-base sm:text-lg">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>מעבד את ההזמנה שלך...</span>
              </div>
            ) : isRecording ? (
              <>
                <div className="flex items-center gap-2 font-black text-base sm:text-lg">
                  <Square className="w-5 h-5 fill-white" />
                  <span>⏹️ סיים הקלטה ושמור</span>
                </div>
                <div className="text-xs text-white/90 font-medium truncate max-w-md mt-0.5">
                  {transcript ? `"${transcript}"` : 'מקשיב... דבר עכשיו'}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 font-black text-base sm:text-lg text-white">
                  <span>🎙️</span>
                  <span>לחץ עלי על מנת להתחיל</span>
                </div>
                <div className="text-xs text-emerald-200 font-medium mt-0.5">
                  דבר על הזמנה, תשלום או ביטול — ואוסיף ליומן
                </div>
              </>
            )}
          </button>
        ) : (
          /* Text Input Mode */
          <form onSubmit={handleTextSubmit} className="flex-1 flex items-center gap-2 h-[72px]">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder='למשל: "שמוליק, שריין מקום למקסי מיום ראשון עד רביעי, 600 ש״ח, שילם בביט מקדמה 150"'
              disabled={isProcessing}
              className="flex-1 h-full bg-white text-slate-900 border border-slate-300 rounded-2xl px-4 text-xs sm:text-sm font-medium focus:outline-none focus:border-[#044e45] shadow-xs"
              autoFocus
            />
            <button
              type="submit"
              disabled={isProcessing || !textInput.trim()}
              className="bg-[#044e45] hover:bg-[#033b34] text-white h-full px-5 rounded-2xl font-bold text-sm shadow-md flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-4 h-4 rotate-180" />}
              <span className="hidden sm:inline">שלח</span>
            </button>
          </form>
        )}

      </div>
    </div>
  );
};
