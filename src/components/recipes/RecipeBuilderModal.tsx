'use client';

import React, { useState, useEffect } from 'react';
import { useUserStore } from '@/hooks/use-user-store';
import { calculateDynamicCost, saveProductRecipe, RecipeItemInput, ComponentType, DynamicCostCalculationResult } from '@/app/actions/recipes';
import { Product } from '@/types';
import { 
  Plus, Trash2, Calculator, Save, RefreshCw, AlertCircle, 
  CheckCircle2, Layers, Droplet, Package, Tag, ShieldAlert, Sparkles, DollarSign 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface RecipeBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetProduct: Product | null;
  allProducts: Product[];
  onRecipeSaved?: () => void;
}

const COMPONENT_LABELS: Record<ComponentType, { label: string; icon: any; color: string }> = {
  liquid: { label: 'Perfume / Líquido Original', icon: Droplet, color: 'text-amber-400' },
  bottle_frasco: { label: 'Frasco Vacío Decant', icon: Package, color: 'text-indigo-400' },
  atomizer: { label: 'Válvula Atomizadora', icon: Layers, color: 'text-cyan-400' },
  label: { label: 'Etiqueta Impresa', icon: Tag, color: 'text-emerald-400' },
  packaging: { label: 'Caja / Bolsa / Empaque', icon: Package, color: 'text-rose-400' },
  other: { label: 'Otros Insumos', icon: Layers, color: 'text-zinc-400' }
};

export function RecipeBuilderModal({
  isOpen,
  onClose,
  targetProduct,
  allProducts,
  onRecipeSaved
}: RecipeBuilderModalProps) {
  const { role } = useUserStore();
  const [sizeMl, setSizeMl] = useState<number>(5);
  const [recipeName, setRecipeName] = useState('');
  const [items, setItems] = useState<RecipeItemInput[]>([]);
  const [autoUpdateCost, setAutoUpdateCost] = useState(true);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [calcResult, setCalcResult] = useState<DynamicCostCalculationResult | null>(null);

  // Filtrar perfumes originales y insumos de packaging
  const liquidOptions = allProducts.filter(p => p.type === 'bottle' || p.type === 'decant_liquid');
  const supplyOptions = allProducts.filter(p => p.type === 'supply' || p.type === 'bottle');

  useEffect(() => {
    if (targetProduct) {
      setRecipeName(`Receta Decant ${sizeMl}ml: ${targetProduct.name}`);
      // Agregar insumo inicial sugerido de líquido si existe
      setItems([
        { ingredient_product_id: '', component_type: 'liquid', quantity: sizeMl },
        { ingredient_product_id: '', component_type: 'bottle_frasco', quantity: 1 },
        { ingredient_product_id: '', component_type: 'label', quantity: 1 }
      ]);
    }
  }, [targetProduct, sizeMl]);

  // Recalcular costo en tiempo real cuando cambian los insumos seleccionados o sus cantidades
  useEffect(() => {
    if (!targetProduct) return;

    const validItems = items.filter(i => i.ingredient_product_id !== '' && i.quantity > 0);
    if (validItems.length === 0) {
      setCalcResult(null);
      return;
    }

    const timer = setTimeout(async () => {
      setCalculating(true);
      const result = await calculateDynamicCost(targetProduct.id, validItems);
      if (result.success) {
        setCalcResult(result);
      }
      setCalculating(false);
    }, 250);

    return () => clearTimeout(timer);
  }, [items, targetProduct]);

  if (!isOpen || !targetProduct) return null;

  const handleAddItem = (type: ComponentType = 'packaging') => {
    setItems(prev => [
      ...prev,
      { ingredient_product_id: '', component_type: type, quantity: 1 }
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof RecipeItemInput, value: any) => {
    setItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSave = async () => {
    if (role !== 'admin') {
      toast.error('Acceso denegado. Se requiere rol de Administrador.');
      return;
    }

    const validItems = items.filter(i => i.ingredient_product_id !== '' && i.quantity > 0);
    if (validItems.length === 0) {
      toast.error('Debes seleccionar al menos 1 insumo válido para armar la receta.');
      return;
    }

    try {
      setLoading(true);
      const res = await saveProductRecipe(
        role,
        targetProduct.id,
        recipeName,
        validItems,
        autoUpdateCost,
        notes,
        sizeMl
      );

      if (res.success) {
        toast.success(`Receta guardada con éxito. Costo base actualizado a $${res.calculatedCostArs?.toLocaleString('es-AR')} ARS.`);
        if (onRecipeSaved) onRecipeSaved();
        onClose();
      } else {
        toast.error(res.error || 'Error al guardar la receta.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar receta.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-[#08130E] border border-[#1B362A] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* CABECERA MODAL */}
        <div className="p-6 border-b border-[#1B362A] bg-[#13261E]/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#D0A96B]/10 border border-[#D0A96B]/30 text-[#D0A96B]">
              <Calculator className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide">
                Ensamblado BOM & Costeo Dinámico
              </h2>
              <p className="text-xs text-zinc-400 font-mono">
                Producto Final: <span className="text-[#D0A96B] font-bold">{targetProduct.name}</span> ({targetProduct.sku})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-2 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* CUERPO DEL MODAL (FORMULARIO Y CALCULADORA LIVE) */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* SELECCIÓN DE MEDIDA DEL DECANT */}
          <div className="bg-[#13261E]/70 border border-[#1B362A] rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#D0A96B]">
                Presentación / Medida:
              </span>
              <div className="flex items-center gap-1.5 bg-[#08130E] p-1 rounded-lg border border-[#1B362A]">
                {[5, 10].map(size => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setSizeMl(size)}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                      sizeMl === size
                        ? 'bg-[#D0A96B] text-[#08130E] shadow'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {size} ml
                  </button>
                ))}
              </div>
            </div>

            {targetProduct.type === 'bottle' ? (
              <span className="text-[11px] text-zinc-400 italic">
                🛡️ Perfume original protegido: la receta calculará el costo de la muestra sin alterar el costo de la botella sellada.
              </span>
            ) : (
              <span className="text-[11px] text-emerald-400">
                ✨ Costeo dinámico activo para fraccionado a granel.
              </span>
            )}
          </div>

          {/* NOMBRE DE LA RECETA Y CONFIGURACIÓN */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                Nombre de la Receta / Modelo de Costeo
              </label>
              <input
                type="text"
                value={recipeName}
                onChange={e => setRecipeName(e.target.value)}
                className="w-full bg-[#13261E] border border-[#1B362A] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#D0A96B]"
                placeholder="Ej. Receta Decant 10ml Aventus"
              />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                id="autoUpdateCost"
                checked={autoUpdateCost}
                onChange={e => setAutoUpdateCost(e.target.checked)}
                className="rounded border-[#1B362A] bg-[#13261E] text-[#D0A96B] focus:ring-0 cursor-pointer h-4 w-4"
              />
              <label htmlFor="autoUpdateCost" className="text-xs text-zinc-300 cursor-pointer font-medium">
                Actualizar automáticamente el <span className="text-emerald-400 font-bold">Costo Base</span> del producto.
              </label>
            </div>
          </div>

          {/* LISTA DE INSUMOS DE LA RECETA (DETALLE BOM) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-[#1B362A] pb-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="h-4 w-4 text-[#D0A96B]" />
                Insumos & Componentes de la Receta
              </h3>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAddItem('liquid')}
                  className="border-[#D0A96B]/30 bg-[#13261E] text-[#D0A96B] hover:bg-zinc-800 text-xs h-8 cursor-pointer"
                >
                  <Droplet className="h-3.5 w-3.5 mr-1" />
                  + Perfume Líquido
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAddItem('bottle_frasco')}
                  className="border-[#1B362A] bg-[#13261E] text-zinc-300 hover:bg-zinc-800 text-xs h-8 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  + Insumo Packaging
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              {items.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-[#1B362A] rounded-xl text-zinc-500 text-xs">
                  No has agregado insumos a esta receta. Haz clic arriba para añadir líquido o packaging.
                </div>
              ) : (
                items.map((item, index) => {
                  const isLiquid = item.component_type === 'liquid';
                  const availableOptions = isLiquid ? liquidOptions : supplyOptions;
                  const Icon = COMPONENT_LABELS[item.component_type]?.icon || Layers;
                  const selectedIngredient = allProducts.find(p => p.id === item.ingredient_product_id);

                  return (
                    <div
                      key={index}
                      className="grid grid-cols-1 md:grid-cols-12 gap-3 p-3 bg-[#13261E] border border-[#1B362A] rounded-xl items-center"
                    >
                      {/* TIPO DE COMPONENTE */}
                      <div className="md:col-span-3">
                        <select
                          value={item.component_type}
                          onChange={e => handleItemChange(index, 'component_type', e.target.value as ComponentType)}
                          className="w-full bg-[#08130E] border border-[#1B362A] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                        >
                          <option value="liquid">💧 Perfume Líquido</option>
                          <option value="bottle_frasco">🧪 Frasco Vacío</option>
                          <option value="atomizer">💨 Atomizador</option>
                          <option value="label">🏷️ Etiqueta</option>
                          <option value="packaging">📦 Caja / Empaque</option>
                          <option value="other">⚙️ Otros Insumos</option>
                        </select>
                      </div>

                      {/* SELECTOR DE PRODUCTO INSUMO */}
                      <div className="md:col-span-5">
                        <select
                          value={item.ingredient_product_id}
                          onChange={e => handleItemChange(index, 'ingredient_product_id', e.target.value)}
                          className="w-full bg-[#08130E] border border-[#1B362A] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                        >
                          <option value="">-- Seleccionar Insumo --</option>
                          {availableOptions.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.sku}) — Costo: ${p.base_cost_ars.toLocaleString('es-AR')} ARS {p.volume_ml ? `(${p.volume_ml}ml)` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* CANTIDAD (ML O UNIDADES) */}
                      <div className="md:col-span-3 flex items-center gap-1.5">
                        <input
                          type="number"
                          step={isLiquid ? '0.5' : '1'}
                          min="0.1"
                          value={item.quantity}
                          onChange={e => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                          className="w-full bg-[#08130E] border border-[#1B362A] rounded-lg px-2.5 py-1.5 text-xs text-white font-mono text-right focus:outline-none"
                        />
                        <span className="text-[11px] font-bold text-zinc-400 min-w-[30px]">
                          {isLiquid ? 'ml' : 'un.'}
                        </span>
                      </div>

                      {/* ELIMINAR */}
                      <div className="md:col-span-1 flex justify-end">
                        <button
                          onClick={() => handleRemoveItem(index)}
                          className="text-rose-400 hover:text-rose-300 p-1.5 rounded-lg hover:bg-rose-950/40 cursor-pointer"
                          title="Eliminar insumo"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* TARJETA DE COSTEO EN TIEMPO REAL (WIDGET DE MARGEN & PROYECCIÓN) */}
          <div className="p-4 bg-[#08130E] border border-[#1B362A] rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#D0A96B] flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#D0A96B]" />
                Simulación de Costeo y Rentabilidad Proyectada
              </h4>
              {calculating && <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#D0A96B]" />}
            </div>

            {calcResult ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                
                {/* 1. COSTO LÍQUIDO */}
                <div className="p-3 bg-[#13261E] rounded-xl border border-[#1B362A]">
                  <p className="text-[10px] uppercase font-bold text-amber-400">Costo Líquido (Fragancia)</p>
                  <p className="text-lg font-black text-amber-400 font-mono mt-1">
                    ${calcResult.liquid_cost_ars.toLocaleString('es-AR')} ARS
                  </p>
                  <p className="text-[10px] text-zinc-500 font-mono">
                    ~USD ${(calcResult.liquid_cost_ars / calcResult.exchange_rate_used).toFixed(2)}
                  </p>
                </div>

                {/* 2. COSTO PACKAGING */}
                <div className="p-3 bg-[#13261E] rounded-xl border border-[#1B362A]">
                  <p className="text-[10px] uppercase font-bold text-indigo-400">Costo Packaging & Insumos</p>
                  <p className="text-lg font-black text-indigo-400 font-mono mt-1">
                    ${calcResult.packaging_cost_ars.toLocaleString('es-AR')} ARS
                  </p>
                  <p className="text-[10px] text-zinc-500 font-mono">
                    ~USD ${(calcResult.packaging_cost_ars / calcResult.exchange_rate_used).toFixed(2)}
                  </p>
                </div>

                {/* 3. COSTO TOTAL CALCULADO */}
                <div className="p-3 bg-[#13261E] rounded-xl border border-[#1B362A]">
                  <p className="text-[10px] uppercase font-bold text-emerald-400">Costo Total Receta (ARS)</p>
                  <p className="text-xl font-black text-emerald-400 font-mono mt-1">
                    ${calcResult.total_cost_ars.toLocaleString('es-AR')} ARS
                  </p>
                  <p className="text-[10px] text-zinc-400 font-mono">
                    USD ${calcResult.total_cost_usd} @ ${calcResult.exchange_rate_used}
                  </p>
                </div>

                {/* 4. MARGEN PROYECTADO DE VENTA */}
                <div className={`p-3 bg-[#13261E] rounded-xl border ${
                  calcResult.projected_margin_percent >= 40 ? 'border-emerald-500/40' : 'border-amber-500/40'
                }`}>
                  <p className="text-[10px] uppercase font-bold text-zinc-400">Margen Proyectado</p>
                  <p className={`text-xl font-black font-mono mt-1 ${
                    calcResult.projected_margin_percent >= 40 ? 'text-emerald-400' : 'text-amber-400'
                  }`}>
                    {calcResult.projected_margin_percent}%
                  </p>
                  <p className="text-[10px] text-zinc-400 font-mono">
                    Precio Venta: ${calcResult.target_price_ars.toLocaleString('es-AR')} ARS
                  </p>
                </div>

              </div>
            ) : (
              <p className="text-xs text-zinc-500">
                Selecciona al menos 1 insumo válido para simular el costo dinámico y margen en tiempo real.
              </p>
            )}
          </div>

        </div>

        {/* PIE DEL MODAL (BOTÓN GUARDAR) */}
        <div className="p-4 border-t border-[#1B362A] bg-[#13261E]/50 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-[#1B362A] text-zinc-400 hover:text-white text-xs cursor-pointer"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading || items.length === 0}
            className="bg-[#D0A96B] hover:bg-[#E5C158] text-[#08130E] font-bold text-xs h-9 px-6 cursor-pointer flex items-center gap-2"
          >
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            <span>Guardar Receta y Actualizar Costo</span>
          </Button>
        </div>

      </div>
    </div>
  );
}
