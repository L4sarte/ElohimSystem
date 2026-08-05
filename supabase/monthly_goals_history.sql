-- ==============================================================================
-- HISTORIAL DE METAS MENSUALES (monthly_goals)
-- Elohim Import ERP - Supabase PostgreSQL Schema & RLS Policies
-- ==============================================================================

-- 1. Crear tabla monthly_goals
CREATE TABLE IF NOT EXISTS public.monthly_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    year INTEGER NOT NULL CHECK (year >= 2020),
    period_month VARCHAR(7) UNIQUE NOT NULL, -- Formato "YYYY-MM" (ej: "2026-08")
    revenue_goal_ars NUMERIC(15, 2) NOT NULL DEFAULT 5000000,
    net_profit_goal_ars NUMERIC(15, 2) NOT NULL DEFAULT 2000000,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_month_year UNIQUE (month, year)
);

-- Comentarios explicativos
COMMENT ON TABLE public.monthly_goals IS 'Historial de metas financieras mensuales por año y mes';
COMMENT ON COLUMN public.monthly_goals.month IS 'Número de mes (1 = Enero, 12 = Diciembre)';
COMMENT ON COLUMN public.monthly_goals.period_month IS 'Clave formato YYYY-MM para búsquedas indexadas';

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.monthly_goals ENABLE ROW LEVEL SECURITY;

-- 2. Políticas RLS
DROP POLICY IF EXISTS "Permitir lectura de metas a usuarios autenticados" ON public.monthly_goals;
CREATE POLICY "Permitir lectura de metas a usuarios autenticados"
    ON public.monthly_goals FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Permitir escritura de metas solo a administradores" ON public.monthly_goals;
CREATE POLICY "Permitir escritura de metas solo a administradores"
    ON public.monthly_goals FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );
