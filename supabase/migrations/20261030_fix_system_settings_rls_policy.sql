-- ==============================================================================
-- MIGRACIÓN SUPABASE / POSTGRESQL: ENDURECIMIENTO DE RLS — system_settings
-- Elohim Import ERP
-- ------------------------------------------------------------------------------
-- OBJETIVO: Cerrar la superficie de ataque pública sobre la configuración global
-- (que incluye el CBU/CVU donde los clientes pagan por transferencia) sin tocar
-- NINGÚN dato existente. Solo se modifican políticas de acceso y permisos de RPC.
--
-- CONTEXTO:
--   La migración 20261021_fix_system_settings_rls_persistence.sql abrió
--   UPDATE/INSERT de system_settings a `TO public USING (true)` como "respaldo"
--   para resolver un bloqueo de persistencia. Eso dejó la tabla escribible por
--   el rol `anon` vía REST (PATCH /rest/v1/system_settings con la anon key del
--   bundle), y la RPC save_system_settings_atomic (SECURITY DEFINER) quedó
--   ejecutable por cualquier usuario (PostgreSQL otorga EXECUTE a PUBLIC por
--   defecto en toda función creada sin REVOKE explícito).
--
--   La vía legítima de escritura es exclusivamente el Server Action
--   `updateSystemSettings` (src/app/actions/systemSettings.ts), que:
--     1. Verifica admin server-side con requireAdmin().
--     2. Usa el cliente service_role (getServiceSupabase), que bypasea RLS.
--   Por lo tanto restringir RLS no rompe esa vía.
--
-- SEGURIDAD DE DATOS: esta migración NO ejecuta DELETE, TRUNCATE, DROP ni
-- altera columnas/valores. Es idempotente y reversible (ver notas al final).
-- ==============================================================================

-- 1. Reemplazar la política de UPDATE abierta a public por una restringida
DROP POLICY IF EXISTS "system_settings_update_policy" ON public.system_settings;

CREATE POLICY "system_settings_update_policy"
ON public.system_settings
FOR UPDATE
TO authenticated, service_role
USING (true)
WITH CHECK (true);

-- 2. La política de INSERT abierta a public ya no es necesaria: el upsert lo
--    resuelve la RPC (service_role) o el fallback del action (service_role).
DROP POLICY IF EXISTS "system_settings_insert_policy" ON public.system_settings;

-- 3. Mantener lectura pública (SELECT): la tienda pública y el POS necesitan
--    mostrar datos de contacto/CBU al cliente. La anon key NO puede escribir.
DO $$ BEGIN
    -- Asegurar que exista la política de lectura (idempotente si ya existe)
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

-- 4. La RPC SECURITY DEFINER debe ser invocable SOLO por service_role.
--    Sin este REVOKE, cualquier visitante podría ejecutarla por REST y
--    reescribir TODA la configuración global (saltándose RLS por completo).
REVOKE EXECUTE ON FUNCTION public.save_system_settings_atomic(
    TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
    TEXT, TEXT, TEXT, INT, BOOLEAN, INT, TEXT, TEXT, TEXT, TEXT, NUMERIC
) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.save_system_settings_atomic(
    TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
    TEXT, TEXT, TEXT, INT, BOOLEAN, INT, TEXT, TEXT, TEXT, TEXT, NUMERIC
) FROM anon;
REVOKE EXECUTE ON FUNCTION public.save_system_settings_atomic(
    TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
    TEXT, TEXT, TEXT, INT, BOOLEAN, INT, TEXT, TEXT, TEXT, TEXT, NUMERIC
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.save_system_settings_atomic(
    TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
    TEXT, TEXT, TEXT, INT, BOOLEAN, INT, TEXT, TEXT, TEXT, TEXT, NUMERIC
) TO service_role;

-- ==============================================================================
-- NOTAS DE VERIFICACIÓN POST-MIGRACIÓN (ejecutar en SQL Editor de Supabase):
--
--   -- Políticas resultantes esperadas:
--   SELECT policyname, cmd, roles, qual
--   FROM pg_policies WHERE tablename = 'system_settings';
--   => select_policy: SELECT / {public}
--   => update_policy: UPDATE / {authenticated, service_role}
--
--   -- Permisos de la RPC esperados:
--   SELECT proacl FROM pg_proc WHERE proname = 'save_system_settings_atomic';
--   => {service_role=X}
--
--   -- Smoke test de escritura por la vía legítima (desde la app):
--   -- Configuración -> editar -> Guardar => debe persistir y reflejarse.
--
-- REVERSIÓN (si fuera necesaria):
--   DROP POLICY "system_settings_update_policy" ON public.system_settings;
--   CREATE POLICY "system_settings_update_policy" ON public.system_settings
--     FOR UPDATE TO public USING (true) WITH CHECK (true);
--   GRANT EXECUTE ON FUNCTION public.save_system_settings_atomic(...)
--     TO anon, authenticated;
-- ==============================================================================