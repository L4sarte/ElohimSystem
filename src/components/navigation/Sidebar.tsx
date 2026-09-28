'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUserStore } from '@/hooks/use-user-store';
import { 
  ShoppingBag, LayoutGrid, Users, CreditCard, Package, Archive, 
  PackageX, Globe, BarChart3, Coins, DollarSign, TrendingUp, 
  ShieldCheck, Menu, X, Sparkles, ChevronRight, Home, Percent, Landmark,
  Truck, Settings, Printer, Calculator, LogOut, Droplet, Activity
} from 'lucide-react';
import { logoutAction } from '@/app/actions/auth';

interface SidebarProps {
  children?: React.ReactNode;
}

export function Sidebar() {
  const pathname = usePathname();
  const role = useUserStore((state) => state.role);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === '/' && pathname === '/') return true;
    if (path !== '/' && pathname.startsWith(path)) return true;
    return false;
  };

  const navCategories = [
    {
      title: 'VENTAS & CLIENTES',
      items: [
        { name: 'Punto de Venta (POS)', href: '/pos', icon: ShoppingBag, color: 'text-erp-gold' },
        { name: 'Kanban Pedidos', href: '/kanban', icon: LayoutGrid, color: 'text-emerald-400' },
        { name: 'CRM Clientes & Points', href: '/clientes', icon: Users, color: 'text-indigo-400' },
        { name: 'Cobranzas / Fiados', href: '/admin/finanzas/cxcobrar', icon: CreditCard, color: 'text-amber-400' },
        { name: 'Historial de Ventas', href: '/auditoria/ventas', icon: Printer, color: 'text-erp-gold' },
      ]
    },
    {
      title: 'INVENTARIO & PACKAGING',
      items: [
        { name: 'Catálogo Productos', href: '/productos', icon: Package, color: 'text-violet-400' },
        { name: 'Hub Decants & Granel', href: '/admin/inventario/decants', icon: Droplet, color: 'text-cyan-400', adminOnly: true },
        { name: 'Kardex & Movimientos', href: '/admin/inventario/kardex', icon: Activity, color: 'text-emerald-400', adminOnly: true },
        { name: 'Recetas Decants (BOM)', href: '/admin/inventario/recetas', icon: Calculator, color: 'text-erp-gold', adminOnly: true },
        { name: 'Insumos de Packaging', href: '/admin/inventario/insumos', icon: Archive, color: 'text-amber-400', adminOnly: true },
        { name: 'Ajustes / Mermas', href: '/admin/inventario/ajustes', icon: PackageX, color: 'text-rose-400', adminOnly: true },
        { name: 'Vidriera Digital B2C', href: '/catalogo', icon: Globe, color: 'text-teal-400' },
      ]
    },
    {
      title: 'COMPRAS & LOGÍSTICA',
      items: [
        { name: 'Órdenes de Compra (PO)', href: '/compras', icon: ShoppingBag, color: 'text-emerald-400', adminOnly: true },
        { name: 'Proveedores & Compras', href: '/admin/proveedores', icon: ShoppingBag, color: 'text-sky-400', adminOnly: true },
        { name: 'Logística & Envíos', href: '/admin/envios', icon: Truck, color: 'text-indigo-400' },
      ]
    },
    {
      title: 'FINANZAS & AUDITORÍA',
      items: [
        { name: 'Dashboard Principal', href: '/', icon: Home, color: 'text-erp-gold' },
        { name: 'Tesorería & Cuentas', href: '/admin/finanzas/tesoreria', icon: Landmark, color: 'text-erp-gold' },
        { name: 'Comisiones & Pasarelas', href: '/admin/finanzas/comisiones', icon: Percent, color: 'text-erp-gold', adminOnly: true },
        { name: 'Cuotas & Recargos', href: '/config/pagos', icon: CreditCard, color: 'text-erp-gold', adminOnly: true },
        { name: 'Gastos OPEX', href: '/admin/gastos', icon: DollarSign, color: 'text-rose-400', adminOnly: true },
        { name: 'Reportes Financieros', href: '/admin/reportes', icon: TrendingUp, color: 'text-emerald-400', adminOnly: true },
        { name: 'Dashboard Visual Mensual', href: '/admin/reportes/mensual', icon: BarChart3, color: 'text-erp-gold', adminOnly: true },
        { name: 'Auditoría General', href: '/auditoria', icon: ShieldCheck, color: 'text-zinc-400' },
      ]
    },
    {
      title: 'SISTEMA',
      items: [
        { name: 'Configuración', href: '/admin/configuracion', icon: Settings, color: 'text-zinc-400', adminOnly: true },
        { name: 'Usuarios & Roles', href: '/admin/usuarios', icon: Users, color: 'text-amber-400', adminOnly: true },
      ]
    }
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-erp-surface border-r border-erp-border w-64 text-zinc-100">
      
      {/* LOGO SUPERIOR CON FALLBACK ONERROR */}
      <div className="p-4 border-b border-erp-border flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 cursor-pointer">
          <img 
            src="/logo-elohim.png" 
            alt="Elohim Import ERP" 
            className="h-9 w-auto object-contain"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </Link>
        {mobileOpen && (
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden text-zinc-400 hover:text-white p-1"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* MENÚ DE CATEGORÍAS */}
      <div className="flex-1 overflow-y-auto p-3 space-y-6">
        {navCategories.map((category, catIdx) => {
          // Filtrar items según rol
          const filteredItems = category.items.filter(item => !item.adminOnly || role === 'admin');
          if (filteredItems.length === 0) return null;

          return (
            <div key={catIdx} className="space-y-1">
              <div className="text-[11px] font-extrabold uppercase tracking-widest text-zinc-500 px-3 py-1 font-serif">
                {category.title}
              </div>

              {filteredItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      active
                        ? 'bg-secondary text-erp-gold border border-erp-gold/40 shadow-sm shadow-erp-gold/10'
                        : 'text-zinc-300 hover:bg-secondary/60 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`h-4 w-4 ${active ? 'text-erp-gold' : item.color}`} />
                      <span>{item.name}</span>
                    </div>

                    {active && <ChevronRight className="h-3.5 w-3.5 text-erp-gold" />}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* PIE DEL SIDEBAR */}
      <div className="p-3 border-t border-erp-border bg-erp-bg/60 text-[11px] text-zinc-400 flex items-center justify-between">
        <div>
          <div className="font-bold text-white font-serif">Elohim Import ERP</div>
          <div className="text-zinc-500 font-mono">v2.5 Enterprise</div>
        </div>
        <div className="flex items-center gap-2">
          <kbd className="px-1.5 py-0.5 rounded bg-erp-surface border border-erp-border text-erp-gold font-mono text-xs">
            ⌘K
          </kbd>
          <button
            onClick={() => logoutAction()}
            title="Cerrar Sesión Segura"
            className="p-1.5 rounded-lg bg-erp-surface border border-erp-border text-zinc-400 hover:text-rose-400 hover:border-rose-500/30 transition-colors cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

    </div>
  );

  return (
    <>
      {/* SIDEBAR DESKTOP */}
      <aside className="hidden md:flex shrink-0">
        {sidebarContent}
      </aside>

      {/* HAMBURGUESA MOBILE */}
      <div className="md:hidden fixed top-3 left-3 z-50">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-xl bg-erp-surface border border-erp-border text-erp-gold shadow-lg cursor-pointer"
          title="Abrir menú"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* DRAWER MOBILE OVERLAY */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
