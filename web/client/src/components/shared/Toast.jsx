import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

let toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, message, type, duration }]);
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = {
    success: (msg, dur) => addToast(msg, 'success', dur),
    error: (msg, dur) => addToast(msg, 'error', dur || 6000),
    warning: (msg, dur) => addToast(msg, 'warning', dur),
    info: (msg, dur) => addToast(msg, 'info', dur),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

function ToastContainer({ toasts, onRemove }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2" style={{ maxWidth: 380 }}>
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onRemove }) {
  useEffect(() => {
    if (!toast.duration) return;
    const timer = setTimeout(() => onRemove(toast.id), toast.duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onRemove]);

  const icons = {
    success: <CheckCircle size={16} className="text-accent flex-shrink-0" />,
    error: <XCircle size={16} className="text-danger flex-shrink-0" />,
    warning: <AlertCircle size={16} className="text-yellow-400 flex-shrink-0" />,
    info: <Info size={16} className="text-blue-400 flex-shrink-0" />
  };

  const borders = {
    success: 'border-l-accent',
    error: 'border-l-danger',
    warning: 'border-l-yellow-400',
    info: 'border-l-blue-400'
  };

  return (
    <div
      className={`toast-enter flex items-start gap-3 p-3 rounded-lg border border-border bg-bg-card shadow-xl border-l-2 ${borders[toast.type]}`}
      style={{ minWidth: 280 }}
    >
      {icons[toast.type]}
      <span className="flex-1 text-sm text-text-primary">{toast.message}</span>
      <button
        onClick={() => onRemove(toast.id)}
        className="text-text-muted hover:text-text-primary flex-shrink-0 mt-0.5"
      >
        <X size={14} />
      </button>
    </div>
  );
}
