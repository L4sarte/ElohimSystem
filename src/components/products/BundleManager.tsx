'use client';

import React, { useState, useEffect } from 'react';
import { useUserStore } from '@/hooks/use-user-store';
import { getBundles, createBundle, deleteBundle, ProductBundle, BundleItemInput } from '@/app/actions/bundles';
import { getProducts } from '@/app/actions/products';
import { Product } from '@/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Layers, Plus, Trash2, RefreshCw, AlertCircle, Sparkles, Check, Package, X } from 'lucide-react';
import { toast } from 'sonner';

export function BundleManager() {
  const { role } = useUserStore();

  const [bundles, setBundles] = useState<ProductBundle[]>([]);
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estado del Modal de Creación
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [priceArs, setPriceArs] = useState('');
  const [priceUsd, setPriceUsd] = useState('');
  const [selectedItems, setSelectedItems] = useState<BundleItemInput[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const fetchInitialData = async () => {
    setLoading(true);
    setError(null);
    const [resBundles, resProducts] = await Promise.all([
      getBundles(role),
      getProducts(role)
    ]);

    if (resBundles.success && resBundles.data) {
      setBundles(resBundles.data);
    } else {
      setError(resBundles.error || 'Error al cargar combos');
    }

    if (resProducts.success && resProducts.data) {
      setAvailableProducts(resProducts.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchInitialData();
  }, [role]);

  const handleOpenModal = () => {
    setSku(`CMB-${Math.floor(100 + Math.random() * 900)}`);
    setName('');
    setDescription('');
    setPriceArs('');
    setPriceUsd('');
    setSelectedItems([]);
    setIsModalOpen(true);
  };

  const handleAddItemToCombo = (productId: string) => {
    if (!productId) return;
    if (selectedItems.some(item => item.product_id === productId)) {
      toast.info('El producto ya forma parte de este combo.');
      return;
    }
    setSelectedItems(prev => [...prev, { product_id: productId, quantity_to_deduct: 1 }]);
  };

  const handleItemQtyChange = (productId: string, qty: number) => {
    setSelectedItems(prev => prev.map(item => 
      item.product_id === productId ? { ...item, quantity_to_deduct: Math.max(1, qty) } : item
    ));
  };

  const handleRemoveItem = (productId: string) => {
    setSelectedItems(prev => prev.filter(item => item.product_id !== productId));
  };

  const handleCreateBundle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sku.trim() || !name.trim()) {
      toast.error('Completa el SKU y nombre del combo');
      return;
    }

    if (selectedItems.length === 0) {
      toast.error('Agrega al menos un producto componente al combo');
      return;
    }

    setSubmitting(true);
    const res = await createBundle(role, {
      sku: sku.trim(),
      name: name.trim(),
      description: description.trim(),
      price_ars: parseFloat(priceArs) || 0,
      price_usd: parseFloat(priceUsd) || 0,
      items: selectedItems
    });
    setSubmitting(false);

    if (res.success) {
      toast.success(`Combo "${name}" creado exitosamente`);
      setIsModalOpen(false);
      fetchInitialData();
    } else {
      toast.error(res.error || 'Error al crear el combo');
    }
  };

  const handleDeleteBundle = async (bundleId: string, bundleName: string) => {
    const res = await deleteBundle(role, bundleId);
    if (res.success) {
      toast.success(`Combo "${bundleName}" eliminado`);
      fetchInitialData();
    } else {
      toast.error(res.error || 'Error al eliminar combo');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* HEADER DE MÓDULO */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-[#13261E] p-4 rounded-xl border border-[#1B362A]">
        <div>
          <h2 className="text-base font-bold text-white font-serif flex items-center gap-2">
            <Layers className="h-5 w-5 text-[#D0A96B]" />
            Módulo de Combos & Bundles Promocionales
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Crea combos de productos (ej: Perfume + Decant) con descuento automático de stock por componente al vender.
          </p>
        </div>

        {role === 'admin' && (
          <Button
            onClick={handleOpenModal}
            className="bg-[#D0A96B] hover:bg-[#E5C158] text-[#08130E] font-extrabold text-xs shadow-md shadow-[#D0A96B]/20 cursor-pointer shrink-0"
          >
            <Plus className="mr-1.5 h-4 w-4" /> Crear Nuevo Combo
          </Button>
        )}
      </div>

      {/* GRILLA DE COMBOS EXISTENTES */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 border border-[#1B362A] bg-[#13261E]/50 rounded-2xl">
          <RefreshCw className="h-7 w-7 animate-spin text-[#D0A96B]" />
          <span className="text-xs font-semibold text-zinc-400">Cargando catálogo de combos...</span>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12 text-rose-400 gap-2 border border-rose-500/20 bg-rose-500/10 rounded-2xl">
          <AlertCircle className="h-8 w-8 text-rose-500" />
          <span className="text-xs font-bold">{error}</span>
          <Button variant="outline" size="sm" onClick={fetchInitialData} className="mt-2 border-rose-500/30">Reintentar</Button>
        </div>
      ) : bundles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-2 border border-dashed border-[#1B362A] bg-[#08130E]/50 rounded-2xl">
          <Package className="h-10 w-10 text-zinc-600" />
          <h3 className="text-sm font-bold text-white font-serif">No hay combos promocionales creados</h3>
          <p className="text-xs text-zinc-500 max-w-sm">
            Crea ofertas empaquetadas (ej: 1 Botella + 1 Decant 10ml) para vender en el POS descontando componentes individuales.
          </p>
          {role === 'admin' && (
            <Button onClick={handleOpenModal} className="mt-2 bg-[#D0A96B] hover:bg-[#E5C158] text-[#08130E] font-bold text-xs">
              Crear Primer Combo
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {bundles.map(bundle => (
            <Card key={bundle.id} className="border border-[#1B362A] bg-[#13261E] rounded-2xl shadow-xl flex flex-col justify-between">
              <CardHeader className="pb-3 border-b border-[#1B362A]">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-[10px] font-bold text-[#D0A96B] uppercase tracking-wider">
                      SKU: {bundle.sku}
                    </span>
                    <CardTitle className="text-base font-bold text-white font-serif mt-0.5">
                      {bundle.name}
                    </CardTitle>
                  </div>
                  {role === 'admin' && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleDeleteBundle(bundle.id, bundle.name)}
                      className="text-zinc-500 hover:text-rose-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {bundle.description && (
                  <CardDescription className="text-xs text-zinc-400 mt-1 line-clamp-2">
                    {bundle.description}
                  </CardDescription>
                )}
              </CardHeader>

              <CardContent className="py-4 space-y-3">
                <div className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-[#D0A96B]" /> Componentes a Descontar:
                </div>

                <div className="space-y-2">
                  {bundle.bundle_items?.map((item: any) => (
                    <div key={item.id} className="flex items-center justify-between text-xs bg-[#08130E]/60 border border-[#1B362A] p-2 rounded-xl">
                      <div className="truncate">
                        <span className="font-semibold text-white truncate block" title={item.products?.name}>
                          {item.products?.name || 'Producto N/A'}
                        </span>
                        <span className="text-[10px] text-zinc-400 font-mono">
                          {item.products?.brand} • Stock Disp: {item.products?.stock_quantity}
                        </span>
                      </div>
                      <span className="font-mono font-black text-[#D0A96B] bg-[#D0A96B]/10 border border-[#D0A96B]/30 px-2 py-0.5 rounded-md shrink-0 ml-2">
                        -{item.quantity_to_deduct} ud
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>

              <CardFooter className="border-t border-[#1B362A] bg-[#08130E]/40 px-4 py-3 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-bold">Precio Combo</span>
                  <span className="text-base font-extrabold text-white font-mono">
                    ${Number(bundle.price_ars).toLocaleString('es-AR')} ARS
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-bold">Equiv. USD</span>
                  <span className="text-xs font-bold text-indigo-400 font-mono">
                    u$s {Number(bundle.price_usd).toFixed(2)}
                  </span>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* MODAL DE CREACIÓN DE COMBO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-[#13261E] border border-[#1B362A] rounded-2xl shadow-2xl overflow-hidden space-y-4 p-6">
            
            <div className="flex items-center justify-between border-b border-[#1B362A] pb-3">
              <h3 className="text-base font-bold text-white font-serif flex items-center gap-2">
                <Layers className="h-5 w-5 text-[#D0A96B]" />
                Crear Nuevo SKU Combo / Bundle
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateBundle} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-zinc-300">SKU Combo *</label>
                  <Input
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="CMB-001"
                    className="bg-[#08130E] border-[#1B362A] font-mono text-xs font-bold"
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-[10px] font-bold uppercase text-zinc-300">Nombre del Combo *</label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej: Lattafa Asad + Decant 10ml"
                    className="bg-[#08130E] border-[#1B362A] text-xs font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-zinc-300">Precio ARS *</label>
                  <Input
                    type="number"
                    value={priceArs}
                    onChange={(e) => setPriceArs(e.target.value)}
                    placeholder="$0"
                    className="bg-[#08130E] border-[#1B362A] font-mono text-xs font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-zinc-300">Precio Ref USD</label>
                  <Input
                    type="number"
                    value={priceUsd}
                    onChange={(e) => setPriceUsd(e.target.value)}
                    placeholder="u$s 0"
                    className="bg-[#08130E] border-[#1B362A] font-mono text-xs font-bold"
                  />
                </div>
              </div>

              {/* SELECCIÓN DE COMPONENTES */}
              <div className="space-y-2 pt-2 border-t border-[#1B362A]">
                <label className="text-xs font-bold uppercase text-[#D0A96B] flex items-center justify-between">
                  <span>Componentes a Descontar del Stock</span>
                </label>

                <select
                  onChange={(e) => {
                    handleAddItemToCombo(e.target.value);
                    e.target.value = '';
                  }}
                  className="flex h-9 w-full rounded-lg border border-[#1B362A] bg-[#08130E] px-3 py-1 text-xs text-white"
                >
                  <option value="">➕ Seleccionar producto para agregar al combo...</option>
                  {availableProducts.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.brand}) - Stock: {p.stock_quantity}
                    </option>
                  ))}
                </select>

                <div className="space-y-2 max-h-40 overflow-y-auto pt-1">
                  {selectedItems.map(item => {
                    const prod = availableProducts.find(p => p.id === item.product_id);
                    return (
                      <div key={item.product_id} className="flex items-center justify-between bg-[#08130E] border border-[#1B362A] p-2 rounded-xl text-xs">
                        <span className="font-semibold text-white truncate max-w-[55%]">
                          {prod?.name || item.product_id}
                        </span>

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-zinc-400">Descontar:</span>
                          <Input
                            type="number"
                            value={item.quantity_to_deduct}
                            onChange={(e) => handleItemQtyChange(item.product_id, parseFloat(e.target.value))}
                            className="w-16 h-7 bg-[#13261E] border-[#1B362A] font-mono text-xs text-center font-bold"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.product_id)}
                            className="text-zinc-500 hover:text-rose-400 ml-1"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[#1B362A]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  className="border-[#1B362A] bg-[#08130E]"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-[#D0A96B] hover:bg-[#E5C158] text-[#08130E] font-bold"
                >
                  {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Guardar Combo'}
                </Button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}
