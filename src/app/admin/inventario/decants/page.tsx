'use client';

import React, { useState, useEffect } from 'react';
import { useUserStore } from '@/hooks/use-user-store';
import { useExchangeRate } from '@/hooks/use-exchange-rate';
import { getProducts } from '@/app/actions/products';
import { getFractionationLogs, FractionationLogRecord } from '@/app/actions/inventory';
import { Product } from '@/types';
import { RoleSelector } from '@/components/products/RoleSelector';
import { ExchangeRateWidget } from '@/components/rates/ExchangeRateWidget';
import { FractionateModal } from '@/components/products/FractionateModal';
import { 
  Droplet, Package, Archive, AlertTriangle, CheckCircle2, ArrowLeft, 
  Plus, RefreshCw, Layers, ShieldAlert, Sparkles, AlertCircle, 
  Flame, TrendingDown, Clock, Search, HelpCircle, Activity, ShoppingCart
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

export default function DecantsHubPage() {
  const { role } = useUserStore();
  const { rate: exchangeRate } = useExchangeRate();

  const [products, setProducts] = useState<Product[]>([]);
  const [fractionationLogs, setFractionationLogs] = useState<FractionationLogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal de Fraccionamiento Rápido
  const [isFracModalOpen, setIsFracModalOpen] = useState(false);
  const [selectedBottleForFrac, setSelectedBottleForFrac] = useState<Product | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const [pRes, fRes] = await Promise.all([
      getProducts(role),
      getFractionationLogs(role),
    ]);

    if (pRes.success && pRes.data) {
      setProducts(pRes.data);
    } else {
      toast.error(pRes.error || 'Error al cargar catálogo de productos.');
    }

    if (fRes.success && fRes.data) {
      setFractionationLogs(fRes.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [role]);

  if (role !== 'admin') {
    return (
      <div className="flex flex-col min-h-screen bg-[#08130E] text-zinc-50">
        <header className="sticky top-0 z-40 w-full border-b border-[#1B362A] bg-[#08130E]/80 backdrop-blur-md">
          <div className="container mx-auto flex h-16 items-center justify-between px-6 max-w-6xl">
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
                El Hub de Decants y Control de Fraccionamiento es exclusivo para Administradores.
              </CardDescription>
            </CardHeader>
          </Card>
        </main>
      </div>
    );
  }

  // 1. Filtrar líquidos a granel
  const decantLiquids = products.filter(p => p.type === 'decant_liquid');
  const filteredLiquids = decantLiquids.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 2. Botellas selladas con stock disponibles para fraccionar
  const availableBottles = products.filter(p => p.type === 'bottle' && p.stock_quantity > 0);

  // 3. Filtrar insumos críticos de packaging
  const allSupplies = products.filter(p => p.type === 'supply');
  const supply5ml = allSupplies.find(s => Number(s.volume_ml) === 5 || s.sku.includes('5ML') || s.name.toLowerCase().includes('5ml'));
  const supply10ml = allSupplies.find(s => Number(s.volume_ml) === 10 || s.sku.includes('10ML') || s.name.toLowerCase().includes('10ml'));
  const atomizers = allSupplies.filter(s => s.name.toLowerCase().includes('atomizador') || s.name.toLowerCase().includes('valvula'));
  const labels = allSupplies.filter(s => s.name.toLowerCase().includes('etiqueta') || s.sku.includes('ETIQ'));

  const stock5ml = Number(supply5ml?.stock_quantity || 0);
  const stock10ml = Number(supply10ml?.stock_quantity || 0);
  const totalAtomizers = atomizers.reduce((acc, a) => acc + Number(a.stock_quantity || 0), 0);
  const totalLabels = labels.reduce((acc, l) => acc + Number(l.stock_quantity || 0), 0);

  // 4. Métricas Totales del Hub
  const totalLiquidMl = decantLiquids.reduce((acc, d) => acc + Number(d.stock_quantity || 0), 0);
  const totalInmovilizadoArs = decantLiquids.reduce((acc, d) => acc + (Number(d.stock_quantity || 0) * Number(d.base_cost_ars || 0)), 0);
  const totalInmovilizadoUsd = exchangeRate ? totalInmovilizadoArs / exchangeRate : 0;

  // 5. Simulación de Rendimiento y Cuellos de Botella
  const max5mlFromLiquid = Math.floor(totalLiquidMl / 5);
  const max10mlFromLiquid = Math.floor(totalLiquidMl / 10);
  
  const actionable5ml = Math.min(max5mlFromLiquid, stock5ml);
  const actionable10ml = Math.min(max10mlFromLiquid, stock10ml);

  // Detección de Cuellos de Botella
  let bottleneck5ml = '';
  if (stock5ml <= 0) {
    bottleneck5ml = 'Sin frascos de 5ml en inventario';
  } else if (stock5ml < max5mlFromLiquid) {
    bottleneck5ml = `Frascos 5ml limitan la producción (${stock5ml} frascos vs ${max5mlFromLiquid} de líquido)`;
  } else {
    bottleneck5ml = 'Perfume líquido a granel limita la producción';
  }

  let bottleneck10ml = '';
  if (stock10ml <= 0) {
    bottleneck10ml = 'Sin frascos de 10ml en inventario';
  } else if (stock10ml < max10mlFromLiquid) {
    bottleneck10ml = `Frascos 10ml limitan la producción (${stock10ml} frascos vs ${max10mlFromLiquid} de líquido)`;
  } else {
    bottleneck10ml = 'Perfume líquido a granel limita la producción';
  }

  const handleOpenFracForBottle = (bottle?: Product) => {
    setSelectedBottleForFrac(bottle || null);
    setIsFracModalOpen(true);
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#08130E] text-zinc-50 font-sans">
      
      {/* NAVBAR */}
      <header className="sticky top-0 z-40 w-full border-b border-[#1B362A] bg-[#08130E]/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 max-w-7xl">
          <div className="flex items-center gap-4">
            <Link 
              href="/"
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Dashboard</span>
            </Link>
            <span className="text-zinc-800">|</span>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <Droplet className="h-4.5 w-4.5" />
              </div>
              <div>
                <span className="text-sm font-bold tracking-tight text-white uppercase">
                  Hub Central de Decants & Fraccionamiento
                </span>
                <span className="hidden sm:inline-block ml-2 text-[10px] font-mono text-[#D0A96B] bg-[#D0A96B]/10 px-2 py-0.5 rounded-full border border-[#D0A96B]/30">
                  Laboratorio & Stock
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <RoleSelector />
            <ExchangeRateWidget role={role} />
          </div>
        </div>
      </header>

      {/* CUERPO PRINCIPAL */}
      <main className="flex-1 container mx-auto px-4 py-8 sm:px-6 max-w-7xl space-y-8">
        
        {/* ENCABEZADO Y ACCIONES PRINCIPALES */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[#1B362A] pb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white font-serif flex items-center gap-2">
              Control Profesional de Graneles y Fraccionamiento JIT
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              Monitoreo milimétrico de perfumes abiertos, valor inmovilizado, cuello de botella de packaging y registro de trasvasados.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/admin/inventario/kardex">
              <Button
                variant="outline"
                className="border-[#1B362A] bg-[#13261E] text-zinc-300 hover:text-white hover:bg-zinc-800 text-xs h-10 gap-1.5 cursor-pointer"
              >
                <Activity className="h-4 w-4 text-emerald-400" />
                <span>Ver Kardex</span>
              </Button>
            </Link>

            <Link href="/admin/inventario/recetas">
              <Button
                variant="outline"
                className="border-[#1B362A] bg-[#13261E] text-zinc-300 hover:text-white hover:bg-zinc-800 text-xs h-10 gap-1.5 cursor-pointer"
              >
                <Layers className="h-4 w-4 text-[#D0A96B]" />
                <span>Recetas BOM</span>
              </Button>
            </Link>

            <Button
              onClick={() => handleOpenFracForBottle()}
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs h-10 px-4 rounded-xl shadow-lg shadow-emerald-600/20 flex items-center gap-2 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Fraccionar Botella Sellada</span>
            </Button>
          </div>
        </div>

        {/* METRICAS KPI SUPERIORES */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#13261E]/80 border border-[#1B362A] rounded-2xl p-4 shadow-xl space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Total Líquido en Proceso</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-mono font-black text-cyan-400">{totalLiquidMl.toLocaleString('es-AR')}</span>
              <span className="text-xs font-mono text-zinc-500">ml disponibles</span>
            </div>
            <p className="text-[11px] text-zinc-400">En {decantLiquids.length} fragancia(s) activas</p>
          </div>

          <div className="bg-[#13261E]/80 border border-[#1B362A] rounded-2xl p-4 shadow-xl space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Valor en Granel Inmovilizado</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-mono font-black text-emerald-400">
                ${totalInmovilizadoArs.toLocaleString('es-AR')}
              </span>
              <span className="text-xs font-mono text-zinc-500">ARS</span>
            </div>
            <p className="text-[11px] text-zinc-400">~ u$s {totalInmovilizadoUsd.toFixed(1)} USD a reposición</p>
          </div>

          <div className="bg-[#13261E]/80 border border-[#1B362A] rounded-2xl p-4 shadow-xl space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Potencial Envasable Hoy (5ml)</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-mono font-black text-[#D0A96B]">{actionable5ml}</span>
              <span className="text-xs font-mono text-zinc-500">muestras listas</span>
            </div>
            <p className="text-[11px] text-zinc-400">
              Limitado por: <span className="font-semibold text-amber-400">{stock5ml < max5mlFromLiquid ? 'Frascos 5ml' : 'Líquido'}</span>
            </p>
          </div>

          <div className="bg-[#13261E]/80 border border-[#1B362A] rounded-2xl p-4 shadow-xl space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Potencial Envasable Hoy (10ml)</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-mono font-black text-indigo-400">{actionable10ml}</span>
              <span className="text-xs font-mono text-zinc-500">muestras listas</span>
            </div>
            <p className="text-[11px] text-zinc-400">
              Limitado por: <span className="font-semibold text-amber-400">{stock10ml < max10mlFromLiquid ? 'Frascos 10ml' : 'Líquido'}</span>
            </p>
          </div>
        </div>

        {/* CONTENIDO PRINCIPAL: 2 COLUMNAS (MONITOR DE GRANEL Y SEMÁFORO DE INSUMOS) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* COLUMNA IZQUIERDA (2/3): MONITOR DE LÍQUIDOS A GRANEL */}
          <div className="lg:col-span-2 space-y-6">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Droplet className="h-5 w-5 text-cyan-400" />
                  Monitor de Perfumes a Granel
                </h2>
                <p className="text-xs text-zinc-400">
                  Nivel de líquido restante, costo promedio ponderado (PPP) y valor actual.
                </p>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Buscar granel por nombre o SKU..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-[#13261E] border border-[#1B362A] rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#D0A96B]"
                />
              </div>
            </div>

            {loading ? (
              <div className="py-16 text-center text-zinc-500 flex flex-col items-center justify-center gap-3">
                <RefreshCw className="h-8 w-8 animate-spin text-[#D0A96B]" />
                <span className="text-xs font-mono">Cargando monitor de decants...</span>
              </div>
            ) : filteredLiquids.length === 0 ? (
              <div className="p-12 text-center border border-dashed border-[#1B362A] rounded-2xl bg-[#13261E]/30 space-y-3">
                <Droplet className="h-10 w-10 mx-auto text-zinc-600" />
                <h3 className="text-sm font-bold text-zinc-300">No hay líquidos a granel registrados</h3>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                  Abre una botella comercial sellada con el botón "Fraccionar Botella Sellada" para iniciar el stock de decants.
                </p>
                <Button
                  onClick={() => handleOpenFracForBottle()}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer"
                >
                  Abrir Primera Botella
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredLiquids.map((liquid) => {
                  const currentMl = Number(liquid.stock_quantity || 0);
                  const maxMlEstimate = Number(liquid.volume_ml) || 100;
                  const percent = Math.min(100, Math.round((currentMl / maxMlEstimate) * 100));
                  const costPerMl = Number(liquid.base_cost_ars || 0);
                  const totalVal = currentMl * costPerMl;
                  
                  // Colores de barra de progreso
                  let barColor = 'bg-emerald-500';
                  let statusBadge = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
                  if (currentMl <= 15) {
                    barColor = 'bg-rose-500';
                    statusBadge = 'bg-rose-500/10 text-rose-400 border-rose-500/30';
                  } else if (currentMl <= 40) {
                    barColor = 'bg-amber-500';
                    statusBadge = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
                  }

                  const yields5ml = Math.floor(currentMl / 5);
                  const yields10ml = Math.floor(currentMl / 10);

                  return (
                    <div 
                      key={liquid.id}
                      className="bg-[#13261E]/90 border border-[#1B362A] hover:border-[#D0A96B]/50 transition-all rounded-2xl p-5 shadow-xl space-y-4 relative overflow-hidden"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-mono uppercase tracking-widest text-[#D0A96B] font-bold">
                            {liquid.brand}
                          </span>
                          <h3 className="text-sm font-bold text-white line-clamp-1">{liquid.name}</h3>
                          <span className="text-[10px] font-mono text-zinc-500">SKU: {liquid.sku}</span>
                        </div>

                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusBadge}`}>
                          {currentMl <= 15 ? 'Crítico' : currentMl <= 40 ? 'Medio' : 'Óptimo'}
                        </span>
                      </div>

                      {/* BARRA DE PROGRESO DE ML */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-baseline text-xs">
                          <span className="font-mono font-bold text-white flex items-center gap-1">
                            <span className="text-lg font-black text-cyan-400">{currentMl}</span> / {maxMlEstimate} ml
                          </span>
                          <span className="font-mono text-zinc-400 text-[11px]">{percent}%</span>
                        </div>
                        <div className="w-full bg-[#08130E] h-2.5 rounded-full overflow-hidden border border-[#1B362A]">
                          <div 
                            className={`h-full transition-all duration-500 ${barColor}`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>

                      {/* DATOS DE VALUACIÓN Y COSTOS */}
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#1B362A]/60 text-xs">
                        <div>
                          <span className="text-[10px] text-zinc-400 block">Costo PPP / ml:</span>
                          <span className="font-mono font-bold text-zinc-200">
                            ${costPerMl.toLocaleString('es-AR')} ARS
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-zinc-400 block">Valor Inmovilizado:</span>
                          <span className="font-mono font-bold text-emerald-400">
                            ${Math.round(totalVal).toLocaleString('es-AR')} ARS
                          </span>
                        </div>
                      </div>

                      {/* RENDIMIENTO CALCULADO */}
                      <div className="bg-[#08130E]/70 rounded-xl p-2.5 border border-[#1B362A] flex items-center justify-between text-[11px]">
                        <span className="text-zinc-400">Rendimiento estimado:</span>
                        <div className="flex items-center gap-2 font-mono font-bold">
                          <span className="text-[#D0A96B]">{yields5ml}x 5ml</span>
                          <span className="text-zinc-600">|</span>
                          <span className="text-indigo-400">{yields10ml}x 10ml</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </div>

          {/* COLUMNA DERECHA (1/3): SEMÁFORO DE INSUMOS Y SIMULADOR */}
          <div className="space-y-6">
            
            {/* PANEL DE SEMÁFORO DE INSUMOS */}
            <div className="bg-[#13261E]/90 border border-[#1B362A] rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-[#1B362A] pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Archive className="h-4 w-4 text-amber-400" />
                  Semáforo de Insumos Críticos
                </h3>
                <Link href="/admin/inventario/insumos" className="text-[11px] font-bold text-[#D0A96B] hover:underline">
                  Gestionar →
                </Link>
              </div>

              <div className="space-y-3">
                
                {/* FRASCO 5ML */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#08130E]/60 border border-[#1B362A]">
                  <div>
                    <h4 className="text-xs font-bold text-white">Frascos Vacíos 5ml</h4>
                    <span className="text-[10px] font-mono text-zinc-500">Insumo vial para decants</span>
                  </div>
                  <div className="text-right">
                    <span className={`font-mono text-sm font-black ${stock5ml < 10 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {stock5ml} uds
                    </span>
                    {stock5ml < 10 && (
                      <span className="block text-[9px] font-bold text-rose-400 uppercase tracking-wider">
                        ⚠️ Reorden Urgente
                      </span>
                    )}
                  </div>
                </div>

                {/* FRASCO 10ML */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#08130E]/60 border border-[#1B362A]">
                  <div>
                    <h4 className="text-xs font-bold text-white">Frascos Vacíos 10ml</h4>
                    <span className="text-[10px] font-mono text-zinc-500">Insumo vial para decants</span>
                  </div>
                  <div className="text-right">
                    <span className={`font-mono text-sm font-black ${stock10ml < 10 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {stock10ml} uds
                    </span>
                    {stock10ml < 10 && (
                      <span className="block text-[9px] font-bold text-rose-400 uppercase tracking-wider">
                        ⚠️ Reorden Urgente
                      </span>
                    )}
                  </div>
                </div>

                {/* ATOMIZADORES */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#08130E]/60 border border-[#1B362A]">
                  <div>
                    <h4 className="text-xs font-bold text-white">Válvulas Spray / Atomizadores</h4>
                    <span className="text-[10px] font-mono text-zinc-500">Dispensadores de muestra</span>
                  </div>
                  <div className="text-right">
                    <span className={`font-mono text-sm font-black ${totalAtomizers < 15 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {totalAtomizers} uds
                    </span>
                  </div>
                </div>

                {/* ETIQUETAS */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#08130E]/60 border border-[#1B362A]">
                  <div>
                    <h4 className="text-xs font-bold text-white">Etiquetas Impresas</h4>
                    <span className="text-[10px] font-mono text-zinc-500">Identificación de fragancia</span>
                  </div>
                  <div className="text-right">
                    <span className={`font-mono text-sm font-black ${totalLabels < 20 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {totalLabels} uds
                    </span>
                  </div>
                </div>

              </div>

              <Link href="/compras">
                <Button 
                  variant="outline" 
                  className="w-full mt-2 border-amber-500/30 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 text-xs font-bold h-9 gap-1.5 cursor-pointer"
                >
                  <ShoppingCart className="h-3.5 w-3.5" />
                  <span>Comprar Insumos en /compras</span>
                </Button>
              </Link>
            </div>

            {/* PANEL DE ANÁLISIS DE CUELLO DE BOTELLA */}
            <div className="bg-[#13261E]/90 border border-[#1B362A] rounded-2xl p-5 shadow-xl space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-[#1B362A] pb-2">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                Diagnóstico de Cuello de Botella
              </h3>

              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-[#08130E] border border-[#1B362A] space-y-1">
                  <span className="text-[10px] font-bold text-[#D0A96B] uppercase tracking-wider block">
                    Formato Decant 5ml:
                  </span>
                  <p className="text-zinc-300">{bottleneck5ml}</p>
                </div>

                <div className="p-3 rounded-xl bg-[#08130E] border border-[#1B362A] space-y-1">
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">
                    Formato Decant 10ml:
                  </span>
                  <p className="text-zinc-300">{bottleneck10ml}</p>
                </div>
              </div>
            </div>

          </div>

        </div>

        {/* REGISTRO DE TRASVASADOS Y FRACCIONAMIENTOS HISTÓRICOS */}
        <div className="bg-[#13261E]/90 border border-[#1B362A] rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1B362A] pb-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Clock className="h-4.5 w-4.5 text-[#D0A96B]" />
                Registro de Trasvasados de Botellas (Trazabilidad)
              </h3>
              <p className="text-xs text-zinc-400">
                Auditoría histórica de apertura de botellas selladas y conversión a líquido comercial.
              </p>
            </div>

            <span className="text-xs font-mono text-zinc-400">
              {fractionationLogs.length} registro(s) asentado(s)
            </span>
          </div>

          {fractionationLogs.length === 0 ? (
            <div className="py-8 text-center text-zinc-500 text-xs">
              Aún no se han asentado trasvasados en el registro de auditoría.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#1B362A] text-zinc-400 font-mono uppercase text-[10px]">
                    <th className="py-2.5 px-3">Fecha y Hora</th>
                    <th className="py-2.5 px-3">Botella Abierta</th>
                    <th className="py-2.5 px-3">Líquido Granel</th>
                    <th className="py-2.5 px-3 text-right">Volumen</th>
                    <th className="py-2.5 px-3 text-right">Costo Transferido</th>
                    <th className="py-2.5 px-3 text-right">PPP / ml</th>
                    <th className="py-2.5 px-3">Operador</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1B362A]/40 font-mono">
                  {fractionationLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-[#1B362A]/20 transition-colors">
                      <td className="py-2.5 px-3 text-zinc-400 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleDateString('es-AR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-white">
                        {log.source_bottle_name}
                        <span className="block text-[10px] text-zinc-500 font-normal">SKU: {log.source_bottle_sku}</span>
                      </td>
                      <td className="py-2.5 px-3 text-cyan-400">
                        {log.target_liquid_name}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-cyan-400">
                        +{log.volume_ml} ml
                      </td>
                      <td className="py-2.5 px-3 text-right text-emerald-400 font-bold">
                        ${log.cost_transferred_ars.toLocaleString('es-AR')}
                      </td>
                      <td className="py-2.5 px-3 text-right text-zinc-300">
                        ${log.cost_per_ml_calculated.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-zinc-400 font-sans text-[11px]">
                        {log.admin_name}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </main>

      {/* MODAL DE FRACCIONAMIENTO */}
      <FractionateModal
        isOpen={isFracModalOpen}
        onClose={() => {
          setIsFracModalOpen(false);
          setSelectedBottleForFrac(null);
        }}
        onSuccess={() => {
          fetchData();
          toast.success('¡Fraccionamiento completado exitosamente!');
        }}
        bottle={selectedBottleForFrac}
        availableBottles={availableBottles}
        role={role}
      />

    </div>
  );
}
