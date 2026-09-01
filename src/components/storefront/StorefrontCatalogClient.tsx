'use client';

import React, { useState, useMemo } from 'react';
import { PublicProduct } from '@/lib/storefront-validation';
import { SystemSettingsData, DEFAULT_SYSTEM_SETTINGS } from '@/lib/settings-validation';
import { StorefrontHeader } from './StorefrontHeader';
import { StorefrontFooter } from './StorefrontFooter';
import { CartDrawer } from './CartDrawer';
import { ProductCard } from './ProductCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Search, Filter, Sparkles, Droplet, Package, 
  ArrowUpDown, RefreshCw, X, SlidersHorizontal, ChevronDown 
} from 'lucide-react';

interface StorefrontCatalogClientProps {
  initialProducts: PublicProduct[];
  brands: string[];
  families: string[];
  settings?: SystemSettingsData;
}

export function StorefrontCatalogClient({
  initialProducts,
  brands,
  families,
  settings = DEFAULT_SYSTEM_SETTINGS,
}: StorefrontCatalogClientProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFamily, setSelectedFamily] = useState('Todas');
  const [selectedBrand, setSelectedBrand] = useState('Todas');
  const [selectedType, setSelectedType] = useState<'all' | 'bottle' | 'decant_liquid'>('all');
  const [sortBy, setSortBy] = useState<'name_asc' | 'price_asc' | 'price_desc' | 'newest'>('name_asc');
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);

  // Filtrado y ordenamiento en cliente
  const filteredProducts = useMemo(() => {
    let list = [...initialProducts];

    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          (p.olfactory_family || '').toLowerCase().includes(q) ||
          (p.olfactory_notes || []).some((n) => n.toLowerCase().includes(q))
      );
    }

    if (selectedFamily !== 'Todas') {
      list = list.filter((p) => p.olfactory_family === selectedFamily);
    }

    if (selectedBrand !== 'Todas') {
      list = list.filter((p) => p.brand.toLowerCase() === selectedBrand.toLowerCase());
    }

    if (selectedType !== 'all') {
      list = list.filter((p) => p.type === selectedType);
    }

    if (sortBy === 'price_asc') {
      list.sort((a, b) => a.base_price_ars - b.base_price_ars);
    } else if (sortBy === 'price_desc') {
      list.sort((a, b) => b.base_price_ars - a.base_price_ars);
    } else if (sortBy === 'newest') {
      list.sort((a, b) => (new Date(b.created_at || 0).getTime()) - (new Date(a.created_at || 0).getTime()));
    } else {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }

    return list;
  }, [initialProducts, searchTerm, selectedFamily, selectedBrand, selectedType, sortBy]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedFamily('Todas');
    setSelectedBrand('Todas');
    setSelectedType('all');
    setSortBy('name_asc');
  };

  const hasActiveFilters = 
    searchTerm !== '' || 
    selectedFamily !== 'Todas' || 
    selectedBrand !== 'Todas' || 
    selectedType !== 'all';

  return (
    <div className="min-h-screen bg-[#08130E] text-zinc-100 flex flex-col font-sans selection:bg-[#D0A96B]/30 selection:text-[#E5C158]">
      
      {/* HEADER & DRAWER */}
      <StorefrontHeader settings={settings} />
      <CartDrawer />

      {/* HERO BANNER BOUTIQUE */}
      <section className="relative border-b border-[#1B362A] bg-gradient-to-b from-[#13261E] via-[#08130E] to-[#08130E] py-12 sm:py-16 px-4 sm:px-6">
        <div className="container mx-auto max-w-6xl text-center space-y-4">
          
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1B362A] border border-[#D0A96B]/40 text-[#D0A96B] text-[11px] font-mono uppercase tracking-widest font-bold animate-in fade-in">
            <Sparkles className="h-3.5 w-3.5" />
            Colección Exclusiva de Autor
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-white font-serif tracking-tight max-w-2xl mx-auto leading-tight">
            Descubre tu Firma Olfativa
          </h1>

          <p className="text-xs sm:text-sm text-zinc-400 max-w-xl mx-auto leading-relaxed">
            {settings.slogan || 'Fragancias de nicho exclusivas y decants fraccionados para coleccionistas y apasionados del perfume.'}
          </p>

          {/* BUSCADOR HERO */}
          <div className="max-w-xl mx-auto pt-4">
            <div className="relative">
              <Search className="absolute left-4 top-3.5 h-4 w-4 text-[#D0A96B]" />
              <Input
                type="text"
                placeholder="Buscar por nombre, diseñador o notas (ej: Tom Ford, Vainilla, Oud)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-12 pl-11 pr-10 rounded-2xl bg-[#08130E]/90 border border-[#1B362A] text-white placeholder-zinc-500 focus:ring-2 focus:ring-[#D0A96B] text-xs shadow-xl"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3.5 top-3.5 text-zinc-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* PILLS RÁPIDAS DE CATEGORÍAS */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-3 text-xs font-bold">
            <button
              onClick={() => setSelectedType('all')}
              className={`px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
                selectedType === 'all'
                  ? 'bg-[#D0A96B] text-[#08130E] font-black'
                  : 'bg-[#13261E] text-zinc-300 border border-[#1B362A] hover:border-[#D0A96B]'
              }`}
            >
              Todos los Perfumes ({initialProducts.length})
            </button>

            <button
              onClick={() => setSelectedType('decant_liquid')}
              className={`px-3.5 py-1.5 rounded-full transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedType === 'decant_liquid'
                  ? 'bg-blue-500 text-white font-black'
                  : 'bg-[#13261E] text-zinc-300 border border-[#1B362A] hover:border-blue-400'
              }`}
            >
              <Droplet className="h-3.5 w-3.5 text-blue-400" />
              <span>Decants Fraccionados</span>
            </button>

            <button
              onClick={() => setSelectedType('bottle')}
              className={`px-3.5 py-1.5 rounded-full transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedType === 'bottle'
                  ? 'bg-[#E5C158] text-[#08130E] font-black'
                  : 'bg-[#13261E] text-zinc-300 border border-[#1B362A] hover:border-[#E5C158]'
              }`}
            >
              <Package className="h-3.5 w-3.5 text-[#D0A96B]" />
              <span>Botellas Selladas</span>
            </button>
          </div>

        </div>
      </section>

      {/* CONTENIDO DEL CATÁLOGO */}
      <main className="flex-1 container mx-auto max-w-6xl px-4 sm:px-6 py-8">
        
        {/* BARRA DE FILTROS & ORDENAMIENTO */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-[#1B362A]">
          
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-zinc-400 font-mono">
              Mostrando <span className="text-white font-black">{filteredProducts.length}</span> fragancias
            </span>
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="text-[11px] text-[#D0A96B] hover:underline font-semibold ml-2 cursor-pointer flex items-center gap-1"
              >
                <RefreshCw className="h-3 w-3" /> Limpiar Filtros
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            
            {/* SELECTOR DE FAMILIA OLFATIVA */}
            <select
              value={selectedFamily}
              onChange={(e) => setSelectedFamily(e.target.value)}
              className="h-9 px-3 rounded-xl bg-[#13261E] border border-[#1B362A] text-xs font-bold text-zinc-200 focus:outline-none focus:border-[#D0A96B]"
            >
              <option value="Todas">Todas las Familias</option>
              {families.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>

            {/* SELECTOR DE MARCA */}
            {brands.length > 0 && (
              <select
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="h-9 px-3 rounded-xl bg-[#13261E] border border-[#1B362A] text-xs font-bold text-zinc-200 focus:outline-none focus:border-[#D0A96B]"
              >
                <option value="Todas">Todas las Marcas</option>
                {brands.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            )}

            {/* SELECTOR DE ORDEN */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="h-9 px-3 rounded-xl bg-[#13261E] border border-[#1B362A] text-xs font-bold text-zinc-200 focus:outline-none focus:border-[#D0A96B]"
            >
              <option value="name_asc">Nombre (A-Z)</option>
              <option value="price_asc">Menor Precio</option>
              <option value="price_desc">Mayor Precio</option>
              <option value="newest">Más Recientes</option>
            </select>

          </div>

        </div>

        {/* GRILLA DE PRODUCTOS */}
        <div className="pt-6">
          {filteredProducts.length === 0 ? (
            <div className="py-24 text-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-[#13261E] border border-[#1B362A] flex items-center justify-center mx-auto text-zinc-500">
                <Search className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">No se encontraron perfumes</h3>
                <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
                  No hay resultados que coincidan con los filtros seleccionados.
                </p>
              </div>
              <Button
                onClick={handleResetFilters}
                variant="outline"
                className="border-[#D0A96B]/40 text-[#D0A96B] hover:bg-[#13261E]"
              >
                Restablecer Filtros
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 sm:gap-6">
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>

      </main>

      {/* FOOTER */}
      <StorefrontFooter settings={settings} />

    </div>
  );
}
