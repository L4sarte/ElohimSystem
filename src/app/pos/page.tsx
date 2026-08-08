'use client';

import dynamic from 'next/dynamic';

// Importación dinámica de TODO el árbol del POS desactivando el SSR por completo.
// Esto garantiza que ningún Hook (useRef, useEffect) se evalúe en el servidor, 
// eliminando de raíz el Error #310 durante los revalidatePath.
const POSClientWrapper = dynamic(
  () => import('./POSClientWrapper'),
  { 
    ssr: false,
    loading: () => (
      <div className="flex flex-col min-h-screen bg-[#08130E] text-zinc-50 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#D0A96B] border-t-transparent mb-4"></div>
        <span className="text-sm font-mono text-zinc-400">Iniciando Motor de Ventas...</span>
      </div>
    )
  }
);

export default function POSPage() {
  return <POSClientWrapper />;
}
