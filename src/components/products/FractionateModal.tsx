'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Product, UserRole } from '@/types';
import { getDecantLiquids, fractionateBottle, createProduct } from '@/app/actions/products';
import { CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X, AlertTriangle, RefreshCw, AlertCircle, Sparkles, Check } from 'lucide-react';
import { toast } from 'sonner';

interface FractionateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  bottle: Product | null;
  role: UserRole;
  availableBottles?: Product[];
}

export function FractionateModal({ isOpen, onClose, onSuccess, bottle, role, availableBottles = [] }: FractionateModalProps) {
  const router = useRouter();
  const [decants, setDecants] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<{
    code?: string;
    message?: string;
    details?: string | null;
    hint?: string | null;
  } | null>(null);

  // Estados de Selección de Botella (si no fue provista externamente)
  const [selectedBottleId, setSelectedBottleId] = useState<string>(bottle?.id || '');

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setErrorDetails(null);

    if (bottle) {
      setSelectedBottleId(bottle.id);
    } else if (availableBottles.length > 0) {
      const currentValid = availableBottles.find(b => b.id === selectedBottleId && b.stock_quantity > 0);
      if (!currentValid) {
        const firstWithStock = availableBottles.find(b => b.stock_quantity > 0) || availableBottles[0];
        if (firstWithStock) setSelectedBottleId(firstWithStock.id);
      }
    }
  }, [bottle, availableBottles, isOpen]);

  const activeBottle = bottle || availableBottles.find(b => b.id === selectedBottleId) || null;

  // Estados de Selección del Decant Destino
  const [targetDecantId, setTargetDecantId] = useState<string>(''); // ID de decant existente o 'create_new'
  
  // Estados para creación automática de nuevo decant
  const [newDecantSku, setNewDecantSku] = useState('');
  const [newDecantName, setNewDecantName] = useState('');
  const [newDecantCost, setNewDecantCost] = useState('');
  const [newDecantPrice, setNewDecantPrice] = useState('');

  // Cargar lista de decants y autodetectar coincidencias
  useEffect(() => {
    const currentBottle = activeBottle;
    if (!isOpen || !currentBottle) return;
    
    async function loadDecants() {
      setLoadingData(true);
      setError(null);
      setErrorDetails(null);
      const res = await getDecantLiquids();
      setLoadingData(false);

      if (res.success && res.data && currentBottle) {
        setDecants(res.data);
        
        // Buscar si existe un decant con el mismo perfume/marca
        const matchingDecant = res.data.find(d => 
          d.brand.toLowerCase() === currentBottle.brand.toLowerCase() &&
          d.name.toLowerCase().replace(/[\s()\-]/g, '').includes(currentBottle.name.toLowerCase().replace(/[\s()\-]/g, ''))
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
  }, [activeBottle?.id, isOpen, role]);

  // Pre-llenar formulario de nuevo decant
  useEffect(() => {
    if (activeBottle && targetDecantId === 'create_new') {
      setNewDecantSku(`${activeBottle.sku}-DEC`);
      setNewDecantName(`${activeBottle.name} (Líquido a Granel)`);
      
      // Estimar costo por ml (costo botella / capacidad ml)
      const costPerMl = activeBottle.volume_ml ? (activeBottle.base_cost_ars / activeBottle.volume_ml) : 0;
      setNewDecantCost(costPerMl.toFixed(2));
      
      // Estimar precio sugerido de venta por ml (1.8x el costo estimado por ml)
      setNewDecantPrice((costPerMl * 1.8).toFixed(2));
    }
  }, [activeBottle, targetDecantId]);

  if (!isOpen) return null;

  const handleFractionate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setErrorDetails(null);

    if (!activeBottle || !activeBottle.id || !activeBottle.id.trim()) {
      const msg = 'Debes seleccionar una botella válida para fraccionar.';
      setError(msg);
      toast.error(msg);
      return;
    }

    if (activeBottle.stock_quantity < 1) {
      const msg = `No hay stock disponible de "${activeBottle.name}" para realizar el fraccionamiento.`;
      setError(msg);
      toast.error(msg);
      return;
    }

    if (!targetDecantId || !targetDecantId.trim()) {
      const msg = 'Debes seleccionar un líquido a granel destino o la opción de crear uno nuevo.';
      setError(msg);
      toast.error(msg);
      return;
    }

    setLoading(true);

    try {
      let finalDecantId = targetDecantId.trim();

      // 1. Si el usuario seleccionó crear un nuevo decant, lo registramos primero
      if (finalDecantId === 'create_new') {
        const createRes = await createProduct({
          sku: newDecantSku.trim(),
          name: newDecantName.trim(),
          brand: activeBottle.brand,
          type: 'decant_liquid',
          base_cost_ars: parseFloat(newDecantCost) || 0,
          base_price_ars: parseFloat(newDecantPrice) || 0,
          stock_quantity: 0, // se inicializa en 0 y se llenará con la transacción RPC
          volume_ml: null,   // los graneles no tienen un volumen fijo contenedor
        });

        if (!createRes.success || !createRes.id) {
          const createErrMsg = createRes.error || 'Error al crear el producto del decant destino';
          setError(createErrMsg);
          toast.error(createErrMsg);
          setLoading(false);
          return;
        }
        finalDecantId = createRes.id.trim();
      }

      if (!finalDecantId || finalDecantId === 'create_new') {
        const idErr = 'ID de decant destino inválido o vacío.';
        setError(idErr);
        toast.error(idErr);
        setLoading(false);
        return;
      }

      // 2. Ejecutar la transacción de fraccionamiento seguro en Supabase
      const volumeToFractionate = Number(activeBottle.volume_ml) > 0 ? Number(activeBottle.volume_ml) : 100;
      const fracRes = await fractionateBottle(activeBottle.id.trim(), finalDecantId, volumeToFractionate);

      if (!fracRes.success) {
        const dbMessage = fracRes.errorDetails?.message || fracRes.error || 'Error al procesar el fraccionamiento en base de datos';
        console.error('[FractionateModal] Error retornado por Supabase:', {
          error: fracRes.error,
          errorDetails: fracRes.errorDetails,
          bottleId: activeBottle.id,
          decantId: finalDecantId,
          volumeMl: volumeToFractionate,
        });

        setError(fracRes.error || dbMessage);
        if (fracRes.errorDetails) {
          setErrorDetails(fracRes.errorDetails);
        }

        toast.error(`Error en Base de Datos: ${dbMessage}`, {
          description: fracRes.errorDetails?.hint || fracRes.errorDetails?.details || undefined,
          duration: 6000,
        });
        setLoading(false);
        return;
      }

      // 3. Éxito: Notificar, refrescar caché de rutas e invocar callback del padre
      toast.success(
        `¡Fraccionamiento exitoso! +${volumeToFractionate} ml sumados al granel.`,
        {
          description: fracRes.data?.new_weighted_avg_cost_ars
            ? `Nuevo Costo Promedio Ponderado (PPP): $${fracRes.data.new_weighted_avg_cost_ars.toLocaleString('es-AR')} ARS/ml`
            : undefined,
        }
      );

      router.refresh();
      await Promise.resolve(onSuccess());
      onClose();
    } catch (err: unknown) {
      console.error('[FractionateModal] Excepción inesperada:', err);
      const errMsg = err instanceof Error ? err.message : 'Error inesperado en la operación de fraccionamiento';
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-lg" className="overflow-hidden">
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
              <div className="flex flex-col gap-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 p-3 text-xs text-rose-600 dark:text-rose-400">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span className="font-semibold">{error}</span>
                </div>
                {errorDetails && (errorDetails.code || errorDetails.details || errorDetails.hint) && (
                  <div className="pl-6 space-y-0.5 font-mono text-[11px] text-rose-500/90 dark:text-rose-300/80 border-t border-rose-200/60 dark:border-rose-900/40 pt-1.5">
                    {errorDetails.code && <div>Código Postgres: {errorDetails.code}</div>}
                    {errorDetails.details && <div>Detalle: {errorDetails.details}</div>}
                    {errorDetails.hint && <div>Sugerencia: {errorDetails.hint}</div>}
                  </div>
                )}
              </div>
            )}

            {/* SELECTOR DE BOTELLA SI NO FUE PRE-SELECCIONADA */}
            {!bottle && availableBottles.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  Seleccionar Botella Sellada a Abrir *
                </label>
                <select
                  value={selectedBottleId}
                  onChange={(e) => setSelectedBottleId(e.target.value)}
                  className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring dark:border-input/40 dark:bg-input/10 dark:text-white"
                >
                  {availableBottles
                    .filter((b) => b.type === 'bottle' && b.stock_quantity > 0)
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.brand} • Stock: {b.stock_quantity} u • {b.volume_ml || 100}ml)
                      </option>
                    ))}
                </select>
              </div>
            )}

            {/* RESUMEN DE LA BOTELLA ORIGEN */}
            {activeBottle && (
              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 dark:border-erp-border dark:bg-erp-surface/30 space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                  Botella de Origen a Abrir
                </div>
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-slate-950 dark:text-zinc-50">{activeBottle.name}</h4>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                      Marca: {activeBottle.brand} • SKU: {activeBottle.sku}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs rounded bg-violet-100 px-2 py-0.5 font-bold text-violet-800 dark:bg-erp-gold/10 dark:text-erp-gold">
                      -{activeBottle.volume_ml || 100} ml
                    </span>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Stock actual: {activeBottle.stock_quantity} uds
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* SELECCIÓN DEL DECANT DESTINO */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                Destino del Líquido a Granel (Decant) *
              </label>
              
              {loadingData ? (
                <div className="flex items-center justify-center py-4 text-xs text-slate-400 gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin text-erp-gold" />
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
                    <label className="text-[11px] font-bold uppercase text-slate-400 dark:text-zinc-500">
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
                    <label className="text-[11px] font-bold uppercase text-slate-400 dark:text-zinc-500">
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
                    <label className="text-[11px] font-bold uppercase text-slate-400 dark:text-zinc-500">
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
                    <label className="text-[11px] font-bold uppercase text-slate-400 dark:text-zinc-500">
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
                <li>Se descontará **1 unidad** comercial de {activeBottle?.name || 'la botella seleccionada'} en el inventario.</li>
                <li>Se sumarán **+{activeBottle?.volume_ml || 100} ml** líquidos al decant seleccionado.</li>
                <li>Se registrará automáticamente la auditoría histórica de apertura.</li>
              </ul>
            </div>

          </CardContent>

          <CardFooter className="border-t border-slate-100 dark:border-zinc-900 pt-4 flex justify-end gap-3 bg-slate-50/50 dark:bg-erp-surface/20 px-6 py-4">
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
    </Modal>
  );
}
