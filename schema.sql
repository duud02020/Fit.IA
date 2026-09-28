-- ==============================================================================
-- Fit.IA - Database Schema (PostgreSQL / Supabase / SQLite compatible)
-- ==============================================================================

-- 1. Tabela de Usuários (users)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    level VARCHAR(50) DEFAULT 'Iniciante', -- 'Iniciante', 'Intermediário', 'Avançado'
    goal VARCHAR(100),                     -- 'Perda de gordura', 'Ganho de massa', etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabela de Planos de Treino (workout_plans)
CREATE TABLE IF NOT EXISTS workout_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    modality VARCHAR(100) NOT NULL,        -- 'Musculação', 'Calistenia', 'CrossFit', etc.
    goal VARCHAR(100) NOT NULL,
    level VARCHAR(50) NOT NULL,
    days_per_week INT DEFAULT 3,
    workout_json JSONB NOT NULL,           -- Estrutura JSON com o treino completo gerado pela IA
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabela de Eventos de Calendário / Treinos Agendados (calendar_events)
CREATE TABLE IF NOT EXISTS calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workout_plan_id UUID REFERENCES workout_plans(id) ON DELETE SET NULL,
    workout_snapshot JSONB,                -- Cópia ou JSON do treino do dia
    scheduled_date DATE NOT NULL,          -- Formato YYYY-MM-DD
    status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'completed', 'skipped'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices recomendados para performance
CREATE INDEX IF NOT EXISTS idx_calendar_user_date ON calendar_events (user_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_workout_plans_user ON workout_plans (user_id);
