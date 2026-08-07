-- ==============================================================================
-- SISTEMA DE RECETAS (BOM - BILL OF MATERIALS) PARA COSTEO DINÁMICO DE DECANTS
-- Elohim Import ERP
-- ==============================================================================

-- 1. Tabla de Recetas de Productos (Encabezado)
CREATE TABLE IF NOT EXISTS public.product_recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    notes TEXT,
    auto_update_cost BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_product_recipe UNIQUE(product_id)
);

-- 2. Tabla de Ítems / Insumos de la Receta (Detalle BOM)
CREATE TABLE IF NOT EXISTS public.recipe_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID NOT NULL REFERENCES public.product_recipes(id) ON DELETE CASCADE,
    ingredient_product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    component_type VARCHAR(50) NOT NULL CHECK (component_type IN ('liquid', 'bottle_frasco', 'label', 'atomizer', 'packaging', 'other')),
    quantity NUMERIC(10, 2) NOT NULL DEFAULT 1.00,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Índices de Rendimiento
CREATE INDEX IF NOT EXISTS idx_product_recipes_product_id ON public.product_recipes(product_id);
CREATE INDEX IF NOT EXISTS idx_recipe_items_recipe_id ON public.recipe_items(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_items_ingredient_id ON public.recipe_items(ingredient_product_id);

-- 4. Trigger para actualizar el campo updated_at en product_recipes
CREATE OR REPLACE FUNCTION update_product_recipes_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_product_recipes_timestamp ON public.product_recipes;
CREATE TRIGGER trigger_update_product_recipes_timestamp
    BEFORE UPDATE ON public.product_recipes
    FOR EACH ROW
    EXECUTE FUNCTION update_product_recipes_timestamp();

-- 5. Políticas RLS (Row Level Security)
ALTER TABLE public.product_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_items ENABLE ROW LEVEL SECURITY;

-- Política de lectura para usuarios autenticados
CREATE POLICY "Permitir lectura de recetas a usuarios autenticados"
    ON public.product_recipes FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Permitir lectura de ítems de recetas a usuarios autenticados"
    ON public.recipe_items FOR SELECT
    USING (auth.role() = 'authenticated');

-- Política de escritura total para Service Role y Admins
CREATE POLICY "Permitir gestión total de recetas al servicio y admin"
    ON public.product_recipes FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Permitir gestión total de ítems de recetas al servicio y admin"
    ON public.recipe_items FOR ALL
    USING (true)
    WITH CHECK (true);
