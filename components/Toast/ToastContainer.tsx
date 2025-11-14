import React from 'react';
import { Toast as ToastType, ToastPosition } from '@/lib/toast/types';
import Toast from './Toast';
import styles from './ToastContainer.module.css';

interface ToastContainerProps {
  toasts: ToastType[];
  position: ToastPosition;
  onClose: (id: string) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, position, onClose }) => {
  const getPositionClass = () => {
    switch (position) {
      case 'top-left':
        return styles.topLeft;
      case 'top-center':
        return styles.topCenter;
      case 'top-right':
        return styles.topRight;
      case 'bottom-left':
        return styles.bottomLeft;
      case 'bottom-center':
        return styles.bottomCenter;
      case 'bottom-right':
        return styles.bottomRight;
      default:
        return styles.topRight;
    }
  };

  if (toasts.length === 0) return null;

  return (
    <div className={`${styles.toastContainer} ${getPositionClass()}`}>
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} position={position} onClose={onClose} />
      ))}
    </div>
  );
};

export default ToastContainer;
