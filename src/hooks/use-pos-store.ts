import { create } from 'zustand';
import { Product } from '@/types';

export interface CartItem {
  key: string;               // Identificador único del ítem en el carrito (ej. id o id-ml-supplyId)
  product: Product;
  quantity: number;          // Unidades del producto o del decant final armado
  decantMl?: number;         // Capacidad en ml para decants (opcional)
  selectedSupplyId?: string; // ID del frasco vacío usado para decants (opcional)
  selectedSupplyName?: string;
  selectedSupplyPrice?: number; // Precio unitario del frasco vacío en ARS
}

interface PosState {
  cart: CartItem[];
  addItem: (product: Product, decantMl?: number, supply?: { id: string; name: string; price: number }) => void;
  removeItem: (key: string) => void;
  updateQuantity: (key: string, quantity: number) => void;
  clearCart: () => void;
}

export const usePosStore = create<PosState>((set) => ({
  cart: [],

  addItem: (product, decantMl, supply) => set((state) => {
    // Generar la llave única para el carrito
    const key = product.type === 'decant_liquid' && decantMl && supply
      ? `${product.id}-${decantMl}-${supply.id}`
      : product.id;

    const existingIndex = state.cart.findIndex((item) => item.key === key);

    if (existingIndex > -1) {
      const updatedCart = [...state.cart];
      updatedCart[existingIndex] = {
        ...updatedCart[existingIndex],
        quantity: updatedCart[existingIndex].quantity + 1,
      };
      return { cart: updatedCart };
    }

    const newItem: CartItem = {
      key,
      product,
      quantity: 1,
      ...(product.type === 'decant_liquid' && decantMl && supply ? {
        decantMl,
        selectedSupplyId: supply.id,
        selectedSupplyName: supply.name,
        selectedSupplyPrice: supply.price,
      } : {}),
    };

    return { cart: [...state.cart, newItem] };
  }),

  removeItem: (key) => set((state) => ({
    cart: state.cart.filter((item) => item.key !== key),
  })),

  updateQuantity: (key, quantity) => set((state) => ({
    cart: state.cart.map((item) => 
      item.key === key ? { ...item, quantity: Math.max(1, quantity) } : item
    ),
  })),

  clearCart: () => set({ cart: [] }),
}));
