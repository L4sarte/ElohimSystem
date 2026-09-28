'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Package, Plus, Trash2 } from 'lucide-react';
import { PackagingSupplyOption, PackagingUsedItem } from './types';

interface PackagingSelectorProps {
  availableSupplies: PackagingSupplyOption[];
  selectedPackaging: PackagingUsedItem[];
  onSelectedPackagingChange: (items: PackagingUsedItem[]) => void;
}

/**
 * Sección de Insumos de Packaging Utilizados (opcional, colapsable):
 * selección de bolsas/cajas/frascos adicionales con control de cantidades.
 * El estado de apertura y el insumo en curso son internos; la selección se
 * propaga al orquestador vía onSelectedPackagingChange.
 */
export function PackagingSelector({
  availableSupplies,
  selectedPackaging,
  onSelectedPackagingChange,
}: PackagingSelectorProps) {
  const [isPackagingOpen, setIsPackagingOpen] = useState(false);
  const [selectedSupplyToAdd, setSelectedSupplyToAdd] = useState('');

  const handleAddPackagingItem = () => {
    if (!selectedSupplyToAdd) return;
    const supply = availableSupplies.find(s => s.id === selectedSupplyToAdd);
    if (!supply) return;

    const existingIndex = selectedPackaging.findIndex(p => p.packaging_id === supply.id);
    if (existingIndex >= 0) {
      const updated = [...selectedPackaging];
      updated[existingIndex] = {
        ...updated[existingIndex],
        quantity_used: updated[existingIndex].quantity_used + 1
      };
      onSelectedPackagingChange(updated);
    } else {
      onSelectedPackagingChange([
        ...selectedPackaging,
        {
          packaging_id: supply.id,
          name: supply.name,
          quantity_used: 1,
          available_stock: supply.stock_quantity || 0
        }
      ]);
    }
    setSelectedSupplyToAdd('');
  };

  const handleUpdatePackagingQty = (packaging_id: string, qty: number) => {
    if (qty <= 0) {
      handleRemovePackagingItem(packaging_id);
      return;
    }
    onSelectedPackagingChange(
      selectedPackaging.map(p => p.packaging_id === packaging_id ? { ...p, quantity_used: qty } : p)
    );
  };

  const handleRemovePackagingItem = (packaging_id: string) => {
    onSelectedPackagingChange(selectedPackaging.filter(p => p.packaging_id !== packaging_id));
  };

  return (
    <div className="border border-erp-border rounded-xl bg-erp-bg overflow-hidden transition-all pt-1">
      <button
        type="button"
        onClick={() => setIsPackagingOpen(!isPackagingOpen)}
        className="w-full flex items-center justify-between p-3 text-left hover:bg-erp-surface/50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-erp-gold" />
          <span className="text-xs font-bold text-white">📦 Insumos de Packaging Utilizados</span>
          <span className="text-[11px] text-zinc-400 font-mono">(Opcional)</span>
          {selectedPackaging.length > 0 && (
            <span className="ml-2 bg-erp-gold text-erp-bg px-2 py-0.5 rounded-full text-[11px] font-extrabold font-mono">
              {selectedPackaging.reduce((sum, item) => sum + item.quantity_used, 0)} insumos
            </span>
          )}
        </div>
        {isPackagingOpen ? (
          <ChevronUp className="h-4 w-4 text-zinc-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-zinc-400" />
        )}
      </button>

      {isPackagingOpen && (
        <div className="p-3 border-t border-erp-border bg-erp-surface/40 space-y-3">
          <div className="flex items-center gap-2">
            <select
              value={selectedSupplyToAdd}
              onChange={(e) => setSelectedSupplyToAdd(e.target.value)}
              className="flex-1 h-8 rounded-lg border border-erp-border bg-erp-bg px-2 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-erp-gold"
            >
              <option value="">-- Seleccionar Insumo (Bolsa, Cajas, Frascos) --</option>
              {availableSupplies.map(sup => (
                <option key={sup.id} value={sup.id}>
                  {sup.name} (Stock disp: {sup.stock_quantity || 0})
                </option>
              ))}
            </select>
            <Button
              type="button"
              size="sm"
              onClick={handleAddPackagingItem}
              disabled={!selectedSupplyToAdd}
              className="h-8 bg-erp-gold hover:bg-erp-gold-hover text-erp-bg font-bold text-xs px-3 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Agregar
            </Button>
          </div>

          {selectedPackaging.length > 0 ? (
            <div className="space-y-1.5 pt-1">
              {selectedPackaging.map(item => (
                <div key={item.packaging_id} className="flex items-center justify-between p-2 rounded-lg bg-erp-bg border border-erp-border text-xs">
                  <div className="flex flex-col">
                    <span className="font-bold text-zinc-200">{item.name}</span>
                    <span className="text-[11px] text-zinc-500 font-mono">Stock disponible: {item.available_stock}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center border border-erp-border rounded-md bg-erp-surface">
                      <button
                        type="button"
                        onClick={() => handleUpdatePackagingQty(item.packaging_id, item.quantity_used - 1)}
                        className="px-2 py-0.5 text-zinc-400 hover:text-white text-xs font-bold cursor-pointer"
                      >
                        -
                      </button>
                      <span className="px-2 font-mono font-bold text-white text-xs">{item.quantity_used}</span>
                      <button
                        type="button"
                        onClick={() => handleUpdatePackagingQty(item.packaging_id, item.quantity_used + 1)}
                        className="px-2 py-0.5 text-zinc-400 hover:text-white text-xs font-bold cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemovePackagingItem(item.packaging_id)}
                      className="text-rose-400 hover:text-rose-300 p-1 cursor-pointer"
                      title="Eliminar insumo"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-zinc-500 italic text-center py-1">
              No has añadido insumos de packaging adicionales a esta venta.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
