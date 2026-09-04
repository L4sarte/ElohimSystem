-- ==============================================================================
-- MIGRACIÓN: MOVIMIENTOS DE TESORERÍA Y PAGOS A PROVEEDORES B2B
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.treasury_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.treasury_accounts(id) ON DELETE RESTRICT,
    type TEXT NOT NULL,
    amount_ars NUMERIC(15, 2) NOT NULL CHECK (amount_ars > 0),
    description TEXT,
    reference_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_treasury_movements_account ON public.treasury_movements(account_id);
CREATE INDEX IF NOT EXISTS idx_treasury_movements_type ON public.treasury_movements(type);
CREATE INDEX IF NOT EXISTS idx_treasury_movements_created ON public.treasury_movements(created_at DESC);

ALTER TABLE public.treasury_movements ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Permitir acceso a service role en treasury_movements"
        ON public.treasury_movements
        FOR ALL
        USING (true)
        WITH CHECK (true);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
