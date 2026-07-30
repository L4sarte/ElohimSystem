'use client';

import React, { useState, useEffect } from 'react';
import { Product, UserRole, ProductType } from '@/types';
import { getProducts, deleteProduct, toggleProductVisibility } from '@/app/actions/products';
import { useExchangeRate } from '@/hooks/use-exchange-rate';
import { ProductFormModal } from './ProductFormModal';
import { FractionateModal } from './FractionateModal';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Search, Plus, Edit, Trash2, Filter, EyeOff, Eye, DollarSign, Package, 
  Tag, Info, RefreshCw, AlertCircle, ShoppingBag, Droplet, Archive, Globe 
} from 'lucide-react';

interface ProductListProps {
  role: UserRole;
  excludeSupplies?: boolean;
}

export function ProductList({ role, excludeSupplies = true }: ProductListProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filtros de búsqueda
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');

  // Cotización del Dólar Blue para precios de referencia
  const { rate: exchangeRate, loading: loadingRate } = useExchangeRate();

  // Estados para el Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Estados para el Modal de Fraccionamiento
  const [isFracModalOpen, setIsFracModalOpen] = useState(false);
  const [selectedBottle, setSelectedBottle] = useState<Product | null>(null);

  const handleFracClick = (product: Product) => {
    setSelectedBottle(product);
    setIsFracModalOpen(true);
  };

  const fetchProductsList = async () => {
    setLoading(true);
    setError(null);
    const res = await getProducts(role);
    if (res.success && res.data) {
      setProducts(res.data);
    } else {
      setError(res.error || 'Error al cargar productos');
    }
    setLoading(false);
  };

  // Recargar productos al cambiar de rol o al guardar/eliminar
  useEffect(() => {
    fetchProductsList();
  }, [role]);

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`¿Estás seguro de que deseas eliminar el producto "${name}"?`)) {
      setLoading(true);
      const res = await deleteProduct(role, id);
      if (res.success) {
        await fetchProductsList();
      } else {
        alert(res.error || 'Error al eliminar producto');
        setLoading(false);
      }
    }
  };

  const handleToggleVisibility = async (productId: string, currentPublic: boolean) => {
    const nextState = !currentPublic;
    // Actualización optimista local
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, is_public: nextState } : p));
    const res = await toggleProductVisibility(role, productId, nextState);
    if (!res.success) {
      // Revertir en caso de falla
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, is_public: currentPublic } : p));
      alert(res.error || 'Error al cambiar visibilidad pública');
    }
  };

  const handleEditClick = (product: Product) => {
    setEditingProduct(product);
    setIsModalOpen(true);
  };

  const handleCreateClick = () => {
    setEditingProduct(null);
    setIsModalOpen(true);
  };

  // Filtrar productos
  const filteredProducts = products.filter(product => {
    if (excludeSupplies && product.type === 'supply') return false;

    const matchesSearch = 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.olfactory_family || '').toLowerCase().includes(searchTerm.toLowerCase());
      
    const matchesType = selectedType === 'all' || product.type === selectedType;
    
    return matchesSearch && matchesType;
  });

  // Helper para formatear valores en ARS
  const formatArs = (amount: number) => {
    return amount.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
  };

  // Helper para obtener precio equivalente informativo en USD
  const getUsdReference = (arsAmount: number) => {
    if (!exchangeRate) return 'u$s --';
    const usd = arsAmount / exchangeRate;
    return `u$s ${usd.toFixed(2)}`;
  };

  // Badge para categoría/tipo de producto
  const renderTypeBadge = (type: ProductType) => {
    switch (type) {
      case 'bottle':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-2 py-1 text-xs font-semibold text-violet-700 dark:bg-[#D0A96B]/10 dark:text-[#D0A96B]">
            <ShoppingBag className="h-3 w-3" /> Botella Sellada
          </span>
        );
      case 'decant_liquid':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-400">
            <Droplet className="h-3 w-3" /> Decant / Granel
          </span>
        );
      case 'supply':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
            <Archive className="h-3 w-3" /> Insumo
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      
      {/* BARRA DE FILTROS Y BÚSQUEDA */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white dark:bg-[#13261E] p-4 rounded-xl border border-slate-200 dark:border-[#1B362A] shadow-sm">
        
        {/* Input de Búsqueda */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por SKU, nombre, marca o familia..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Selector de Tipo / Categoría */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={selectedType === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedType('all')}
            className="cursor-pointer"
          >
            Todos
          </Button>
          <Button
            variant={selectedType === 'bottle' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedType('bottle')}
            className="cursor-pointer"
          >
            Botellas
          </Button>
          <Button
            variant={selectedType === 'decant_liquid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedType('decant_liquid')}
            className="cursor-pointer"
          >
            Decants (ml)
          </Button>
          <Button
            variant={selectedType === 'supply' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedType('supply')}
            className="cursor-pointer"
          >
            Insumos
          </Button>
        </div>

        {/* Botón de Creación (Solo Admin) */}
        {role === 'admin' && (
          <Button 
            onClick={handleCreateClick} 
            className="bg-[#D0A96B] hover:bg-[#E5C158] text-[#08130E] font-extrabold shadow-md shadow-[#D0A96B]/20 dark:bg-violet-500 dark:hover:bg-[#D0A96B] text-[#08130E] cursor-pointer shadow-sm ml-auto sm:ml-0"
          >
            <Plus className="mr-2 h-4 w-4" /> Agregar Producto
          </Button>
        )}
      </div>

      {/* INFORMACIÓN DE ADVERTENCIA PARA VENDEDOR */}
      {role === 'seller' && (
        <div className="flex gap-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 p-3.5 text-xs text-amber-800 dark:text-amber-300">
          <Info className="h-4.5 w-4.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="font-semibold">Modo de Consulta (Vendedor)</p>
            <p className="mt-0.5 opacity-90">
              Tienes acceso de consulta al catálogo de stock. Los costos de adquisición están bloqueados por seguridad, y la modificación de precios o eliminación de registros está restringida.
            </p>
          </div>
        </div>
      )}

      {/* CONTENEDOR DE LA TABLA */}
      <Card className="border-slate-200 dark:border-[#1B362A]">
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <RefreshCw className="h-8 w-8 animate-spin text-[#D0A96B] dark:text-[#D0A96B]" />
              <span className="text-sm font-medium text-slate-500 dark:text-zinc-400">Cargando catálogo de productos...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 text-rose-500 gap-2 px-4 text-center">
              <AlertCircle className="h-10 w-10 text-rose-600 dark:text-rose-400" />
              <h3 className="font-bold text-lg">Error al Cargar</h3>
              <p className="text-sm text-slate-500 max-w-sm">{error}</p>
              <Button variant="outline" onClick={fetchProductsList} className="mt-4">Reintentar</Button>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-center px-4">
              <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-400 dark:text-zinc-500">
                <Package className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white">No hay productos</h3>
              <p className="text-sm text-slate-500 dark:text-zinc-400 max-w-sm">
                No se encontraron productos que coincidan con la búsqueda o la categoría seleccionada.
              </p>
              {role === 'admin' && (
                <Button onClick={handleCreateClick} className="mt-2 bg-[#D0A96B] hover:bg-[#E5C158] text-[#08130E] font-extrabold shadow-md shadow-[#D0A96B]/20 dark:bg-violet-500 dark:hover:bg-[#D0A96B] text-[#08130E]">
                  Crear primer producto
                </Button>
              )}
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-[#1B362A] bg-slate-50/50 dark:bg-[#13261E]/40 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  <th className="p-4 pl-6">SKU</th>
                  <th className="p-4">Tipo</th>
                  <th className="p-4">Producto</th>
                  <th className="p-4">Stock</th>
                  {role === 'admin' && (
                    <th className="p-4 text-[#D0A96B] dark:text-[#D0A96B]">Costo (ARS)</th>
                  )}
                  <th className="p-4">Precio (ARS)</th>
                  <th className="p-4 text-indigo-600 dark:text-indigo-400">Precio Ref (USD)</th>
                  <th className="p-4 text-center">Tienda B2C</th>
                  {role === 'admin' && (
                    <th className="p-4 pr-6 text-right">Acciones</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-900 text-sm">
                {filteredProducts.map((product) => (
                  <tr 
                    key={product.id} 
                    className="hover:bg-slate-50/60 dark:hover:bg-[#13261E]/30 transition-colors"
                  >
                    {/* SKU */}
                    <td className="p-4 pl-6 font-mono text-xs font-semibold text-slate-700 dark:text-zinc-300">
                      {product.sku}
                    </td>

                    {/* Categoría */}
                    <td className="p-4">
                      {renderTypeBadge(product.type)}
                    </td>

                    {/* Nombre y Detalles */}
                    <td className="p-4">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {product.name}
                      </div>
                      <div className="flex gap-2 text-xs text-slate-400 mt-0.5">
                        <span>Marca: <strong className="text-slate-600 dark:text-zinc-300">{product.brand}</strong></span>
                        {product.olfactory_family && (
                          <>
                            <span>•</span>
                            <span>Familia: <strong className="text-slate-600 dark:text-zinc-300">{product.olfactory_family}</strong></span>
                          </>
                        )}
                        {product.batch_code && (
                          <>
                            <span>•</span>
                            <span>Batch: <strong className="text-slate-600 dark:text-zinc-300">{product.batch_code}</strong></span>
                          </>
                        )}
                      </div>
                    </td>

                    {/* Stock */}
                    <td className="p-4 font-medium text-slate-900 dark:text-white">
                      {product.stock_quantity}
                      <span className="text-xs text-slate-400 font-normal ml-1">
                        {product.type === 'decant_liquid' ? 'ml' : 'uds'}
                      </span>
                      {product.volume_ml && (
                        <div className="text-[10px] text-slate-400 font-normal">
                          Capacidad: {product.volume_ml} ml
                        </div>
                      )}
                    </td>

                    {/* Costo Adquisición (Solo Admin) */}
                    {role === 'admin' && (
                      <td className="p-4 font-mono font-medium text-[#D0A96B] dark:text-[#D0A96B]">
                        {formatArs(product.base_cost_ars)}
                      </td>
                    )}

                    {/* Precio de Venta (ARS Fijo) */}
                    <td className="p-4 font-mono font-bold text-slate-950 dark:text-zinc-50">
                      {formatArs(product.base_price_ars)}
                    </td>

                    {/* Precio de Referencia (USD Blue) */}
                    <td className="p-4 font-mono text-indigo-600 dark:text-indigo-400 font-semibold">
                      {getUsdReference(product.base_price_ars)}
                    </td>

                    {/* Visibilidad Tienda B2C */}
                    <td className="p-4 text-center">
                      {role === 'admin' ? (
                        <button
                          type="button"
                          onClick={() => handleToggleVisibility(product.id, product.is_public !== false)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer border ${
                            product.is_public !== false
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                              : 'bg-zinc-800 text-zinc-500 border-[#1B362A] hover:bg-zinc-700 hover:text-zinc-300'
                          }`}
                          title="Alternar visibilidad en la vidriera digital pública B2C"
                        >
                          {product.is_public !== false ? (
                            <>
                              <Eye className="h-3 w-3 text-emerald-400" /> Público
                            </>
                          ) : (
                            <>
                              <EyeOff className="h-3 w-3 text-zinc-500" /> Oculto
                            </>
                          )}
                        </button>
                      ) : (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${product.is_public !== false ? 'text-emerald-400' : 'text-zinc-500'}`}>
                          {product.is_public !== false ? 'Público' : 'Oculto'}
                        </span>
                      )}
                    </td>

                    {/* Acciones (Solo Admin) */}
                    {role === 'admin' && (
                      <td className="p-4 pr-6 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {product.type === 'bottle' && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => handleFracClick(product)}
                              className="text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 cursor-pointer"
                              title="Fraccionar botella (abrir decant)"
                            >
                              <Droplet className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleEditClick(product)}
                            className="text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                            title="Editar producto"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleDelete(product.id, product.name)}
                            className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer"
                            title="Eliminar producto"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* MODAL DE FORMULARIO CRUD */}
      <ProductFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchProductsList}
        product={editingProduct}
        role={role}
      />

      {/* MODAL DE FRACCIONAMIENTO */}
      <FractionateModal
        isOpen={isFracModalOpen}
        onClose={() => setIsFracModalOpen(false)}
        onSuccess={fetchProductsList}
        bottle={selectedBottle}
        role={role}
      />
    </div>
  );
}
