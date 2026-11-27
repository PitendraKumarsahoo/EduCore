import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let readable = 'An unexpected application error occurred. Please reload to continue.';
    try {
      const parsed = JSON.parse(error.message) as { error?: string };
      if (parsed && parsed.error) {
        readable = parsed.error.includes('Missing or insufficient permissions')
          ? 'You do not have permission to access this resource. Please verify your assigned institutional role.'
          : parsed.error;
      }
    } catch {
      if (error.message && !error.message.includes('Missing or insufficient permissions')) {
        readable = error.message;
      }
    }
    return { hasError: true, message: readable };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('EduCore ErrorBoundary caught:', error, info);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F3F6FA] flex items-center justify-center p-6">
          <div className="max-w-md w-full ec-card p-8 text-center">
            <div className="w-12 h-12 rounded-[12px] bg-red-50 border border-red-200 flex items-center justify-center text-red-700 mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h1 className="text-[20px] font-semibold text-slate-900">Something went wrong</h1>
            <p className="text-[15px] text-slate-600 leading-relaxed mt-2 mb-6">{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="ec-btn-primary"
            >
              <RotateCcw className="w-4 h-4" />
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
