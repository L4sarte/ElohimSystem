'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          backgroundColor: '#08130E',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <title>Error crítico — Elohim Import ERP</title>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '26rem',
              borderRadius: '1rem',
              border: '1px solid #1B362A',
              backgroundColor: '#13261E',
              padding: '2rem',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                margin: '0 auto 1rem',
                display: 'flex',
                height: '3.5rem',
                width: '3.5rem',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '9999px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
              }}
            >
              <AlertTriangle style={{ height: '1.75rem', width: '1.75rem', color: '#f87171' }} />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ffffff', margin: 0 }}>
              Error crítico del sistema
            </h2>
            <p style={{ fontSize: '0.875rem', color: '#a1a1aa', margin: '0.5rem 0 0' }}>
              No se pudo renderizar la aplicación. Intentá recargar la página o reintentar.
            </p>
            <button
              onClick={() => unstable_retry()}
              style={{
                marginTop: '1.5rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                borderRadius: '0.75rem',
                backgroundColor: '#D0A96B',
                padding: '0.625rem 1.25rem',
                fontSize: '0.875rem',
                fontWeight: 700,
                color: '#08130E',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <RefreshCw style={{ height: '1rem', width: '1rem' }} />
              Reintentar
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
