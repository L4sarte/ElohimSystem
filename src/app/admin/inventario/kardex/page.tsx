'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useUserStore } from '@/hooks/use-user-store';
import { useExchangeRate } from '@/hooks/use-exchange-rate';
import { getKardexMovements, KardexMovement, KardexMovementType } from '@/app/actions/inventory';
import { RoleSelector } from '@/components/products/RoleSelector';
import { ExchangeRateWidget } from '@/components/rates/ExchangeRateWidget';
import { 
  Activity, ArrowLeft, ArrowDownLeft, ArrowUpRight, Search, 
  RefreshCw, Download, Filter, ShieldAlert, ShoppingCart, 
  Globe, ShoppingBag, Droplet, Sparkles, Flame, FileText, 
  Layers, Package, Calendar, DollarSign, CheckCircle2, TrendingUp, TrendingDown
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

const MOVEMENT_CONFIG: Record<KardexMovementType, {
  label: string;
  badgeBg: string;
  badgeText: string;
  borderColor: string;
  icon: React.ElementType;
}> = {
  COMPRA_IN: {
    label: 'Ingreso por Compra B2B',
    badgeBg: 'bg-emerald-950/40',
    badgeText: 'text-emerald-400',
    borderColor: 'border-emerald-800/40',
    icon: ArrowDownLeft,
  },
  VENTA_POS: {
    label: 'Venta Mostrador (POS)',
    badgeBg: 'bg-amber-950/30',
    badgeText: 'text-amber-400',
    borderColor: 'border-amber-800/40',
    icon: ShoppingCart,
  },
  VENTA_WEB: {
    label: 'Venta Online (WhatsApp)',
    badgeBg: 'bg-teal-950/40',
    badgeText: 'text-teal-300',
    borderColor: 'border-teal-800/40',
    icon: Globe,
  },
  FRACCIONAMIENTO_OUT: {
    label: 'Salida Botella (Trasvasado)',
    badgeBg: 'bg-purple-950/40',
    badgeText: 'text-purple-300',
    borderColor: 'border-purple-800/40',
    icon: Layers,
  },
  FRACCIONAMIENTO_IN: {
    label: 'Ingreso Granel Decant (+ml)',
    badgeBg: 'bg-cyan-950/40',
    badgeText: 'text-cyan-300',
    borderColor: 'border-cyan-800/40',
    icon: Droplet,
  },
  USO_TESTER: {
    label: 'Apertura Tester (Marketing)',
    badgeBg: 'bg-violet-950/40',
    badgeText: 'text-violet-400',
    borderColor: 'border-violet-800/40',
    icon: Sparkles,
  },
  MERMA_ROTURA: {
    label: 'Merma / Rotura (Pérdida)',
    badgeBg: 'bg-rose-950/40',
    badgeText: 'text-rose-400',
    borderColor: 'border-rose-800/40',
    icon: Flame,
  },
  AJUSTE_MANUAL: {
    label: 'Ajuste de Stock / Conteo',
    badgeBg: 'bg-zinc-900',
    badgeText: 'text-zinc-300',
    borderColor: 'border-zinc-700/50',
    icon: FileText,
  },
};

export default function KardexPage() {
  const { role } = useUserStore();
  const { rate: rawExchangeRate } = useExchangeRate();
  const exchangeRate = rawExchangeRate || 1250;

  const [movements, setMovements] = useState<KardexMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedProductType, setSelectedProductType] = useState<string>('ALL');
  const [limit, setLimit] = useState<number>(150);

  const fetchMovements = async () => {
    setLoading(true);
    const res = await getKardexMovements({ limit });
    if (res.success && res.data) {
      setMovements(res.data);
    } else {
      toast.error(res.error || 'Error al obtener movimientos del Kardex.');
    }
    setLoading(false);
  };

  useEffect(() => {
    if (role === 'admin') {
      fetchMovements();
    }
  }, [role, limit]);

  // Filtrado reactivo en memoria
  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      // Filtro por tipo de movimiento
      if (selectedType !== 'ALL' && m.movement_type !== selectedType) {
        return false;
      }
      // Filtro por categoría de producto
      if (selectedProductType !== 'ALL' && m.product_type !== selectedProductType) {
        return false;
      }
      // Filtro por texto
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const matchName = m.product_name.toLowerCase().includes(term);
        const matchBrand = m.product_brand.toLowerCase().includes(term);
        const matchSku = m.product_sku.toLowerCase().includes(term);
        const matchRef = m.reference_label.toLowerCase().includes(term);
        const matchUser = (m.responsible_user || '').toLowerCase().includes(term);
        if (!matchName && !matchBrand && !matchSku && !matchRef && !matchUser) {
          return false;
        }
      }
      return true;
    });
  }, [movements, selectedType, selectedProductType, searchTerm]);

  // KPIs calculados
  const kpis = useMemo(() => {
    let unitsIn = 0;
    let unitsOut = 0;
    let totalValueNet = 0;
    let decantMlIn = 0;

    filteredMovements.forEach((m) => {
      totalValueNet += m.total_value_ars;
      if (m.product_type === 'decant_liquid') {
        if (m.quantity > 0) decantMlIn += m.quantity;
      } else {
        if (m.quantity > 0) unitsIn += m.quantity;
        else unitsOut += Math.abs(m.quantity);
      }
    });

    return {
      totalCount: filteredMovements.length,
      unitsIn,
      unitsOut,
      decantMlIn,
      totalValueNet,
    };
  }, [filteredMovements]);

  // Exportar a CSV compatible con Excel
  const handleExportCsv = () => {
    if (filteredMovements.length === 0) {
      toast.error('No hay movimientos para exportar.');
      return;
    }

    const dateStamp = new Date().toISOString().split('T')[0];
    const rows: string[][] = [
      ['KARDEX OFICIAL DE MOVIMIENTOS DE INVENTARIO - ELOHIM IMPORT ERP'],
      [`Fecha de Exportación: ${new Date().toLocaleString('es-AR')}`],
      [`Cotización Dólar Referencial: 1 USD = $${exchangeRate.toLocaleString('es-AR')} ARS`],
      [`Total de Registros: ${filteredMovements.length}`],
      [''],
      [
        'Fecha y Hora',
        'Tipo de Movimiento',
        'SKU',
        'Producto',
        'Marca',
        'Tipo de Item',
        'Cantidad Movida',
        'Unidad',
        'Costo/Precio Unitario (ARS)',
        'Valor Total (ARS)',
        'Valor Aprox (USD)',
        'Referencia / Comprobante',
        'Responsable',
        'Notas',
      ],
    ];

    filteredMovements.forEach((m) => {
      const config = MOVEMENT_CONFIG[m.movement_type];
      const dateFormatted = new Date(m.created_at).toLocaleString('es-AR');
      const unitLabel = m.product_type === 'decant_liquid' ? 'ml' : 'uds';
      const usdVal = exchangeRate > 0 ? (m.total_value_ars / exchangeRate).toFixed(2) : '0';

      rows.push([
        `"${dateFormatted}"`,
        `"${config?.label || m.movement_type}"`,
        `"${(m.product_sku || '').replace(/"/g, '""')}"`,
        `"${(m.product_name || '').replace(/"/g, '""')}"`,
        `"${(m.product_brand || '').replace(/"/g, '""')}"`,
        `"${m.product_type}"`,
        String(m.quantity),
        `"${unitLabel}"`,
        m.unit_value_ars.toFixed(2),
        m.total_value_ars.toFixed(2),
        usdVal,
        `"${(m.reference_label || '').replace(/"/g, '""')}"`,
        `"${(m.responsible_user || '').replace(/"/g, '""')}"`,
        `"${(m.notes || '').replace(/"/g, '""')}"`,
      ]);
    });

    const csvContent = '\uFEFF' + rows.map((r) => r.join(';')).join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Kardex_Inventario_Elohim_${dateStamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Archivo CSV de Kardex descargado exitosamente.');
  };

  if (role !== 'admin') {
    return (
      <div className="flex flex-col min-h-screen bg-[#08130E] text-zinc-50">
        <header className="sticky top-0 z-40 w-full border-b border-[#1B362A] bg-[#08130E]/80 backdrop-blur-md">
          <div className="container mx-auto flex h-16 items-center justify-between px-6 max-w-7xl">
            <Link href="/" className="flex items-center gap-2 text-xs text-zinc-400 hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              <span>Volver al Dashboard</span>
            </Link>
            <RoleSelector />
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md border-rose-900/30 bg-rose-950/10 text-rose-400">
            <CardHeader className="text-center">
              <ShieldAlert className="h-10 w-10 mx-auto text-rose-500 mb-2" />
              <CardTitle className="text-lg font-bold">Acceso Restringido</CardTitle>
              <CardDescription className="text-rose-400/80">
                La auditoría de Kardex y movimientos de inventario es exclusiva para Administradores.
              </CardDescription>
            </CardHeader>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#08130E] text-zinc-50 selection:bg-[#D0A96B]/20">
      
      {/* NAVBAR SUPERIOR */}
      <header className="sticky top-0 z-40 w-full border-b border-[#1B362A] bg-[#08130E]/90 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 max-w-7xl">
          <div className="flex items-center gap-4">
            <Link 
              href="/productos" 
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Catálogo</span>
            </Link>
            <span className="text-zinc-700">|</span>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Activity className="h-4 w-4" />
              </div>
              <span className="text-sm font-bold tracking-tight text-white font-serif">
                Kardex & Control de Trazabilidad
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <RoleSelector />
            <ExchangeRateWidget role={role} />
          </div>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 container mx-auto px-4 py-8 sm:px-6 max-w-7xl space-y-6">
        
        {/* CABECERA Y ACCIONES */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-[#13261E]/60 border border-[#1B362A] p-6 rounded-2xl">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">
              <Activity className="h-3.5 w-3.5" />
              <span>Registro Cronológico Contable y Físico</span>
            </div>
            <h1 className="text-2xl font-bold font-serif text-white tracking-tight">
              Libro Diario de Movimientos (Kardex)
            </h1>
            <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
              Trazabilidad unificada de ventas (POS y WhatsApp), recepciones de compras B2B, 
              fraccionamiento de botellas a granel, aperturas de tester en showroom y bajas por merma.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={fetchMovements}
              variant="outline"
              disabled={loading}
              className="bg-[#13261E] border-[#1B362A] text-zinc-300 hover:text-white text-xs h-9"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>

            <Button
              onClick={handleExportCsv}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold h-9 shadow-md shadow-emerald-950/50"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Exportar CSV / Excel
            </Button>
          </div>
        </div>

        {/* METRICAS Y KPIS SUPERIORES */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="p-4 rounded-xl bg-[#13261E]/60 border border-[#1B362A] space-y-1">
            <span className="text-[10px] text-zinc-400 uppercase font-semibold">Total Movimientos</span>
            <div className="text-xl font-bold text-white font-mono">{kpis.totalCount}</div>
            <span className="text-[10px] text-zinc-500">Transacciones listadas</span>
          </div>

          <div className="p-4 rounded-xl bg-[#13261E]/60 border border-[#1B362A] space-y-1">
            <span className="text-[10px] text-emerald-400 uppercase font-semibold flex items-center gap-1">
              <ArrowDownLeft className="h-3 w-3" /> Entradas (+Uds)
            </span>
            <div className="text-xl font-bold text-emerald-400 font-mono">+{kpis.unitsIn} uds</div>
            <span className="text-[10px] text-zinc-500">Compras recibidas</span>
          </div>

          <div className="p-4 rounded-xl bg-[#13261E]/60 border border-[#1B362A] space-y-1">
            <span className="text-[10px] text-rose-400 uppercase font-semibold flex items-center gap-1">
              <ArrowUpRight className="h-3 w-3" /> Salidas (-Uds)
            </span>
            <div className="text-xl font-bold text-rose-400 font-mono">-{kpis.unitsOut} uds</div>
            <span className="text-[10px] text-zinc-500">Ventas, trasvasados y mermas</span>
          </div>

          <div className="p-4 rounded-xl bg-[#13261E]/60 border border-[#1B362A] space-y-1">
            <span className="text-[10px] text-cyan-400 uppercase font-semibold flex items-center gap-1">
              <Droplet className="h-3 w-3" /> Granel Decants
            </span>
            <div className="text-xl font-bold text-cyan-300 font-mono">+{kpis.decantMlIn} ml</div>
            <span className="text-[10px] text-zinc-500">Fraccionado a líquido</span>
          </div>

          <div className="p-4 rounded-xl bg-[#13261E]/60 border border-[#1B362A] space-y-1 col-span-2 md:col-span-1">
            <span className="text-[10px] text-[#D0A96B] uppercase font-semibold">Flujo Valorizado Total</span>
            <div className="text-xl font-bold text-[#D0A96B] font-mono">
              ${kpis.totalValueNet.toLocaleString('es-AR')}
            </div>
            <span className="text-[10px] text-zinc-500">
              ≈ USD ${(exchangeRate > 0 ? (kpis.totalValueNet / exchangeRate).toFixed(1) : '0')}
            </span>
          </div>
        </div>

        {/* BARRA DE FILTROS */}
        <div className="p-4 rounded-2xl bg-[#13261E]/60 border border-[#1B362A] space-y-3">
          <div className="flex flex-col md:flex-row items-center gap-3">
            
            {/* Buscador */}
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Buscar por fragancia, marca, SKU, comprobante o usuario..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#08130E] border border-[#1B362A] rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Selector de Tipo de Movimiento */}
            <div className="w-full md:w-64">
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full bg-[#08130E] border border-[#1B362A] rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="ALL">🔍 Todos los Movimientos</option>
                <option value="COMPRA_IN">📥 Ingreso por Compra (B2B)</option>
                <option value="VENTA_POS">🛒 Venta Mostrador (POS)</option>
                <option value="VENTA_WEB">🌐 Venta Online (WhatsApp)</option>
                <option value="FRACCIONAMIENTO_OUT">🧴 Salida Botella a Decant</option>
                <option value="FRACCIONAMIENTO_IN">💧 Ingreso Granel Decant (+ml)</option>
                <option value="USO_TESTER">🧪 Apertura de Tester (Showroom)</option>
                <option value="MERMA_ROTURA">💥 Merma / Rotura (Pérdida)</option>
                <option value="AJUSTE_MANUAL">⚖️ Ajuste Manual / Conteo</option>
              </select>
            </div>

            {/* Selector de Tipo de Producto */}
            <div className="w-full md:w-48">
              <select
                value={selectedProductType}
                onChange={(e) => setSelectedProductType(e.target.value)}
                className="w-full bg-[#08130E] border border-[#1B362A] rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="ALL">📦 Todo el Catálogo</option>
                <option value="bottle">🌸 Perfumes Sellados</option>
                <option value="decant_liquid">💧 Decants a Granel (ml)</option>
                <option value="supply">📦 Insumos Packaging</option>
              </select>
            </div>

            {/* Selector de Límite */}
            <div className="w-full md:w-32">
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="w-full bg-[#08130E] border border-[#1B362A] rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value={50}>Últimos 50</option>
                <option value={100}>Últimos 100</option>
                <option value={150}>Últimos 150</option>
                <option value={300}>Últimos 300</option>
              </select>
            </div>

          </div>

          {/* Quick chips / badges de filtrado activo */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[11px] text-zinc-500">Filtros rápidos:</span>
            <button
              onClick={() => { setSelectedType('ALL'); setSelectedProductType('ALL'); setSearchTerm(''); }}
              className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                selectedType === 'ALL' && selectedProductType === 'ALL' && !searchTerm
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-[#08130E] text-zinc-400 border-[#1B362A] hover:text-white'
              }`}
            >
              Todos ({movements.length})
            </button>
            <button
              onClick={() => setSelectedType('COMPRA_IN')}
              className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                selectedType === 'COMPRA_IN'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-[#08130E] text-zinc-400 border-[#1B362A] hover:text-white'
              }`}
            >
              Compras B2B
            </button>
            <button
              onClick={() => setSelectedType('VENTA_POS')}
              className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                selectedType === 'VENTA_POS'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-[#08130E] text-zinc-400 border-[#1B362A] hover:text-white'
              }`}
            >
              Ventas POS
            </button>
            <button
              onClick={() => setSelectedType('VENTA_WEB')}
              className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                selectedType === 'VENTA_WEB'
                  ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                  : 'bg-[#08130E] text-zinc-400 border-[#1B362A] hover:text-white'
              }`}
            >
              Ventas Web
            </button>
            <button
              onClick={() => setSelectedType('FRACCIONAMIENTO_OUT')}
              className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                selectedType === 'FRACCIONAMIENTO_OUT'
                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                  : 'bg-[#08130E] text-zinc-400 border-[#1B362A] hover:text-white'
              }`}
            >
              Apertura Decants
            </button>
            <button
              onClick={() => setSelectedType('USO_TESTER')}
              className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                selectedType === 'USO_TESTER'
                  ? 'bg-violet-500/20 text-violet-300 border-violet-500/40'
                  : 'bg-[#08130E] text-zinc-400 border-[#1B362A] hover:text-white'
              }`}
            >
              Testers Showroom
            </button>
            <button
              onClick={() => setSelectedType('MERMA_ROTURA')}
              className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                selectedType === 'MERMA_ROTURA'
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  : 'bg-[#08130E] text-zinc-400 border-[#1B362A] hover:text-white'
              }`}
            >
              Mermas
            </button>
          </div>
        </div>

        {/* TABLA PRINCIPAL AUDITABLE DE MOVIMIENTOS */}
        <div className="rounded-2xl border border-[#1B362A] bg-[#13261E]/80 overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#1B362A] bg-[#0A1812] text-zinc-400 text-[11px] uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4">Fecha / Hora</th>
                  <th className="py-3 px-4">Tipo Movimiento</th>
                  <th className="py-3 px-4">Producto & SKU</th>
                  <th className="py-3 px-4 text-right">Variación</th>
                  <th className="py-3 px-4 text-right">Valor Unit.</th>
                  <th className="py-3 px-4 text-right">Total $ARS</th>
                  <th className="py-3 px-4">Origen / Referencia</th>
                  <th className="py-3 px-4">Responsable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1B362A]">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-zinc-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="h-6 w-6 animate-spin text-emerald-500" />
                        <span className="text-xs">Cargando libro de Kardex...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredMovements.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-zinc-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <FileText className="h-8 w-8 text-zinc-600" />
                        <p className="font-semibold text-zinc-300">No se encontraron movimientos registrados</p>
                        <p className="text-[11px] text-zinc-500">Prueba ajustando los filtros de búsqueda o categoría.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredMovements.map((mov) => {
                    const config = MOVEMENT_CONFIG[mov.movement_type] || MOVEMENT_CONFIG.AJUSTE_MANUAL;
                    const Icon = config.icon;
                    const isPositive = mov.quantity > 0;
                    const unitLabel = mov.product_type === 'decant_liquid' ? 'ml' : 'uds';
                    const dateObj = new Date(mov.created_at);
                    const dateStr = dateObj.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                    const timeStr = dateObj.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

                    return (
                      <tr key={mov.id} className="hover:bg-[#1B362A]/40 transition-colors group">
                        
                        {/* Fecha y Hora */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-mono text-zinc-200 font-medium">{dateStr}</div>
                          <div className="font-mono text-[10px] text-zinc-500">{timeStr} hs</div>
                        </td>

                        {/* Tipo de Movimiento con Badge */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border ${config.badgeBg} ${config.badgeText} ${config.borderColor}`}>
                            <Icon className="h-3 w-3 shrink-0" />
                            {config.label}
                          </span>
                        </td>

                        {/* Producto & SKU */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-white group-hover:text-emerald-300 transition-colors">
                            {mov.product_name}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-zinc-400 mt-0.5">
                            {mov.product_brand && <span>{mov.product_brand}</span>}
                            {mov.product_sku && (
                              <span className="font-mono bg-[#08130E] px-1.5 py-0.2 rounded border border-[#1B362A] text-zinc-300">
                                {mov.product_sku}
                              </span>
                            )}
                            {mov.product_type === 'decant_liquid' && (
                              <span className="text-cyan-400 font-semibold">• Granel</span>
                            )}
                            {mov.product_type === 'supply' && (
                              <span className="text-amber-400 font-semibold">• Insumo</span>
                            )}
                          </div>
                        </td>

                        {/* Cantidad Movida */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap font-mono">
                          <span className={`font-bold text-xs ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {isPositive ? `+${mov.quantity}` : mov.quantity} {unitLabel}
                          </span>
                        </td>

                        {/* Valor Unitario */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap font-mono text-zinc-300">
                          ${mov.unit_value_ars.toLocaleString('es-AR')}
                        </td>

                        {/* Total $ARS */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap font-mono font-bold text-white">
                          ${mov.total_value_ars.toLocaleString('es-AR')}
                          <div className="text-[10px] text-zinc-500 font-normal">
                            ≈ USD ${(exchangeRate > 0 ? (mov.total_value_ars / exchangeRate).toFixed(1) : '0')}
                          </div>
                        </td>

                        {/* Referencia / Motivo */}
                        <td className="py-3.5 px-4 max-w-xs">
                          <div className="text-xs text-zinc-300 truncate" title={mov.reference_label}>
                            {mov.reference_label}
                          </div>
                          {mov.notes && (
                            <div className="text-[10px] text-zinc-500 italic truncate" title={mov.notes}>
                              {mov.notes}
                            </div>
                          )}
                        </td>

                        {/* Responsable */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-[11px] text-zinc-400">
                          {mov.responsible_user || 'Sistema'}
                        </td>

                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pie de tabla con conteo */}
          <div className="p-4 border-t border-[#1B362A] bg-[#0A1812] flex items-center justify-between text-xs text-zinc-500">
            <span>Mostrando {filteredMovements.length} de {movements.length} movimientos</span>
            <span className="font-mono text-[11px]">Sistema Oficial Kardex • Elohim Import</span>
          </div>
        </div>

      </main>

      {/* FOOTER */}
      <footer className="border-t border-[#1B362A] bg-[#08130E] py-6 mt-12">
        <div className="container mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500 max-w-7xl">
          <p>© 2026 Elohim Import ERP. Módulo de Auditoría de Inventario y Kardex.</p>
          <div className="flex gap-4">
            <Link href="/productos" className="hover:text-zinc-300">Catálogo</Link>
            <span>•</span>
            <Link href="/admin/inventario/decants" className="hover:text-zinc-300">Hub Decants</Link>
            <span>•</span>
            <Link href="/admin/inventario/ajustes" className="hover:text-zinc-300">Ajustes & Mermas</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
