-- ==============================================================================
-- MIGRACIÓN SUPABASE / POSTGRESQL (v3 FINAL): system_settings — RLS + RPC
-- Elohim Import ERP
-- ------------------------------------------------------------------------------
-- ESTADO VERIFICADO EN LA BASE VIVA (31/10/2026, vía introspección REST):
--   * Tabla system_settings: 24 columnas, coincide con el repo. Datos intactos.
--   * Existe UNA función save_system_settings_atomic con firma (jsonb) —
--     distinta a la que invoca la app (22 parámetros individuales) → la app
--     siempre cae al fallback de update directo (funciona, con ruido).
--   * El RLS del resto de tablas está OK: con la anon key, tesorería, clientes,
--     ventas, gastos, perfiles y logs devuelven 0 filas (bien blindado).
--   * system_settings es legible por anon (intencional: la tienda muestra CBU),
--     pero su UPDATE/INSERT quedó abierto a anon por la migración 20261021.
--
-- ESTA MIGRACIÓN (idempotente, no toca datos, re-ejecutable):
--   1. Restringe UPDATE/INSERT de system_settings a authenticated+service_role.
--   2. Crea la RPC canónica de 22 parámetros (la que la app invoca) como
--      sobrecarga NUEVA — no reemplaza ni borra la versión jsonb existente.
--   3. Bloquea la ejecución de TODAS las sobrecargas (jsonb y canónica) a
--      service_role únicamente, vía catálogo (independiente de la firma).
-- ==============================================================================

-- ---------------------------------------------------------------------------
-- 1. POLÍTICAS RLS
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "system_settings_update_policy" ON public.system_settings;

CREATE POLICY "system_settings_update_policy"
ON public.system_settings
FOR UPDATE
TO authenticated, service_role
USING (true)
WITH CHECK (true);

-- INSERT público ya no es necesario: el upsert lo hace service_role.
DROP POLICY IF EXISTS "system_settings_insert_policy" ON public.system_settings;

-- SELECT público se mantiene (tienda pública / POS muestran contacto y CBU).
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'system_settings'
          AND policyname = 'system_settings_select_policy'
    ) THEN
        CREATE POLICY "system_settings_select_policy"
        ON public.system_settings
        FOR SELECT
        TO public
        USING (true);
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. RPC CANÓNICA (22 parámetros) — la firma que invoca la app.
--    CREATE OR REPLACE con firma distinta = crea una SOBRECARGA nueva.
--    No altera la versión (jsonb) existente ni sus permisos (eso hace el paso 3).
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 3. BLINDAJE DE EJECUCIÓN: TODAS las sobrecargas de save_system_settings_atomic
--    (la jsonb preexistente Y la canónica recién creada) quedan ejecutables
--    SOLO por service_role. Se localizan por nombre vía catálogo, por lo que
--    funciona sin importar la firma.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT p.oid::regprocedure::text AS func_identity
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname = 'save_system_settings_atomic'
    LOOP
        -- %s (no %I): regprocedure::text ya emite una referencia parseable
        EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', r.func_identity);
        EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', r.func_identity);
        EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', r.func_identity);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.func_identity);
    END LOOP;
END $$;

-- ==============================================================================
-- VERIFICACIÓN (ejecutar por separado, después de la migración):
--
--   -- 1) Políticas esperadas:
--   SELECT policyname, cmd, roles FROM pg_policies WHERE tablename = 'system_settings';
--   => select_policy: SELECT / {public}
--   => update_policy: UPDATE / {authenticated, service_role}
--
--   -- 2) Sobrecargas y permisos esperados:
--   SELECT pg_get_function_identity_arguments(oid) AS firma, proacl
--   FROM pg_proc
--   WHERE pronamespace = 'public'::regnamespace AND proname = 'save_system_settings_atomic';
--   => dos filas: (jsonb) y (text, text, ..., numeric), ambas proacl {service_role=X}
--
--   -- 3) Prueba E2E: Configuración → editar → Guardar
--      => ahora usa la RPC atómica (sin fallback) y el action verifica la
--         escritura con read-back antes de mostrar "guardado exitosamente".
--
-- REVERSIÓN:
--   DROP POLICY "system_settings_update_policy" ON public.system_settings;
--   CREATE POLICY "system_settings_update_policy" ON public.system_settings
--     FOR UPDATE TO public USING (true) WITH CHECK (true);
--   -- (la RPC canónica puede quedarse; solo re-otorgar EXECUTE si hiciera falta)
-- ==============================================================================