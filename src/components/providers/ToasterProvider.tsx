'use client';

import { Toaster } from 'sonner';

export function ToasterProvider() {
  return (
    <Toaster 
      position="top-right" 
      theme="dark" 
      richColors 
      closeButton 
      className="print:hidden" 
      toastOptions={{ className: 'print:hidden' }} 
    />
  );
}
