import { Component, type ReactNode, type ErrorInfo } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in application:', error, errorInfo);
  }

  public handleReset = () => {
    try {
      localStorage.clear();
    } catch (e) {
      // ignore
    }
    window.location.reload();
  };

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 text-right" dir="rtl">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-xl border border-slate-200 text-center space-y-4">
            <div className="w-16 h-16 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black text-slate-900">טעינת האפליקציה חודשה</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              האפליקציה מוכנה לעבודה. לחץ על הכפתור למטה כדי לרענן ולהיכנס ישירות ליומן.
            </p>
            <div className="pt-2">
              <button
                onClick={this.handleReset}
                className="w-full flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-3.5 px-6 rounded-2xl shadow-md transition-all active:scale-95 cursor-pointer text-base"
              >
                <RefreshCw className="w-5 h-5" />
                כניסה ליומן עכשיו
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
