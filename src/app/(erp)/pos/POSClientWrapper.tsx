'use client';

import React, { useState, useEffect, useCallback, useMemo, useDeferredValue, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useUserStore } from '@/hooks/use-user-store';
import { useExchangeRate } from '@/hooks/use-exchange-rate';
import { usePosStore } from '@/hooks/use-pos-store';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { getProducts } from '@/app/actions/products';
import { Product, ProductType } from '@/types';
import { RoleSelector } from '@/components/products/RoleSelector';
import { ExchangeRateWidget } from '@/components/rates/ExchangeRateWidget';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft, Search, RefreshCw, AlertCircle, ShoppingCart, 
  ShoppingBag, Sparkles 
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { POSProductCard } from '@/components/pos/POSProductCard';
import { POSCartPanel } from '@/components/pos/POSCartPanel';

const CheckoutModal = dynamic(
  () => import('@/components/pos/CheckoutModal').then(mod => mod.CheckoutModal),
  { ssr: false }
);

const PAGE_BATCH_SIZE = 24;

export default function POSClientWrapper() {
  const [mounted, setMounted] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const role = useUserStore((state) => state.role);
  const { rate: exchangeRate, refresh: refreshRate } = useExchangeRate();

  const cart = usePosStore((state) => state.cart);
  const addItem = usePosStore((state) => state.addItem);
  const clearCart = usePosStore((state) => state.clearCart);

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros de búsqueda desacoplados con useDeferredValue
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [selectedType, setSelectedType] = useState<string>('all');

  // Límite de tarjetas visibles en el DOM para scroll fluido (paginación virtual / batching)
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_BATCH_SIZE);

  // Estados del modal de checkout
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  // Barra inferior móvil
  const [mobileCartExpanded, setMobileCartExpanded] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await getProducts();
    if (res.success && res.data) {
      setProducts(res.data);
    } else {
      setError(res.error || 'Error al cargar productos para el POS');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (mounted) {
      fetchProducts();
    }
  }, [role, mounted, fetchProducts]);

  // 1. Filtrar frascos vacíos disponibles como insumos (memoizado)
  const emptyBottles = useMemo(() => {
    return products.filter(p => p.type === 'supply' && p.stock_quantity > 0);
  }, [products]);

  // 2. Pre-indexación de búsqueda: evita ejecutar .toLowerCase() N veces por tecla en cada render
  const searchableIndex = useMemo(() => {
    return products
      .filter(p => p.type !== 'supply')
      .map(p => ({
        product: p,
        searchStr: `${p.name} ${p.brand} ${p.sku}`.toLowerCase(),
      }));
  }, [products]);

  // 3. Filtrado eficiente reactivo al término diferido (Deferred Value)
  const filteredProducts = useMemo(() => {
    const term = deferredSearchTerm.trim().toLowerCase();

    return searchableIndex
      .filter(({ product, searchStr }) => {
        if (selectedType !== 'all' && product.type !== selectedType) {
          return false;
        }
        if (!term) return true;
        return searchStr.includes(term);
      })
      .map(item => item.product);
  }, [searchableIndex, deferredSearchTerm, selectedType]);

  // Resetear el conteo visible cuando cambia el filtro o término de búsqueda
  useEffect(() => {
    setVisibleCount(PAGE_BATCH_SIZE);
  }, [deferredSearchTerm, selectedType]);

  // 4. Renderizado progresivo: segmentar solo el batch activo en el DOM
  const displayedProducts = useMemo(() => {
    return filteredProducts.slice(0, visibleCount);
  }, [filteredProducts, visibleCount]);

  // Infinite Scroll ultraliviano con IntersectionObserver
  useEffect(() => {
    if (!sentinelRef.current || visibleCount >= filteredProducts.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount(prev => Math.min(prev + PAGE_BATCH_SIZE, filteredProducts.length));
        }
      },
      { rootMargin: '300px' }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [visibleCount, filteredProducts.length]);

  // 5. Callbacks de agregado memoizados para evitar romper React.memo de las tarjetas
  const handleAddToCart = useCallback((product: Product) => {
    addItem(product);
  }, [addItem]);

  const handleAddDecantToCart = useCallback((product: Product, ml: number, supplyProduct: Product) => {
    addItem(product, ml, {
      id: supplyProduct.id,
      name: supplyProduct.name,
      price: supplyProduct.base_price_ars,
    });
    toast.success(`Decant ${ml}ml agregado al carrito`);
  }, [addItem]);

  // 6. Callback de escáner de códigos de barras
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
        if (emptyBottles.length > 0) {
          handleAddDecantToCart(matchedProduct, 5, emptyBottles[0]);
          toast.success(`⚡ Decant 5ml escaneado y ensamblado: ${matchedProduct.name}`);
        } else {
          toast.error(`Sin frascos disponibles para envasar decant.`);
        }
      } else {
        toast.info(`Insumo detectado (${matchedProduct.name}). Se requiere envasado JIT.`);
      }
    } else {
      toast.error(`Código de barras no reconocido: "${code}"`);
    }
  }, [products, addItem, emptyBottles, handleAddDecantToCart]);

  useBarcodeScanner(handleBarcodeScan);

  // 7. Atajos de teclado operativos (F2, F4, F8, F9)
  useEffect(() => {
    if (!mounted || isCheckoutOpen) return;

    const handlePosKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isEditingInput =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.tagName === 'SELECT' ||
          (activeEl as HTMLElement).isContentEditable);

      // F2 o '/' (fuera de input) -> Enfocar buscador
      if (e.key === 'F2' || (!isEditingInput && e.key === '/')) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      // F4 o F9 -> Abrir checkout
      if ((e.key === 'F4' || e.key === 'F9') && cart.length > 0) {
        e.preventDefault();
        setIsCheckoutOpen(true);
        return;
      }

      // F8 -> Vaciar carrito
      if (e.key === 'F8' && cart.length > 0) {
        e.preventDefault();
        clearCart();
        toast.info('Carrito vaciado (F8)');
      }
    };

    window.addEventListener('keydown', handlePosKeyDown);
    return () => window.removeEventListener('keydown', handlePosKeyDown);
  }, [mounted, isCheckoutOpen, cart.length, clearCart]);

  if (!mounted) {
    return (
      <div className="flex flex-col min-h-screen bg-erp-bg text-zinc-50 items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-erp-gold mb-2" />
        <span className="text-xs text-zinc-400 font-mono">Cargando Punto de Venta (POS)...</span>
      </div>
    );
  }

  // Total rápido para el modal de checkout
  const cartTotalArs = cart.reduce((total, item) => {
    if (item.product.type === 'decant_liquid' && item.decantMl) {
      const supplyPrice = Number(item.selectedSupplyPrice ?? 0);
      return total + (item.quantity * ((item.product.base_price_ars * item.decantMl) + supplyPrice));
    }
    return total + (item.quantity * item.product.base_price_ars);
  }, 0);

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900 dark:bg-erp-bg dark:text-zinc-50 transition-colors duration-150">
      
      {/* NAVBAR POS */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/90 backdrop-blur-sm dark:border-erp-border dark:bg-erp-bg/90 will-change-transform">
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
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-white shadow-xs">
                <ShoppingCart className="h-4.5 w-4.5 text-white" />
              </div>
              <span className="text-sm font-bold tracking-tight text-slate-800 dark:text-zinc-100 uppercase font-serif">
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
      <main className="flex-1 container mx-auto px-4 py-6 pb-28 sm:px-6 lg:pb-6 max-w-7xl grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* PANEL IZQUIERDO: CATÁLOGO */}
        <div className="lg:col-span-2 space-y-4 flex flex-col h-[calc(100dvh-8.5rem)] max-lg:h-auto">
          
          {/* BUSCADOR Y FILTROS */}
          <div className="bg-white dark:bg-erp-surface p-4 rounded-xl border border-slate-200 dark:border-erp-border shadow-xs space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                ref={searchInputRef}
                placeholder="Buscar por marca, perfume o SKU... (Atajo: F2 o /)"
                className="pl-9 pr-14"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <kbd className="hidden sm:inline-block absolute right-2.5 top-2 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-erp-bg border border-slate-200 dark:border-erp-border text-[10px] font-mono text-slate-500 dark:text-zinc-400 pointer-events-none">
                F2
              </kbd>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={selectedType === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedType('all')}
                className="cursor-pointer text-xs"
              >
                Todos ({products.filter(p => p.type !== 'supply').length})
              </Button>
              <Button
                type="button"
                variant={selectedType === 'bottle' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedType('bottle')}
                className="cursor-pointer text-xs"
              >
                Botellas Selladas
              </Button>
              <Button
                type="button"
                variant={selectedType === 'decant_liquid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedType('decant_liquid')}
                className="cursor-pointer text-xs"
              >
                Líquidos a Granel
              </Button>
            </div>
          </div>

          {/* GRILLA DE PRODUCTOS OPTIMIZADA */}
          <div className="flex-1 overflow-y-auto pr-1 overscroll-contain">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full py-20 gap-3">
                <RefreshCw className="h-8 w-8 animate-spin text-emerald-500" />
                <span className="text-sm font-medium text-slate-500 dark:text-zinc-400">
                  Cargando catálogo...
                </span>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-full text-rose-500 gap-2">
                <AlertCircle className="h-10 w-10 text-rose-600" />
                <h3 className="font-bold">Error</h3>
                <p className="text-xs text-slate-500">{error}</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2 py-20">
                <ShoppingBag className="h-10 w-10 opacity-30 text-erp-gold" />
                <span className="text-sm">No se encontraron productos</span>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {displayedProducts.map((product) => (
                    <POSProductCard
                      key={product.id}
                      product={product}
                      emptyBottles={emptyBottles}
                      onAddToCart={handleAddToCart}
                      onAddDecantToCart={handleAddDecantToCart}
                    />
                  ))}
                </div>

                {/* SENTINEL PARA INFINITE SCROLL / CARGA PROGRESIVA */}
                {visibleCount < filteredProducts.length && (
                  <div
                    ref={sentinelRef}
                    className="py-4 text-center text-xs font-mono text-zinc-400 flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="h-3.5 w-3.5 animate-spin text-erp-gold" />
                    <span>Cargando más productos ({displayedProducts.length} de {filteredProducts.length})...</span>
                  </div>
                )}
              </>
            )}
          </div>

        </div>

        {/* PANEL DERECHO: CARRITO DESKTOP AISLADO */}
        <POSCartPanel
          variant="desktop"
          exchangeRate={exchangeRate}
          onOpenCheckout={() => setIsCheckoutOpen(true)}
        />

      </main>

      {/* BARRA INFERIOR MÓVIL Y DRAWER AISLADO */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 dark:border-erp-border bg-white/95 dark:bg-erp-bg/95 backdrop-blur-sm shadow-md">
        {mobileCartExpanded ? (
          <POSCartPanel
            variant="mobile_drawer"
            exchangeRate={exchangeRate}
            isMobileExpanded={mobileCartExpanded}
            onToggleMobileExpanded={setMobileCartExpanded}
            onOpenCheckout={() => {
              setMobileCartExpanded(false);
              setIsCheckoutOpen(true);
            }}
          />
        ) : (
          <POSCartPanel
            variant="mobile_bar"
            exchangeRate={exchangeRate}
            isMobileExpanded={mobileCartExpanded}
            onToggleMobileExpanded={setMobileCartExpanded}
            onOpenCheckout={() => setIsCheckoutOpen(true)}
          />
        )}
      </div>

      {/* MODAL DE CHECKOUT */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        onSuccess={() => {
          clearCart();
          setMobileCartExpanded(false);
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
