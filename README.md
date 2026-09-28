# 🏋️‍♂️ Fit.IA - Documentação da API & Guia de Integração

Backend e especificação de rotas para a plataforma **Fit.IA**, incluindo esquemas de banco de dados, CORS configurado e exemplos de consumo via front-end.

---

## 🗄️ 1. Script SQL para o Banco de Dados (Supabase / PostgreSQL)

O arquivo [`schema.sql`](file:///c:/Users/26012427/Documents/GitHub/Fit.IA/schema.sql) contém a criação das tabelas necessárias:

```sql
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
    workout_json JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabela de Eventos de Calendário (calendar_events)
CREATE TABLE IF NOT EXISTS calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workout_plan_id UUID REFERENCES workout_plans(id) ON DELETE SET NULL,
    workout_snapshot JSONB,
    scheduled_date DATE NOT NULL,          -- Formato YYYY-MM-DD
    status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'completed', 'skipped'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_calendar_user_date ON calendar_events (user_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_workout_plans_user ON workout_plans (user_id);
```

---

## 🚀 2. Endpoints da API

Todas as rotas suportam **CORS liberado** (`Access-Control-Allow-Origin: *`) para consumo no GitHub Pages, Vercel ou localmente.

### 2.1. `POST /api/register`
**Body (JSON):**
```json
{
  "nome": "João Silva",
  "email": "joao@email.com",
  "senha": "senhaSegura123",
  "nivel": "Intermediário",
  "objetivo": "Ganho de massa"
}
```
**Resposta (201 Created):**
```json
{
  "success": true,
  "message": "Usuário cadastrado com sucesso!",
  "token": "token_dXNy...",
  "user": {
    "id": "usr_1727542400_abc123",
    "name": "João Silva",
    "email": "joao@email.com",
    "level": "Intermediário",
    "goal": "Ganho de massa"
  }
}
```

---

### 2.2. `POST /api/generate-workout`
**Body (JSON):**
```json
{
  "modalidade": "Academia/Musculação",
  "foco": "Ganho de massa",
  "nivel": "Intermediário",
  "dias_por_semana": 4,
  "observacoes": "Leve desconforto no ombro direito, evitar supino inclinado com barra."
}
```
**Resposta (200 OK):**
```json
{
  "success": true,
  "workout": {
    "nome_treino": "Hipertrofia Otimizada - Upper/Lower",
    "resumo": "Periodização focada em ganho de massa com proteção articular para ombro.",
    "duracao_estimada": "55 minutos",
    "dias": [
      {
        "dia": "Dia 1 - Superior (Ênfase Peito e Costas)",
        "foco_dia": "Hipertrofia Superior",
        "exercicios": [
          {
            "nome": "Supino com Halteres (pegada neutra)",
            "series": 4,
            "repeticoes_ou_tempo": "10-12",
            "descanso_segundos": 60,
            "instrucoes_execucao": "Manter escápulas aduzidas e cotovelos alinhados a 45 graus."
          },
          {
            "nome": "Puxada Alta Pronada",
            "series": 4,
            "repeticoes_ou_tempo": "10-12",
            "descanso_segundos": 60,
            "instrucoes_execucao": "Puxar a barra até a altura do queixo contraindo as dorsais."
          }
        ]
      }
    ]
  }
}
```

---

### 2.3. `POST /api/schedule-workout`
**Body (JSON):**
```json
{
  "user_id": "usr_1727542400_abc123",
  "data_agendada": "2026-10-01",
  "treino_id_ou_json": {
    "titulo": "Treino A - Peito e Tríceps",
    "duracao": "50m"
  },
  "status": "pendente"
}
```

---

### 2.4. `GET /api/user-workouts`
**Query Params:**
- `user_id`: ID do usuário.
- `mes_ano`: (Opcional, ex: `2026-10`).

**Exemplo de chamada:** `GET /api/user-workouts?user_id=usr_123&mes_ano=2026-10`

---

## 💻 3. Exemplo de Chamada `fetch()` no Front-End

```javascript
async function gerarTreinoFitIA() {
  const payload = {
    modalidade: "Academia/Musculação",
    foco: "Ganho de massa",
    nivel: "Intermediário",
    dias_por_semana: 4,
    observacoes: "Sem dores articulares, preferência por halteres e polias."
  };

  try {
    const response = await fetch("https://sua-api.com/api/generate-workout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Erro na requisição: ${response.status}`);
    }

    const data = await response.json();
    console.log("Treino gerado com sucesso:", data.workout);
    return data.workout;
  } catch (error) {
    console.error("Falha ao comunicar com Fit.IA API:", error);
  }
}
```
