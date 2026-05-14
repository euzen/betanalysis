import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType>({ toast: () => {} });

const ICONS = {
  success: <CheckCircle size={20} className="text-green-500 shrink-0" />,
  error: <XCircle size={20} className="text-red-500 shrink-0" />,
  info: <AlertCircle size={20} className="text-blue-500 shrink-0" />,
};

const COLORS = {
  success: 'border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800',
  error: 'border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800',
  info: 'border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800',
};

let _id = 0;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = ++_id;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  const remove = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none print:hidden">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`flex items-center gap-3 px-5 py-3.5 rounded-xl border shadow-lg text-base font-medium pointer-events-auto min-w-[260px] max-w-sm
              animate-in slide-in-from-right-4 duration-200 ${COLORS[t.type]}`}
          >
            {ICONS[t.type]}
            <span className="text-gray-800">{t.message}</span>
            <button onClick={() => remove(t.id)} className="ml-2 text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
