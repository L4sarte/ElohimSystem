'use client';

import React, { useState, useEffect, useMemo, useCallback, useDeferredValue } from 'react';
import dynamic from 'next/dynamic';
import { Product, UserRole, ProductType } from '@/types';
import { getProducts, deleteProduct, toggleProductVisibility } from '@/app/actions/products';
import { useExchangeRate } from '@/hooks/use-exchange-rate';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Search, Plus, Edit, Trash2, EyeOff, Eye, DollarSign, Package, 
  RefreshCw, AlertCircle, ShoppingBag, Droplet, Archive, 
  Sparkles, Crown, FileSpreadsheet, FileText, Wallet, ChevronLeft, ChevronRight 
} from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { getSystemSettings } from '@/app/actions/systemSettings';
import { calculateProfitSplit } from '@/lib/financial-math';
import { getStockRunwayAnalysis, StockRunwayProduct } from '@/app/actions/inventoryAnalytics';

// Modales cargados dinámicamente con ssr: false para optimizar bundle size y First Input Delay (FID)
const ProductFormModal = dynamic(
  () => import('./ProductFormModal').then((m) => m.ProductFormModal),
  { ssr: false }
);

const FractionateModal = dynamic(
  () => import('./FractionateModal').then((m) => m.FractionateModal),
  { ssr: false }
);

const OlfactoryCatalogModal = dynamic(
  () => import('./OlfactoryCatalogModal').then((m) => m.OlfactoryCatalogModal),
  { ssr: false }
);

const CatalogGeneratorModal = dynamic(
  () => import('./CatalogGeneratorModal').then((m) => m.CatalogGeneratorModal),
  { ssr: false }
);

// Formateador estándar de ARS memoizado a nivel módulo
const arsCurrencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

const formatArs = (amount: number) => arsCurrencyFormatter.format(amount || 0);

interface ProductListProps {
  role: UserRole;
  excludeSupplies?: boolean;
}

// ============================================================================
// COMPONENTE DE FILA MEMOIZADO (ProductTableRow)
// Evita re-renderizar todas las filas al seleccionar un checkbox o escribir en el buscador
// ============================================================================
interface ProductTableRowProps {
  product: Product;
  isSelected: boolean;
  role: UserRole;
  exchangeRate: number | null;
  personalPayoutRate: number;
  runway?: StockRunwayProduct;
  onToggleSelect: (id: string) => void;
  onToggleVisibility: (id: string, currentPublic: boolean) => void;
  onFracClick: (product: Product) => void;
  onEditClick: (product: Product) => void;
  onDeleteClick: (id: string, name: string) => void;
}

const ProductTableRow = React.memo(function ProductTableRow({
  product,
  isSelected,
  role,
  exchangeRate,
  personalPayoutRate,
  runway,
  onToggleSelect,
  onToggleVisibility,
  onFracClick,
  onEditClick,
  onDeleteClick,
}: ProductTableRowProps) {
  // Cálculo de división de ganancias memoizado por fila
  const profitSplit = useMemo(() => {
    if (role !== 'admin') return null;
    const price = Number(product?.base_price_ars) || 0;
    const cost = Number(product?.base_cost_ars) || 0;
    const payoutRate = Number(personalPayoutRate);
    const safeRate = Number.isFinite(payoutRate) ? payoutRate : 30;
    if (cost <= 0 || price <= cost) return null;
    try {
      return calculateProfitSplit(price, cost, safeRate);
    } catch (calcErr) {
      console.error("DEBUG CALC ERROR on product:", product?.id, calcErr);
      return null;
    }
  }, [role, product?.base_price_ars, product?.base_cost_ars, personalPayoutRate, product?.id]);

  // Conversión informativa a USD protegida
  const usdReference = useMemo(() => {
    const rateNum = Number(exchangeRate);
    if (!rateNum || rateNum <= 0 || !Number.isFinite(rateNum)) return 'u$s --';
    const priceNum = Number(product?.base_price_ars) || 0;
    const usd = priceNum / rateNum;
    return `u$s ${Number.isFinite(usd) ? usd.toFixed(2) : '--'}`;
  }, [product?.base_price_ars, exchangeRate]);

  const renderTypeBadge = (type: ProductType) => {
    switch (type) {
      case 'bottle':
        return (
          <span className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-2 py-1 text-xs font-semibold text-violet-700 dark:bg-erp-gold/10 dark:text-erp-gold">
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
    <tr 
      className={`hover:bg-slate-50/60 dark:hover:bg-erp-surface/30 transition-colors ${
        isSelected ? 'bg-erp-surface/50' : ''
      }`}
    >
      {/* CHECKBOX SELECCIÓN */}
      <td className="p-4 pl-4 text-center">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(product.id)}
          className="rounded border-erp-border bg-erp-bg text-erp-gold focus:ring-erp-gold cursor-pointer"
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
            <div className="text-[11px] text-cyan-700/80 dark:text-cyan-300/70 font-normal mt-0.5">
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
              <div className="text-[11px] text-slate-400 font-normal">
                Capacidad: {product.volume_ml} ml
              </div>
            )}
          </>
        )}

        {/* Indicador de Cobertura / Runway */}
        {role === 'admin' && runway && (
          <div className="mt-1.5">
            {runway.urgency === 'critico' ? (
              <span 
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/30"
                title={`Velocidad: ${runway.dailyVelocity} ud/día (${runway.unitsSoldLast30Days} vendidas en 30d)`}
              >
                🚨 {runway.coverageDays}d (Crítico)
              </span>
            ) : runway.urgency === 'reorden' ? (
              <span 
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/30"
                title={`Velocidad: ${runway.dailyVelocity} ud/día (${runway.unitsSoldLast30Days} vendidas en 30d)`}
              >
                ⚠️ {runway.coverageDays}d (Reorden)
              </span>
            ) : runway.urgency === 'agotado' ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-neutral-500/10 text-neutral-400 border border-neutral-500/30">
                Agotado (0d)
              </span>
            ) : runway.urgency === 'optimo' ? (
              <span 
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                title={`Velocidad: ${runway.dailyVelocity} ud/día (${runway.unitsSoldLast30Days} vendidas en 30d)`}
              >
                {runway.coverageDays > 90 ? '>90d' : `${runway.coverageDays}d`} (Óptimo)
              </span>
            ) : null}
          </div>
        )}
      </td>

      {/* Costo Adquisición (Solo Admin) */}
      {role === 'admin' && (
        <td className="p-4 font-mono font-medium text-erp-gold dark:text-erp-gold">
          {product.type === 'decant_liquid' ? (
            <div>
              <div className="flex items-baseline gap-1">
                <span>{formatArs(Number(product.base_cost_ars) || 0)}</span>
                <span className="text-[11px] text-slate-400 font-normal">/ ml</span>
              </div>
              <div className="text-[11px] text-slate-400 font-normal mt-0.5">
                Total: {formatArs((Number(product.stock_quantity) || 0) * (Number(product.base_cost_ars) || 0))}
              </div>
            </div>
          ) : (
            formatArs(Number(product.base_cost_ars) || 0)
          )}
        </td>
      )}

      {/* Precio de Venta (ARS Fijo) & Desglose de Utilidades */}
      <td className="p-4 font-mono text-slate-950 dark:text-zinc-50">
        {profitSplit && (
          <div className="flex flex-wrap items-center gap-1 mb-1.5 text-[10px] font-mono">
            <span 
              className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded font-bold"
              title="Tu Retiro Estimado de Bolsillo según porcentaje configurado"
            >
              <Wallet className="h-2.5 w-2.5 text-erp-gold" />
              Tu Retiro: ${Math.round(profitSplit.ownerPayout).toLocaleString('es-AR')}
            </span>
            <span 
              className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded font-bold"
              title="Costo de Reposición (COGS) + Utilidad Reinvertida retenida para la empresa"
            >
              Empresa: ${Math.round(profitSplit.totalBusinessKeep).toLocaleString('es-AR')}
            </span>
          </div>
        )}
        {product.type === 'decant_liquid' ? (
          <div>
            <div className="flex items-baseline gap-1">
              <span>{formatArs(Number(product.base_price_ars) || 0)}</span>
              <span className="text-[11px] font-normal text-slate-400">/ ml</span>
            </div>
            <div className="flex flex-wrap gap-1 mt-1">
              <span className="inline-block px-1.5 py-0.5 text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded">
                5ml: {formatArs((Number(product.base_price_ars) || 0) * 5)}
              </span>
              <span className="inline-block px-1.5 py-0.5 text-xs font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 rounded">
                10ml: {formatArs((Number(product.base_price_ars) || 0) * 10)}
              </span>
            </div>
          </div>
        ) : (
          formatArs(Number(product.base_price_ars) || 0)
        )}
      </td>

      {/* Precio de Referencia (USD Blue) */}
      <td className="p-4 font-mono text-indigo-600 dark:text-indigo-400 font-semibold">
        {usdReference}
      </td>

      {/* Visibilidad Tienda B2C */}
      <td className="p-4 text-center">
        {role === 'admin' ? (
          <button
            type="button"
            onClick={() => onToggleVisibility(product.id, product.is_public !== false)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer border ${
              product.is_public !== false
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                : 'bg-zinc-800 text-zinc-500 border-erp-border hover:bg-zinc-700 hover:text-zinc-300'
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
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${product.is_public !== false ? 'text-emerald-400' : 'text-zinc-500'}`}>
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
                onClick={() => onFracClick(product)}
                className="text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 cursor-pointer"
                title="Fraccionar botella (abrir decant)"
              >
                <Droplet className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onEditClick(product)}
              className="text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              title="Editar producto"
            >
              <Edit className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onDeleteClick(product.id, product.name)}
              className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer"
              title="Eliminar producto"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </td>
      )}
    </tr>
  );
});

// ============================================================================
// COMPONENTE PRINCIPAL PRODUCT LIST
// ============================================================================
export function ProductList({ role, excludeSupplies = true }: ProductListProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [runwayMap, setRunwayMap] = useState<Record<string, StockRunwayProduct>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Selección múltiple para Generador de Catálogo
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [isOlfactoryModalOpen, setIsOlfactoryModalOpen] = useState(false);
  const [personalPayoutRate, setPersonalPayoutRate] = useState<number>(30);
  
  // Filtros de búsqueda con useDeferredValue para desacoplar el input del filtrado de la tabla
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [selectedType, setSelectedType] = useState<string>('all');

  // Paginación en cliente para renderizado fluido de 60 FPS
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Cotización del Dólar Blue
  const { rate: exchangeRate } = useExchangeRate();

  // Estados para Exportación de Stock
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Estados para el Modal CRUD
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteProductInfo, setDeleteProductInfo] = useState<{ id: string; name: string } | null>(null);

  // Estados para el Modal de Fraccionamiento
  const [isFracModalOpen, setIsFracModalOpen] = useState(false);
  const [selectedBottle, setSelectedBottle] = useState<Product | null>(null);

  // Cargar configuración de utilidades en segundo plano una sola vez
  useEffect(() => {
    if (role === 'admin') {
      getSystemSettings().then((res) => {
        if (res.success && res.data?.personal_payout_rate !== undefined) {
          setPersonalPayoutRate(Number(res.data.personal_payout_rate));
        }
      }).catch(() => {});
    }
  }, [role]);

  const handleFracClick = useCallback((product: Product) => {
    setSelectedBottle(product);
    setIsFracModalOpen(true);
  }, []);

  const fetchProductsList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, runwayRes] = await Promise.all([
        getProducts(),
        role === 'admin' ? getStockRunwayAnalysis() : Promise.resolve({ success: true, data: undefined }),
      ]);
      if (res.success && res.data) {
        setProducts(res.data);
      } else {
        const errMsg = res.error || 'Error al cargar productos';
        console.error("DEBUG PRODUCTS ERROR:", errMsg);
        setError(errMsg);
      }
      if (runwayRes.success && runwayRes.data) {
        setRunwayMap(runwayRes.data.byProductId || {});
      }
    } catch (err: unknown) {
      console.error("DEBUG PRODUCTS ERROR:", err);
      const errMsg = err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : String(err || 'Error inesperado al cargar catálogo');
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    fetchProductsList();
  }, [fetchProductsList]);

  const handleDelete = useCallback((id: string, name: string) => {
    setDeleteProductInfo({ id, name });
  }, []);

  const executeDeleteProduct = async () => {
    if (!deleteProductInfo) return;
    setLoading(true);
    const res = await deleteProduct(deleteProductInfo.id);
    if (res.success) {
      toast.success(`Producto "${deleteProductInfo.name}" eliminado con éxito.`);
      await fetchProductsList();
    } else {
      toast.error(res.error || 'Error al eliminar producto');
      setLoading(false);
    }
    setDeleteProductInfo(null);
  };

  const handleToggleVisibility = useCallback(async (productId: string, currentPublic: boolean) => {
    const nextState = !currentPublic;
    setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, is_public: nextState } : p)));
    const res = await toggleProductVisibility(productId, nextState);
    if (!res.success) {
      setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, is_public: currentPublic } : p)));
      toast.error(res.error || 'Error al cambiar visibilidad pública');
    } else {
      toast.success(`Visibilidad actualizada a ${nextState ? 'Público' : 'Oculto'}`);
    }
  }, []);

  const handleEditClick = useCallback((product: Product) => {
    setEditingProduct(product);
    setIsModalOpen(true);
  }, []);

  const handleCreateClick = useCallback(() => {
    setEditingProduct(null);
    setIsModalOpen(true);
  }, []);

  // Pre-indexar cadenas de búsqueda para evitar llamar a toLowerCase() múltiples veces por producto en cada render
  const indexedProducts = useMemo(() => {
    return products.map((p) => ({
      product: p,
      searchTarget: `${p.sku} ${p.name} ${p.brand} ${p.olfactory_family || ''}`.toLowerCase(),
    }));
  }, [products]);

  // Filtrado optimizado reactivo al término diferido (Deferred Value)
  const filteredProducts = useMemo(() => {
    const term = deferredSearchTerm.trim().toLowerCase();
    return indexedProducts
      .filter(({ product, searchTarget }) => {
        if (excludeSupplies && product.type === 'supply') return false;
        if (term && !searchTarget.includes(term)) return false;

        if (selectedType === 'low_stock') {
          const minAlert = Number(product.min_stock_alert ?? 5);
          const runway = runwayMap[product.id];
          return product.stock_quantity <= minAlert || runway?.urgency === 'critico' || runway?.urgency === 'reorden';
        }
        if (selectedType !== 'all') {
          return product.type === selectedType;
        }
        return true;
      })
      .map(({ product }) => product);
  }, [indexedProducts, deferredSearchTerm, excludeSupplies, selectedType, runwayMap]);

  // Reiniciar a página 1 cuando cambia el filtro o término de búsqueda
  useEffect(() => {
    setCurrentPage(1);
  }, [deferredSearchTerm, selectedType]);

  // Paginación en cliente
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredProducts.slice(startIndex, startIndex + pageSize);
  }, [filteredProducts, currentPage, pageSize]);

  const selectedProductIdsSet = useMemo(() => new Set(selectedProductIds), [selectedProductIds]);

  const selectedProductsObjects = useMemo(() => {
    if (selectedProductIds.length === 0) return [];
    return products.filter((p) => selectedProductIdsSet.has(p.id));
  }, [products, selectedProductIdsSet, selectedProductIds.length]);

  const toggleSelectAll = useCallback(() => {
    if (selectedProductIds.length === filteredProducts.length) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(filteredProducts.map((p) => p.id));
    }
  }, [filteredProducts, selectedProductIds.length]);

  const toggleSelectProduct = useCallback((id: string) => {
    setSelectedProductIds((prev) => 
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }, []);

  const getFilterLabel = useCallback(() => {
    const parts: string[] = [];
    if (selectedType === 'bottle') parts.push('Botellas Selladas');
    else if (selectedType === 'decant_liquid') parts.push('Decants');
    else if (selectedType === 'supply') parts.push('Insumos Packaging');
    else if (selectedType === 'low_stock') parts.push('Stock Crítico / Bajo');

    if (deferredSearchTerm.trim()) parts.push(`Búsqueda: "${deferredSearchTerm.trim()}"`);
    if (selectedProductIds.length > 0) parts.push(`${selectedProductIds.length} ítems seleccionados`);
    return parts.length > 0 ? parts.join(' | ') : 'Inventario Consolidado Completo';
  }, [selectedType, deferredSearchTerm, selectedProductIds.length]);

  // Exportación CSV con importación dinámica bajo demanda
  const handleExportCsv = async () => {
    try {
      setIsExportingCsv(true);
      const itemsToExport = selectedProductIds.length > 0 ? selectedProductsObjects : filteredProducts;
      if (itemsToExport.length === 0) {
        toast.error('No hay productos para exportar con los filtros actuales.');
        return;
      }

      toast.info(`Generando archivo CSV con ${itemsToExport.length} productos...`);
      const [{ exportStockToCsv }, settingsRes] = await Promise.all([
        import('@/lib/stock-export'),
        getSystemSettings(),
      ]);

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

  // Exportación PDF con importación dinámica bajo demanda (evita precargar jsPDF en el bundle principal)
  const handleExportPdf = async () => {
    try {
      setIsExportingPdf(true);
      const itemsToExport = selectedProductIds.length > 0 ? selectedProductsObjects : filteredProducts;
      if (itemsToExport.length === 0) {
        toast.error('No hay productos para exportar con los filtros actuales.');
        return;
      }

      toast.info(`Generando PDF vectorial oficial con ${itemsToExport.length} productos...`);
      const [{ exportStockToPdf }, settingsRes] = await Promise.all([
        import('@/lib/stock-export'),
        getSystemSettings(),
      ]);

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

  return (
    <div className="space-y-6">
      
      {/* BARRA DE FILTROS Y BÚSQUEDA */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-white dark:bg-erp-surface p-4 rounded-xl border border-slate-200 dark:border-erp-border shadow-sm">
        
        {/* Input de Búsqueda Desacoplado */}
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
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={isExportingCsv || filteredProducts.length === 0}
            className="border-erp-border bg-erp-surface text-emerald-400 hover:bg-emerald-950/40 hover:text-emerald-300 font-bold text-xs cursor-pointer flex items-center gap-1.5 shadow-sm"
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
            className="border-erp-border bg-erp-surface text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 font-bold text-xs cursor-pointer flex items-center gap-1.5 shadow-sm"
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
              <Crown className="mr-1.5 h-4 w-4 text-erp-gold" />
              Generar Catálogo ({selectedProductIds.length})
            </Button>
          )}

          {/* BOTÓN GESTOR OLFATIVO (Solo Admin) */}
          {role === 'admin' && (
            <Button
              variant="outline"
              onClick={() => setIsOlfactoryModalOpen(true)}
              className="border-erp-border bg-erp-surface text-zinc-200 hover:bg-zinc-800 font-bold text-xs cursor-pointer"
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5 text-erp-gold" />
              Gestor Olfativo
            </Button>
          )}

          {/* Botón de Creación (Solo Admin) */}
          {role === 'admin' && (
            <Button 
              onClick={handleCreateClick} 
              className="bg-erp-gold hover:bg-erp-gold-hover text-erp-bg font-extrabold shadow-md shadow-erp-gold/20 cursor-pointer text-xs"
            >
              <Plus className="mr-1.5 h-4 w-4" /> Agregar Producto
            </Button>
          )}
        </div>
      </div>

      {/* CONTENEDOR DE LA TABLA */}
      <Card className="border-slate-200 dark:border-erp-border">
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <RefreshCw className="h-8 w-8 animate-spin text-erp-gold" />
              <span className="text-sm font-medium text-slate-500 dark:text-zinc-400">Cargando catálogo de productos...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 text-rose-500 gap-3 px-4 text-center">
              <AlertCircle className="h-10 w-10 text-rose-600 dark:text-rose-400" />
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">Error al Cargar Catálogo</h3>
              <div className="text-xs text-rose-700 dark:text-rose-300 max-w-lg font-mono bg-rose-50 dark:bg-rose-950/40 p-3.5 rounded-xl border border-rose-200 dark:border-rose-900/50 break-words text-left">
                <span className="font-bold block mb-1">Detalle del error:</span>
                {error}
              </div>
              <Button variant="outline" onClick={fetchProductsList} className="mt-2 cursor-pointer font-bold">
                Reintentar Carga
              </Button>
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
                <Button onClick={handleCreateClick} className="mt-2 bg-erp-gold hover:bg-erp-gold-hover text-erp-bg font-extrabold shadow-md shadow-erp-gold/20">
                  Crear primer producto
                </Button>
              )}
            </div>
          ) : (
            <>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-erp-border bg-slate-50/50 dark:bg-erp-surface/40 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    <th className="p-4 pl-4 text-center w-10">
                      <input
                        type="checkbox"
                        checked={filteredProducts.length > 0 && selectedProductIds.length === filteredProducts.length}
                        onChange={toggleSelectAll}
                        className="rounded border-erp-border bg-erp-bg text-erp-gold focus:ring-erp-gold cursor-pointer"
                        title="Seleccionar todos para el catálogo"
                      />
                    </th>
                    <th className="p-4">SKU</th>
                    <th className="p-4">Tipo</th>
                    <th className="p-4">Producto</th>
                    <th className="p-4">Stock</th>
                    {role === 'admin' && (
                      <th className="p-4 text-erp-gold">Costo (ARS)</th>
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
                  {paginatedProducts.map((product) => (
                    <ProductTableRow
                      key={product.id}
                      product={product}
                      isSelected={selectedProductIdsSet.has(product.id)}
                      role={role}
                      exchangeRate={exchangeRate}
                      personalPayoutRate={personalPayoutRate}
                      runway={runwayMap[product.id]}
                      onToggleSelect={toggleSelectProduct}
                      onToggleVisibility={handleToggleVisibility}
                      onFracClick={handleFracClick}
                      onEditClick={handleEditClick}
                      onDeleteClick={handleDelete}
                    />
                  ))}
                </tbody>
              </table>

              {/* CONTROLES DE PAGINACIÓN DE ALTO RENDIMIENTO */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3.5 border-t border-slate-200 dark:border-erp-border bg-slate-50/30 dark:bg-erp-surface/20 text-xs text-slate-600 dark:text-zinc-400">
                <div className="flex items-center gap-3">
                  <span>
                    Mostrando <strong className="text-slate-900 dark:text-white">{(currentPage - 1) * pageSize + 1}</strong> a <strong className="text-slate-900 dark:text-white">{Math.min(currentPage * pageSize, filteredProducts.length)}</strong> de <strong className="text-slate-900 dark:text-white">{filteredProducts.length}</strong> productos
                  </span>
                  <div className="flex items-center gap-1.5 ml-2">
                    <span className="text-[11px] text-zinc-500">Por página:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="bg-white dark:bg-erp-bg border border-slate-200 dark:border-erp-border rounded-md px-2 py-1 text-xs text-slate-900 dark:text-white font-mono cursor-pointer"
                    >
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                      <option value={200}>200</option>
                    </select>
                  </div>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage <= 1}
                      className="h-8 px-2.5 text-xs font-semibold cursor-pointer border-slate-200 dark:border-erp-border"
                    >
                      <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                      Anterior
                    </Button>
                    <span className="px-2 font-mono text-xs">
                      Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong>
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages}
                      className="h-8 px-2.5 text-xs font-semibold cursor-pointer border-slate-200 dark:border-erp-border"
                    >
                      Siguiente
                      <ChevronRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* MODAL DE FORMULARIO CRUD */}
      {isModalOpen && (
        <ProductFormModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={fetchProductsList}
          product={editingProduct}
          role={role}
        />
      )}

      {/* MODAL DE FRACCIONAMIENTO */}
      {isFracModalOpen && (
        <FractionateModal
          isOpen={isFracModalOpen}
          onClose={() => setIsFracModalOpen(false)}
          onSuccess={fetchProductsList}
          bottle={selectedBottle}
          role={role}
        />
      )}

      {/* MODAL DE GESTOR OLFATIVO */}
      {isOlfactoryModalOpen && (
        <OlfactoryCatalogModal
          isOpen={isOlfactoryModalOpen}
          onClose={() => setIsOlfactoryModalOpen(false)}
          onRefreshForm={fetchProductsList}
        />
      )}

      {/* MODAL DE GENERADOR DE CATÁLOGO */}
      {isCatalogModalOpen && (
        <CatalogGeneratorModal
          isOpen={isCatalogModalOpen}
          onClose={() => setIsCatalogModalOpen(false)}
          selectedProducts={selectedProductsObjects}
          exchangeRateUsd={exchangeRate || 1570}
        />
      )}

      {/* MODAL DE CONFIRMACIÓN DE ELIMINACIÓN */}
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
