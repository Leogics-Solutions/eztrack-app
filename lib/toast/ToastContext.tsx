import React, { createContext, useState, useCallback, ReactNode } from 'react';
import { Toast, ToastOptions, ToastPosition } from './types';
import ToastContainer from '@/components/Toast/ToastContainer';

interface ToastContextType {
  showToast: (message: string, options?: ToastOptions) => void;
  success: (message: string, options?: Omit<ToastOptions, 'type'>) => void;
  error: (message: string, options?: Omit<ToastOptions, 'type'>) => void;
  warning: (message: string, options?: Omit<ToastOptions, 'type'>) => void;
  info: (message: string, options?: Omit<ToastOptions, 'type'>) => void;
  removeToast: (id: string) => void;
  setDefaultPosition: (position: ToastPosition) => void;
}

export const ToastContext = createContext<ToastContextType | undefined>(undefined);

interface ToastProviderProps {
  children: ReactNode;
  defaultPosition?: ToastPosition;
  defaultDuration?: number;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({
  children,
  defaultPosition = 'top-right',
  defaultDuration = 3000,
}) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [position, setPosition] = useState<ToastPosition>(defaultPosition);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, options?: ToastOptions) => {
      const id = `toast-${Date.now()}-${Math.random()}`;
      const newToast: Toast = {
        id,
        message,
        type: options?.type || 'info',
        duration: options?.duration || defaultDuration,
      };

      if (options?.position) {
        setPosition(options.position);
      }

      setToasts((prev) => [...prev, newToast]);
    },
    [defaultDuration]
  );

  const success = useCallback(
    (message: string, options?: Omit<ToastOptions, 'type'>) => {
      showToast(message, { ...options, type: 'success' });
    },
    [showToast]
  );

  const error = useCallback(
    (message: string, options?: Omit<ToastOptions, 'type'>) => {
      showToast(message, { ...options, type: 'error' });
    },
    [showToast]
  );

  const warning = useCallback(
    (message: string, options?: Omit<ToastOptions, 'type'>) => {
      showToast(message, { ...options, type: 'warning' });
    },
    [showToast]
  );

  const info = useCallback(
    (message: string, options?: Omit<ToastOptions, 'type'>) => {
      showToast(message, { ...options, type: 'info' });
    },
    [showToast]
  );

  const setDefaultPosition = useCallback((newPosition: ToastPosition) => {
    setPosition(newPosition);
  }, []);

  return (
    <ToastContext.Provider
      value={{
        showToast,
        success,
        error,
        warning,
        info,
        removeToast,
        setDefaultPosition,
      }}
    >
      {children}
      <ToastContainer toasts={toasts} position={position} onClose={removeToast} />
    </ToastContext.Provider>
  );
};
