import React, { type ReactNode } from 'react';
import ToastViewport from './ui/Toast';

/**
 * Thin wrapper that mounts the custom ToastViewport next to children.
 * Kept for API compatibility with the previous MUI-based provider.
 */
const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => (
  <>
    {children}
    <ToastViewport />
  </>
);

export default ToastProvider;
