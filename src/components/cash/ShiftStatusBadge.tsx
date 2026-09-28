'use client';

import React from 'react';
import Link from 'next/link';
import { Landmark } from 'lucide-react';

export function ShiftStatusBadge() {
  return (
    <Link href="/admin/finanzas/tesoreria" title="Ir al panel de Tesorería & Cuentas">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-erp-gold/10 border border-erp-gold/30 px-3 py-1 text-xs font-bold text-erp-gold-hover hover:bg-erp-gold/20 transition-colors cursor-pointer shadow-sm">
        <Landmark className="h-3.5 w-3.5 text-erp-gold" />
        <span>Tesorería Online</span>
      </span>
    </Link>
  );
}
