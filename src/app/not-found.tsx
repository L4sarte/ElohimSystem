import Link from 'next/link';
import { SearchX, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center font-sans">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-erp-gold/10">
        <SearchX className="h-8 w-8 text-erp-gold" />
      </div>
      <p className="font-mono text-5xl font-black text-erp-gold">404</p>
      <h2 className="mt-3 font-serif text-xl font-bold text-white">Página no encontrada</h2>
      <p className="mt-2 max-w-sm text-sm text-zinc-400">
        El recurso que buscás no existe o fue movido. Verificá la dirección o volvé al panel principal.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-erp-gold px-5 py-2.5 text-sm font-bold text-erp-bg transition-colors hover:bg-erp-gold-hover"
      >
        <Home className="h-4 w-4" />
        Volver al Dashboard
      </Link>
    </div>
  );
}
