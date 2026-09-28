'use client';

import React from 'react';
import Link from 'next/link';
import { useUserStore } from '@/hooks/use-user-store';
import { Button } from '@/components/ui/button';
import { 
  ShoppingBag, ShoppingCart, LayoutGrid, Truck, Archive, AlertTriangle, 
  Landmark, CreditCard, Users, Printer, FileText, Activity, BarChart3, 
  Settings, ShieldCheck, ExternalLink, Sparkles
} from 'lucide-react';

export function QuickAccessPills() {
  const role = useUserStore((state) => state.role);

  const quickAccessItems = [
    { name: 'Punto de Venta (POS)', href: '/pos', icon: ShoppingCart, color: 'text-erp-gold' },
    { name: 'Kanban Pedidos', href: '/kanban', icon: LayoutGrid, color: 'text-emerald-400' },
    { name: 'Catálogo Productos', href: '/productos', icon: ShoppingBag, color: 'text-violet-400' },
    { name: 'Proveedores & Compras', href: '/compras', icon: ShoppingBag, color: 'text-sky-400', adminOnly: true },
    { name: 'Logística & Envíos', href: '/kanban', icon: Truck, color: 'text-indigo-400' },
    { name: 'Insumos de Packaging', href: '/admin/inventario/insumos', icon: Archive, color: 'text-amber-400', adminOnly: true },
    { name: 'Mermas & Ajustes', href: '/admin/inventario/ajustes', icon: AlertTriangle, color: 'text-amber-400', adminOnly: true },
    { name: 'Tesorería & Cuentas', href: '/admin/finanzas/tesoreria', icon: Landmark, color: 'text-erp-gold' },
    { name: 'Cobranzas / Fiados', href: '/admin/finanzas/cxcobrar', icon: CreditCard, color: 'text-amber-400' },
    { name: 'CRM Clientes', href: '/clientes', icon: Users, color: 'text-indigo-400' },
    { name: 'Historial Ventas', href: '/auditoria/ventas', icon: Printer, color: 'text-erp-gold' },
    { name: 'Gastos OPEX', href: '/admin/gastos', icon: FileText, color: 'text-rose-400', adminOnly: true },
    { name: 'Reportes Financieros', href: '/admin/reportes', icon: Activity, color: 'text-indigo-400', adminOnly: true },
    { name: 'Dashboard Mensual', href: '/admin/reportes/mensual', icon: BarChart3, color: 'text-erp-gold', adminOnly: true },
    { name: 'Configuración', href: '/admin/configuracion', icon: Settings, color: 'text-zinc-400', adminOnly: true },
    { name: 'Usuarios & Roles', href: '/admin/usuarios', icon: Users, color: 'text-amber-400', adminOnly: true },
    { name: 'Visor Auditoría', href: '/auditoria', icon: ShieldCheck, color: 'text-zinc-400' },
    { name: 'Vidriera Digital B2C', href: '/catalogo', icon: ExternalLink, color: 'text-teal-400' },
  ];

  const filteredItems = quickAccessItems.filter(item => !item.adminOnly || role === 'admin');

  return (
    <div className="pt-6 border-t border-erp-border space-y-3">
      <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-widest text-zinc-500 font-serif">
        <Sparkles className="h-3 w-3 text-erp-gold" />
        <span>Accesos Rápidos a Módulos:</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {filteredItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.name} href={item.href}>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs font-bold cursor-pointer border-erp-border bg-erp-surface/80 text-zinc-300 hover:bg-secondary hover:text-white transition-all hover:scale-105 shadow-sm"
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
