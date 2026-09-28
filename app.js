/**
 * Fit.IA - Client Logic & API Integration
 */

// Estado global da aplicação cliente
const AppState = {
  currentUser: {
    id: "usr_demo_101",
    name: "Alexandre Silva",
    email: "alexandre@fitia.app",
    level: "Intermediário",
    goal: "Ganho de massa"
  },
  currentGeneratedWorkout: null,
  calendarDate: new Date(),
  scheduledWorkouts: [
    {
      id: "evt_init_1",
      user_id: "usr_demo_101",
      scheduled_date: new Date().toISOString().split('T')[0],
      workout_snapshot: {
        titulo: "Treino A - Peito & Tríceps",
        duracao: "50 min"
      },
      status: "completed"
    }
  ]
};

// URL base da API (se local usar porta 3000, adaptável com fallback)
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000'
  : '';

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initFormInteractions();
  initCalendar();
  loadSavedUser();
});

// ==========================================
// 1. Navegação por Abas
// ==========================================
function initNavigation() {
  const tabs = document.querySelectorAll('.nav-tab-btn');
  const views = document.querySelectorAll('.tab-content-view');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetId = tab.dataset.tab;

      tabs.forEach(t => t.classList.remove('active'));
      views.forEach(v => v.classList.remove('active'));

      tab.classList.add('active');
      const targetView = document.getElementById(targetId);
      if (targetView) targetView.classList.add('active');

      if (targetId === 'tab-calendar') {
        renderCalendar();
      }
    });
  });
}

// ==========================================
// 2. Formulário de Geração de Treino
// ==========================================
function initFormInteractions() {
  // Modalidades Chips
  const modalityChips = document.querySelectorAll('#modality-chips .chip-btn');
  let selectedModality = 'Academia/Musculação';

  modalityChips.forEach(chip => {
    chip.addEventListener('click', () => {
      modalityChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      selectedModality = chip.dataset.val;
    });
  });

  // Foco Chips
  const goalChips = document.querySelectorAll('#goal-chips .chip-btn');
  let selectedGoal = 'Ganho de massa';

  goalChips.forEach(chip => {
    chip.addEventListener('click', () => {
      goalChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      selectedGoal = chip.dataset.val;
    });
  });

  // Botão Gerar Treino
  const btnGenerate = document.getElementById('btn-generate-workout');
  btnGenerate.addEventListener('click', async () => {
    const level = document.getElementById('workout-level').value;
    const days = document.getElementById('workout-days').value;
    const notes = document.getElementById('workout-notes').value.trim();

    const payload = {
      modalidade: selectedModality,
      foco: selectedGoal,
      nivel: level,
      dias_por_semana: parseInt(days, 10),
      observacoes: notes || 'Nenhuma restrição específica.'
    };

    btnGenerate.disabled = true;
    btnGenerate.innerHTML = `
      <svg class="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;">
        <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
        <path d="M12 2a10 10 0 0 1 10 10"></path>
      </svg>
      A Inteligência Artificial está montando seu treino...
    `;

    try {
      let workout;
      try {
        const res = await fetch(`${API_BASE_URL}/api/generate-workout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const data = await res.json();
          workout = data.workout;
        }
      } catch (err) {
        console.warn('API local offline ou inacessível. Usando gerador inteligente integrado do cliente.');
      }

      // Se API não respondeu ou erro de rede, gera simulação realista no front
      if (!workout) {
        workout = generateLocalAiWorkout(payload);
      }

      AppState.currentGeneratedWorkout = workout;
      renderWorkoutResult(workout);
      showToast('Treino personalizado gerado com sucesso!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Erro ao processar treino.', 'error');
    } finally {
      btnGenerate.disabled = false;
      btnGenerate.innerHTML = `
        <span>⚡ Gerar Treino Inteligente</span>
      `;
    }
  });

  // Modal Agendamento
  const modal = document.getElementById('schedule-modal');
  const btnCloseModal = document.getElementById('close-schedule-modal');
  const btnConfirmSchedule = document.getElementById('confirm-schedule-btn');

  btnCloseModal.addEventListener('click', () => modal.classList.remove('active'));
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('active');
  });

  btnConfirmSchedule.addEventListener('click', async () => {
    const scheduledDate = document.getElementById('schedule-date-input').value;
    if (!scheduledDate) {
      showToast('Selecione uma data para o treino!', 'error');
      return;
    }

    const payload = {
      user_id: AppState.currentUser.id,
      data_agendada: scheduledDate,
      treino_id_ou_json: {
        titulo: AppState.currentGeneratedWorkout.nome_treino,
        duracao: AppState.currentGeneratedWorkout.duracao_estimada
      },
      status: 'pending'
    };

    try {
      await fetch(`${API_BASE_URL}/api/schedule-workout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(() => null);

      AppState.scheduledWorkouts.push({
        id: `evt_${Date.now()}`,
        ...payload
      });

      modal.classList.remove('active');
      showToast('Treino agendado com sucesso no calendário!', 'success');
      renderCalendar();
    } catch (e) {
      showToast('Não foi possível salvar o agendamento.', 'error');
    }
  });

  // Cadastro de usuário
  const regForm = document.getElementById('register-form');
  if (regForm) {
    regForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nome = document.getElementById('reg-name').value;
      const email = document.getElementById('reg-email').value;
      const senha = document.getElementById('reg-pass').value;
      const nivel = document.getElementById('reg-level').value;
      const objetivo = document.getElementById('reg-goal').value;

      try {
        const res = await fetch(`${API_BASE_URL}/api/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome, email, senha, nivel, objetivo })
        });
        const data = await res.json();
        if (data.success) {
          AppState.currentUser = data.user;
          updateUserDisplay();
          showToast(`Bem-vindo ao Fit.IA, ${nome}!`, 'success');
          // Muda para a aba de gerar treinos
          document.querySelector('[data-tab="tab-generator"]').click();
        } else {
          showToast(data.error || 'Erro ao cadastrar.', 'error');
        }
      } catch (err) {
        // Fallback local
        AppState.currentUser = { id: `usr_${Date.now()}`, name: nome, email, level: nivel, goal: objetivo };
        updateUserDisplay();
        showToast(`Conta criada localmente! Bem-vindo, ${nome}!`, 'success');
        document.querySelector('[data-tab="tab-generator"]').click();
      }
    });
  }
}

// ==========================================
// 3. Renderização do Treino Gerado
// ==========================================
function renderWorkoutResult(workout) {
  const container = document.getElementById('workout-result-container');

  const daysHtml = workout.dias.map((dia, idx) => `
    <div class="day-block">
      <div class="day-block-header">
        <span class="day-title">${dia.dia || `Dia ${idx + 1}`}</span>
        <span class="day-focus">${dia.foco_dia || ''}</span>
      </div>
      <div class="exercises-grid">
        ${dia.exercicios.map(ex => `
          <div class="exercise-item">
            <div class="exercise-info">
              <h4>${ex.nome}</h4>
              <p>${ex.instrucoes_execucao || ''}</p>
            </div>
            <div class="exercise-stats">
              <span class="stat-pill">${ex.series} séries</span>
              <span class="stat-pill">${ex.repeticoes_ou_tempo}</span>
              <span class="stat-pill" style="background: rgba(6, 182, 212, 0.15); color: #22d3ee;">${ex.descanso_segundos}s desc.</span>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');

  container.innerHTML = `
    <div class="workout-header-badge">
      <div>
        <h3>${workout.nome_treino}</h3>
        <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 0.25rem;">${workout.resumo}</p>
        <div class="workout-meta-tags">
          <span class="meta-tag duration">⏱️ ${workout.duracao_estimada}</span>
          <span class="meta-tag">📅 ${workout.dias.length} dias semanais</span>
        </div>
      </div>
      <button class="btn-schedule-quick" id="btn-open-schedule-modal">
        📅 Agendar no Calendário
      </button>
    </div>
    <div class="workout-days-list">
      ${daysHtml}
    </div>
  `;

  document.getElementById('btn-open-schedule-modal').addEventListener('click', () => {
    const modal = document.getElementById('schedule-modal');
    document.getElementById('schedule-workout-name').textContent = workout.nome_treino;
    document.getElementById('schedule-date-input').value = new Date().toISOString().split('T')[0];
    modal.classList.add('active');
  });
}

// Fallback de Treinos caso a API backend esteja offline
function generateLocalAiWorkout(options) {
  const { modalidade, foco, nivel, dias_por_semana, observacoes } = options;
  
  const exerciciosBase = {
    'Academia/Musculação': [
      { nome: "Supino Reto com Barra/Halteres", series: 4, repeticoes_ou_tempo: "8-12 reps", descanso_segundos: 60, instrucoes_execucao: "Manter escápulas retraídas e amplitude controlada." },
      { nome: "Puxada Frontal Alta", series: 4, repeticoes_ou_tempo: "10-12 reps", descanso_segundos: 60, instrucoes_execucao: "Tracionar com as costas sem balancear o tronco." },
      { nome: "Agachamento com Barra", series: 4, repeticoes_ou_tempo: "8-10 reps", descanso_segundos: 90, instrucoes_execucao: "Pés firmes no solo, descida além dos 90 graus mantendo a coluna alinhada." },
      { nome: "Elevação Lateral com Halteres", series: 3, repeticoes_ou_tempo: "12-15 reps", descanso_segundos: 45, instrucoes_execucao: "Controle na fase de descida, foco no deltóide medial." },
      { nome: "Tríceps Corda na Polia", series: 3, repeticoes_ou_tempo: "10-12 reps", descanso_segundos: 45, instrucoes_execucao: "Abrir a corda no ponto de contração máxima." }
    ],
    'Calistenia': [
      { nome: "Flexão de Braços (Push-ups)", series: 4, repeticoes_ou_tempo: "12-20 reps", descanso_segundos: 60, instrucoes_execucao: "Corpo em prancha firme, peito próximo ao solo." },
      { nome: "Barra Fixa Pronada (Pull-ups)", series: 4, repeticoes_ou_tempo: "6-10 reps", descanso_segundos: 90, instrucoes_execucao: "Passar o queixo da barra sem impulso exagerado." },
      { nome: "Agachamento Pistol / Búlgaro", series: 3, repeticoes_ou_tempo: "10 cada perna", descanso_segundos: 60, instrucoes_execucao: "Equilíbrio e amplitude completa." },
      { nome: "Mergulho em Paralelas (Dips)", series: 3, repeticoes_ou_tempo: "8-12 reps", descanso_segundos: 60, instrucoes_execucao: "Descer até 90 graus no cotovelo." },
      { nome: "Hollow Body Hold", series: 3, repeticoes_ou_tempo: "40 segundos", descanso_segundos: 45, instrucoes_execucao: "Lombar colada no chão com abdômen travado." }
    ]
  };

  const lista = exerciciosBase[modalidade] || exerciciosBase['Academia/Musculação'];

  return {
    nome_treino: `Protocolo Fit.IA: ${modalidade}`,
    resumo: `Periodização otimizada para ${foco}, desenvolvida para o nível ${nivel}. Restrições observadas: ${observacoes}`,
    duracao_estimada: "50-60 minutos",
    dias: Array.from({ length: dias_por_semana }).map((_, i) => ({
      dia: `Dia ${i + 1}`,
      foco_dia: `${foco} - Módulo ${String.fromCharCode(65 + i)}`,
      exercicios: lista.slice(0, 4)
    }))
  };
}

// ==========================================
// 4. Calendário Interativo
// ==========================================
function initCalendar() {
  document.getElementById('cal-prev-month').addEventListener('click', () => {
    AppState.calendarDate.setMonth(AppState.calendarDate.getMonth() - 1);
    renderCalendar();
  });

  document.getElementById('cal-next-month').addEventListener('click', () => {
    AppState.calendarDate.setMonth(AppState.calendarDate.getMonth() + 1);
    renderCalendar();
  });
}

function renderCalendar() {
  const titleEl = document.getElementById('cal-current-month-title');
  const gridEl = document.getElementById('calendar-grid-cells');
  const sidebarList = document.getElementById('scheduled-workouts-sidebar-list');

  const year = AppState.calendarDate.getFullYear();
  const month = AppState.calendarDate.getMonth();

  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  titleEl.textContent = `${monthNames[month]} de ${year}`;

  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const prevMonthTotalDays = new Date(year, month, 0).getDate();

  gridEl.innerHTML = '';

  const todayStr = new Date().toISOString().split('T')[0];

  // Dias do mês anterior
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const dayCell = document.createElement('div');
    dayCell.className = 'cal-day-cell other-month';
    dayCell.innerHTML = `<span class="cal-day-number">${prevMonthTotalDays - i}</span>`;
    gridEl.appendChild(dayCell);
  }

  // Dias do mês corrente
  for (let day = 1; day <= totalDays; day++) {
    const dayCell = document.createElement('div');
    const dayPadded = String(day).padStart(2, '0');
    const monthPadded = String(month + 1).padStart(2, '0');
    const dateStr = `${year}-${monthPadded}-${dayPadded}`;

    dayCell.className = 'cal-day-cell';
    if (dateStr === todayStr) dayCell.classList.add('today');

    // Eventos agendados para este dia
    const eventsThisDay = AppState.scheduledWorkouts.filter(e => e.scheduled_date === dateStr);

    let eventsHtml = '';
    if (eventsThisDay.length > 0) {
      eventsHtml = eventsThisDay.map(ev => `
        <div class="cal-event-dot" title="${ev.workout_snapshot?.titulo || 'Treino'}">
          ⚡ ${ev.workout_snapshot?.titulo || 'Treino'}
        </div>
      `).join('');
    }

    dayCell.innerHTML = `
      <span class="cal-day-number">${day}</span>
      <div>${eventsHtml}</div>
    `;

    dayCell.addEventListener('click', () => {
      document.getElementById('schedule-date-input').value = dateStr;
      if (AppState.currentGeneratedWorkout) {
        document.getElementById('schedule-workout-name').textContent = AppState.currentGeneratedWorkout.nome_treino;
        document.getElementById('schedule-modal').classList.add('active');
      } else {
        showToast(`Dia selecionado: ${dateStr}. Gere um treino na aba inicial para agendá-lo.`, 'info');
      }
    });

    gridEl.appendChild(dayCell);
  }

  // Renderiza Lista na Barra Lateral
  if (AppState.scheduledWorkouts.length === 0) {
    sidebarList.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem;">Nenhuma sessão agendada.</p>`;
  } else {
    sidebarList.innerHTML = AppState.scheduledWorkouts.map(w => `
      <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 0.8rem; margin-bottom: 0.6rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.2rem;">
          <strong style="font-size: 0.9rem; color: #fff;">${w.workout_snapshot?.titulo || 'Treino Fit.IA'}</strong>
          <span style="font-size: 0.75rem; color: #34d399; font-weight: 600;">${w.status === 'completed' ? '✓ Concluído' : 'Pendente'}</span>
        </div>
        <p style="color: var(--text-muted); font-size: 0.8rem;">📅 Data: ${w.scheduled_date}</p>
      </div>
    `).join('');
  }
}

// ==========================================
// 5. Utilitários (Toast, Estado de Usuário)
// ==========================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icon = type === 'success' ? '✓' : type === 'error' ? '⚠' : 'ℹ';
  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function loadSavedUser() {
  updateUserDisplay();
}

function updateUserDisplay() {
  const user = AppState.currentUser;
  const nameEl = document.getElementById('nav-user-name');
  if (nameEl) nameEl.textContent = user.name.split(' ')[0];
  const avatarEl = document.getElementById('nav-user-avatar');
  if (avatarEl) avatarEl.textContent = user.name.charAt(0).toUpperCase();
}
