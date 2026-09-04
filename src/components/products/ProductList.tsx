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
  Tag, Info, RefreshCw, AlertCircle, ShoppingBag, Droplet, Archive, Globe,
  Sparkles, Crown, CheckSquare, Square, FileSpreadsheet, FileText 
} from 'lucide-react';

import { toast } from 'sonner';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { OlfactoryCatalogModal } from './OlfactoryCatalogModal';
import { CatalogGeneratorModal } from './CatalogGeneratorModal';
import { exportStockToCsv, exportStockToPdf } from '@/lib/stock-export';
import { getSystemSettings } from '@/app/actions/systemSettings';

interface ProductListProps {
  role: UserRole;
  excludeSupplies?: boolean;
}

export function ProductList({ role, excludeSupplies = true }: ProductListProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Selección múltiple para Generador de Catálogo
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [isOlfactoryModalOpen, setIsOlfactoryModalOpen] = useState(false);
  
  // Filtros de búsqueda
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');

  // Cotización del Dólar Blue para precios de referencia
  const { rate: exchangeRate, loading: loadingRate } = useExchangeRate();

  // Estados para Exportación de Stock
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Estados para el Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteProductInfo, setDeleteProductInfo] = useState<{ id: string; name: string } | null>(null);

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

  const handleDelete = (id: string, name: string) => {
    setDeleteProductInfo({ id, name });
  };

  const executeDeleteProduct = async () => {
    if (!deleteProductInfo) return;
    setLoading(true);
    const res = await deleteProduct(role, deleteProductInfo.id);
    if (res.success) {
      toast.success(`Producto "${deleteProductInfo.name}" eliminado con éxito.`);
      await fetchProductsList();
    } else {
      toast.error(res.error || 'Error al eliminar producto');
      setLoading(false);
    }
    setDeleteProductInfo(null);
  };

  const handleToggleVisibility = async (productId: string, currentPublic: boolean) => {
    const nextState = !currentPublic;
    // Actualización optimista local
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, is_public: nextState } : p));
    const res = await toggleProductVisibility(role, productId, nextState);
    if (!res.success) {
      // Revertir en caso de falla
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, is_public: currentPublic } : p));
      toast.error(res.error || 'Error al cambiar visibilidad pública');
    } else {
      toast.success(`Visibilidad actualizada a ${nextState ? 'Público' : 'Oculto'}`);
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

  // Filtrar productos con soporte para Stock Crítico
  const filteredProducts = products.filter(product => {
    if (excludeSupplies && product.type === 'supply') return false;

    const matchesSearch = 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.olfactory_family || '').toLowerCase().includes(searchTerm.toLowerCase());
      
    let matchesType = true;
    if (selectedType === 'low_stock') {
      const minAlert = Number(product.min_stock_alert ?? 5);
      matchesType = product.stock_quantity <= minAlert;
    } else if (selectedType !== 'all') {
      matchesType = product.type === selectedType;
    }
    
    return matchesSearch && matchesType;
  });

  const getFilterLabel = () => {
    const parts: string[] = [];
    if (selectedType === 'bottle') parts.push('Botellas Selladas');
    else if (selectedType === 'decant_liquid') parts.push('Decants');
    else if (selectedType === 'supply') parts.push('Insumos Packaging');
    else if (selectedType === 'low_stock') parts.push('Stock Crítico / Bajo');

    if (searchTerm.trim()) parts.push(`Búsqueda: "${searchTerm.trim()}"`);
    if (selectedProductIds.length > 0) parts.push(`${selectedProductIds.length} ítems seleccionados`);
    return parts.length > 0 ? parts.join(' | ') : 'Inventario Consolidado Completo';
  };

  const handleExportCsv = async () => {
    try {
      setIsExportingCsv(true);
      const itemsToExport = selectedProductIds.length > 0 ? selectedProductsObjects : filteredProducts;
      if (itemsToExport.length === 0) {
        toast.error('No hay productos para exportar con los filtros actuales.');
        return;
      }

      toast.info(`Generando archivo CSV con ${itemsToExport.length} productos...`);
      const settingsRes = await getSystemSettings();
      exportStockToCsv({
        products: itemsToExport,
        role,
        settings: settingsRes.data,
        exchangeRate: exchangeRate || 1200,
        filterLabel: getFilterLabel(),
      });
      toast.success('¡Planilla de inventario Excel (.csv) descargada con éxito!');
    } catch (err: unknown) {
      console.error('Error al exportar CSV:', err);
      const msg = err instanceof Error ? err.message : 'Error al exportar CSV';
      toast.error(msg);
    } finally {
      setIsExportingCsv(false);
    }
  };

  const handleExportPdf = async () => {
    try {
      setIsExportingPdf(true);
      const itemsToExport = selectedProductIds.length > 0 ? selectedProductsObjects : filteredProducts;
      if (itemsToExport.length === 0) {
        toast.error('No hay productos para exportar con los filtros actuales.');
        return;
      }

      toast.info(`Generando PDF vectorial oficial con ${itemsToExport.length} productos...`);
      const settingsRes = await getSystemSettings();
      exportStockToPdf({
        products: itemsToExport,
        role,
        settings: settingsRes.data,
        exchangeRate: exchangeRate || 1200,
        filterLabel: getFilterLabel(),
      });
      toast.success('¡Reporte PDF oficial de inventario descargado con éxito!');
    } catch (err: unknown) {
      console.error('Error al exportar PDF:', err);
      const msg = err instanceof Error ? err.message : 'Error al exportar PDF';
      toast.error(msg);
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Helper para formatear valores en ARS
  const formatArs = (amount: number) => {
    return amount.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
  };

  const toggleSelectAll = () => {
    if (selectedProductIds.length === filteredProducts.length) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(filteredProducts.map(p => p.id));
    }
  };

  const toggleSelectProduct = (id: string) => {
    setSelectedProductIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const selectedProductsObjects = products.filter(p => selectedProductIds.includes(p.id));

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
          <Button
            variant={selectedType === 'low_stock' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedType('low_stock')}
            className={`cursor-pointer ${
              selectedType === 'low_stock'
                ? 'bg-amber-600 hover:bg-amber-500 text-white'
                : 'text-amber-500 border-amber-600/40 hover:bg-amber-950/30'
            }`}
          >
            ⚠️ Stock Crítico
          </Button>
        </div>

        {/* ACCIONES DE CATÁLOGO, EXPORTACIÓN Y CREACIÓN */}
        <div className="flex flex-wrap items-center gap-2 ml-auto sm:ml-0">
          {/* BOTONES DE EXPORTACIÓN DE STOCK */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={isExportingCsv || filteredProducts.length === 0}
            className="border-[#1B362A] bg-[#13261E] text-emerald-400 hover:bg-emerald-950/40 hover:text-emerald-300 font-bold text-xs cursor-pointer flex items-center gap-1.5 shadow-sm"
            title="Exportar stock actual a planilla Excel / CSV"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>{isExportingCsv ? 'Exportando...' : 'Exportar Excel (.csv)'}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPdf}
            disabled={isExportingPdf || filteredProducts.length === 0}
            className="border-[#1B362A] bg-[#13261E] text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 font-bold text-xs cursor-pointer flex items-center gap-1.5 shadow-sm"
            title="Descargar reporte oficial de inventario en PDF vectorial"
          >
            {isExportingPdf ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>Generando PDF...</span>
              </>
            ) : (
              <>
                <FileText className="h-3.5 w-3.5" />
                <span>Exportar PDF Oficial</span>
              </>
            )}
          </Button>

          {/* BOTÓN GENERAR CATÁLOGO (Cuando hay selección) */}
          {selectedProductIds.length > 0 && (
            <Button
              onClick={() => setIsCatalogModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs cursor-pointer shadow-md animate-in fade-in duration-200"
            >
              <Crown className="mr-1.5 h-4 w-4 text-[#D0A96B]" />
              Generar Catálogo ({selectedProductIds.length})
            </Button>
          )}

          {/* BOTÓN GESTOR OLFATIVO (Solo Admin) */}
          {role === 'admin' && (
            <Button
              variant="outline"
              onClick={() => setIsOlfactoryModalOpen(true)}
              className="border-[#1B362A] bg-[#13261E] text-zinc-200 hover:bg-zinc-800 font-bold text-xs cursor-pointer"
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5 text-[#D0A96B]" />
              Gestor Olfativo
            </Button>
          )}

          {/* Botón de Creación (Solo Admin) */}
          {role === 'admin' && (
            <Button 
              onClick={handleCreateClick} 
              className="bg-[#D0A96B] hover:bg-[#E5C158] text-[#08130E] font-extrabold shadow-md shadow-[#D0A96B]/20 cursor-pointer text-xs"
            >
              <Plus className="mr-1.5 h-4 w-4" /> Agregar Producto
            </Button>
          )}
        </div>
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
                  <th className="p-4 pl-4 text-center w-10">
                    <input
                      type="checkbox"
                      checked={filteredProducts.length > 0 && selectedProductIds.length === filteredProducts.length}
                      onChange={toggleSelectAll}
                      className="rounded border-[#1B362A] bg-[#08130E] text-[#D0A96B] focus:ring-[#D0A96B] cursor-pointer"
                      title="Seleccionar todos para el catálogo"
                    />
                  </th>
                  <th className="p-4">SKU</th>
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
                    className={`hover:bg-slate-50/60 dark:hover:bg-[#13261E]/30 transition-colors ${
                      selectedProductIds.includes(product.id) ? 'bg-[#13261E]/50' : ''
                    }`}
                  >
                    {/* CHECKBOX SELECCIÓN */}
                    <td className="p-4 pl-4 text-center">
                      <input
                        type="checkbox"
                        checked={selectedProductIds.includes(product.id)}
                        onChange={() => toggleSelectProduct(product.id)}
                        className="rounded border-[#1B362A] bg-[#08130E] text-[#D0A96B] focus:ring-[#D0A96B] cursor-pointer"
                      />
                    </td>

                    {/* SKU */}
                    <td className="p-4 font-mono text-xs font-semibold text-slate-700 dark:text-zinc-300">
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
                      {product.type === 'decant_liquid' ? (
                        <div>
                          <div className="flex items-center gap-1.5 font-bold text-cyan-600 dark:text-cyan-400">
                            <Droplet className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
                            <span>{product.stock_quantity} ml</span>
                          </div>
                          <div className="text-[10px] text-cyan-700/80 dark:text-cyan-300/70 font-normal mt-0.5">
                            Granel en depósito
                          </div>
                        </div>
                      ) : (
                        <>
                          {product.stock_quantity}
                          <span className="text-xs text-slate-400 font-normal ml-1">
                            uds
                          </span>
                          {product.volume_ml && (
                            <div className="text-[10px] text-slate-400 font-normal">
                              Capacidad: {product.volume_ml} ml
                            </div>
                          )}
                        </>
                      )}
                    </td>

                    {/* Costo Adquisición (Solo Admin) */}
                    {role === 'admin' && (
                      <td className="p-4 font-mono font-medium text-[#D0A96B] dark:text-[#D0A96B]">
                        {product.type === 'decant_liquid' ? (
                          <div>
                            <div className="flex items-baseline gap-1">
                              <span>{formatArs(product.base_cost_ars)}</span>
                              <span className="text-[10px] text-slate-400 font-normal">/ ml</span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-normal mt-0.5">
                              Total: {formatArs((Number(product.stock_quantity) || 0) * (Number(product.base_cost_ars) || 0))}
                            </div>
                          </div>
                        ) : (
                          formatArs(product.base_cost_ars)
                        )}
                      </td>
                    )}

                    {/* Precio de Venta (ARS Fijo) */}
                    <td className="p-4 font-mono font-bold text-slate-950 dark:text-zinc-50">
                      {product.type === 'decant_liquid' ? (
                        <div>
                          <div className="flex items-baseline gap-1">
                            <span>{formatArs(product.base_price_ars)}</span>
                            <span className="text-[11px] font-normal text-slate-400">/ {product.volume_ml || 5}ml</span>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            <span className="inline-block px-1.5 py-0.5 text-[9px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded">
                              Base {product.volume_ml || 5}ml
                            </span>
                            <span className="inline-block px-1.5 py-0.5 text-[9px] font-medium bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 rounded">
                              +10ml disponible
                            </span>
                          </div>
                        </div>
                      ) : (
                        formatArs(product.base_price_ars)
                      )}
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
      {/* MODAL DE GESTOR OLFATIVO (FAMILIAS Y NOTAS) */}
      <OlfactoryCatalogModal
        isOpen={isOlfactoryModalOpen}
        onClose={() => setIsOlfactoryModalOpen(false)}
        onRefreshForm={fetchProductsList}
      />

      {/* MODAL DE GENERADOR DE CATÁLOGO EXPORTABLE */}
      <CatalogGeneratorModal
        isOpen={isCatalogModalOpen}
        onClose={() => setIsCatalogModalOpen(false)}
        selectedProducts={selectedProductsObjects}
        exchangeRateUsd={exchangeRate || 1570}
      />

      {/* MODAL DE CONFIRMACIÓN DE ELIMINACIÓN DE PRODUCTO */}
      <ConfirmModal
        isOpen={Boolean(deleteProductInfo)}
        title="Eliminar Producto"
        description={`¿Estás seguro de que deseas eliminar el producto "${deleteProductInfo?.name}"? Esta acción se removerá del inventario.`}
        confirmText="Eliminar Producto"
        cancelText="Cancelar"
        variant="danger"
        onConfirm={executeDeleteProduct}
        onCancel={() => setDeleteProductInfo(null)}
      />
    </div>
  );
}
