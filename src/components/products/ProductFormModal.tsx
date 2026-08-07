'use client';

import React, { useState, useEffect } from 'react';
import { Product, ProductType, UserRole } from '@/types';
import { createProduct, updateProduct } from '@/app/actions/products';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X, Save, RefreshCw, AlertCircle, Sparkles, Wand2 } from 'lucide-react';
import { extractPerfumeData } from '@/app/actions/aiPerfume';
import { toast } from 'sonner';

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  product: Product | null; // null si es creación, objeto si es edición
  role?: UserRole;
  initialType?: ProductType;
}

export function ProductFormModal({ isOpen, onClose, onSuccess, product, role = 'admin', initialType = 'bottle' }: ProductFormModalProps) {
  const isEditing = !!product;

  // Estados del Formulario
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [type, setType] = useState<ProductType>(initialType);
  const [batchCode, setBatchCode] = useState('');
  const [olfactoryFamily, setOlfactoryFamily] = useState('');
  const [olfactoryNotesText, setOlfactoryNotesText] = useState('');
  const [baseCostArs, setBaseCostArs] = useState('');
  const [basePriceArs, setBasePriceArs] = useState('');
  const [stockQuantity, setStockQuantity] = useState('');
  const [volumeMl, setVolumeMl] = useState('');

  // Estados de carga y error
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sincronizar formulario con el producto a editar
  const [minStockAlert, setMinStockAlert] = useState('5');

  // Estados para Calculadora de Rentabilidad Automática
  const [profitMode, setProfitMode] = useState<'real_margin' | 'markup'>('real_margin');
  const [marginPercent, setMarginPercent] = useState<string>('40');

  // Estados para Extracción Olfativa con IA
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [rawFragranticaText, setRawFragranticaText] = useState('');
  const [aiExtracting, setAiExtracting] = useState(false);

  const handleAiAutoFill = async () => {
    if (!rawFragranticaText || rawFragranticaText.trim().length < 5) {
      toast.error('Por favor pega el texto descriptivo del perfume (ej. de Fragrantica).');
      return;
    }

    try {
      setAiExtracting(true);
      const res = await extractPerfumeData(role, rawFragranticaText);
      if (res.success && res.data) {
        if (res.data.familia_olfativa) {
          setOlfactoryFamily(res.data.familia_olfativa);
        }
        const allNotes = [
          ...res.data.notas_salida,
          ...res.data.notas_corazon,
          ...res.data.notas_fondo
        ].filter(Boolean);

        if (allNotes.length > 0) {
          setOlfactoryNotesText(Array.from(new Set(allNotes)).join(', '));
        }

        toast.success('¡Pirámide olfativa autocompletada con IA!');
        setAiModalOpen(false);
        setRawFragranticaText('');
      } else {
        toast.error(res.error || 'No se pudieron extraer notas del texto.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error al procesar el texto con IA.');
    } finally {
      setAiExtracting(false);
    }
  };

  // Recalcular precio a partir de costo y % de margen/markup
  const calculatePriceFromMargin = (costStr: string, pctStr: string, mode: 'real_margin' | 'markup') => {
    const cost = parseFloat(costStr);
    const pct = parseFloat(pctStr);
    if (isNaN(cost) || cost <= 0 || isNaN(pct)) return;

    let calculatedPrice = 0;
    if (mode === 'real_margin') {
      if (pct >= 100) return; // Evitar división por <= 0
      calculatedPrice = cost / (1 - pct / 100);
    } else {
      calculatedPrice = cost * (1 + pct / 100);
    }

    setBasePriceArs(Math.round(calculatedPrice).toString());
  };

  // Recalcular % implícito cuando el usuario modifica directamente el Precio de Venta
  const calculateMarginFromPrice = (costStr: string, priceStr: string, mode: 'real_margin' | 'markup') => {
    const cost = parseFloat(costStr);
    const price = parseFloat(priceStr);
    if (isNaN(cost) || cost <= 0 || isNaN(price) || price <= 0) return;

    let pct = 0;
    if (mode === 'real_margin') {
      pct = ((price - cost) / price) * 100;
    } else {
      pct = ((price - cost) / cost) * 100;
    }

    setMarginPercent(pct > 0 ? pct.toFixed(1) : '0');
  };

  const handleCostChange = (val: string) => {
    setBaseCostArs(val);
    if (val && marginPercent && type !== 'supply') {
      calculatePriceFromMargin(val, marginPercent, profitMode);
    }
  };

  const handleMarginChange = (val: string) => {
    setMarginPercent(val);
    if (baseCostArs && val && type !== 'supply') {
      calculatePriceFromMargin(baseCostArs, val, profitMode);
    }
  };

  const handlePriceChange = (val: string) => {
    setBasePriceArs(val);
    if (baseCostArs && val && type !== 'supply') {
      calculateMarginFromPrice(baseCostArs, val, profitMode);
    }
  };

  const handleModeChange = (newMode: 'real_margin' | 'markup') => {
    setProfitMode(newMode);
    if (baseCostArs && marginPercent && type !== 'supply') {
      calculatePriceFromMargin(baseCostArs, marginPercent, newMode);
    }
  };

  useEffect(() => {
    if (product) {
      setSku(product.sku || '');
      setName(product.name || '');
      setBrand(product.brand || '');
      setType(product.type || 'bottle');
      setBatchCode(product.batch_code || '');
      setOlfactoryFamily(product.olfactory_family || '');
      setOlfactoryNotesText(Array.isArray(product.olfactory_notes) ? product.olfactory_notes.join(', ') : '');
      
      const cost = product.base_cost_ars !== undefined ? product.base_cost_ars : 0;
      const price = product.base_price_ars !== undefined ? product.base_price_ars : 0;
      
      setBaseCostArs(cost > 0 ? cost.toString() : '');
      setBasePriceArs(price > 0 ? price.toString() : '');
      setStockQuantity(product.stock_quantity !== undefined ? product.stock_quantity.toString() : '');
      setVolumeMl(product.volume_ml !== undefined ? product.volume_ml.toString() : '');
      setMinStockAlert(product.min_stock_alert !== undefined && product.min_stock_alert !== null ? product.min_stock_alert.toString() : '5');

      if (cost > 0 && price > 0) {
        const pct = profitMode === 'real_margin' ? ((price - cost) / price) * 100 : ((price - cost) / cost) * 100;
        setMarginPercent(pct > 0 ? pct.toFixed(1) : '0');
      } else {
        setMarginPercent('40');
      }
    } else {
      // Limpiar formulario para nuevo registro
      setSku('');
      setName('');
      setBrand('');
      setType(initialType);
      setBatchCode('');
      setOlfactoryFamily('');
      setOlfactoryNotesText('');
      setBaseCostArs('');
      setBasePriceArs(initialType === 'supply' ? '0' : '');
      setStockQuantity('');
      setVolumeMl('');
      setMinStockAlert('5');
      setMarginPercent('40');
    }
    setError(null);
  }, [product, isOpen, initialType]);

  if (!isOpen) return null;

  // Bloquear el renderizado completo si no es administrador (doble protección en cliente)
  if (role !== 'admin') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="w-full max-w-md bg-white dark:bg-[#08130E] p-6 rounded-xl border border-rose-200 dark:border-rose-900/30 shadow-2xl">
          <div className="flex gap-3 text-rose-600 dark:text-rose-400">
            <AlertCircle className="h-6 w-6 shrink-0" />
            <div>
              <h3 className="font-bold text-lg">Acceso Restringido</h3>
              <p className="text-sm mt-1 text-slate-600 dark:text-zinc-400">
                Solo los usuarios con rol de administrador pueden agregar o editar productos del catálogo.
              </p>
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <Button onClick={onClose}>Cerrar</Button>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const notesArray = olfactoryNotesText
      .split(',')
      .map(n => n.trim())
      .filter(Boolean);

    const formData = {
      sku: sku.trim(),
      name: name.trim(),
      brand: brand.trim(),
      type,
      batch_code: batchCode.trim() || undefined,
      olfactory_family: olfactoryFamily.trim() || undefined,
      olfactory_notes: notesArray,
      min_stock_alert: minStockAlert.trim() !== '' ? parseFloat(minStockAlert) : 5,
      base_cost_ars: parseFloat(baseCostArs) || 0,
      base_price_ars: parseFloat(basePriceArs) || 0,
      stock_quantity: parseFloat(stockQuantity) || 0,
      volume_ml: volumeMl.trim() !== '' ? parseFloat(volumeMl) : null,
    };

    let result;
    if (isEditing && product) {
      result = await updateProduct(role, product.id, formData);
    } else {
      result = await createProduct(role, formData);
    }

    setLoading(false);
    if (result.success) {
      onSuccess();
      onClose();
    } else {
      setError(result.error || 'Error al guardar el producto');
    }
  };

  // Cálculo de ganancia neta en vivo para feedback visual
  const numCost = parseFloat(baseCostArs) || 0;
  const numPrice = parseFloat(basePriceArs) || 0;
  const projectedNetProfit = numPrice - numCost;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div className="w-[95vw] sm:max-w-xl bg-white dark:bg-[#08130E] border border-slate-200 dark:border-[#1B362A] rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 my-auto">
        <form onSubmit={handleSubmit}>
          
          <CardHeader className="border-b border-slate-100 dark:border-zinc-900 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">
                {isEditing ? 'Editar Producto' : 'Nuevo Producto'}
              </CardTitle>
              <button
                type="button"
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <CardDescription className="mt-1">
              Todos los campos de costos y precios de venta deben cargarse obligatoriamente en **Pesos Argentinos (ARS)**.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 max-h-[65vh] overflow-y-auto p-6">
            
            {error && (
              <div className="flex gap-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 p-3 text-xs text-rose-600 dark:text-rose-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {/* SKU */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  SKU / Código *
                </label>
                <Input
                  required
                  placeholder="Ej. BATCH-A100"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  className="font-mono"
                />
              </div>

              {/* TIPO */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  Categoría / Tipo *
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as ProductType)}
                  className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring dark:border-input/40 dark:bg-input/10 dark:text-white"
                >
                  <option value="bottle">Botella Sellada</option>
                  <option value="decant_liquid">Líquido a Granel (Decant)</option>
                  <option value="supply">Insumo (Frascos, Atomizadores)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* NOMBRE */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  Nombre del Perfume/Insumo *
                </label>
                <Input
                  required
                  placeholder="Ej. Bleu de Chanel EDP"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              {/* MARCA */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  Marca / Fabricante *
                </label>
                <Input
                  required
                  placeholder="Ej. Chanel"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                />
              </div>
            </div>

            {/* BOTÓN Y SECCIÓN AUTO-COMPLETAR CON IA */}
            {type !== 'supply' && (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#13261E] border border-[#1B362A]">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#D0A96B]" />
                  <span className="text-xs font-bold text-white">¿Tienes el texto de Fragrantica?</span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setAiModalOpen(true)}
                  className="border-[#D0A96B]/40 bg-[#08130E] text-[#D0A96B] hover:bg-zinc-800 text-xs font-bold h-7 cursor-pointer flex items-center gap-1.5"
                >
                  <Wand2 className="h-3.5 w-3.5" />
                  <span>Auto-completar con IA</span>
                </Button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {/* BATCH CODE */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  Batch Code
                </label>
                <Input
                  placeholder="Ej. 8201"
                  value={batchCode}
                  onChange={(e) => setBatchCode(e.target.value)}
                />
              </div>

              {/* FAMILIA OLFATIVA SELECT (Solo Perfumes y Decants) */}
              {type !== 'supply' ? (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    Familia Olfativa
                  </label>
                  <select
                    value={olfactoryFamily}
                    onChange={(e) => setOlfactoryFamily(e.target.value)}
                    className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring dark:border-input/40 dark:bg-input/10 dark:text-white"
                  >
                    <option value="">Seleccionar familia...</option>
                    <option value="Cítrico">Cítrico</option>
                    <option value="Amaderado">Amaderado</option>
                    <option value="Gourmand">Gourmand</option>
                    <option value="Floral">Floral</option>
                    <option value="Oriental">Oriental</option>
                    <option value="Cuero">Cuero</option>
                    <option value="Aromático">Aromático</option>
                    <option value="Fougère">Fougère</option>
                    <option value="Especiado">Especiado</option>
                  </select>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    Capacidad Frasco (ml)
                  </label>
                  <Input
                    type="number"
                    placeholder="Ej. 5, 10, 50 ml"
                    value={volumeMl}
                    onChange={(e) => setVolumeMl(e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* NOTAS OLFATIVAS (Solo Perfumes y Decants) */}
            {type !== 'supply' && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[#D0A96B]">
                  Notas Olfativas (separadas por coma)
                </label>
                <Input
                  placeholder="Ej. Vainilla, Tabaco, Bergamota, Cuero, Sándalo"
                  value={olfactoryNotesText}
                  onChange={(e) => setOlfactoryNotesText(e.target.value)}
                  className="border-[#1B362A] focus-visible:ring-[#D0A96B]"
                />
                <p className="text-[10px] text-zinc-500">
                  Carga las notas aromáticas clave del perfume para alimentar el algoritmo de Match Olfativo del CRM.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {/* CAPACIDAD ML (Solo para botellas o decants) */}
              {type !== 'supply' ? (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    Volumen (ml) *
                  </label>
                  <Input
                    type="number"
                    placeholder="Ej. 100"
                    required
                    value={volumeMl}
                    onChange={(e) => setVolumeMl(e.target.value)}
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-amber-500 dark:text-amber-400">
                    Tipo de Insumo
                  </label>
                  <div className="text-xs text-zinc-400 p-2 rounded-lg bg-[#13261E] border border-[#1B362A] font-mono">
                    Packaging / Envase Vacio (JIT)
                  </div>
                </div>
              )}

              {/* STOCK QUANTITY */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  {type === 'decant_liquid' ? 'Stock Líquido (ml) *' : 'Cantidad en Stock *'}
                </label>
                <Input
                  type="number"
                  required
                  placeholder="Ej. 10"
                  value={stockQuantity}
                  onChange={(e) => setStockQuantity(e.target.value)}
                />
              </div>
            </div>

            {/* ALERTA DE STOCK MINIMO */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-amber-500 dark:text-amber-400 flex items-center justify-between">
                <span>Límite de Alerta de Stock Mínimo *</span>
                <span className="text-[10px] text-zinc-500 font-normal">Dispara alerta en Radar de Re-Stock</span>
              </label>
              <Input
                type="number"
                required
                min="0"
                placeholder="Default: 5"
                value={minStockAlert}
                onChange={(e) => setMinStockAlert(e.target.value)}
                className="border-amber-900/40 focus-visible:ring-amber-500 font-mono"
              />
            </div>

            {/* SECCIÓN DE PRECIOS Y CALCULADORA AUTOMÁTICA DE RENTABILIDAD */}
            <div className="space-y-3 border-t border-[#1B362A] pt-4 bg-[#13261E]/40 p-4 rounded-xl border">
              
              {/* TOGGLE Y TÍTULO DE CALCULADORA */}
              {type !== 'supply' && (
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-[#D0A96B] font-serif">
                    Calculadora de Rentabilidad
                  </span>

                  {/* TOGGLE SWITCH ENTRE MARGEN REAL Y MARKUP DIRECTO */}
                  <div className="flex items-center rounded-lg bg-[#08130E] p-0.5 border border-[#1B362A]">
                    <button
                      type="button"
                      onClick={() => handleModeChange('real_margin')}
                      className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                        profitMode === 'real_margin'
                          ? 'bg-[#D0A96B] text-[#08130E] shadow-sm'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                      title="Margen Real sobre Precio de Venta: Precio = Costo / (1 - %)"
                    >
                      Margen Real (%)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleModeChange('markup')}
                      className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                        profitMode === 'markup'
                          ? 'bg-[#D0A96B] text-[#08130E] shadow-sm'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                      title="Markup Directo sobre Costo: Precio = Costo * (1 + %)"
                    >
                      Markup Directo (%)
                    </button>
                  </div>
                </div>
              )}

              {/* GRILLA DE 3 CAMPOS: COSTO, % RENTABILIDAD Y PRECIO VENTA */}
              <div className={type !== 'supply' ? "grid grid-cols-1 sm:grid-cols-3 gap-3" : "grid grid-cols-2 gap-4"}>
                
                {/* 1. COSTO ADQUISICIÓN ARS */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#D0A96B]">
                    Costo (ARS) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 px-0.5 text-sm text-slate-400 font-medium">$</span>
                    <Input
                      required
                      type="number"
                      placeholder="Ej. 45000"
                      value={baseCostArs}
                      onChange={(e) => handleCostChange(e.target.value)}
                      className="pl-7 border-[#1B362A] focus-visible:ring-[#D0A96B] font-mono text-white"
                    />
                  </div>
                </div>

                {/* 2. RENTABILIDAD DESEADA (%) - SOLO PERFUMES Y DECANTS */}
                {type !== 'supply' && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#E5C158]">
                      Rentabilidad (%)
                    </label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.5"
                        placeholder="Ej. 40"
                        value={marginPercent}
                        onChange={(e) => handleMarginChange(e.target.value)}
                        className="pr-7 border-[#1B362A] focus-visible:ring-[#D0A96B] font-mono text-white text-right"
                      />
                      <span className="absolute right-3 top-2 text-sm text-zinc-400 font-bold">%</span>
                    </div>
                  </div>
                )}

                {/* 3. PRECIO DE VENTA BASE ARS */}
                {type !== 'supply' ? (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                      Precio Venta (ARS) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 px-0.5 text-sm text-[#D0A96B] font-bold">$</span>
                      <Input
                        required
                        type="number"
                        placeholder="Ej. 75000"
                        value={basePriceArs}
                        onChange={(e) => handlePriceChange(e.target.value)}
                        className="pl-7 border-[#1B362A] focus-visible:ring-[#D0A96B] font-mono text-[#D0A96B] font-bold"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5 opacity-60">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                      Precio Venta Directa
                    </label>
                    <div className="text-xs text-zinc-400 p-2 rounded-lg bg-[#08130E] border border-[#1B362A] font-mono italic">
                      Sin venta al público ($0)
                    </div>
                  </div>
                )}

              </div>

              {/* FEEDBACK VISUAL EN TIEMPO REAL: GANANCIA NETA PROYECTADA */}
              {type !== 'supply' && numCost > 0 && numPrice > 0 && (
                <div className="flex items-center justify-between text-xs pt-2 border-t border-[#1B362A]/60 font-mono">
                  <span className="text-zinc-400">Ganancia neta proyectada por unidad:</span>
                  <span className={projectedNetProfit >= 0 ? 'text-[#D0A96B] font-extrabold text-sm' : 'text-rose-400 font-extrabold text-sm'}>
                    ${Math.round(projectedNetProfit).toLocaleString('es-AR')} ARS
                  </span>
                </div>
              )}

            </div>

          </CardContent>

          <CardFooter className="border-t border-slate-100 dark:border-zinc-900 pt-4 flex justify-end gap-3 bg-slate-50/50 dark:bg-[#13261E]/20 px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-[#D0A96B] hover:bg-[#E5C158] text-[#08130E] font-extrabold shadow-md shadow-[#D0A96B]/20 text-[#08130E]"
            >
              {loading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Guardando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" /> Guardar Producto
                </>
              )}
            </Button>
          </CardFooter>
          
        </form>
      </div>

      {/* MODAL POPUP PARA PEGAR TEXTO DE FRAGRANTICA Y EXTRAER CON IA */}
      {aiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-lg bg-[#08130E] border border-[#1B362A] rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#1B362A] pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#D0A96B]/10 text-[#D0A96B] border border-[#D0A96B]/30">
                  <Sparkles className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-bold text-white">Extracción de Notas con IA</h3>
              </div>
              <button
                type="button"
                onClick={() => setAiModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              Pega a continuación la reseña o descripción completa del perfume copiada de Fragrantica. La IA extraerá automáticamente la Familia Olfativa y las Notas de Salida, Corazón y Fondo.
            </p>

            <textarea
              rows={6}
              value={rawFragranticaText}
              onChange={(e) => setRawFragranticaText(e.target.value)}
              placeholder="Pega aquí el texto... Ej: 'Bleu de Chanel es una fragancia de la familia olfativa Amaderada Aromática. Las Notas de Salida son Toronja, Limón, Menta y Pimienta Rosa. Las Notas de Corazón son Jengibre, Nuez Moscada y Jazmín...'"
              className="w-full bg-[#13261E] border border-[#1B362A] rounded-xl p-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#D0A96B] font-mono"
            />

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAiModalOpen(false)}
                disabled={aiExtracting}
                className="border-[#1B362A] text-zinc-400 hover:text-white text-xs cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleAiAutoFill}
                disabled={aiExtracting || !rawFragranticaText.trim()}
                className="bg-[#D0A96B] hover:bg-[#E5C158] text-[#08130E] font-bold text-xs h-9 px-5 cursor-pointer flex items-center gap-2"
              >
                {aiExtracting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                <span>{aiExtracting ? 'Procesando IA...' : 'Extraer y Auto-completar'}</span>
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
