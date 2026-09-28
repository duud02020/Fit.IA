import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração de CORS aberto para acesso irrestrito do front-end (Vercel, GitHub Pages, etc.)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Inicialização da SDK Gemini
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

// Mock Storage / Simulação em memória caso não haja banco configurado
const db = {
  users: [],
  workout_plans: [],
  calendar_events: []
};

// ==============================================================================
// 1. POST /api/register - Cadastro de Usuário
// ==============================================================================
app.post('/api/register', async (req, res) => {
  try {
    const { nome, email, senha, nivel = 'Iniciante', objetivo = 'Saúde Geral' } = req.body;

    if (!nome || !email || !senha) {
      return res.status(400).json({
        success: false,
        error: 'Campos obrigatórios ausentes: nome, email e senha são necessários.'
      });
    }

    const existingUser = db.users.find(u => u.email === email);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'Usuário já cadastrado com este e-mail.'
      });
    }

    const newUser = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: nome,
      email,
      password_hash: `hash_${Buffer.from(senha).toString('base64')}`, // Em produção usar bcrypt
      level: nivel,
      goal: objetivo,
      created_at: new Date().toISOString()
    };

    db.users.push(newUser);

    const token = `token_${Buffer.from(`${newUser.id}:${Date.now()}`).toString('base64')}`;

    return res.status(201).json({
      success: true,
      message: 'Usuário cadastrado com sucesso!',
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        level: newUser.level,
        goal: newUser.goal
      }
    });
  } catch (error) {
    console.error('Erro em /api/register:', error);
    return res.status(500).json({ success: false, error: 'Erro interno ao cadastrar usuário.' });
  }
});

// ==============================================================================
// 2. POST /api/generate-workout - Geração de Treino com IA
// ==============================================================================
app.post('/api/generate-workout', async (req, res) => {
  try {
    const {
      modalidade = 'Academia/Musculação',
      foco = 'Ganho de massa',
      nivel = 'Intermediário',
      dias_por_semana = 4,
      observacoes = 'Nenhuma restrição informada.'
    } = req.body;

    const systemInstruction = 
      "Você é o Fit.IA, um Personal Trainer profissional e especialista em educação física. " +
      "Crie um treino detalhado, balanceado e estruturado em formato JSON rigoroso com os campos: " +
      "nome_treino, resumo, duracao_estimada, e uma lista de dias (cada dia com: dia_semana ou rotulo, foco_dia, e exercicios). " +
      "Cada exercicio deve conter: nome, series, repeticoes_ou_tempo, descanso_segundos, instrucoes_execucao.";

    const userPrompt = `
Gere uma periodização de treino com as seguintes especificações:
- Modalidade: ${modalidade}
- Foco do Treino: ${foco}
- Nível do Atleta: ${nivel}
- Frequência: ${dias_por_semana} dias por semana
- Observações/Restrições/Equipamentos: ${observacoes}

Responda APENAS com o objeto JSON estruturado solicitado, sem blocos de texto explicativos adicionais antes ou depois.`;

    let workoutData;

    if (genAI) {
      const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        generationConfig: { responseMimeType: 'application/json' },
        systemInstruction: systemInstruction
      });

      const result = await model.generateContent(userPrompt);
      const responseText = result.response.text();
      workoutData = JSON.parse(responseText);
    } else {
      // Fallback estruturado caso a chave de IA não esteja configurada no ambiente
      workoutData = {
        nome_treino: `Plano Fit.IA - ${modalidade} (${foco})`,
        resumo: `Treino personalizado de nível ${nivel} voltado para ${foco}, distribuído em ${dias_por_semana} dias semanais.`,
        duracao_estimada: "50-60 minutos por sessão",
        dias: Array.from({ length: Number(dias_por_semana) || 3 }).map((_, idx) => ({
          dia: `Dia ${idx + 1}`,
          foco_dia: `${foco} - Bloco ${String.fromCharCode(65 + idx)}`,
          exercicios: [
            {
              nome: idx === 0 ? "Agachamento Livre" : "Supino Reto / Flexões",
              series: 4,
              repeticoes_ou_tempo: "8 a 12 repetições",
              descanso_segundos: 60,
              instrucoes_execucao: "Manter a postura alinhada, core contraído e cadência controlada na fase excêntrica."
            },
            {
              nome: idx === 0 ? "Leg Press 45°" : "Puxada Frontal / Barra Fixa",
              series: 3,
              repeticoes_ou_tempo: "10 a 15 repetições",
              descanso_segundos: 45,
              instrucoes_execucao: "Amplitude completa com controle de movimento."
            },
            {
              nome: "Prancha Abdominal",
              series: 3,
              repeticoes_ou_tempo: "45 segundos",
              descanso_segundos: 30,
              instrucoes_execucao: "Abdômen e glúteos contraídos sem hiperlordose."
            }
          ]
        }))
      };
    }

    return res.status(200).json({
      success: true,
      workout: workoutData
    });
  } catch (error) {
    console.error('Erro em /api/generate-workout:', error);
    return res.status(500).json({
      success: false,
      error: 'Falha ao gerar treino com IA.',
      details: error.message
    });
  }
});

// ==============================================================================
// 3. POST /api/schedule-workout - Agendar Treino no Calendário
// ==============================================================================
app.post('/api/schedule-workout', (req, res) => {
  try {
    const { user_id, data_agendada, treino_id_ou_json, status = 'pendente' } = req.body;

    if (!user_id || !data_agendada || !treino_id_ou_json) {
      return res.status(400).json({
        success: false,
        error: 'Parâmetros obrigatórios: user_id, data_agendada e treino_id_ou_json.'
      });
    }

    const newEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      user_id,
      scheduled_date: data_agendada,
      workout_snapshot: treino_id_ou_json,
      status,
      created_at: new Date().toISOString()
    };

    db.calendar_events.push(newEvent);

    return res.status(201).json({
      success: true,
      message: 'Treino agendado no calendário com sucesso!',
      event: newEvent
    });
  } catch (error) {
    console.error('Erro em /api/schedule-workout:', error);
    return res.status(500).json({ success: false, error: 'Erro ao agendar treino.' });
  }
});

// ==============================================================================
// 4. GET /api/user-workouts - Listar Treinos Agendados
// ==============================================================================
app.get('/api/user-workouts', (req, res) => {
  try {
    const { user_id, mes_ano } = req.query;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        error: 'O parâmetro user_id na query é obrigatório.'
      });
    }

    let events = db.calendar_events.filter(e => e.user_id === user_id);

    // Filtro opcional por mês e ano (formato esperado: YYYY-MM)
    if (mes_ano) {
      events = events.filter(e => e.scheduled_date.startsWith(mes_ano));
    }

    return res.status(200).json({
      success: true,
      user_id,
      count: events.length,
      workouts: events
    });
  } catch (error) {
    console.error('Erro em /api/user-workouts:', error);
    return res.status(500).json({ success: false, error: 'Erro ao listar treinos do usuário.' });
  }
});

// ==============================================================================
// Rota de Health Check
// ==============================================================================
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'Fit.IA Backend API', timestamp: new Date() });
});

app.listen(PORT, () => {
  console.log(`🚀 Fit.IA API rodando na porta ${PORT}`);
});
