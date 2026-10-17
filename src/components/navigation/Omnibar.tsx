'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUserStore } from '@/hooks/use-user-store';
import { useOmnibarStore } from '@/hooks/use-omnibar-store';
import { usePosStore } from '@/hooks/use-pos-store';
import { useExchangeRate } from '@/hooks/use-exchange-rate';
import { getFlatNavigationItemsForRole, NavigationItem } from '@/config/navigation';
import { getProducts } from '@/app/actions/products';
import { getClients, ClientRecord } from '@/app/actions/sales';
import { Product } from '@/types';
import {
  Search,
  ShoppingBag,
  Droplet,
  Users,
  ArrowRight,
  Sparkles,
  X,
  ShoppingCart,
  CornerDownLeft,
  ArrowUp,
  ArrowDown,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

type CommandEntry =
  | { type: 'nav'; id: string; item: NavigationItem }
  | { type: 'product'; id: string; product: Product }
  | { type: 'client'; id: string; client: ClientRecord };

export function Omnibar() {
  const { isOpen, initialQuery, closeOmnibar, toggleOmnibar } = useOmnibarStore();
  const role = useUserStore((state) => state.role);
  const { rate: exchangeRate } = useExchangeRate();
  const { addItem } = usePosStore();
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [hasLoadedCatalog, setHasLoadedCatalog] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const listContainerRef = useRef<HTMLDivElement | null>(null);

  // Sincronizar query inicial al abrir desde otro componente
  useEffect(() => {
    if (isOpen) {
      setQuery(initialQuery || '');
      setSelectedIndex(0);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [isOpen, initialQuery]);

  // Cargar catálogo y clientes de forma diferida al abrir por primera vez
  useEffect(() => {
    if (!isOpen || hasLoadedCatalog) return;

    let cancelled = false;
    async function loadOmnibarData() {
      setLoadingData(true);
      const [prodRes, clientRes] = await Promise.all([
        getProducts(),
        getClients(role),
      ]);

      if (cancelled) return;

      if (prodRes.success && prodRes.data) {
        setProducts(prodRes.data.filter((p) => p.type !== 'supply'));
      }
      if (clientRes.success && clientRes.data) {
        setClients(clientRes.data);
      }

      setHasLoadedCatalog(true);
      setLoadingData(false);
    }

    loadOmnibarData();
    return () => {
      cancelled = true;
    };
  }, [isOpen, hasLoadedCatalog, role]);

  // Escuchar atajos globales Ctrl+K / Cmd+K y teclas rápidas fuera de inputs
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isEditingInput =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.tagName === 'SELECT' ||
          (activeEl as HTMLElement).isContentEditable);

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        toggleOmnibar();
        return;
      }

      if (isOpen && e.key === 'Escape') {
        e.preventDefault();
        closeOmnibar();
        return;
      }

      if (isEditingInput || isOpen) return;

      // Atajos rápidos globales cuando no se está escribiendo en ningún campo
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const key = e.key.toLowerCase();
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

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isOpen, role, router, toggleOmnibar, closeOmnibar]);

  // 1. Filtrado dinámico de módulos según rol y búsqueda
  const accessibleNavItems = useMemo(() => getFlatNavigationItemsForRole(role), [role]);

  const filteredNavItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return accessibleNavItems.slice(0, 8);
    }
    return accessibleNavItems.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.href.toLowerCase().includes(q) ||
        item.keywords.some((kw) => kw.toLowerCase().includes(q))
    );
  }, [accessibleNavItems, query]);

  // 2. Filtrado dinámico de productos del catálogo
  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return products.slice(0, 6);
    }
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.olfactory_family || '').toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [products, query]);

  // 3. Filtrado dinámico de clientes CRM (cuando el usuario escribe al menos 2 caracteres)
  const filteredClients = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return clients
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.phone || '').toLowerCase().includes(q) ||
          (c.contact_whatsapp || '').toLowerCase().includes(q) ||
          (c.email || '').toLowerCase().includes(q)
      )
      .slice(0, 5);
  }, [clients, query]);

  // Lista plana unificada para navegación con flechas de teclado (↑ / ↓ / Enter)
  const commandEntries = useMemo<CommandEntry[]>(() => {
    const entries: CommandEntry[] = [];
    filteredNavItems.forEach((item) => {
      entries.push({ type: 'nav', id: `nav-${item.id}`, item });
    });
    filteredProducts.forEach((product) => {
      entries.push({ type: 'product', id: `prod-${product.id}`, product });
    });
    filteredClients.forEach((client) => {
      entries.push({ type: 'client', id: `client-${client.id}`, client });
    });
    return entries;
  }, [filteredNavItems, filteredProducts, filteredClients]);

  // Mantener el índice dentro de rango cuando cambian los resultados
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleNavigate = useCallback(
    (path: string) => {
      closeOmnibar();
      router.push(path);
    },
    [closeOmnibar, router]
  );

  const handleAddToCart = useCallback(
    (product: Product) => {
      if (product.type === 'decant_liquid') {
        closeOmnibar();
        router.push('/pos');
        toast.info(`Selecciona el envase y ml para "${product.name}" en el POS.`);
        return;
      }
      if (product.stock_quantity <= 0) {
        toast.error(`"${product.name}" no tiene stock disponible.`);
        return;
      }
      addItem(product);
      closeOmnibar();
      toast.success(`"${product.name}" agregado al carrito POS.`);
      router.push('/pos');
    },
    [addItem, closeOmnibar, router]
  );

  const executeEntry = useCallback(
    (entry: CommandEntry | undefined) => {
      if (!entry) return;
      if (entry.type === 'nav') {
        handleNavigate(entry.item.href);
      } else if (entry.type === 'product') {
        handleAddToCart(entry.product);
      } else if (entry.type === 'client') {
        handleNavigate('/clientes');
      }
    },
    [handleNavigate, handleAddToCart]
  );

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (commandEntries.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => {
        const next = (prev + 1) % commandEntries.length;
        scrollEntryIntoView(next);
        return next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => {
        const next = (prev - 1 + commandEntries.length) % commandEntries.length;
        scrollEntryIntoView(next);
        return next;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      executeEntry(commandEntries[selectedIndex]);
    }
  };

  const scrollEntryIntoView = (index: number) => {
    const container = listContainerRef.current;
    if (!container) return;
    const target = container.querySelector<HTMLElement>(`[data-command-idx="${index}"]`);
    target?.scrollIntoView({ block: 'nearest' });
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-14 sm:pt-20 px-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
      onClick={closeOmnibar}
    >
      <div
        className="w-full max-w-2xl bg-erp-surface border border-erp-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ENCABEZADO DE BÚSQUEDA DEL OMNIBAR */}
        <div className="flex items-center px-4 border-b border-erp-border bg-erp-bg/60">
          <Search className="h-4 w-4 shrink-0 text-erp-gold mr-2.5" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Buscar módulo, perfume por SKU/marca o cliente CRM..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            className="flex h-12 w-full bg-transparent text-sm text-erp-cream placeholder-zinc-500 focus:outline-none font-sans"
          />
          {loadingData && (
            <RefreshCw className="h-3.5 w-3.5 animate-spin text-erp-gold mr-2 shrink-0" />
          )}
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-xs text-zinc-400 hover:text-white px-2 py-0.5 rounded mr-1 cursor-pointer"
            >
              Limpiar
            </button>
          )}
          <button
            type="button"
            onClick={closeOmnibar}
            className="text-zinc-500 hover:text-white transition-colors cursor-pointer p-1 rounded-lg"
            title="Cerrar (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* RESULTADOS UNIFICADOS CON NAVEGACIÓN POR TECLADO */}
        <div
          ref={listContainerRef}
          className="max-h-[65vh] overflow-y-auto p-2.5 space-y-4"
        >
          {/* SECCIÓN 1: MÓDULOS Y ACCIONES DEL ERP */}
          {filteredNavItems.length > 0 && (
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-widest text-erp-gold px-3 py-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3" /> Módulos del Sistema
                </span>
                <span className="font-mono text-zinc-500">{filteredNavItems.length}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs">
                {filteredNavItems.map((item) => {
                  const Icon = item.icon;
                  const entryIdx = commandEntries.findIndex(
                    (e) => e.type === 'nav' && e.item.id === item.id
                  );
                  const isSelected = entryIdx === selectedIndex;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-command-idx={entryIdx}
                      onMouseEnter={() => setSelectedIndex(entryIdx)}
                      onClick={() => handleNavigate(item.href)}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all cursor-pointer group border ${
                        isSelected
                          ? 'bg-secondary text-erp-gold border-erp-gold/40 shadow-sm'
                          : 'text-zinc-200 border-transparent hover:bg-secondary/60'
                      }`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${isSelected ? 'text-erp-gold' : item.color}`} />
                      <div className="flex-1 min-w-0">
                        <div className="font-bold truncate">{item.name}</div>
                        <div className="text-[11px] text-zinc-400 truncate">{item.description}</div>
                      </div>
                      {item.shortcutHint ? (
                        <kbd className="px-1.5 py-0.5 rounded bg-erp-bg/80 border border-erp-border text-[10px] font-mono text-zinc-400">
                          {item.shortcutHint}
                        </kbd>
                      ) : (
                        <ArrowRight
                          className={`h-3.5 w-3.5 shrink-0 transition-opacity ${
                            isSelected ? 'opacity-100 text-erp-gold' : 'opacity-0 group-hover:opacity-100'
                          }`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* SECCIÓN 2: CATÁLOGO DE PRODUCTOS Y DECANTS */}
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-400 px-3 py-1.5 flex items-center justify-between">
              <span>Catálogo Comercial (Perfumes & Decants)</span>
              <span className="font-mono">{filteredProducts.length} resultados</span>
            </div>

            {loadingData && products.length === 0 ? (
              <div className="py-6 text-center text-xs text-zinc-400">
                Sincronizando catálogo comercial...
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="py-4 text-center text-xs text-zinc-500">
                No se encontraron productos para &ldquo;{query}&rdquo;.
              </div>
            ) : (
              <div className="space-y-1">
                {filteredProducts.map((product) => {
                  const entryIdx = commandEntries.findIndex(
                    (e) => e.type === 'product' && e.product.id === product.id
                  );
                  const isSelected = entryIdx === selectedIndex;
                  const usdEq =
                    exchangeRate && exchangeRate > 0
                      ? product.base_price_ars / exchangeRate
                      : null;

                  return (
                    <div
                      key={product.id}
                      data-command-idx={entryIdx}
                      onMouseEnter={() => setSelectedIndex(entryIdx)}
                      onClick={() => handleAddToCart(product)}
                      className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-secondary/90 border-erp-gold/60 shadow-sm'
                          : 'bg-erp-bg/60 border-erp-border hover:border-erp-gold/40'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-erp-surface border border-erp-border">
                          {product.type === 'decant_liquid' ? (
                            <Droplet className="h-4 w-4 text-cyan-400" />
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
                            <span className="text-zinc-500">{product.sku}</span>
                            <span>•</span>
                            <span
                              className={
                                product.stock_quantity > 0 ? 'text-emerald-400' : 'text-rose-400'
                              }
                            >
                              Stock: {product.stock_quantity}{' '}
                              {product.type === 'decant_liquid' ? 'ml' : 'uds'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        <div className="text-right font-mono">
                          <div className="text-xs font-bold text-erp-gold tabular-nums">
                            ${product.base_price_ars.toLocaleString('es-AR')}
                            {product.type === 'decant_liquid' ? '/ml' : ''}
                          </div>
                          {usdEq !== null && (
                            <div className="text-[10px] text-zinc-500 tabular-nums">
                              u$s {usdEq.toFixed(2)}
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddToCart(product);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-erp-gold hover:bg-erp-gold-hover text-erp-bg font-extrabold text-[11px] flex items-center gap-1 cursor-pointer shadow-sm transition-all"
                          title="Enviar directo al Punto de Venta (POS)"
                        >
                          <ShoppingCart className="h-3 w-3" />
                          <span>POS</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SECCIÓN 3: CLIENTES CRM (CUANDO HAY BÚSQUEDA) */}
          {filteredClients.length > 0 && (
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-400 px-3 py-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Users className="h-3 w-3" /> Clientes CRM & VibePoints
                </span>
                <span className="font-mono">{filteredClients.length}</span>
              </div>

              <div className="space-y-1">
                {filteredClients.map((client) => {
                  const entryIdx = commandEntries.findIndex(
                    (e) => e.type === 'client' && e.client.id === client.id
                  );
                  const isSelected = entryIdx === selectedIndex;

                  return (
                    <button
                      key={client.id}
                      type="button"
                      data-command-idx={entryIdx}
                      onMouseEnter={() => setSelectedIndex(entryIdx)}
                      onClick={() => handleNavigate('/clientes')}
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-secondary/90 border-indigo-400/60'
                          : 'bg-erp-bg/60 border-erp-border hover:border-indigo-400/40'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
                          <Users className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-xs text-white truncate">
                            {client.name}
                          </div>
                          <div className="text-[11px] text-zinc-400 font-mono truncate">
                            {client.contact_whatsapp || client.phone || client.email || 'Sin teléfono'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="px-2 py-0.5 rounded-full bg-erp-gold/10 border border-erp-gold/30 text-erp-gold text-[10px] font-mono font-bold">
                          {client.points_balance || 0} pts
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 text-zinc-400" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* PIE DEL OMNIBAR CON GUÍA DE TECLADO */}
        <div className="px-4 py-2.5 border-t border-erp-border bg-erp-bg flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-400 font-mono">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-erp-surface border border-erp-border text-zinc-300">
                <ArrowUp className="h-2.5 w-2.5 inline" />
              </kbd>
              <kbd className="px-1 py-0.5 rounded bg-erp-surface border border-erp-border text-zinc-300">
                <ArrowDown className="h-2.5 w-2.5 inline" />
              </kbd>
              <span>Navegar</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-erp-surface border border-erp-border text-zinc-300">
                <CornerDownLeft className="h-2.5 w-2.5 inline" /> Enter
              </kbd>
              <span>Seleccionar</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-zinc-500">Atajos: N (POS) • I (Catálogo)</span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-erp-surface border border-erp-border text-zinc-300">
                Esc
              </kbd>{' '}
              Cerrar
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
