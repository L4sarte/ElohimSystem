'use client';

import React from 'react';
import Link from 'next/link';
import { 
  ShoppingBag, DollarSign, PackagePlus, ArrowRight, Zap, Sparkles,
  Settings, Users, Truck, Landmark, LayoutGrid, Archive, AlertTriangle,
  CreditCard, FileText, Activity, ExternalLink, ShoppingCart 
} from 'lucide-react';
import { useUserStore } from '@/hooks/use-user-store';
import { Button } from '@/components/ui/button';

export function QuickActions() {
  const { role } = useUserStore();

  const quickAccessItems = [
    { name: 'Punto de Venta (POS)', href: '/pos', icon: ShoppingCart, color: 'text-[#D0A96B]' },
    { name: 'Kanban Pedidos', href: '/kanban', icon: LayoutGrid, color: 'text-emerald-400' },
    { name: 'Catálogo Productos', href: '/productos', icon: ShoppingBag, color: 'text-violet-400' },
    { name: 'Insumos', href: '/admin/inventario/insumos', icon: Archive, color: 'text-amber-400', adminOnly: true },
    { name: 'Mermas & Ajustes', href: '/admin/inventario/ajustes', icon: AlertTriangle, color: 'text-amber-400', adminOnly: true },
    { name: 'Proveedores & Compras', href: '/compras', icon: ShoppingBag, color: 'text-sky-400', adminOnly: true },
    { name: 'Logística & Envíos', href: '/kanban', icon: Truck, color: 'text-indigo-400' },
    { name: 'Tesorería & Cuentas', href: '/admin/finanzas/tesoreria', icon: Landmark, color: 'text-[#D0A96B]' },
    { name: 'Cobranzas / Fiados', href: '/admin/finanzas/cxcobrar', icon: CreditCard, color: 'text-amber-400' },
    { name: 'Clientes (CRM)', href: '/clientes', icon: Users, color: 'text-indigo-400' },
    { name: 'Gastos OPEX', href: '/admin/gastos', icon: FileText, color: 'text-rose-400', adminOnly: true },
    { name: 'Reportes Financieros', href: '/admin/reportes', icon: Activity, color: 'text-indigo-400', adminOnly: true },
    { name: 'Configuración', href: '/admin/configuracion', icon: Settings, color: 'text-zinc-400', adminOnly: true },
    { name: 'Usuarios & Roles', href: '/admin/usuarios', icon: Users, color: 'text-amber-400', adminOnly: true },
    { name: 'Vidriera Digital B2C', href: '/catalogo', icon: ExternalLink, color: 'text-teal-400' },
  ];

  const filteredItems = quickAccessItems.filter(item => !item.adminOnly || role === 'admin');

  return (
    <div className="space-y-4 mb-6">
      
      {/* 3 TARJETAS DE ACCIÓN PRINCIPAL */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
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

      {/* BARRA HORIZONTAL DE ACCESOS RÁPIDOS MÓDULOS (PILLS) */}
      <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[#1B362A]">
        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mr-1.5 flex items-center gap-1 font-serif">
          <Sparkles className="h-3 w-3 text-[#D0A96B]" /> Accesos:
        </span>

        {filteredItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.name} href={item.href}>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs font-bold cursor-pointer border-[#1B362A] bg-[#13261E]/80 text-zinc-300 hover:bg-[#1B362A] hover:text-white transition-all hover:scale-105 shadow-sm"
              >
                <Icon className={`mr-1.5 h-3.5 w-3.5 ${item.color}`} />
                <span>{item.name}</span>
              </Button>
            </Link>
          );
        })}
      </div>

    </div>
  );
}
