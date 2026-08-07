'use client';

import React, { useState, useEffect } from 'react';
import { useUserStore } from '@/hooks/use-user-store';
import { getProducts } from '@/app/actions/products';
import { calculateDynamicCost, deleteProductRecipe } from '@/app/actions/recipes';
import { Product } from '@/types';
import { RecipeBuilderModal } from '@/components/recipes/RecipeBuilderModal';
import { RoleSelector } from '@/components/products/RoleSelector';
import { ExchangeRateWidget } from '@/components/rates/ExchangeRateWidget';
import { 
  ArrowLeft, Layers, Plus, Calculator, Search, Filter, 
  Droplet, Package, Sparkles, RefreshCw, ShieldAlert, Trash2, Edit3, DollarSign 
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

export default function RecetasPage() {
  const { role } = useUserStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'decant' | 'bottle'>('all');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const fetchProductsData = async () => {
    setLoading(true);
    const res = await getProducts(role);
    if (res.success && res.data) {
      setProducts(res.data);
    } else {
      toast.error(res.error || 'Error al cargar inventario.');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProductsData();
  }, []);

  if (role !== 'admin') {
    return (
      <div className="flex flex-col min-h-screen bg-[#08130E] text-zinc-50">
        <header className="sticky top-0 z-40 w-full border-b border-[#1B362A] bg-[#08130E]/80 backdrop-blur-md">
          <div className="container mx-auto flex h-16 items-center justify-between px-6 max-w-6xl">
            <Link href="/" className="flex items-center gap-2 text-xs text-zinc-400 hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              <span>Volver</span>
            </Link>
            <RoleSelector />
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md border-rose-900/30 bg-rose-950/10 text-rose-400">
            <CardHeader className="text-center">
              <ShieldAlert className="h-10 w-10 mx-auto text-rose-500 mb-2" />
              <CardTitle className="text-lg font-bold">Acceso Restringido</CardTitle>
              <CardDescription className="text-rose-400/80">
                La gestión de recetas y costeo de decants (BOM) es exclusiva para Administradores.
              </CardDescription>
            </CardHeader>
          </Card>
        </main>
      </div>
    );
  }

  const decantProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku.toLowerCase().includes(searchTerm.toLowerCase());
    if (filterType === 'decant') return matchesSearch && (p.type === 'decant_liquid' || p.name.toLowerCase().includes('decant'));
    if (filterType === 'bottle') return matchesSearch && p.type === 'bottle';
    return matchesSearch;
  });

  const handleOpenBuilder = (product: Product) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  const handleDeleteRecipe = async (productId: string) => {
    if (confirm('¿Estás seguro de eliminar la receta de costeo de este producto?')) {
      const res = await deleteProductRecipe(role, productId);
      if (res.success) {
        toast.success('Receta eliminada correctamente.');
        fetchProductsData();
      } else {
        toast.error(res.error || 'Error al eliminar receta.');
      }
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#08130E] text-zinc-50">
      
      {/* NAVBAR */}
      <header className="sticky top-0 z-40 w-full border-b border-[#1B362A] bg-[#08130E]/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 max-w-6xl">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              <span>Dashboard</span>
            </Link>
            <span className="text-zinc-800">|</span>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#D0A96B]/10 border border-[#D0A96B]/30 text-[#D0A96B]">
                <Calculator className="h-4.5 w-4.5" />
              </div>
              <span className="text-sm font-bold tracking-tight text-white uppercase">
                Recetas de Costeo Decants (BOM)
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <RoleSelector />
            <ExchangeRateWidget role={role} />
          </div>
        </div>
      </header>

      {/* CUERPO PRINCIPAL */}
      <main className="flex-1 container mx-auto px-4 py-8 sm:px-6 max-w-6xl space-y-6">
        
        {/* TITULAR Y FILTROS */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              Gestión de Recetas & Bill of Materials (BOM)
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              Automatiza el costo de adquisición de decants sumando fraccionado de perfume original e insumos.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Buscar por nombre o SKU..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-1.5 bg-[#13261E] border border-[#1B362A] rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#D0A96B]"
              />
            </div>
            
            <Button
              onClick={fetchProductsData}
              variant="outline"
              size="sm"
              className="border-[#1B362A] bg-[#13261E] text-zinc-300 hover:text-white cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* GRILLA DE PRODUCTOS DECANTS CON ESTADO DE COSTEO */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <RefreshCw className="h-8 w-8 animate-spin text-[#D0A96B]" />
            <span className="text-xs text-zinc-400">Cargando catálogo de decants y productos...</span>
          </div>
        ) : decantProducts.length === 0 ? (
          <div className="p-12 text-center border border-dashed border-[#1B362A] rounded-2xl text-zinc-500 text-xs">
            No se encontraron productos coincidentes para armar recetas.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {decantProducts.map(product => {
              const isDecant = product.type === 'decant_liquid' || product.name.toLowerCase().includes('decant');

              return (
                <div
                  key={product.id}
                  className="p-5 bg-[#13261E] border border-[#1B362A] rounded-2xl shadow-xl space-y-4 flex flex-col justify-between hover:border-[#D0A96B]/40 transition-colors"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#08130E] text-[#D0A96B] border border-[#1B362A]">
                        {product.sku}
                      </span>
                      <span className="text-[10px] font-extrabold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                        Stock: {product.stock_quantity} un.
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-white line-clamp-1">{product.name}</h3>
                    <p className="text-xs text-zinc-400">{product.brand}</p>
                  </div>

                  <div className="p-3 bg-[#08130E] rounded-xl border border-[#1B362A] space-y-1 font-mono text-xs">
                    <div className="flex justify-between text-zinc-400">
                      <span>Costo Actual:</span>
                      <span className="text-emerald-400 font-bold">${product.base_cost_ars.toLocaleString('es-AR')} ARS</span>
                    </div>
                    <div className="flex justify-between text-zinc-400">
                      <span>Precio Venta:</span>
                      <span className="text-white font-bold">${product.base_price_ars.toLocaleString('es-AR')} ARS</span>
                    </div>
                    <div className="flex justify-between text-zinc-500 text-[11px] pt-1 border-t border-[#1B362A]">
                      <span>Margen Est.:</span>
                      <span className="text-[#D0A96B] font-bold">
                        {product.base_price_ars > 0
                          ? `${(((product.base_price_ars - product.base_cost_ars) / product.base_price_ars) * 100).toFixed(1)}%`
                          : '0%'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      onClick={() => handleOpenBuilder(product)}
                      className="w-full bg-[#D0A96B] hover:bg-[#E5C158] text-[#08130E] font-bold text-xs h-9 cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>Configurar Receta (BOM)</span>
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleDeleteRecipe(product.id)}
                      className="border-[#1B362A] text-rose-400 hover:bg-rose-950/30 text-xs h-9 px-3 cursor-pointer"
                      title="Eliminar Receta"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </main>

      {/* MODAL DE ARMADO Y COSTEO DE RECETAS */}
      <RecipeBuilderModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        targetProduct={selectedProduct}
        allProducts={products}
        onRecipeSaved={fetchProductsData}
      />

    </div>
  );
}
