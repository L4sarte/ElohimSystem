export type UserRole = 'admin' | 'seller';

export interface Profile {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
}

export interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  preferred_notes?: string[];
  points_balance?: number;
  created_at: string;
}

export type ProductType = 'bottle' | 'decant_liquid' | 'supply';

export interface Product {
  id: string;
  sku: string;
  name: string;
  brand: string;
  type: ProductType;
  batch_code?: string;
  olfactory_family?: string;
  olfactory_notes?: string[];
  is_public?: boolean;
  min_stock_alert?: number;
  base_cost_ars: number;      // Costo de adquisición (ARS) - Solo visible por Admin
  base_price_ars: number;     // Precio de venta base (ARS)
  stock_quantity: number;     // Cantidad de stock (unidades para bottle/supply, ml para decant_liquid)
  volume_ml?: number;         // Capacidad en ml (opcional para botellas)
  created_at: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  quantity: number;
  unit_price_ars: number;
  subtotal_ars: number;
  product?: Partial<Product>;
}

export interface Sale {
  id: string;
  seller_id: string;
  client_name?: string;
  client_phone?: string;
  total_ars: number;
  payment_method_mix: {
    cash_ars?: number;
    transfer_ars?: number;
    cash_usd?: number;
    exchange_rate_usd?: number; // Cotización informativa utilizada
  };
  change_ars?: number;
  change_usd?: number;
  created_at: string;
}

export interface DecantAssemblyItem {
  decant_liquid_id: string;
  ml_quantity: number;
  supply_id: string;
}
