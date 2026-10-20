-- ==============================================================================
-- MIGRACIÓN SUPABASE / POSTGRESQL: DIVISIÓN DE UTILIDADES Y RETIROS PERSONALES
-- Elohim Import ERP
-- ==============================================================================

-- 1. Asegurar o actualizar columna de configuración global en system_settings
DO $$
BEGIN
    -- Crear tabla system_settings si no existiera previamente
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'system_settings'
    ) THEN
        CREATE TABLE public.system_settings (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            company_name TEXT DEFAULT 'Elohim Import S.R.L.',
            trade_name TEXT DEFAULT 'Elohim Perfumería & Decants',
            store_name TEXT DEFAULT 'Elohim Perfumería & Decants',
            slogan TEXT DEFAULT 'Alta Perfumería de Nicho & Decants Fraccionados',
            logo_url TEXT DEFAULT '/logo-elohim.png',
            cuit_tax_id TEXT DEFAULT '30-71829384-9',
            phone TEXT DEFAULT '+54 9 11 5555-0199',
            email TEXT DEFAULT 'contacto@elohimimport.com',
            address TEXT DEFAULT 'Av. Santa Fe 1234, Local 12',
            city TEXT DEFAULT 'CABA, Buenos Aires',
            instagram_handle TEXT DEFAULT '@elohim.perfumes',
            receipt_header TEXT DEFAULT 'DOCUMENTO NO VÁLIDO COMO FACTURA',
            receipt_footer_text TEXT DEFAULT '¡Gracias por elegir Elohim Perfumería! Conserva este ticket para cambios.',
            receipt_footer_message TEXT DEFAULT '¡Gracias por elegir Elohim Perfumería! Conserva este ticket para cambios.',
            warranty_policy_days INT DEFAULT 30,
            enable_auto_stock_alerts BOOLEAN DEFAULT TRUE,
            default_min_stock_alert INT DEFAULT 3,
            bank_name TEXT DEFAULT 'Banco Galicia / Mercado Pago',
            bank_account_holder TEXT DEFAULT 'Elohim Import S.R.L.',
            bank_cbu_cvu TEXT DEFAULT '0070123400000012345678',
            bank_alias TEXT DEFAULT 'ELOHIM.PERFUMES.ARS',
            personal_payout_rate NUMERIC(5,2) DEFAULT 30.00 CHECK (personal_payout_rate >= 0 AND personal_payout_rate <= 100),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        INSERT INTO public.system_settings (id, personal_payout_rate)
        VALUES (gen_random_uuid(), 30.00);
    ELSE
        -- Agregar la columna personal_payout_rate si ya existe la tabla system_settings
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'system_settings' AND column_name = 'personal_payout_rate'
        ) THEN
            ALTER TABLE public.system_settings 
            ADD COLUMN personal_payout_rate NUMERIC(5,2) DEFAULT 30.00 CHECK (personal_payout_rate >= 0 AND personal_payout_rate <= 100);
        END IF;
    END IF;
END $$;

-- 2. Crear tabla de auditoría para extracciones personales (owner_draws)
-- Compatible con treasury_accounts (o accounts como fallback)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'treasury_accounts'
    ) THEN
        CREATE TABLE IF NOT EXISTS public.owner_draws (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            amount_ars NUMERIC(12,2) NOT NULL CHECK (amount_ars > 0),
            amount_usd NUMERIC(10,2),
            exchange_rate_used NUMERIC(10,2),
            account_source_id UUID REFERENCES public.treasury_accounts(id) ON DELETE RESTRICT,
            notes TEXT
        );
    ELSIF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'accounts'
    ) THEN
        CREATE TABLE IF NOT EXISTS public.owner_draws (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            amount_ars NUMERIC(12,2) NOT NULL CHECK (amount_ars > 0),
            amount_usd NUMERIC(10,2),
            exchange_rate_used NUMERIC(10,2),
            account_source_id UUID REFERENCES public.accounts(id) ON DELETE RESTRICT,
            notes TEXT
        );
    ELSE
        CREATE TABLE IF NOT EXISTS public.owner_draws (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            amount_ars NUMERIC(12,2) NOT NULL CHECK (amount_ars > 0),
            amount_usd NUMERIC(10,2),
            exchange_rate_used NUMERIC(10,2),
            account_source_id UUID,
            notes TEXT
        );
    END IF;
END $$;

-- 3. Índices de auditoría y performance
CREATE INDEX IF NOT EXISTS idx_owner_draws_created_at ON public.owner_draws(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_owner_draws_account_source ON public.owner_draws(account_source_id);

-- 4. Seguridad RLS
ALTER TABLE public.owner_draws ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Permitir lectura y registro de retiros a usuarios autenticados" ON public.owner_draws;
    CREATE POLICY "Permitir lectura y registro de retiros a usuarios autenticados" 
    ON public.owner_draws
    FOR ALL 
    TO authenticated
    USING (true)
    WITH CHECK (true);
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;

-- 5. RPC transaccional atómica: Registro de Retiro Personal con impacto en Tesorería sin tocar OPEX
CREATE OR REPLACE FUNCTION public.register_owner_draw(
    p_amount_ars NUMERIC(12,2),
    p_account_source_id UUID,
    p_amount_usd NUMERIC(10,2) DEFAULT NULL,
    p_exchange_rate_used NUMERIC(10,2) DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_draw_id UUID;
    v_acc_name TEXT;
    v_current_bal NUMERIC;
    v_new_bal NUMERIC;
BEGIN
    -- Validaciones básicas
    IF p_amount_ars IS NULL OR p_amount_ars <= 0 THEN
        RAISE EXCEPTION 'El monto del retiro debe ser mayor a cero.';
    END IF;

    IF p_account_source_id IS NULL THEN
        RAISE EXCEPTION 'Debe seleccionar una cuenta de tesorería de origen.';
    END IF;

    -- Bloqueo pesimista de fila en treasury_accounts para evitar inconsistencias concurrentes
    SELECT account_name, balance_ars 
    INTO v_acc_name, v_current_bal
    FROM public.treasury_accounts
    WHERE id = p_account_source_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La cuenta de tesorería seleccionada no existe.';
    END IF;

    IF v_current_bal < p_amount_ars THEN
        RAISE EXCEPTION 'Saldo insuficiente en "%". Disponible: $%, Monto Solicitado: $%', 
            v_acc_name, v_current_bal, p_amount_ars;
    END IF;

    -- 1. Insertar registro en owner_draws
    INSERT INTO public.owner_draws (
        amount_ars,
        amount_usd,
        exchange_rate_used,
        account_source_id,
        notes
    ) VALUES (
        p_amount_ars,
        p_amount_usd,
        p_exchange_rate_used,
        p_account_source_id,
        p_notes
    ) RETURNING id INTO v_draw_id;

    -- 2. Descontar saldo de la cuenta de tesorería
    v_new_bal := v_current_bal - p_amount_ars;
    UPDATE public.treasury_accounts
    SET balance_ars = v_new_bal
    WHERE id = p_account_source_id;

    -- 3. Registrar el egreso en auditoría de tesorería (NO OPEX, NO expenses)
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'treasury_movements'
    ) THEN
        INSERT INTO public.treasury_movements (
            account_id,
            type,
            amount,
            amount_ars,
            description,
            reference_id
        ) VALUES (
            p_account_source_id,
            'out',
            p_amount_ars,
            p_amount_ars,
            CONCAT('Retiro Personal de Utilidades / Socio: ', COALESCE(p_notes, 'Sin notas adicionales')),
            v_draw_id
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'draw_id', v_draw_id,
        'amount_ars', p_amount_ars,
        'account_id', p_account_source_id,
        'account_name', v_acc_name,
        'new_balance_ars', v_new_bal
    );
END;
$$;
