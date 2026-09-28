'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error('[APP_ERROR_BOUNDARY]:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-erp-bg px-4 font-sans">
      <div className="w-full max-w-md rounded-2xl border border-erp-border bg-erp-surface p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10">
          <AlertTriangle className="h-7 w-7 text-red-400" />
        </div>
        <h2 className="font-serif text-xl font-bold text-white">Algo salió mal</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Ocurrió un error inesperado al renderizar esta sección del sistema. Podés reintentar o volver al panel principal.
        </p>
        {error?.digest && (
          <p className="mt-3 font-mono text-[11px] text-zinc-500">Digest: {error.digest}</p>
        )}
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={() => unstable_retry()}
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-erp-gold px-5 py-2.5 text-sm font-bold text-erp-bg transition-colors hover:bg-erp-gold-hover"
          >
            <RefreshCw className="h-4 w-4" />
            Reintentar
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl border border-erp-border px-5 py-2.5 text-sm font-bold text-zinc-300 transition-colors hover:text-white"
          >
            <Home className="h-4 w-4" />
            Ir al Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
