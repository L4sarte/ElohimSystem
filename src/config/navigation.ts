import {
  ShoppingBag,
  LayoutGrid,
  Users,
  CreditCard,
  Package,
  Archive,
  PackageX,
  Globe,
  BarChart3,
  DollarSign,
  TrendingUp,
  ShieldCheck,
  Home,
  Percent,
  Landmark,
  Settings,
  Printer,
  Calculator,
  Droplet,
  Activity,
  LucideIcon,
} from 'lucide-react';
import { UserRole } from '@/types';

export interface NavigationItem {
  id: string;
  name: string;
  description: string;
  href: string;
  icon: LucideIcon;
  color: string;
  adminOnly?: boolean;
  keywords: string[];
  shortcutHint?: string;
}

export interface NavigationCategory {
  id: string;
  title: string;
  items: NavigationItem[];
}

/**
 * Fuente única de verdad (Single Source of Truth) para la navegación del ERP.
 * Consumida tanto por el Sidebar como por la Barra de Comandos Global (Omnibar).
 * Se han depurado las rutas redundantes de redirección (/admin/proveedores, /admin/envios, /admin/finanzas/cuotas).
 */
export const ERP_NAVIGATION_CATEGORIES: NavigationCategory[] = [
  {
    id: 'sales-crm',
    title: 'VENTAS & CLIENTES',
    items: [
      {
        id: 'pos',
        name: 'Punto de Venta (POS)',
        description: 'Facturación ágil bimonetaria, decants JIT y lector de barras',
        href: '/pos',
        icon: ShoppingBag,
        color: 'text-erp-gold',
        keywords: ['pos', 'venta', 'mostrador', 'caja', 'facturar', 'cobrar', 'ticket'],
        shortcutHint: 'N',
      },
      {
        id: 'kanban',
        name: 'Pedidos & Envíos (Kanban)',
        description: 'Tablero logístico de pedidos WhatsApp, preparación y despacho',
        href: '/kanban',
        icon: LayoutGrid,
        color: 'text-emerald-400',
        keywords: ['kanban', 'pedidos', 'whatsapp', 'envios', 'logistica', 'despacho', 'entregas'],
      },
      {
        id: 'crm-clients',
        name: 'CRM Clientes & VibePoints',
        description: 'Directorio de clientes, fidelización y perfiles olfativos',
        href: '/clientes',
        icon: Users,
        color: 'text-indigo-400',
        keywords: ['clientes', 'crm', 'puntos', 'vibepoints', 'fidelizacion', 'agenda'],
      },
      {
        id: 'receivables',
        name: 'Cobranzas / Fiados (CXC)',
        description: 'Cuentas por cobrar de clientes, abonos parciales y saldos',
        href: '/admin/finanzas/cxcobrar',
        icon: CreditCard,
        color: 'text-amber-400',
        keywords: ['cobranzas', 'fiados', 'cxc', 'cuentas por cobrar', 'deudores', 'abonos'],
      },
      {
        id: 'sales-history',
        name: 'Historial de Ventas',
        description: 'Registro histórico de comprobantes, reimpresión y anulaciones',
        href: '/auditoria/ventas',
        icon: Printer,
        color: 'text-erp-gold',
        keywords: ['historial', 'ventas', 'tickets', 'comprobantes', 'facturas', 'devoluciones'],
      },
    ],
  },
  {
    id: 'inventory-packaging',
    title: 'INVENTARIO & DECANTS',
    items: [
      {
        id: 'catalog',
        name: 'Catálogo de Productos',
        description: 'Stock comercial de botellas selladas, precios y márgenes',
        href: '/productos',
        icon: Package,
        color: 'text-violet-400',
        keywords: ['catalogo', 'productos', 'perfumes', 'botellas', 'stock', 'precios', 'sku'],
        shortcutHint: 'I',
      },
      {
        id: 'decants-hub',
        name: 'Hub Decants & Granel',
        description: 'Fraccionamiento de botellas a mililitros y rendimiento de líquido',
        href: '/admin/inventario/decants',
        icon: Droplet,
        color: 'text-cyan-400',
        adminOnly: true,
        keywords: ['decants', 'granel', 'fraccionar', 'mililitros', 'ml', 'trasvasado'],
      },
      {
        id: 'kardex',
        name: 'Kardex & Movimientos',
        description: 'Trazabilidad completa de entradas, salidas y costo promedio (PPP)',
        href: '/admin/inventario/kardex',
        icon: Activity,
        color: 'text-emerald-400',
        adminOnly: true,
        keywords: ['kardex', 'movimientos', 'trazabilidad', 'stock', 'ppp', 'auditoria stock'],
      },
      {
        id: 'recipes-bom',
        name: 'Recetas Decants (BOM)',
        description: 'Ingeniería de costos y fórmulas de insumos por presentación',
        href: '/admin/inventario/recetas',
        icon: Calculator,
        color: 'text-erp-gold',
        adminOnly: true,
        keywords: ['recetas', 'bom', 'costos', 'escandallo', 'formulas', 'decant'],
      },
      {
        id: 'supplies',
        name: 'Insumos de Packaging',
        description: 'Control de frascos vacíos, atomizadores, cajas y bolsas',
        href: '/admin/inventario/insumos',
        icon: Archive,
        color: 'text-amber-400',
        adminOnly: true,
        keywords: ['insumos', 'packaging', 'frascos', 'envases', 'atomizadores', 'bolsas'],
      },
      {
        id: 'adjustments',
        name: 'Ajustes / Mermas',
        description: 'Bajas por rotura, evaporación, apertura de testers y arqueo físico',
        href: '/admin/inventario/ajustes',
        icon: PackageX,
        color: 'text-rose-400',
        adminOnly: true,
        keywords: ['ajustes', 'mermas', 'roturas', 'testers', 'perdidas', 'baja stock'],
      },
      {
        id: 'storefront',
        name: 'Vidriera Digital B2C',
        description: 'Catálogo público interactivo para clientes y pedidos online',
        href: '/catalogo',
        icon: Globe,
        color: 'text-teal-400',
        keywords: ['vidriera', 'tienda', 'publico', 'b2c', 'web', 'catalogo online'],
      },
    ],
  },
  {
    id: 'supply-chain',
    title: 'COMPRAS & PROVEEDORES',
    items: [
      {
        id: 'purchases-ap',
        name: 'Compras, CXP & Proveedores',
        description: 'Órdenes de compra, cuentas por pagar a proveedores y mercadería en tránsito',
        href: '/compras',
        icon: ShoppingBag,
        color: 'text-emerald-400',
        adminOnly: true,
        keywords: [
          'compras',
          'proveedores',
          'cxp',
          'cuentas por pagar',
          'deuda proveedores',
          'ordenes de compra',
          'transito',
          'importaciones',
        ],
      },
    ],
  },
  {
    id: 'finance-audit',
    title: 'FINANZAS & AUDITORÍA',
    items: [
      {
        id: 'dashboard',
        name: 'Dashboard Principal',
        description: 'Métricas ejecutivas, cotización del día y resumen operativo',
        href: '/',
        icon: Home,
        color: 'text-erp-gold',
        keywords: ['dashboard', 'inicio', 'home', 'resumen', 'metricas', 'kpis'],
      },
      {
        id: 'treasury',
        name: 'Tesorería & Cuentas',
        description: 'Saldos reales en cajas físicas, bancos, billeteras y transferencias',
        href: '/admin/finanzas/tesoreria',
        icon: Landmark,
        color: 'text-erp-gold',
        keywords: ['tesoreria', 'cajas', 'bancos', 'mercado pago', 'saldos', 'transferencias', 'arqueo'],
      },
      {
        id: 'commissions',
        name: 'Comisiones & Pasarelas',
        description: 'Retenciones de pasarelas de cobro y absorción de comisiones',
        href: '/admin/finanzas/comisiones',
        icon: Percent,
        color: 'text-erp-gold',
        adminOnly: true,
        keywords: ['comisiones', 'pasarelas', 'retenciones', 'mercado pago', 'tarjetas'],
      },
      {
        id: 'installments-config',
        name: 'Cuotas & Recargos',
        description: 'Configuración de planes de financiación y recargos por tarjeta',
        href: '/config/pagos',
        icon: CreditCard,
        color: 'text-erp-gold',
        adminOnly: true,
        keywords: ['cuotas', 'recargos', 'intereses', 'planes de pago', 'financiacion'],
      },
      {
        id: 'opex',
        name: 'Gastos Operativos (OPEX)',
        description: 'Registro de alquileres, servicios, fletes y egresos operativos',
        href: '/admin/gastos',
        icon: DollarSign,
        color: 'text-rose-400',
        adminOnly: true,
        keywords: ['gastos', 'opex', 'egresos', 'costos fijos', 'alquiler', 'servicios'],
        shortcutHint: 'G',
      },
      {
        id: 'financial-reports',
        name: 'Reportes Financieros',
        description: 'Estado de resultados (P&L), margen bruto/neto y exportación PDF',
        href: '/admin/reportes',
        icon: TrendingUp,
        color: 'text-emerald-400',
        adminOnly: true,
        keywords: ['reportes', 'estados financieros', 'rentabilidad', 'margen', 'ganancias', 'pdf'],
      },
      {
        id: 'monthly-analytics',
        name: 'Analítica Visual Mensual',
        description: 'Evolución mensual de facturación, costos y objetivos',
        href: '/admin/reportes/mensual',
        icon: BarChart3,
        color: 'text-erp-gold',
        adminOnly: true,
        keywords: ['mensual', 'graficos', 'analitica', 'evolucion', 'estadisticas'],
      },
      {
        id: 'audit',
        name: 'Auditoría General',
        description: 'Control de turnos de caja, cierres ciegos y bitácora de seguridad',
        href: '/auditoria',
        icon: ShieldCheck,
        color: 'text-zinc-400',
        keywords: ['auditoria', 'cierre de caja', 'turnos', 'control', 'seguridad'],
      },
    ],
  },
  {
    id: 'system',
    title: 'SISTEMA',
    items: [
      {
        id: 'settings',
        name: 'Configuración del ERP',
        description: 'Parámetros globales, márgenes objetivo y preferencias del negocio',
        href: '/admin/configuracion',
        icon: Settings,
        color: 'text-zinc-400',
        adminOnly: true,
        keywords: ['configuracion', 'ajustes sistema', 'parametros', 'empresa'],
      },
      {
        id: 'users',
        name: 'Usuarios & Permisos',
        description: 'Administración de operadores, vendedores y roles de acceso',
        href: '/admin/usuarios',
        icon: Users,
        color: 'text-amber-400',
        adminOnly: true,
        keywords: ['usuarios', 'roles', 'vendedores', 'administradores', 'permisos'],
      },
    ],
  },
];

/**
 * Filtra las categorías y sus ítems según el rol activo del usuario.
 */
export function getNavigationCategoriesForRole(role: UserRole): NavigationCategory[] {
  return ERP_NAVIGATION_CATEGORIES.map((category) => ({
    ...category,
    items: category.items.filter((item) => !item.adminOnly || role === 'admin'),
  })).filter((category) => category.items.length > 0);
}

/**
 * Obtiene una lista plana de todos los módulos accesibles para el rol dado.
 */
export function getFlatNavigationItemsForRole(role: UserRole): NavigationItem[] {
  return getNavigationCategoriesForRole(role).flatMap((cat) => cat.items);
}

/**
 * Determina si una ruta del menú está activa comparando contra el pathname actual.
 */
export function isRouteActive(pathname: string, itemHref: string): boolean {
  if (itemHref === '/') {
    return pathname === '/';
  }
  return pathname === itemHref || pathname.startsWith(`${itemHref}/`);
}
