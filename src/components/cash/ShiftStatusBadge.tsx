'use client';

import React from 'react';
import Link from 'next/link';
import { Landmark } from 'lucide-react';

export function ShiftStatusBadge() {
  return (
    <Link href="/admin/finanzas/tesoreria" title="Ir al panel de Tesorería & Cuentas">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#D0A96B]/10 border border-[#D0A96B]/30 px-3 py-1 text-xs font-bold text-[#E5C158] hover:bg-[#D0A96B]/20 transition-colors cursor-pointer shadow-sm">
        <Landmark className="h-3.5 w-3.5 text-[#D0A96B]" />
        <span>Tesorería Online</span>
      </span>
    </Link>
  );
}
