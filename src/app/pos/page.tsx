'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useUserStore } from '@/hooks/use-user-store';
import { useExchangeRate } from '@/hooks/use-exchange-rate';
import { usePosStore, CartItem } from '@/hooks/use-pos-store';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { getProducts } from '@/app/actions/products';
import { Product, ProductType } from '@/types';
import { RoleSelector } from '@/components/products/RoleSelector';
import { ExchangeRateWidget } from '@/components/rates/ExchangeRateWidget';
import { CheckoutModal } from '@/components/pos/CheckoutModal';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft, ShoppingBag, Droplet, Archive, Search, Trash2, 
  Plus, Minus, RefreshCw, AlertCircle, ShoppingCart, Check, Sparkles 
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function PosPage() {
  const { role } = useUserStore();
  const { rate: exchangeRate, refresh: refreshRate } = useExchangeRate();
  const { cart, addItem, removeItem, updateQuantity, clearCart } = usePosStore();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros de búsqueda
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');

  // Estados del modal de checkout
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  // Estados locales para la configuración de decants antes de agregarlos al carrito
  // Clave del producto -> { ml: 5, supplyId: '' }
  const [decantConfig, setDecantConfig] = useState<Record<string, { ml: number; supplyId: string }>>({});

  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    const res = await getProducts(role);
    if (res.success && res.data) {
      setProducts(res.data);
    } else {
      setError(res.error || 'Error al cargar productos para el POS');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, [role]);

  // Filtrar insumos (supplies) disponibles como recipientes vacíos
  const emptyBottles = products.filter(p => p.type === 'supply' && p.stock_quantity > 0);

  // Filtrar catálogo para mostrar en la grilla del POS (excluyendo estrictamente insumos que solo se consumen JIT)
  const filteredProducts = products.filter(product => {
    if (product.type === 'supply') return false; // Insumos no se venden sueltos

    const matchesSearch = 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchTerm.toLowerCase());
      
    const matchesType = selectedType === 'all' || product.type === selectedType;
    return matchesSearch && matchesType;
  });

  // Inicializar configuraciones por defecto de decants al cargar productos
  useEffect(() => {
    if (products.length === 0 || emptyBottles.length === 0) return;
    
    const initialConfig: Record<string, { ml: number; supplyId: string }> = {};
    products.forEach(p => {
      if (p.type === 'decant_liquid') {
        initialConfig[p.id] = {
          ml: 5,
          supplyId: emptyBottles[0]?.id || ''
        };
      }
    });
    setDecantConfig(prev => ({ ...initialConfig, ...prev }));
  }, [products]);

  // Manejo de la configuración del decant de un producto
  const handleDecantConfigChange = (productId: string, field: 'ml' | 'supplyId', value: any) => {
    setDecantConfig(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [field]: value
      }
    }));
  };

  const handleAddDecantToCart = (product: Product) => {
    const config = decantConfig[product.id];
    if (!config || !config.supplyId) {
      toast.error('Debes seleccionar un frasco de insumo para envasar el decant.');
      return;
    }

    const supplyProduct = emptyBottles.find(b => b.id === config.supplyId);
    if (!supplyProduct) return;

    addItem(product, config.ml, {
      id: supplyProduct.id,
      name: supplyProduct.name,
      price: supplyProduct.base_price_ars
    });
  };

  // Callback para escaneo automático de código de barras
  const handleBarcodeScan = useCallback((code: string) => {
    const cleanCode = code.trim().toLowerCase();
    const matchedProduct = products.find(p => 
      p.sku.toLowerCase() === cleanCode || 
      p.id.toLowerCase() === cleanCode ||
      (p.batch_code && p.batch_code.toLowerCase() === cleanCode)
    );

    if (matchedProduct) {
      if (matchedProduct.type === 'bottle') {
        addItem(matchedProduct);
        toast.success(`⚡ Producto escaneado: ${matchedProduct.name}`);
      } else if (matchedProduct.type === 'decant_liquid') {
        handleAddDecantToCart(matchedProduct);
        toast.success(`⚡ Decant escaneado: ${matchedProduct.name}`);
      } else {
        toast.info(`Insumo detectado (${matchedProduct.name}). Se requiere envasado JIT.`);
      }
    } else {
      toast.error(`Código de barras no reconocido: "${code}"`);
    }
  }, [products, addItem, emptyBottles, decantConfig]);

  useBarcodeScanner(handleBarcodeScan);

  // Calcular totales del carrito
  const calculateItemTotal = (item: CartItem) => {
    if (item.product.type === 'decant_liquid' && item.decantMl && item.selectedSupplyPrice) {
      // (Precio del líquido por ml * ml) + Precio del frasco vacío
      return item.quantity * ((item.product.base_price_ars * item.decantMl) + item.selectedSupplyPrice);
    }
    return item.quantity * item.product.base_price_ars;
  };

  const cartTotalArs = cart.reduce((total, item) => total + calculateItemTotal(item), 0);
  const cartTotalUsd = exchangeRate ? cartTotalArs / exchangeRate : 0;

  // Renderizar íconos según categoría de producto
  const renderProductIcon = (type: ProductType) => {
    switch (type) {
      case 'bottle':
        return <ShoppingBag className="h-5 w-5 text-[#D0A96B]" />;
      case 'decant_liquid':
        return <Droplet className="h-5 w-5 text-blue-500 animate-pulse" />;
      case 'supply':
        return <Archive className="h-5 w-5 text-amber-500" />;
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900 dark:bg-[#08130E] dark:text-zinc-50 transition-colors duration-300">
      
      {/* NAVBAR POS */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/80 backdrop-blur-md dark:border-[#1B362A] dark:bg-[#08130E]/80">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 max-w-7xl">
          <div className="flex items-center gap-4">
            <Link 
              href="/"
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
            >
              <ArrowLeft className="h-4.5 w-4.5" />
              <span>Dashboard</span>
            </Link>
            <span className="text-slate-300 dark:text-zinc-800">|</span>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-emerald-500 to-teal-500 shadow-md shadow-emerald-500/10">
                <ShoppingCart className="h-4.5 w-4.5 text-white" />
              </div>
              <span className="text-sm font-bold tracking-tight text-slate-800 dark:text-zinc-100 uppercase">
                Punto de Venta (POS)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <RoleSelector />
            <ExchangeRateWidget role={role} onRateChange={refreshRate} />
          </div>
        </div>
      </header>

      {/* CUERPO DEL POS */}
      <main className="flex-1 container mx-auto px-4 py-6 sm:px-6 max-w-7xl grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* PANEL IZQUIERDO: CATÁLOGO */}
        <div className="lg:col-span-2 space-y-4 flex flex-col h-[calc(100vh-8.5rem)]">
          
          {/* BUSCADOR Y FILTROS */}
          <div className="bg-white dark:bg-[#13261E] p-4 rounded-xl border border-slate-200 dark:border-[#1B362A] shadow-sm space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por marca, perfume o SKU..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedType === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedType('all')}
                className="cursor-pointer text-xs"
              >
                Todos
              </Button>
              <Button
                variant={selectedType === 'bottle' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedType('bottle')}
                className="cursor-pointer text-xs"
              >
                Botellas Selladas
              </Button>
              <Button
                variant={selectedType === 'decant_liquid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedType('decant_liquid')}
                className="cursor-pointer text-xs"
              >
                Líquidos a Granel
              </Button>
            </div>
          </div>

          {/* GRILLA DE PRODUCTOS */}
          <div className="flex-1 overflow-y-auto pr-1">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full py-20 gap-3">
                <RefreshCw className="h-8 w-8 animate-spin text-emerald-500" />
                <span className="text-sm font-medium text-slate-500 dark:text-zinc-400">Cargando catálogo...</span>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-full text-rose-500 gap-2">
                <AlertCircle className="h-10 w-10 text-rose-600" />
                <h3 className="font-bold">Error</h3>
                <p className="text-xs text-slate-500">{error}</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2 py-20">
                <ShoppingBag className="h-10 w-10" />
                <span className="text-sm">No se encontraron productos</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredProducts.map(product => {
                  const isDecant = product.type === 'decant_liquid';
                  const config = decantConfig[product.id] || { ml: 5, supplyId: '' };
                  
                  return (
                    <div 
                      key={product.id}
                      className="bg-white dark:bg-[#13261E] border border-slate-200 dark:border-[#1B362A] rounded-xl p-4 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="space-y-2">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-1.5">
                            {renderProductIcon(product.type)}
                            <span className="text-[10px] font-bold font-mono text-slate-400 tracking-wider">
                              {product.sku}
                            </span>
                          </div>
                          
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            product.stock_quantity > 0 
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' 
                              : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'
                          }`}>
                            {product.stock_quantity > 0 
                              ? `Stock: ${product.stock_quantity} ${isDecant ? 'ml' : 'uds'}` 
                              : 'Sin Stock'}
                          </span>
                        </div>

                        <div>
                          <h4 className="font-bold text-slate-900 dark:text-white line-clamp-1">{product.name}</h4>
                          <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">Marca: {product.brand}</p>
                        </div>
                      </div>

                      {/* AREA DE ACCIONES / SELECCIÓN DE DECANT */}
                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-[#1B362A] space-y-3">
                        {isDecant ? (
                          <div className="space-y-2">
                            {/* Selector JIT para decant */}
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <label className="text-[9px] font-bold uppercase text-slate-400">Capacidad (ml)</label>
                                <Input
                                  type="number"
                                  min="1"
                                  value={config.ml}
                                  onChange={(e) => handleDecantConfigChange(product.id, 'ml', parseInt(e.target.value) || 1)}
                                  className="h-8 text-xs font-mono"
                                />
                              </div>
                              
                              <div className="space-y-1">
                                <label className="text-[9px] font-bold uppercase text-slate-400">Envase vacío</label>
                                <select
                                  value={config.supplyId}
                                  onChange={(e) => handleDecantConfigChange(product.id, 'supplyId', e.target.value)}
                                  className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs shadow-sm focus:outline-none dark:border-input/40 dark:bg-input/10"
                                >
                                  {emptyBottles.map(bottle => (
                                    <option key={bottle.id} value={bottle.id}>
                                      {bottle.name} (${bottle.base_price_ars})
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                            
                            <div className="flex justify-between items-center bg-blue-50/30 dark:bg-blue-950/10 rounded-lg p-2 text-xs">
                              <span className="text-slate-500 dark:text-zinc-400">Precio / ml:</span>
                              <span className="font-bold text-slate-800 dark:text-zinc-200">
                                ${product.base_price_ars.toLocaleString('es-AR')} ARS
                              </span>
                            </div>
                            
                            <Button
                              onClick={() => handleDecantConfigChange(product.id, 'ml', 5)} // reset o default
                              disabled={product.stock_quantity < config.ml || emptyBottles.length === 0}
                              className="w-full h-8 bg-blue-600 hover:bg-blue-700 text-white cursor-pointer text-xs"
                              onClickCapture={() => handleAddDecantToCart(product)}
                            >
                              <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Ensamblar Decant JIT
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <div className="text-xs text-slate-400">Precio unitario</div>
                              <div className="font-extrabold text-slate-950 dark:text-zinc-50 font-mono">
                                ${product.base_price_ars.toLocaleString('es-AR')}
                              </div>
                            </div>
                            <Button
                              disabled={product.stock_quantity <= 0}
                              onClick={() => addItem(product)}
                              className="bg-[#D0A96B] hover:bg-[#E5C158] text-[#08130E] font-extrabold shadow-md shadow-[#D0A96B]/20 dark:bg-violet-500 dark:hover:bg-[#D0A96B] text-[#08130E] cursor-pointer h-8 text-xs"
                            >
                              <Plus className="mr-1 h-3.5 w-3.5" /> Agregar
                            </Button>
                          </div>
                        )}
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* PANEL DERECHO: CARRITO */}
        <div className="bg-white dark:bg-[#13261E] border border-slate-200 dark:border-[#1B362A] rounded-xl flex flex-col justify-between h-[calc(100vh-8.5rem)] shadow-sm overflow-hidden">
          
          <div className="border-b border-slate-100 dark:border-[#1B362A] p-4 bg-slate-50/50 dark:bg-[#13261E]/50 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShoppingCart className="h-4.5 w-4.5 text-slate-500" />
              Detalle del Carrito
            </h3>
            <span className="text-xs bg-slate-200 dark:bg-zinc-800 px-2 py-0.5 rounded-full font-bold">
              {cart.reduce((sum, item) => sum + item.quantity, 0)} ítems
            </span>
          </div>

          {/* LISTA DE ITEMS */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2.5 py-12">
                <ShoppingCart className="h-12 w-12 opacity-30 animate-bounce" />
                <span className="text-sm font-medium">El carrito está vacío</span>
                <p className="text-[10px] text-slate-400 max-w-[180px] text-center">Selecciona productos de la izquierda para comenzar.</p>
              </div>
            ) : (
              cart.map(item => (
                <div 
                  key={item.key}
                  className="flex flex-col gap-2 rounded-lg border border-slate-100 dark:border-[#1B362A] bg-slate-50/50 dark:bg-[#13261E]/30 p-3 relative"
                >
                  <button
                    onClick={() => removeItem(item.key)}
                    className="absolute top-2 right-2 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                    title="Remover"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>

                  <div>
                    <h5 className="font-bold text-xs text-slate-900 dark:text-zinc-100 pr-5 truncate">{item.product.name}</h5>
                    <p className="text-[10px] text-slate-400 mt-0.5">SKU: {item.product.sku}</p>
                    
                    {item.product.type === 'decant_liquid' && item.decantMl && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-800 dark:bg-blue-500/10 dark:text-blue-400">
                          <Droplet className="h-2.5 w-2.5" /> JIT: {item.decantMl} ml
                        </span>
                        <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800 dark:bg-amber-500/10 dark:text-amber-400">
                          <Archive className="h-2.5 w-2.5" /> Envase: {item.selectedSupplyName}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center mt-1 pt-1.5 border-t border-slate-100 dark:border-[#1B362A]">
                    {/* Selector de cantidad */}
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => updateQuantity(item.key, item.quantity - 1)}
                        className="h-6 w-6 rounded border border-slate-200 dark:border-[#1B362A] cursor-pointer"
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center text-xs font-mono font-bold">{item.quantity}</span>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => updateQuantity(item.key, item.quantity + 1)}
                        className="h-6 w-6 rounded border border-slate-200 dark:border-[#1B362A] cursor-pointer"
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>

                    {/* Total del ítem */}
                    <div className="text-right font-mono font-bold text-xs">
                      ${calculateItemTotal(item).toLocaleString('es-AR')} ARS
                    </div>
                  </div>

                </div>
              ))
            )}
          </div>

          {/* AREA DE TOTAL Y COBRO */}
          <div className="border-t border-slate-100 dark:border-[#1B362A] p-4 bg-slate-50/50 dark:bg-[#13261E]/50 space-y-4">
            
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-slate-500 dark:text-zinc-400">
                <span>Subtotal (Dólares):</span>
                <span className="font-semibold text-slate-800 dark:text-zinc-200">
                  u$s {cartTotalUsd.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-sm font-bold text-slate-900 dark:text-white">Total Venta:</span>
                <div className="text-right">
                  <div className="text-xl font-black text-slate-950 dark:text-zinc-50 font-mono">
                    ${cartTotalArs.toLocaleString('es-AR', { minimumFractionDigits: 2 })} ARS
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={clearCart}
                disabled={cart.length === 0}
                className="w-full text-xs cursor-pointer h-9"
              >
                Vaciar
              </Button>
              <Button
                onClick={() => setIsCheckoutOpen(true)}
                disabled={cart.length === 0}
                className="w-full bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white font-bold text-xs cursor-pointer h-9 shadow-sm"
              >
                Cobrar Orden
              </Button>
            </div>

          </div>

        </div>

      </main>

      {/* CHECKOUT MODAL */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        onSuccess={() => {
          clearCart();
          toast.success('¡Venta registrada con éxito y stocks actualizados!');
        }}
        role={role}
        totalArs={cartTotalArs}
        exchangeRate={exchangeRate || 1250}
        cartItems={cart}
      />

    </div>
  );
}
