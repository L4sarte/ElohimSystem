'use client';

import React, { useState, useEffect } from 'react';
import { useUserStore } from '@/hooks/use-user-store';
import { useExchangeRate } from '@/hooks/use-exchange-rate';
import { getSupplies, deleteProduct } from '@/app/actions/products';
import { Product } from '@/types';
import { ProductFormModal } from '@/components/products/ProductFormModal';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RoleSelector } from '@/components/products/RoleSelector';
import { ExchangeRateWidget } from '@/components/rates/ExchangeRateWidget';
import { 
  Archive, Plus, Search, RefreshCw, AlertCircle, 
  ArrowLeft, Edit, Trash2, ShieldAlert, AlertTriangle, PackageX 
} from 'lucide-react';
import Link from 'next/link';

export default function InsumosPage() {
  const { role } = useUserStore();
  const { rate: exchangeRate, refresh: refreshRate } = useExchangeRate();

  const [supplies, setSupplies] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Estados para Modal de Formulario (Alta / Edición)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const fetchSuppliesData = async () => {
    setLoading(true);
    setError(null);
    const res = await getSupplies(role);
    if (res.success && res.data) {
      setSupplies(res.data);
    } else {
      setError(res.error || 'Error al cargar los insumos de packaging');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSuppliesData();
  }, [role]);

  const handleOpenForm = (product?: Product) => {
    setSelectedProduct(product || null);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (role !== 'admin') {
      alert('Solo los administradores pueden eliminar insumos.');
      return;
    }

    if (confirm(`¿Estás seguro de eliminar el insumo "${name}"?`)) {
      const res = await deleteProduct(role, id);
      if (res.success) {
        fetchSuppliesData();
      } else {
        alert(res.error || 'Error al eliminar el insumo.');
      }
    }
  };

  const filteredSupplies = supplies.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col min-h-screen bg-[#08130E] text-zinc-50 transition-colors duration-300">
      
      {/* NAVBAR */}
      <header className="sticky top-0 z-40 w-full border-b border-[#1B362A] bg-[#08130E]/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 max-w-6xl">
          <div className="flex items-center gap-4">
            <Link 
              href="/productos"
              className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              <ArrowLeft className="h-4.5 w-4.5" />
              <span>Inventario</span>
            </Link>
            <span className="text-zinc-800">|</span>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30">
                <Archive className="h-4.5 w-4.5" />
              </div>
              <span className="text-sm font-bold tracking-tight text-white uppercase font-serif">
                Gestión de Insumos & Packaging
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <RoleSelector />
            <ExchangeRateWidget role={role} onRateChange={refreshRate} />
          </div>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 container mx-auto px-4 py-8 sm:px-6 max-w-6xl">
        
        {/* Cabecera */}
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white font-serif flex items-center gap-2">
              Insumos y Envases de Ensamble JIT
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              Administra frascos vacíos, atomizadores y etiquetas consumidos automáticamente en el fraccionamiento de decants.
            </p>
          </div>

          {role === 'admin' && (
            <Button
              onClick={() => handleOpenForm()}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs cursor-pointer shadow-md shadow-amber-600/20"
            >
              <Plus className="mr-1.5 h-4 w-4" /> Nuevo Insumo
            </Button>
          )}
        </div>

        {/* BARRA DE BÚSQUEDA */}
        <div className="flex items-center gap-4 bg-[#13261E]/90 p-4 rounded-2xl border border-[#1B362A] shadow-xl mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
            <Input
              placeholder="Buscar por nombre de insumo o SKU..."
              className="pl-9 bg-[#08130E] border-[#1B362A] text-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={fetchSuppliesData}
            className="text-zinc-400 hover:text-white"
            title="Actualizar insumos"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-amber-500' : ''}`} />
          </Button>
        </div>

        {/* DATA TABLE DE INSUMOS */}
        <Card className="border border-[#1B362A] bg-[#13261E]/90 rounded-2xl shadow-xl">
          <CardContent className="p-0 overflow-x-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <RefreshCw className="h-8 w-8 animate-spin text-amber-500" />
                <span className="text-sm font-medium text-zinc-400">Cargando insumos...</span>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-20 text-rose-400 gap-2">
                <AlertCircle className="h-10 w-10" />
                <p className="text-sm font-semibold">{error}</p>
                <Button variant="outline" onClick={fetchSuppliesData} className="mt-2">Reintentar</Button>
              </div>
            ) : filteredSupplies.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
                <PackageX className="h-10 w-10 text-zinc-700" />
                <h3 className="font-bold text-white">Sin insumos cargados</h3>
                <p className="text-xs text-zinc-400 max-w-xs">No hay envases o recipientes registrados en el sistema.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#1B362A] bg-[#13261E]/40 text-xs font-bold uppercase tracking-wider text-zinc-400">
                    <th className="p-4 pl-6">Insumo / Envase</th>
                    <th className="p-4 font-mono">SKU</th>
                    <th className="p-4">Capacidad (ml)</th>
                    {role === 'admin' && <th className="p-4 text-[#D0A96B]">Costo Adquisición (ARS)</th>}
                    <th className="p-4">Stock Disponible</th>
                    <th className="p-4">Alerta Mínima</th>
                    <th className="p-4 pr-6 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80 text-sm">
                  {filteredSupplies.map((item) => {
                    const isLowStock = Number(item.stock_quantity || 0) <= Number(item.min_stock_alert ?? 5);
                    return (
                      <tr key={item.id} className="hover:bg-[#13261E]/50 transition-colors">
                        
                        {/* Nombre del Insumo */}
                        <td className="p-4 pl-6 font-bold text-white font-serif flex items-center gap-2">
                          <Archive className="h-4 w-4 text-amber-400 shrink-0" />
                          <span>{item.name}</span>
                        </td>

                        {/* SKU */}
                        <td className="p-4 font-mono text-xs text-zinc-400">
                          {item.sku}
                        </td>

                        {/* Capacidad (ml) */}
                        <td className="p-4 font-mono text-zinc-300">
                          {item.volume_ml ? `${item.volume_ml} ml` : 'N/A'}
                        </td>

                        {/* Costo Adquisición */}
                        {role === 'admin' && (
                          <td className="p-4 font-mono font-bold text-[#E5C158]">
                            ${Number(item.base_cost_ars || 0).toLocaleString('es-AR')}
                          </td>
                        )}

                        {/* Stock Disponible */}
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1.5 font-mono font-bold text-xs px-2.5 py-1 rounded-full border ${
                            isLowStock 
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/30 animate-pulse' 
                              : 'bg-zinc-800 text-zinc-200 border-[#1B362A]'
                          }`}>
                            {isLowStock && <AlertTriangle className="h-3 w-3" />}
                            {item.stock_quantity} unidades
                          </span>
                        </td>

                        {/* Alerta Mínima */}
                        <td className="p-4 font-mono text-xs text-zinc-400">
                          {item.min_stock_alert ?? 5} un.
                        </td>

                        {/* Acciones */}
                        <td className="p-4 pr-6 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {role === 'admin' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => handleOpenForm(item)}
                                  className="text-zinc-400 hover:text-white hover:bg-zinc-800"
                                  title="Editar insumo"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => handleDelete(item.id, item.name)}
                                  className="text-rose-400 hover:text-rose-300 hover:bg-rose-950/30"
                                  title="Eliminar insumo"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

      </main>

      {/* MODAL FORMULARIO DE INSUMO */}
      {isModalOpen && (
        <ProductFormModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={fetchSuppliesData}
          product={selectedProduct}
          initialType="supply"
        />
      )}

    </div>
  );
}
