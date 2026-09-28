'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUserStore } from '@/hooks/use-user-store';
import { usePosStore } from '@/hooks/use-pos-store';
import { getProducts } from '@/app/actions/products';
import { Product } from '@/types';
import { 
  Search, ShoppingBag, Droplet, LayoutGrid, Users, DollarSign, 
  BarChart3, Archive, Layers, Plus, ArrowRight, Sparkles, X, ShoppingCart, Landmark
} from 'lucide-react';

export function Omnibar() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  const role = useUserStore((state) => state.role);
  const { addItem } = usePosStore();
  const router = useRouter();

  // Escuchar atajo global Ctrl+K / Cmd+K y atajos directos (N, G, I)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorar si el usuario está escribiendo en un input, textarea o modal de texto
      const activeEl = document.activeElement;
      const isEditingInput = activeEl && (
        activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        activeEl.tagName === 'SELECT' ||
        (activeEl as HTMLElement).isContentEditable
      );

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
        return;
      }

      if (isEditingInput || open) return;

      const key = e.key.toLowerCase();
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        if (key === 'n') {
          e.preventDefault();
          router.push('/pos');
        } else if (key === 'g' && role === 'admin') {
          e.preventDefault();
          router.push('/admin/gastos');
        } else if (key === 'i') {
          e.preventDefault();
          router.push('/productos');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, role, router]);

  // Cargar productos al abrir el Omnibar
  useEffect(() => {
    if (open && products.length === 0) {
      async function loadProducts() {
        setLoading(true);
        const res = await getProducts();
        if (res.success && res.data) {
          // Filtrar insumos del buscador comercial directo
          setProducts(res.data.filter(p => p.type !== 'supply'));
        }
        setLoading(false);
      }
      loadProducts();
    }
  }, [open, role, products.length]);

  const handleNavigate = (path: string) => {
    setOpen(false);
    router.push(path);
  };

  const handleAddToCart = (product: Product) => {
    if (product.type === 'decant_liquid') {
      setOpen(false);
      router.push('/pos');
      return;
    }
    addItem(product);
    setOpen(false);
    router.push('/pos');
  };

  const filteredProducts = products.filter((p) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.olfactory_family || '').toLowerCase().includes(q)
    );
  }).slice(0, 8);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-erp-surface border border-erp-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* ENCABEZADO DE BÚSQUEDA DEL OMNIBAR */}
        <div className="flex items-center px-4 border-b border-erp-border bg-erp-bg/60">
          <Search className="h-4 w-4 shrink-0 text-erp-gold mr-2.5" />
          <input
            type="text"
            autoFocus
            placeholder="Escribe un comando o busca un perfume... (Esc para cerrar)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex h-12 w-full bg-transparent text-sm text-erp-cream placeholder-zinc-500 focus:outline-none font-sans"
          />
          <button
            onClick={() => setOpen(false)}
            className="text-zinc-500 hover:text-white transition-colors cursor-pointer p-1 rounded-lg"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* LISTA DE COMANDOS Y RESULTADOS */}
        <div className="max-h-[60vh] overflow-y-auto p-2 space-y-4">
          
          {/* SECCIÓN 1: NAVEGACIÓN Y COMANDOS */}
          {!query && (
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-widest text-erp-gold px-3 py-1.5 flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" /> Navegación Rápida ERP
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs">
                <button
                  onClick={() => handleNavigate('/pos')}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-left text-zinc-200 hover:bg-secondary hover:text-erp-gold transition-colors cursor-pointer group"
                >
                  <ShoppingBag className="h-4 w-4 text-erp-gold" />
                  <div className="flex-1">
                    <div className="font-bold">Punto de Venta (POS)</div>
                    <div className="text-[11px] text-zinc-400">Facturación ágil y cobros</div>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>

                <button
                  onClick={() => handleNavigate('/kanban')}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-left text-zinc-200 hover:bg-secondary hover:text-erp-gold transition-colors cursor-pointer group"
                >
                  <LayoutGrid className="h-4 w-4 text-emerald-400" />
                  <div className="flex-1">
                    <div className="font-bold">Pedidos WhatsApp (Kanban)</div>
                    <div className="text-[11px] text-zinc-400">Seguimiento de entregas</div>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>

                <button
                  onClick={() => handleNavigate('/productos')}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-left text-zinc-200 hover:bg-secondary hover:text-erp-gold transition-colors cursor-pointer group"
                >
                  <ShoppingBag className="h-4 w-4 text-violet-400" />
                  <div className="flex-1">
                    <div className="font-bold">Catálogo de Productos</div>
                    <div className="text-[11px] text-zinc-400">Stock y precios</div>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>

                <button
                  onClick={() => handleNavigate('/clientes')}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-left text-zinc-200 hover:bg-secondary hover:text-erp-gold transition-colors cursor-pointer group"
                >
                  <Users className="h-4 w-4 text-indigo-400" />
                  <div className="flex-1">
                    <div className="font-bold">CRM Clientes & VibePoints</div>
                    <div className="text-[11px] text-zinc-400">Perfiles olfativos</div>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>

                <button
                  onClick={() => handleNavigate('/admin/finanzas/tesoreria')}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-left text-zinc-200 hover:bg-secondary hover:text-erp-gold transition-colors cursor-pointer group"
                >
                  <Landmark className="h-4 w-4 text-erp-gold" />
                  <div className="flex-1">
                    <div className="font-bold">Tesorería Global & Cuentas</div>
                    <div className="text-[11px] text-zinc-400">Saldos reales y transferencias</div>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>

                <button
                  onClick={() => handleNavigate('/admin/reportes')}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-left text-zinc-200 hover:bg-secondary hover:text-erp-gold transition-colors cursor-pointer group"
                >
                  <BarChart3 className="h-4 w-4 text-emerald-400" />
                  <div className="flex-1">
                    <div className="font-bold">Reportes Financieros (PDF)</div>
                    <div className="text-[11px] text-zinc-400">Margen neto y Run Rate</div>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              </div>
            </div>
          )}

          {/* SECCIÓN 2: PRODUCTOS ENCONTRADOS */}
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-widest text-zinc-400 px-3 py-1.5 flex items-center justify-between">
              <span>Catálogo Comercial</span>
              <span className="font-mono">{filteredProducts.length} coincidencias</span>
            </div>

            {loading ? (
              <div className="py-6 text-center text-xs text-zinc-400">
                Buscando productos...
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="py-6 text-center text-xs text-zinc-500">
                No se encontraron perfumes o decants con "{query}".
              </div>
            ) : (
              <div className="space-y-1">
                {filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-erp-bg/60 border border-erp-border hover:border-erp-gold/50 transition-all group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-erp-surface border border-erp-border">
                        {product.type === 'decant_liquid' ? (
                          <Droplet className="h-4 w-4 text-blue-400" />
                        ) : (
                          <ShoppingBag className="h-4 w-4 text-erp-gold" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="font-bold text-xs text-white truncate font-serif">
                          {product.name}
                        </div>
                        <div className="text-[11px] text-zinc-400 flex items-center gap-2 font-mono">
                          <span>{product.brand}</span>
                          <span>•</span>
                          <span>Stock: {product.stock_quantity}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-mono font-bold text-erp-gold">
                        ${product.base_price_ars.toLocaleString('es-AR')}{product.type === 'decant_liquid' ? '/ml' : ''}
                      </span>

                      <button
                        onClick={() => handleAddToCart(product)}
                        className="px-2.5 py-1 rounded-lg bg-erp-gold hover:bg-erp-gold-hover text-erp-bg font-extrabold text-[11px] flex items-center gap-1 cursor-pointer shadow-sm transition-all"
                        title="Añadir a Venta POS"
                      >
                        <ShoppingCart className="h-3 w-3" />
                        <span>POS</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* PIE DEL OMNIBAR */}
        <div className="px-4 py-2 border-t border-erp-border bg-erp-bg flex items-center justify-between text-[11px] text-zinc-500 font-mono">
          <span>Elohim Import ERP • Power User Omnibar</span>
          <span>Presiona <kbd className="px-1.5 py-0.5 rounded bg-erp-surface border border-erp-border text-zinc-300">Esc</kbd> para salir</span>
        </div>

      </div>
    </div>
  );
}
