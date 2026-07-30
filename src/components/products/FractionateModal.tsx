'use client';

import React, { useState, useEffect } from 'react';
import { Product, UserRole } from '@/types';
import { getDecantLiquids, fractionateBottle, createProduct } from '@/app/actions/products';
import { CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X, AlertTriangle, RefreshCw, AlertCircle, Sparkles, Check } from 'lucide-react';

interface FractionateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  bottle: Product | null;
  role: UserRole;
}

export function FractionateModal({ isOpen, onClose, onSuccess, bottle, role }: FractionateModalProps) {
  const [decants, setDecants] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estados de Selección del Decant Destino
  const [targetDecantId, setTargetDecantId] = useState<string>(''); // ID de decant existente o 'create_new'
  
  // Estados para creación automática de nuevo decant
  const [newDecantSku, setNewDecantSku] = useState('');
  const [newDecantName, setNewDecantName] = useState('');
  const [newDecantCost, setNewDecantCost] = useState('');
  const [newDecantPrice, setNewDecantPrice] = useState('');

  // Cargar lista de decants y autodetectar coincidencias
  useEffect(() => {
    if (!isOpen || !bottle) return;
    
    const activeBottle = bottle;
    
    async function loadDecants() {
      setLoadingData(true);
      setError(null);
      const res = await getDecantLiquids(role);
      setLoadingData(false);

      if (res.success && res.data) {
        setDecants(res.data);
        
        // Buscar si existe un decant con el mismo perfume/marca
        const matchingDecant = res.data.find(d => 
          d.brand.toLowerCase() === activeBottle.brand.toLowerCase() &&
          d.name.toLowerCase().replace(/[\s()\-]/g, '').includes(activeBottle.name.toLowerCase().replace(/[\s()\-]/g, ''))
        );

        if (matchingDecant) {
          setTargetDecantId(matchingDecant.id);
        } else {
          setTargetDecantId('create_new');
        }
      } else {
        setError(res.error || 'Error al obtener líquidos de decant');
        setTargetDecantId('create_new');
      }
    }

    loadDecants();
  }, [bottle, isOpen, role]);

  // Pre-llenar formulario de nuevo decant
  useEffect(() => {
    if (bottle && targetDecantId === 'create_new') {
      setNewDecantSku(`${bottle.sku}-DEC`);
      setNewDecantName(`${bottle.name} (Líquido a Granel)`);
      
      // Estimar costo por ml (costo botella / capacidad ml)
      const costPerMl = bottle.volume_ml ? (bottle.base_cost_ars / bottle.volume_ml) : 0;
      setNewDecantCost(costPerMl.toFixed(2));
      
      // Estimar precio sugerido de venta por ml (1.8x el costo estimado por ml)
      setNewDecantPrice((costPerMl * 1.8).toFixed(2));
    }
  }, [bottle, targetDecantId]);

  if (!isOpen || !bottle) return null;

  const handleFractionate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bottle.stock_quantity < 1) {
      setError('No hay stock disponible de esta botella para realizar el fraccionamiento.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let finalDecantId = targetDecantId;

      // 1. Si el usuario seleccionó crear un nuevo decant, lo registramos primero
      if (targetDecantId === 'create_new') {
        const createRes = await createProduct(role, {
          sku: newDecantSku.trim(),
          name: newDecantName.trim(),
          brand: bottle.brand,
          type: 'decant_liquid',
          base_cost_ars: parseFloat(newDecantCost) || 0,
          base_price_ars: parseFloat(newDecantPrice) || 0,
          stock_quantity: 0, // se inicializa en 0 y se llenará con la transacción RPC
          volume_ml: null,   // los graneles no tienen un volumen fijo contenedor
        });

        if (!createRes.success || !createRes.id) {
          throw new Error(createRes.error || 'Error al crear el producto del decant destino');
        }
        finalDecantId = createRes.id;
      }

      // 2. Ejecutar la transacción de fraccionamiento seguro en Supabase
      const volumeToFractionate = bottle.volume_ml || 100;
      const fracRes = await fractionateBottle(role, bottle.id, finalDecantId, volumeToFractionate);

      if (!fracRes.success) {
        throw new Error(fracRes.error || 'Error al procesar el fraccionamiento en base de datos');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error en la operación');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white dark:bg-[#08130E] border border-slate-200 dark:border-[#1B362A] rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <form onSubmit={handleFractionate}>
          
          <CardHeader className="border-b border-slate-100 dark:border-zinc-900 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <AlertTriangle className="h-5.5 w-5.5 text-amber-500" />
                Confirmar Fraccionamiento
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
              Esta acción es **digitalmente irreversible**. Dará de baja una unidad comercial de perfume cerrado y sumará su contenido líquido al stock de decants a granel.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 p-6 max-h-[60vh] overflow-y-auto">
            
            {error && (
              <div className="flex gap-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 p-3 text-xs text-rose-600 dark:text-rose-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            {/* RESUMEN DE LA BOTELLA ORIGEN */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 dark:border-[#1B362A] dark:bg-[#13261E]/30 space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                Botella de Origen a Abrir
              </div>
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-slate-950 dark:text-zinc-50">{bottle.name}</h4>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">Marca: {bottle.brand} • SKU: {bottle.sku}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs rounded bg-violet-100 px-2 py-0.5 font-bold text-violet-800 dark:bg-[#D0A96B]/10 dark:text-[#D0A96B]">
                    -{bottle.volume_ml || 100} ml
                  </span>
                  <p className="text-[10px] text-slate-400 mt-1">Stock actual: {bottle.stock_quantity} uds</p>
                </div>
              </div>
            </div>

            {/* SELECCIÓN DEL DECANT DESTINO */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                Destino del Líquido a Granel (Decant) *
              </label>
              
              {loadingData ? (
                <div className="flex items-center justify-center py-4 text-xs text-slate-400 gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin text-[#D0A96B]" />
                  <span>Buscando decants existentes...</span>
                </div>
              ) : (
                <select
                  value={targetDecantId}
                  onChange={(e) => setTargetDecantId(e.target.value)}
                  className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring dark:border-input/40 dark:bg-input/10 dark:text-white"
                >
                  <option value="create_new">➕ Crear un nuevo stock de granel para este perfume</option>
                  {decants.map(decant => (
                    <option key={decant.id} value={decant.id}>
                      {decant.name} (Marca: {decant.brand} • Stock: {decant.stock_quantity} ml)
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* SUBFORMULARIO: CREACIÓN DE NUEVO DECANT */}
            {targetDecantId === 'create_new' && (
              <div className="border border-indigo-100 bg-indigo-50/20 rounded-lg p-4 space-y-3 dark:border-indigo-900/30 dark:bg-indigo-950/10 animate-in slide-in-from-top-1.5 duration-200">
                <div className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider">
                  <Sparkles className="h-4 w-4 text-indigo-500" />
                  Creación del nuevo producto de líquido decantado
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-400 dark:text-zinc-500">
                      SKU del Decant *
                    </label>
                    <Input
                      required
                      placeholder="SKU"
                      value={newDecantSku}
                      onChange={(e) => setNewDecantSku(e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-400 dark:text-zinc-500">
                      Nombre Comercial del Decant *
                    </label>
                    <Input
                      required
                      placeholder="Nombre del decant"
                      value={newDecantName}
                      onChange={(e) => setNewDecantName(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-400 dark:text-zinc-500">
                      Costo Adquisición por ml (ARS) *
                    </label>
                    <Input
                      required
                      type="number"
                      placeholder="Costo por ml"
                      value={newDecantCost}
                      onChange={(e) => setNewDecantCost(e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-400 dark:text-zinc-500">
                      Precio de Venta Base por ml (ARS) *
                    </label>
                    <Input
                      required
                      type="number"
                      placeholder="Precio venta por ml"
                      value={newDecantPrice}
                      onChange={(e) => setNewDecantPrice(e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ADVERTENCIA DE TRANSACCIÓN */}
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 p-3 text-xs text-amber-800 dark:text-amber-300">
              <p className="font-semibold flex items-center gap-1.5">
                Al confirmar el proceso se ejecutará una Transacción SQL:
              </p>
              <ul className="list-disc list-inside mt-1.5 space-y-1 opacity-90 pl-1">
                <li>Se descontará **1 unidad** comercial de {bottle.name} en el inventario.</li>
                <li>Se sumarán **+{bottle.volume_ml || 100} ml** líquidos al decant seleccionado.</li>
                <li>Se registrará automáticamente la auditoría histórica de apertura.</li>
              </ul>
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
              className="bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600 text-white cursor-pointer"
            >
              {loading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Procesando...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" /> Confirmar Apertura
                </>
              )}
            </Button>
          </CardFooter>
          
        </form>
      </div>
    </div>
  );
}
