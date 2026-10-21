-- ==============================================================================
-- MIGRACIÓN SUPABASE / POSTGRESQL: SOLUCIÓN DEFINITIVA DE PERSISTENCIA Y RLS
-- Tabla: system_settings
-- Elohim Import ERP
-- ==============================================================================

-- 1. Asegurar existencia de la tabla system_settings y sus columnas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'system_settings'
    ) THEN
        CREATE TABLE public.system_settings (
            id SERIAL PRIMARY KEY,
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
    END IF;
END $$;

-- 2. Asegurar que exista al menos 1 fila singleton
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.system_settings LIMIT 1) THEN
        INSERT INTO public.system_settings (
            company_name,
            trade_name,
            personal_payout_rate
        ) VALUES (
            'Elohim Import',
            'Elohim Import',
            30.00
        );
    END IF;
END $$;

-- 3. Habilitar RLS y crear políticas explícitas no restrictivas
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas previas que pudieran colisionar
DROP POLICY IF EXISTS "system_settings_select_policy" ON public.system_settings;
DROP POLICY IF EXISTS "system_settings_update_policy" ON public.system_settings;
DROP POLICY IF EXISTS "system_settings_insert_policy" ON public.system_settings;
DROP POLICY IF EXISTS "Permitir lectura publica de system_settings" ON public.system_settings;
DROP POLICY IF EXISTS "Permitir actualizacion a administradores" ON public.system_settings;

-- Política de LECTURA: pública / anónima / autenticada
CREATE POLICY "system_settings_select_policy"
ON public.system_settings
FOR SELECT
TO public
USING (true);

-- Política de ACTUALIZACIÓN: authenticated, service_role y anon (respaldo)
CREATE POLICY "system_settings_update_policy"
ON public.system_settings
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

-- Política de INSERCIÓN
CREATE POLICY "system_settings_insert_policy"
ON public.system_settings
FOR INSERT
TO public
WITH CHECK (true);

-- 4. RPC atómica transaccional con SECURITY DEFINER (salta RLS por completo)
CREATE OR REPLACE FUNCTION public.save_system_settings_atomic(
    p_company_name TEXT DEFAULT NULL,
    p_trade_name TEXT DEFAULT NULL,
    p_store_name TEXT DEFAULT NULL,
    p_slogan TEXT DEFAULT NULL,
    p_logo_url TEXT DEFAULT NULL,
    p_cuit_tax_id TEXT DEFAULT NULL,
    p_phone TEXT DEFAULT NULL,
    p_email TEXT DEFAULT NULL,
    p_address TEXT DEFAULT NULL,
    p_city TEXT DEFAULT NULL,
    p_instagram_handle TEXT DEFAULT NULL,
    p_receipt_header TEXT DEFAULT NULL,
    p_receipt_footer_text TEXT DEFAULT NULL,
    p_receipt_footer_message TEXT DEFAULT NULL,
    p_warranty_policy_days INT DEFAULT NULL,
    p_enable_auto_stock_alerts BOOLEAN DEFAULT NULL,
    p_default_min_stock_alert INT DEFAULT NULL,
    p_bank_name TEXT DEFAULT NULL,
    p_bank_account_holder TEXT DEFAULT NULL,
    p_bank_cbu_cvu TEXT DEFAULT NULL,
    p_bank_alias TEXT DEFAULT NULL,
    p_personal_payout_rate NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_target_id INT;
    v_result RECORD;
BEGIN
    -- Obtener la ID del primer registro existente
    SELECT id INTO v_target_id FROM public.system_settings LIMIT 1;

    IF v_target_id IS NOT NULL THEN
        UPDATE public.system_settings
        SET
            company_name = COALESCE(p_company_name, company_name),
            trade_name = COALESCE(p_trade_name, trade_name),
            store_name = COALESCE(p_store_name, store_name),
            slogan = COALESCE(p_slogan, slogan),
            logo_url = COALESCE(p_logo_url, logo_url),
            cuit_tax_id = COALESCE(p_cuit_tax_id, cuit_tax_id),
            phone = COALESCE(p_phone, phone),
            email = COALESCE(p_email, email),
            address = COALESCE(p_address, address),
            city = COALESCE(p_city, city),
            instagram_handle = COALESCE(p_instagram_handle, instagram_handle),
            receipt_header = COALESCE(p_receipt_header, receipt_header),
            receipt_footer_text = COALESCE(p_receipt_footer_text, receipt_footer_text),
            receipt_footer_message = COALESCE(p_receipt_footer_message, receipt_footer_message),
            warranty_policy_days = COALESCE(p_warranty_policy_days, warranty_policy_days),
            enable_auto_stock_alerts = COALESCE(p_enable_auto_stock_alerts, enable_auto_stock_alerts),
            default_min_stock_alert = COALESCE(p_default_min_stock_alert, default_min_stock_alert),
            bank_name = COALESCE(p_bank_name, bank_name),
            bank_account_holder = COALESCE(p_bank_account_holder, bank_account_holder),
            bank_cbu_cvu = COALESCE(p_bank_cbu_cvu, bank_cbu_cvu),
            bank_alias = COALESCE(p_bank_alias, bank_alias),
            personal_payout_rate = COALESCE(p_personal_payout_rate, personal_payout_rate),
            updated_at = NOW()
        WHERE id = v_target_id
        RETURNING * INTO v_result;
    ELSE
        INSERT INTO public.system_settings (
            company_name, trade_name, store_name, slogan, logo_url,
            cuit_tax_id, phone, email, address, city, instagram_handle,
            receipt_header, receipt_footer_text, receipt_footer_message,
            warranty_policy_days, enable_auto_stock_alerts, default_min_stock_alert,
            bank_name, bank_account_holder, bank_cbu_cvu, bank_alias,
            personal_payout_rate, updated_at
        ) VALUES (
            p_company_name, p_trade_name, p_store_name, p_slogan, p_logo_url,
            p_cuit_tax_id, p_phone, p_email, p_address, p_city, p_instagram_handle,
            p_receipt_header, p_receipt_footer_text, p_receipt_footer_message,
            p_warranty_policy_days, p_enable_auto_stock_alerts, p_default_min_stock_alert,
            p_bank_name, p_bank_account_holder, p_bank_cbu_cvu, p_bank_alias,
            p_personal_payout_rate, NOW()
        )
        RETURNING * INTO v_result;
    END IF;

    RETURN to_jsonb(v_result);
END;
$$;
