'use client';

import React from 'react';
import Link from 'next/link';
import { ShoppingBag, DollarSign, PackagePlus, ArrowRight, Zap, Sparkles } from 'lucide-react';
import { useUserStore } from '@/hooks/use-user-store';

export function QuickActions() {
  const { role } = useUserStore();

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      
      {/* 1. NUEVA VENTA POS */}
      <Link href="/pos" className="group">
        <div className="p-4 rounded-2xl bg-[#13261E] border border-[#D0A96B]/40 hover:border-[#D0A96B] transition-all shadow-xl hover:shadow-[#D0A96B]/10 flex items-center justify-between cursor-pointer">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#D0A96B]/10 text-[#D0A96B] border border-[#D0A96B]/30 group-hover:scale-105 transition-transform">
              <ShoppingBag className="h-5.5 w-5.5" />
            </div>
            <div>
              <div className="font-bold text-sm text-white font-serif flex items-center gap-1.5">
                <span>+ Nueva Venta POS</span>
                <Zap className="h-3.5 w-3.5 text-[#D0A96B]" />
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">Facturación ágil y cobro mixto</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-[#D0A96B] opacity-70 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
        </div>
      </Link>

      {/* 2. REGISTRAR GASTO OPEX (Admin) */}
      <Link href={role === 'admin' ? "/admin/gastos" : "/admin/finanzas/tesoreria"} className="group">
        <div className="p-4 rounded-2xl bg-[#13261E] border border-[#1B362A] hover:border-rose-500/40 transition-all shadow-xl flex items-center justify-between cursor-pointer">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 group-hover:scale-105 transition-transform">
              <DollarSign className="h-5.5 w-5.5" />
            </div>
            <div>
              <div className="font-bold text-sm text-white font-serif">
                {role === 'admin' ? '+ Registrar Gasto (OPEX)' : 'Tesorería & Cuentas'}
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">Control de egresos y saldos</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-rose-400 opacity-70 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
        </div>
      </Link>

      {/* 3. INGRESAR PRODUCTO */}
      <Link href="/productos" className="group">
        <div className="p-4 rounded-2xl bg-[#13261E] border border-[#1B362A] hover:border-emerald-500/40 transition-all shadow-xl flex items-center justify-between cursor-pointer">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group-hover:scale-105 transition-transform">
              <PackagePlus className="h-5.5 w-5.5" />
            </div>
            <div>
              <div className="font-bold text-sm text-white font-serif">+ Ingresar Producto</div>
              <p className="text-xs text-zinc-400 mt-0.5">Catálogo y stock de perfumes</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-emerald-400 opacity-70 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
        </div>
      </Link>

    </div>
  );
}
