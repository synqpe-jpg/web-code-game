import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message?: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-20 right-3 left-3 sm:left-auto sm:right-5 sm:bottom-5 z-50 flex flex-col gap-2 pointer-events-none max-w-[calc(100vw-24px)] sm:max-w-sm w-auto box-border overflow-hidden"
      style={{ maxWidth: 'calc(100vw - 24px)' }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-start gap-3 p-4 rounded-xl shadow-2xl glass-panel border border-border/80 bg-card/95 text-foreground animate-scale-in max-w-full w-full box-border overflow-hidden"
          role="alert"
        >
          {toast.type === 'success' && (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          )}
          {toast.type === 'error' && (
            <AlertCircle className="w-5 h-5 text-accent shrink-0 mt-0.5" />
          )}
          {toast.type === 'info' && (
            <Info className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm leading-tight text-foreground">
              {toast.title}
            </h4>
            {toast.message && (
              <p className="text-xs text-muted-foreground mt-1 leading-snug break-words">
                {toast.message}
              </p>
            )}
          </div>
          <button
            onClick={() => onDismiss(toast.id)}
            className="text-muted-foreground hover:text-foreground p-1 rounded-lg transition-colors cursor-pointer"
            aria-label="Đóng thông báo"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};
