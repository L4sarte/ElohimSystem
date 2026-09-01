'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import Decimal from 'decimal.js';

export interface CartItem {
  id: string; // Composite unique key: productId + format
  productId: string;
  name: string;
  brand: string;
  format: string; // e.g. "Botella 100ml", "Decant 5ml", "Decant 10ml"
  priceArs: number;
  quantity: number;
  maxStock: number;
  image?: string;
  sku?: string;
}

interface CartState {
  items: CartItem[];
  isDrawerOpen: boolean;
  
  // Acciones
  addItem: (item: Omit<CartItem, 'id'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;

  // Calculados
  getTotalItems: () => number;
  getSubtotalArs: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isDrawerOpen: false,

      addItem: (newItem) => {
        const id = `${newItem.productId}-${newItem.format}`;
        const currentItems = get().items;
        const existingIndex = currentItems.findIndex((i) => i.id === id);

        if (existingIndex > -1) {
          const existing = currentItems[existingIndex];
          const newQty = Math.min(existing.quantity + newItem.quantity, newItem.maxStock);
          const updatedItems = [...currentItems];
          updatedItems[existingIndex] = {
            ...existing,
            quantity: newQty,
          };
          set({ items: updatedItems, isDrawerOpen: true });
        } else {
          const initialQty = Math.min(newItem.quantity, newItem.maxStock || 1);
          set({
            items: [...currentItems, { ...newItem, id, quantity: initialQty }],
            isDrawerOpen: true,
          });
        }
      },

      removeItem: (id) => {
        set({ items: get().items.filter((i) => i.id !== id) });
      },

      updateQuantity: (id, quantity) => {
        if (quantity <= 0) {
          get().removeItem(id);
          return;
        }

        set({
          items: get().items.map((item) => {
            if (item.id === id) {
              const safeQty = Math.min(quantity, item.maxStock || 999);
              return { ...item, quantity: safeQty };
            }
            return item;
          }),
        });
      },

      clearCart: () => {
        set({ items: [] });
      },

      openDrawer: () => set({ isDrawerOpen: true }),
      closeDrawer: () => set({ isDrawerOpen: false }),
      toggleDrawer: () => set((state) => ({ isDrawerOpen: !state.isDrawerOpen })),

      getTotalItems: () => {
        return get().items.reduce((total, item) => total + item.quantity, 0);
      },

      getSubtotalArs: () => {
        const total = get().items.reduce((acc, item) => {
          const itemTotal = new Decimal(item.priceArs || 0).times(item.quantity || 1);
          return acc.plus(itemTotal);
        }, new Decimal(0));
        return total.toNumber();
      },
    }),
    {
      name: 'elohim_storefront_cart',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }),
    }
  )
);
