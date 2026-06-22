// Dynamic Base URL and API constants for static client environment
const API_URL = "https://muriquiz.online";

function getBaseUrl() {
    const path = window.location.pathname;
    const pagesIndex = path.indexOf('/pages/');
    if (pagesIndex !== -1) {
        return path.substring(0, pagesIndex + 1);
    }
    return '../../'; // fallback depth 2 prefix
}

let socket;
let currentUser = null;
let currentRoom = null;
let gameMode = null; // 'quick', 'combat', 'micro-enem' ou 'essay'
let currentQuiz = null;
let questionIndex = 0;
let gameTimer = null;
let timeRemaining = 180;
let userAnswers = [];

// ── Sistema de Prefetch ──────────────────────────────────────
// Estados possíveis de uma correção: 'idle' | 'loading' | 'prefetching' | 'prefetched' | 'ready'
// feedbackCache guarda: Map<cacheKey, Promise<result> | result >
const feedbackCache = new Map();

// Estado de prefetch do modo Redação
const essayPrefetchState = {
  cacheKey: null,     // chave do próximo prefetch em andamento
  status: 'idle',     // 'idle' | 'prefetching' | 'prefetched'
  pendingText: null,  // texto que estará pronto para corrigir
  pendingTheme: null
};

/**
 * Gera uma cacheKey estável para uma questão de revisão.
 * Usa o índice da questão + um snapshot do texto da questão para unicidade.
 */
function buildReviewCacheKey(idx) {
  const q = reviewData[idx];
  if (!q) return null;
  const snippet = (q.context || q.body || q.title || q.question || '').slice(0, 50).replace(/\s+/g, '_');
  return `review_${idx}_${snippet}`;
}

/**
 * Gera uma cacheKey para um prefetch de redação.
 */
function buildEssayPrefetchKey(text, theme) {
  const textSnippet = (text || '').slice(0, 80).replace(/\s+/g, '_');
  const themeSnippet = (theme || '').slice(0, 40).replace(/\s+/g, '_');
  return `essay_pf_${themeSnippet}_${textSnippet}`;
}

// --- Inicialização ---
document.addEventListener("DOMContentLoaded", async () => {
  initTheme();
  await loadUserData();
  setupSocket(); // Garante conexão inicial do socket para notificações
  // Se estávamos em uma sala e recarregamos, tenta voltar
  checkActiveRoom();
  lucide.createIcons();
  requestNotificationPermission();
});

function checkActiveRoom() {
  const savedRoom = sessionStorage.getItem("activeRoomCode");
  if (savedRoom) {
    setupSocket();
  }
}

function requestNotificationPermission() {
  if ("Notification" in window) {
    if (Notification.permission === "default") {
      Notification.requestPermission();
    }
  }
}

function initTheme() {
  const savedTheme = localStorage.getItem('preferred-theme') || 'dark';
  setTheme(savedTheme);
}

async function loadUserData() {
  try {
    const res = await fetch(API_URL + "/user/me", { 
      credentials: 'include',
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    if (res.ok) {
      const data = await res.json();
      currentUser = data.user;
      document.getElementById("userNameGreeting").textContent = `Olá, ${currentUser.name.split(' ')[0]}`;
      
      if (currentUser && currentUser.isAdmin) {
        const nav = document.querySelector('.sidebar-nav');
        if (nav && !nav.querySelector('a[href="/admin"]')) {
          const adminLink = document.createElement('a');
          adminLink.href = '/admin';
          adminLink.className = 'nav-item';
          adminLink.innerHTML = '<i data-lucide="shield-alert"></i> Admin';
          nav.appendChild(adminLink);
          if (typeof lucide !== 'undefined') lucide.createIcons();
        }

        // Revela o botão de alternar para gerar quiz a partir de links
        const toggleBtn = document.getElementById('admin-mode-toggle-btn');
        if (toggleBtn) {
          toggleBtn.classList.remove('hidden');
        }
      }
    }
  } catch (err) {
    console.error("Erro ao carregar dados do usuário:", err);
  } finally {
    hideLoader();
  }
}

function setupSocket() {
  if (socket && socket.connected) return;
  
  console.log("[Socket] Inicializando conexão...");
  socket = io('https://muriquiz.online');

  // Registra handlers de prefetch de redação (sistemas assíncronos)
  registerEssayPrefetchHandlers(socket);

  socket.on("connect", () => {
    console.log("[Socket] Conectado! Socket ID:", socket.id);
    if (currentUser) {
      const uid = currentUser.id || currentUser._id;
      console.log("[Socket] Registrando usuário no socket:", uid);
      socket.emit("register_user", { userId: uid });
    } else {
      console.warn("[Socket] currentUser não definido no connect!");
    }
    const savedRoom = sessionStorage.getItem("activeRoomCode");
    if (savedRoom && currentUser) {
      socket.emit("rejoin_room", { roomCode: savedRoom, userName: currentUser.name });
    }
  });

  socket.on("room_created", (room) => {
    currentRoom = room;
    sessionStorage.setItem("activeRoomCode", room.code);
    showCombatLobby(room);
    showToast("Sala criada com sucesso!", "success");
  });

  socket.on("room_updated", ({ room }) => {
    currentRoom = room;
    refreshLobbyUI(room);
  });

  socket.on("message", ({ text, type }) => {
    console.log("[Socket] Mensagem recebida:", text, type);
    showToast(text, type);
    
    // Disparar notificação nativa do navegador se autorizada nas configurações
    if ("Notification" in window && localStorage.getItem('notifications-enabled') === 'true' && Notification.permission === "granted") {
      try {
        console.log("[Socket] Disparando notificação nativa do sistema...");
        new Notification("Muriquiz", {
          body: text,
          icon: getBaseUrl() + "assets/icons/Muriquiz - Mini Logo.png",
          tag: "muriquiz-alert",
          requireInteraction: false
        });
      } catch (err) {
        console.error("Erro ao disparar notificação do navegador:", err);
      }
    } else {
      console.log("[Socket] Notificação nativa não disparada. enabled:", localStorage.getItem('notifications-enabled'), "permission:", Notification.permission);
    }
  });

  socket.on("kicked", ({ message }) => {
    sessionStorage.removeItem("activeRoomCode");
    showToast(message, "error");
    setTimeout(() => location.reload(), 2000);
  });

  socket.on("player_joined", ({ room, player, rejoined }) => {
    currentRoom = room;
    refreshLobbyUI(room);
    if (rejoined) {
      showToast(`${player.name} voltou à partida!`, "success");
    } else {
      let teamMsg = player.team === "spectator" ? "como Espectador" : `no Time ${player.team === 'blue' ? 'Azul' : 'Vermelho'}`;
      showToast(`${player.name} entrou ${teamMsg}!`, "info");
      if (player.id === socket.id) {
        sessionStorage.setItem("activeRoomCode", room.code);
        showCombatLobby(room);
      }
    }
  });

  socket.on("player_disconnected", ({ playerName }) => {
    showToast(`${playerName} desconectou. Aguardando a partida...`, "info");
  });

  socket.on("player_left", ({ room, playerName }) => {
    refreshLobbyUI(room);
    showToast(`${playerName} saiu da sala.`, "error");
  });

  socket.on("team_updated", ({ players }) => {
    if (currentRoom) {
      currentRoom.players = players;
      refreshLobbyUI(currentRoom);
    }
  });

  socket.on("connect_error", () => {
    showToast("Erro de conexão com o servidor.", "error");
  });

  socket.on("disconnect", () => {
    if (gameMode === 'combat') {
      showToast("Você foi desconectado.", "error");
      setTimeout(() => location.reload(), 3000);
    }
  });

  socket.on("status_changed", ({ status }) => {
    if (status === "generating") {
      showLoadingPopup("A IA está preparando as questões... Prepare-se!");
    } else {
      hideLoadingPopup();
    }
  });

  socket.on("new_question", ({ question, questionIndex: qIdx, totalQuestions, timeRemaining: tr }) => {
    gameMode = 'combat';
    questionIndex = qIdx;
    timeRemaining = tr;
    
    document.getElementById("curr-q").textContent = questionIndex + 1;
    document.getElementById("total-q").textContent = totalQuestions;
    
    const myPlayer = currentRoom.players[socket.id];
    const isSpectator = myPlayer && myPlayer.team === "spectator";

    renderQuestion(question, isSpectator);
    showScreen("game-area");
    startTimerDisplay();
    
    const nextBtn = document.getElementById("next-btn");
    const leaveBtn = document.getElementById("leave-game-btn");
    const qContainer = document.getElementById("question-container");

    leaveBtn.classList.remove("hidden");

    if (isSpectator) {
      nextBtn.classList.add("hidden");
      qContainer.style.pointerEvents = "none";
      qContainer.classList.add("spectator-mode");
    } else {
      nextBtn.classList.remove("hidden");
      qContainer.style.pointerEvents = "all";
      qContainer.classList.remove("spectator-mode");
    }

    hideNavigation();
  });

  socket.on("timer_tick", ({ timeRemaining: tr, accelerated }) => {
    timeRemaining = tr;
    updateTimerDisplay();
    if (accelerated) {
      showToast("Tempo reduzido: Metade dos jogadores já respondeu!", "info");
    }
  });

  socket.on("answer_result", ({ isCorrect, correctAnswer }) => {
    showFeedbackPopup(isCorrect, correctAnswer);
  });

  socket.on("scores_updated", ({ scores, targets }) => {
    document.getElementById("score-blue").textContent = `${scores.blue}/${targets.blue}`;
    document.getElementById("score-red").textContent = `${scores.red}/${targets.red}`;
    document.getElementById("combat-scoreboard").classList.remove("hidden");
  });

  socket.on("player_answered", ({ answeredCount, totalPlayers }) => {
    const progressEl = document.getElementById("quiz-progress");
    const countSpan = document.createElement("div");
    countSpan.id = "answered-ratio";
    countSpan.style.fontSize = "0.9rem";
    countSpan.style.color = "var(--yellow)";
    countSpan.style.marginTop = "5px";
    countSpan.textContent = `Respondido: ${answeredCount}/${totalPlayers}`;
    
    const existing = document.getElementById("answered-ratio");
    if (existing) existing.remove();
    progressEl.appendChild(countSpan);
  });

  socket.on("question_over", () => {
    const nextBtn = document.getElementById("next-btn");
    nextBtn.disabled = true;
    nextBtn.textContent = "Rodada finalizada!";
    showToast("Todos responderam! Revelando...", "info");
  });

  socket.on("quiz_finished", (data) => {
    sessionStorage.removeItem("activeRoomCode");
    showResults(data);
  });

  socket.on("error", (err) => {
    showToast(err.message, "error");
  });

  socket.on("left_room_confirmed", () => {
    sessionStorage.removeItem("activeRoomCode");
    location.reload();
  });

  socket.on("essayCorrectionResult", (data) => {
    handleEssayCorrectionResult(data);
  });

  socket.on("essayCorrectionError", (err) => {
    handleEssayCorrectionError(err);
  });
}

function leaveRoom() {
  if (currentRoom) {
    socket.emit("leave_room", { roomCode: currentRoom.code });
  } else {
    location.reload();
  }
}

// --- Navegação de Telas ---
function showScreen(screenId) {
  const screens = ["selection-screen", "quick-quiz-config", "combat-config", "combat-lobby", "game-area", "results-screen", "micro-enem-config", "micro-enem-area", "history-section", "essay-config", "essay-area"];
  screens.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add("hidden");
  });
  const activeScreen = document.getElementById(screenId);
  if (activeScreen) activeScreen.classList.remove("hidden");

  if (screenId === "selection-screen" || screenId === "quick-quiz-config" || screenId === "combat-config" || screenId === "micro-enem-config" || screenId === "essay-config") {
    showNavigation();
  } else {
    hideNavigation();
  }

  lucide.createIcons();
}

function hideNavigation() {
  document.body.classList.add("sidebar-restricted");
  const sidebar = document.getElementById("sidebar");
  const toggle = document.querySelector(".sidebar-toggle");
  const main = document.querySelector(".main-content");
  
  if (sidebar) {
    sidebar.classList.remove("open");
  }
  if (toggle) {
    toggle.classList.remove("active");
  }
  if (main) {
    main.style.marginLeft = "0";
    main.classList.remove("pushed");
  }
}

function showNavigation() {
  document.body.classList.remove("sidebar-restricted");
  const sidebar = document.getElementById("sidebar");
  
  if (sidebar) {
    // Reset para flex se necessário, embora a classe já controle o display
    sidebar.style.display = ""; 
  }
}

function showSelection() { showScreen("selection-screen"); }
function showQuickQuizConfig() { showScreen("quick-quiz-config"); }
function showCombatConfig() { showScreen("combat-config"); }
function showMicroEnemConfig() { showScreen("micro-enem-config"); }

// --- Micro-ENEM ---
let microQuestionsData = [];
let currentExamInfo = "";
// feedbackCache já declarado no topo (sistema de prefetch)

async function startMicroEnem() {
    showLoader();
    const loadingPopup = showLoadingPopup("Buscando questões oficiais do enem.dev...");

    try {
        const chosenLanguage = document.querySelector('input[name="micro-enem-lang"]:checked')?.value || 'ingles';

        const examsResponse = await fetch('https://api.enem.dev/v1/exams');
        if (!examsResponse.ok) throw new Error('Erro ao listar exames');
        const exams = await examsResponse.json();
        
        if (!exams || exams.length === 0) throw new Error('Nenhum exame encontrado');
        
        const randomExam = exams[Math.floor(Math.random() * exams.length)];
        currentExamInfo = `ENEM ${randomExam.year} - ${randomExam.title || 'Edição Regular'}`;

        const offsets = [0, 45, 90, 135];
        microQuestionsData = [];

        for (let i = 0; i < offsets.length; i++) {
            const res = await fetch(`https://api.enem.dev/v1/exams/${randomExam.year}/questions?offset=${offsets[i]}&limit=30&language=${chosenLanguage}`);
            if (res.ok) {
                const data = await res.json();
                
                // Filtro preventivo no lado do cliente: garante que apenas questões no idioma escolhido
                // (ou questões sem campo de idioma, que são em português) sejam selecionadas.
                const filteredQuestions = (data.questions || []).filter(q => {
                    return !q.language || q.language.toLowerCase() === chosenLanguage.toLowerCase();
                });

                const areaQuestions = filteredQuestions.sort(() => 0.5 - Math.random()).slice(0, 5);
                microQuestionsData = microQuestionsData.concat(areaQuestions);
            }
        }

        if (!microQuestionsData || microQuestionsData.length === 0) throw new Error('Nenhuma questão encontrada');

        // Configurar estado do jogo
        gameMode = 'micro-enem';
        questionIndex = 0;
        userAnswers = [];
        feedbackCache.clear(); // Limpar cache para nova partida
        
        document.getElementById("curr-q").textContent = 1;
        document.getElementById("total-q").textContent = microQuestionsData.length;
        document.getElementById("combat-scoreboard").classList.add("hidden");
        
        renderMicroQuestion(microQuestionsData[0]);
        showScreen("game-area");
        startTimeLimit();

        // Inicia prefetch da 1ª correção assim que o quiz começar
        // (neste momento o usuário ainda não respondeu nada, mas podemos
        //  pré-aquecer a conexão para a 1ª pergunta se quisermos.
        //  Deixamos para o prefetch ser iniciado após a 1ª resposta.)
    } catch (error) {
        showToast('Erro ao iniciar simulado: ' + error.message, 'error');
        console.error(error);
    } finally {
        hideLoader();
        hideLoadingPopup();
    }
}

function renderMicroQuestion(q) {
    const container = document.getElementById("question-container");
    const nextBtn = document.getElementById("next-btn");
    const letters = ['A', 'B', 'C', 'D', 'E'];
    
    // Header com info da prova
    let headerHtml = `<div style="color: var(--purple); font-weight: 700; margin-bottom: 15px; font-size: 0.9rem;">${currentExamInfo} | ${q.discipline}${q.component ? ' | ' + q.component : ''}</div>`;
    
    let questionText = q.context || q.body || q.introduction || q.title || 'Texto indisponível';
    questionText = questionText.replace(/!\[.*?\]\((.*?)\)/g, '<img src="$1" style="max-width:100%; height:auto; margin: 15px 0; border-radius:12px; display: block; margin-left: auto; margin-right: auto;" alt="Imagem">');

    const commandText = q.alternativesIntroduction ? `<p style="margin-top: 15px; font-weight: 700; color: var(--fg);">${q.alternativesIntroduction}</p>` : '';

    let alternativesHtml = '<div class="options-list" style="margin-top: 20px;">';
    if (q.alternatives && q.alternatives.length > 0) {
        q.alternatives.forEach((alt, altIndex) => {
            let altContent = '';
            if (typeof alt === 'string') {
                altContent = alt;
            } else {
                if (alt.text) {
                    altContent = alt.text.replace(/!\[.*?\]\((.*?)\)/g, '<img src="$1" style="max-width:100%; height:auto; border-radius:8px;" alt="Alternativa">');
                }
                if (alt.file) {
                    altContent += `<img src="${alt.file}" style="max-width:100%; height:auto; border-radius:8px;" alt="Alternativa">`;
                }
            }

            alternativesHtml += `
                <div class="option-item" onclick="selectMicroOption(this, ${altIndex})">
                    <div class="option-check"></div>
                    <div class="option-text">
                        <strong style="color: var(--purple)">${letters[altIndex]})</strong> ${altContent}
                    </div>
                </div>
            `;
        });
    }
    alternativesHtml += '</div>';

    container.innerHTML = `
        ${headerHtml}
        <div style="color: var(--fg); line-height: 1.6; font-size: 1rem;">${questionText}</div>
        ${commandText}
        ${alternativesHtml}
    `;

    // Injetar Painel de Desenvolvedor se aplicável
    if (currentUser && currentUser.isAdmin && localStorage.getItem('dev-mode-active') === 'true') {
        const devBox = document.createElement("div");
        devBox.id = "dev-toolbox";
        devBox.style.cssText = "position:absolute; top:10px; right:10px; background:var(--bg-dark); border:1px solid var(--purple); border-radius:10px; padding:10px; z-index:100; box-shadow:0 5px 15px rgba(0,0,0,0.5);";
        
        devBox.innerHTML = `
            <div style="font-size: 0.65rem; color: var(--purple); font-weight: 800; margin-bottom: 8px; text-transform: uppercase;">Muriquiz Dev Tools</div>
            <div style="display: flex; gap: 5px;">
                <button onclick="devAutoSolveQuiz('perfect')" title="Acertar Tudo" style="background:var(--green); color:var(--bg-dark); border:none; padding:5px; border-radius:5px; cursor:pointer;"><i data-lucide="check-circle" style="width:14px; height:14px;"></i></button>
                <button onclick="devAutoSolveQuiz('random')" title="Aleatório" style="background:var(--yellow); color:var(--bg-dark); border:none; padding:5px; border-radius:5px; cursor:pointer;"><i data-lucide="shuffle" style="width:14px; height:14px;"></i></button>
                <button onclick="devAutoSolveQuiz('fail')" title="Errar Tudo" style="background:var(--red); color:var(--bg-dark); border:none; padding:5px; border-radius:5px; cursor:pointer;"><i data-lucide="x-circle" style="width:14px; height:14px;"></i></button>
            </div>
        `;
        container.style.position = "relative";
        container.appendChild(devBox);
        lucide.createIcons();
    }
    
    nextBtn.disabled = true;
    nextBtn.textContent = "Confirmar Resposta";
}

function selectMicroOption(element, index) {
    document.querySelectorAll(".option-item").forEach(item => item.classList.remove("selected"));
    element.classList.add("selected");
    document.getElementById("next-btn").disabled = false;
}

async function submitGameAnswer() {
  const nextBtn = document.getElementById("next-btn");
  let answer = "";
  let answerIndex = -1;

  if (gameMode === 'micro-enem') {
      const selected = document.querySelector(".option-item.selected");
      if (!selected) return showToast("Por favor, selecione uma opção", "error");
      
      const letters = ['A', 'B', 'C', 'D', 'E'];
      const options = Array.from(document.querySelectorAll(".option-item"));
      answerIndex = options.indexOf(selected);
      answer = letters[answerIndex];

      const q = microQuestionsData[questionIndex];
      const correctAnswerIndex = q.correctAlternativeIndex !== undefined ? q.correctAlternativeIndex : letters.indexOf(q.correctAlternative.toUpperCase());
      const isCorrect = answerIndex === correctAnswerIndex;

      // Feedback rápido antes de passar
      showFeedbackPopup(isCorrect, letters[correctAnswerIndex]);
      
      userAnswers.push(answer);
      
      // Delay pequeno para o usuário ver o feedback rápido antes de trocar a questão
      setTimeout(() => {
          nextMicroQuestion();
      }, 1000);
      return;
  }

  // Lógica para Quick e Combat
  if (document.querySelector(".option-item")) {
    const selected = document.querySelector(".option-item.selected .option-text");
    if (!selected && gameMode === 'quick') return showToast("Por favor, selecione uma opção", "error");
    answer = selected ? selected.textContent.split(')')[0].trim() : "";
  } else {
    const openInput = document.getElementById("open-answer");
    answer = openInput ? openInput.value : "";
    if (!answer && gameMode === 'quick') return showToast("Por favor, escreva sua resposta", "error");
  }

  if (gameMode === 'quick') {
    userAnswers.push(answer);
    nextQuickQuestion();
    document.getElementById("next-btn").disabled = true;
  } else if (gameMode === 'combat' && currentRoom) {
    socket.emit("submit_answer", { roomCode: currentRoom.code, answer });
    document.getElementById("next-btn").disabled = true;
    document.getElementById("next-btn").textContent = "Aguardando outros...";
  }
}



function nextMicroQuestion() {
    questionIndex++;
    if (questionIndex < microQuestionsData.length) {
        document.getElementById("curr-q").textContent = questionIndex + 1;
        renderMicroQuestion(microQuestionsData[questionIndex]);
        resetTimer();
    } else {
        finishMicroEnem();
    }
}

let reviewIndex = 0;
let reviewData = [];

async function finishMicroEnem() {
    clearInterval(gameTimer);
    showScreen("results-screen");
    const content = document.getElementById("results-content");
    document.getElementById("results-title").textContent = "Simulado Concluído!";

    let score = 0;
    const letters = ['A', 'B', 'C', 'D', 'E'];
    microQuestionsData.forEach((q, i) => {
        const correct = q.correctAlternativeIndex !== undefined ? letters[q.correctAlternativeIndex] : q.correctAlternative.toUpperCase();
        if (userAnswers[i] === correct) score++;
    });

    reviewData = microQuestionsData; // Dados para revisão

    content.innerHTML = `
        <div style="text-align: center;">
            <div style="font-size: 4rem; margin-bottom: 10px;">🏆</div>
            <h2 style="font-size: 2rem; color: var(--purple); margin-bottom: 20px;">Parabéns!</h2>
            <div style="font-size: 1.5rem; font-weight: 800; margin-bottom: 25px;">
                Você acertou <span style="color: var(--green);">${score}</span> de ${microQuestionsData.length} questões.
            </div>
            <p style="color: var(--fg-dim); margin-bottom: 30px; line-height: 1.6;">
                O simulado acabou, mas o aprendizado continua. <br>
                Agora, revise cada questão com a ajuda da nossa IA para entender profundamente os conceitos.
            </p>
            <button onclick="startReview()" class="btn-primary" style="padding: 18px 30px; font-size: 1.2rem; width: auto;">
                <i data-lucide="book-open" style="width: 20px; vertical-align: middle; margin-right: 10px;"></i> Revisar Questões
            </button>
        </div>
    `;
    lucide.createIcons();
}

function startReview() {
    reviewIndex = 0;
    renderReviewPage();
}

async function renderReviewPage() {
    const content = document.getElementById("results-content");
    const q = reviewData[reviewIndex];
    const letters = ['A', 'B', 'C', 'D', 'E'];
    const userAnswer = userAnswers[reviewIndex] || ""; // Garante que não seja undefined
    
    // Suporte para estrutura da API enem.dev e estrutura gerada pela nossa IA
    const correctAnswer = q.correctAlternativeIndex !== undefined ? letters[q.correctAlternativeIndex] : 
                        (q.correctAlternative ? q.correctAlternative.toUpperCase() : (q.correct ? q.correct.toUpperCase() : (q.answer || "---")));
    
    const isCorrect = userAnswer === correctAnswer;

    // Garante que alternatives/options existam antes de mapear
    const alts = q.alternatives || q.options || [];

    content.innerHTML = `
        <div class="review-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid var(--border); padding-bottom: 15px;">
            <div style="font-weight: 700; color: var(--purple);">Revisão: Questão ${reviewIndex + 1} de ${reviewData.length}</div>
            <div style="padding: 4px 12px; border-radius: 20px; font-size: 0.85rem; font-weight: 700; background: ${isCorrect ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'}; color: ${isCorrect ? 'var(--green)' : 'var(--red)'}">
                ${isCorrect ? 'ACERTOU' : 'ERROU'}
            </div>
        </div>

        <div class="review-question" style="margin-bottom: 25px;">
            <div style="font-size: 0.95rem; line-height: 1.6; color: var(--fg); margin-bottom: 15px;">
                ${((q.context || q.body || q.title || q.question || "---")).replace(/!\[.*?\]\((.*?)\)/g, '<img src="$1" style="max-width:100%; height:auto; border-radius:12px; margin: 10px 0;">')}
            </div>
            ${q.alternativesIntroduction ? `<p style="font-weight: 700; margin-bottom: 15px;">${q.alternativesIntroduction}</p>` : ''}
            
            <div class="review-alternatives" style="display: flex; flex-direction: column; gap: 10px;">
                ${alts.map((alt, i) => {
                    const letter = letters[i];
                    const isUserPick = userAnswer === letter;
                    const isCorrectAlt = correctAnswer === letter;
                    
                    let borderColor = 'var(--border)';
                    let bgColor = 'transparent';
                    if (isCorrectAlt) { borderColor = 'var(--green)'; bgColor = 'rgba(16, 185, 129, 0.05)'; }
                    else if (isUserPick) { borderColor = 'var(--red)'; bgColor = 'rgba(239, 68, 68, 0.05)'; }

                    return `
                        <div style="padding: 12px 15px; border: 2px solid ${borderColor}; background: ${bgColor}; border-radius: 10px; font-size: 0.9rem;">
                            <strong style="color: ${isCorrectAlt ? 'var(--green)' : (isUserPick ? 'var(--red)' : 'var(--purple)')}">${letter})</strong> 
                            ${typeof alt === 'string' ? alt : (alt.text || "")}
                            ${isCorrectAlt ? ' <i data-lucide="check" style="width:14px; color:var(--green); vertical-align:middle;"></i>' : ''}
                            ${isUserPick && !isCorrectAlt ? ' <i data-lucide="x" style="width:14px; color:var(--red); vertical-align:middle;"></i>' : ''}
                        </div>
                    `;
                }).join('')}
                ${alts.length === 0 ? `<div style="padding: 15px; border: 2px solid var(--border); border-radius: 10px; font-style: italic; color: var(--fg-dim);">Resposta do aluno: ${userAnswer || "(Sem resposta)"}</div>` : ""}
            </div>
        </div>

        <div id="ai-review-box" style="background: rgba(187, 154, 247, 0.05); border-left: 4px solid var(--purple); padding: 20px; border-radius: 0 12px 12px 0; margin-bottom: 30px;">
            <div id="ai-review-loading" style="text-align: center;">
                <div class="loader-spinner" style="width: 20px; height: 20px; margin: 0 auto 10px;"></div>
                <p style="color: var(--purple); font-size: 0.9rem;">IA analisando esta questão...</p>
            </div>
            <div id="ai-review-content" class="hidden"></div>
        </div>

        <div class="review-navigation" style="display: flex; justify-content: space-between; gap: 15px;">
            <button onclick="prevReview()" class="btn-secondary" ${reviewIndex === 0 ? 'disabled' : ''} style="width: auto; padding: 12px 25px;">Anterior</button>
            <button onclick="nextReview()" class="btn-primary" style="width: auto; padding: 12px 25px;">
                ${reviewIndex === reviewData.length - 1 ? 'Finalizar Revisão' : 'Próxima'}
            </button>
        </div>
    `;
    lucide.createIcons();
    fetchAIReview(q, userAnswer, isCorrect, correctAnswer);
    // Inicia o prefetch da próxima correção enquanto o usuário lê a atual
    triggerPrefetchNext(reviewIndex + 1);
}

async function fetchAIReview(q, userAnswer, isCorrect, correctAnswer) {
    // Usa a cacheKey baseada no índice + snippet da questão (estabilidade)
    const cacheKey = buildReviewCacheKey(reviewIndex) || `review_${reviewIndex}`;
    
    try {
        let explanation;
        
        // Verifica se já está no cache (Promise pendente ou resultado resolvido)
        if (feedbackCache.has(cacheKey)) {
            console.log(`[Prefetch] Cache HIT na revisão ${reviewIndex}`);
            explanation = await feedbackCache.get(cacheKey);
        } else {
            // Não havia prefetch — busca agora com indicador de loading
            console.log(`[Prefetch] Cache MISS na revisão ${reviewIndex} – buscando agora`);
            const letters = ['A', 'B', 'C', 'D', 'E'];
            const alts = q.alternatives || q.options || [];
            
            const promise = fetch(API_URL + '/quiz/explain', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question: {
                        context: q.context || q.question || q.body || q.title,
                        command: q.alternativesIntroduction || q.question,
                        alternatives: alts.map((alt, i) => `${letters[i]}) ${typeof alt === 'string' ? alt : (alt.text || "")}` ),
                        correct: correctAnswer
                    },
                    userAnswer: userAnswer || "",
                    isCorrect: !!isCorrect,
                    cacheKey: cacheKey // Informa o backend para usar o cache da fila
                })
            }).then(res => {
                if (!res.ok) throw new Error('Erro na IA');
                return res.json();
            });
            
            feedbackCache.set(cacheKey, promise);
            explanation = await promise;
        }

        const loading = document.getElementById("ai-review-loading");
        const content = document.getElementById("ai-review-content");

        if (!content) return; // O usuário pode ter saído da tela

        content.innerHTML = `
            <h4 style="color: var(--purple); margin-bottom: 15px; display: flex; align-items: center; gap: 8px;">
                <i data-lucide="brain-circuit" style="width: 18px;"></i> Análise Pedagógica
            </h4>
            <div style="margin-bottom: 15px;">
                <strong style="color: var(--green); font-size: 0.9rem;">Por que a ${correctAnswer} está correta?</strong>
                <p style="margin-top: 5px; font-size: 0.9rem; color: var(--fg-dim); line-height: 1.5;">${explanation.correctExplanation}</p>
            </div>
            <div style="margin-bottom: 15px;">
                <strong style="color: var(--red); font-size: 0.9rem;">Análise das outras alternativas:</strong>
                <p style="margin-top: 5px; font-size: 0.9rem; color: var(--fg-dim); line-height: 1.5;">${explanation.incorrectAnalysis}</p>
            </div>
            <div style="margin-bottom: 15px;">
                <strong style="color: var(--yellow); font-size: 0.9rem;">O "Pulo do Gato" (Evitando erros):</strong>
                <p style="margin-top: 5px; font-size: 0.9rem; color: var(--fg-dim); line-height: 1.5;">${explanation.distractorWarning}</p>
            </div>
            <div style="padding-top: 10px; border-top: 1px solid rgba(187, 154, 247, 0.2);">
                <strong style="color: var(--purple); font-size: 0.9rem;">Dica Extra:</strong>
                <p style="margin-top: 5px; font-size: 0.9rem; font-style: italic; color: var(--fg-dim);">${explanation.suggestedActivity}</p>
            </div>
        `;

        loading.classList.add("hidden");
        content.classList.remove("hidden");
        lucide.createIcons();
    } catch (err) {
        if (document.getElementById("ai-review-loading")) {
            document.getElementById("ai-review-loading").innerHTML = `<p style="color: var(--red); font-size: 0.9rem;">Não foi possível carregar a análise da IA para esta questão.</p>`;
        }
    }
}

/**
 * triggerPrefetchNext — dispara o prefetch HTTP da próxima correção.
 * Chamado logo após a correção atual ser exibida ao usuário.
 * Usa /quiz/prefetch-explanation que responde 202 e processa em background.
 */
function triggerPrefetchNext(index) {
    if (index >= reviewData.length) return;

    const cacheKey = buildReviewCacheKey(index) || `review_${index}`;

    // Já está em cache ou em andamento — não faz nada
    if (feedbackCache.has(cacheKey)) {
        console.log(`[Prefetch] Questão ${index} já está em cache, pulando prefetch`);
        return;
    }

    const nextQ = reviewData[index];
    const letters = ['A', 'B', 'C', 'D', 'E'];
    const userAnswer = userAnswers[index] || "";
    const correctAnswer = nextQ.correctAlternativeIndex !== undefined
        ? letters[nextQ.correctAlternativeIndex]
        : (nextQ.correctAlternative
            ? nextQ.correctAlternative.toUpperCase()
            : (nextQ.correct ? nextQ.correct.toUpperCase() : (nextQ.answer || "---")));
    const isCorrect = userAnswer === correctAnswer;
    const alts = nextQ.alternatives || nextQ.options || [];

    console.log(`[Prefetch] Iniciando prefetch da questão ${index}`);

    // Mostra indicador sutil de "Preparando próxima correção..."
    showPrefetchIndicator();

    // Guarda a promise no cache local para que fetchAIReview possa usá-la imediatamente
    const promise = fetch(API_URL + '/quiz/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            question: {
                context: nextQ.context || nextQ.question || nextQ.body || nextQ.title,
                command: nextQ.alternativesIntroduction || nextQ.question,
                alternatives: alts.map((alt, i) => `${letters[i]}) ${typeof alt === 'string' ? alt : (alt.text || "")}` ),
                correct: correctAnswer
            },
            userAnswer: userAnswer,
            isCorrect: !!isCorrect,
            cacheKey: cacheKey
        })
    }).then(res => {
        if (!res.ok) throw new Error('Erro no prefetch');
        return res.json();
    }).then(result => {
        console.log(`[Prefetch] Questão ${index} pronta!`);
        hidePrefetchIndicator();
        return result;
    }).catch(err => {
        console.warn(`[Prefetch] Falha na questão ${index}:`, err.message);
        feedbackCache.delete(cacheKey); // Permite retry
        hidePrefetchIndicator();
        throw err;
    });

    feedbackCache.set(cacheKey, promise);
}

// Mantém a função antiga como alias para compatibilidade
function prefetchNextCorrection(index) {
    triggerPrefetchNext(index);
}

// ── Indicador visual de prefetch ──────────────────────────────────────────────

/**
 * Exibe um indicador sutil (toast persistente) enquanto o prefetch está em andamento.
 * Respeita o sistema de temas (usa variáveis CSS).
 */
function showPrefetchIndicator() {
    // Evita duplicatas
    if (document.getElementById('prefetch-indicator')) return;

    const el = document.createElement('div');
    el.id = 'prefetch-indicator';
    el.style.cssText = [
        'position:fixed',
        'bottom:80px',
        'right:20px',
        'z-index:1500',
        'padding:8px 16px',
        'border-radius:20px',
        'background:var(--bg)',
        'border:1px solid var(--border)',
        'color:var(--fg-dim)',
        'font-size:0.78rem',
        'display:flex',
        'align-items:center',
        'gap:8px',
        'box-shadow:0 4px 12px rgba(0,0,0,0.2)',
        'opacity:0',
        'transition:opacity 0.4s ease',
        'pointer-events:none'
    ].join(';');

    el.innerHTML = `
        <div class="loader-spinner" style="width:12px;height:12px;border-width:2px;"></div>
        <span>Preparando próxima correção...</span>
    `;
    document.body.appendChild(el);
    // Anima entrada
    requestAnimationFrame(() => { el.style.opacity = '1'; });
}

function hidePrefetchIndicator() {
    const el = document.getElementById('prefetch-indicator');
    if (!el) return;
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 400);
}

function prevReview() {
    if (reviewIndex > 0) {
        reviewIndex--;
        renderReviewPage();
    }
}

async function saveReviewToHistory() {
    try {
        const questionsWithFeedback = [];
        const letters = ['A', 'B', 'C', 'D', 'E'];

        for (let i = 0; i < reviewData.length; i++) {
            const q = reviewData[i];
            const cacheKey = getReviewCacheKey(i);
            let feedback = null;
            try {
                feedback = feedbackCache.has(cacheKey) ? await feedbackCache.get(cacheKey) : null;
            } catch (e) {
                // prefetch pode ter falhado — continua sem feedback
            }
            
            const correctAnswer = q.correctAlternativeIndex !== undefined ? letters[q.correctAlternativeIndex] : 
                                (q.correctAlternative ? q.correctAlternative.toUpperCase() : (q.correct ? q.correct.toUpperCase() : (q.answer || "---")));
            
            questionsWithFeedback.push({
                questionText: q.context || q.question || q.body || q.title || "---",
                userAnswer: userAnswers[i] || "(Sem resposta)",
                correctAnswer: correctAnswer,
                isCorrect: userAnswers[i] === correctAnswer,
                aiFeedback: feedback // Pode ser null se o aluno não viu a correção
            });
        }

        let score = 0;
        questionsWithFeedback.forEach(q => { if (isCorrect(q.userAnswer, q.correctAnswer)) score++; });

        // Tenta inferir o tema do quiz atual
        const topic = document.getElementById("quick-topic")?.value || 
                      document.getElementById("combat-topic")?.value || 
                      currentExamInfo || "Estudo Geral";

        await fetch(API_URL + '/quiz/history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                topic,
                score,
                totalQuestions: reviewData.length,
                gameMode: gameMode,
                questions: questionsWithFeedback
            })
        });
        
        console.log("Histórico de revisão salvo com sucesso.");
    } catch (err) {
        console.error("Erro ao salvar histórico de revisão:", err);
    }
}

function isCorrect(user, correct) {
    if (!user || !correct) return false;
    return user.trim().toUpperCase() === correct.trim().toUpperCase();
}

function nextReview() {
    if (reviewIndex < reviewData.length - 1) {
        reviewIndex++;
        renderReviewPage();
    } else {
        // Antes de finalizar, salva no banco
        showLoader();
        saveReviewToHistory().finally(() => {
            hideLoader();
            location.reload();
        });
    }
}

// ── Helpers de cacheKey para o saveReviewToHistory ────────────────────────────
function getReviewCacheKey(idx) {
    return buildReviewCacheKey(idx) || `review_${idx}`;
}

function refreshLobbyUI(room) {
  currentRoom = room;
  const isHost = room.host === socket.id;
  
  // Atualizar Código e Tema
  document.getElementById("display-room-code").textContent = room.code;
  document.getElementById("display-theme").textContent = room.theme;
  
  // Controles do Host
  document.getElementById("host-controls").classList.toggle("hidden", !isHost);
  document.getElementById("wait-message").classList.toggle("hidden", isHost);

  // Injetar Trava de Times (apenas se for host)
  if (isHost) {
    const hostControls = document.getElementById("host-controls");
    const existingLock = document.getElementById("host-team-lock");
    if (!existingLock) {
      const lockDiv = document.createElement("div");
      lockDiv.id = "host-team-lock";
      lockDiv.style.cssText = "margin-bottom: 15px; display: flex; align-items: center; justify-content: center; gap: 10px; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 10px;";
      lockDiv.innerHTML = `
        <span style="font-weight: 700; font-size: 0.9rem;">Bloquear Troca de Times:</span>
        <label class="switch">
          <input type="checkbox" id="lock-teams-checkbox" ${room.teamsLocked ? 'checked' : ''} onchange="toggleTeamLock()">
          <span class="slider"></span>
        </label>
      `;
      hostControls.prepend(lockDiv);
    } else {
      document.getElementById("lock-teams-checkbox").checked = room.teamsLocked;
    }
  }

  // Injetar Botão de Adicionar Bot (Modo DEV)
  if (isHost && currentUser && currentUser.isAdmin && localStorage.getItem('dev-mode-active') === 'true') {
    const hostControls = document.getElementById("host-controls");
    const existingBotBtn = document.getElementById("dev-add-bot-btn");
    if (!existingBotBtn) {
      const botBtn = document.createElement("button");
      botBtn.id = "dev-add-bot-btn";
      botBtn.className = "btn-secondary";
      botBtn.style.cssText = "margin-top: 10px; background: var(--cyan);";
      botBtn.innerHTML = '<i data-lucide="bot" style="width:16px; margin-right:8px;"></i> DEV: Adicionar Bot';
      botBtn.onclick = addBotCombat;
      hostControls.appendChild(botBtn);
      lucide.createIcons();
    }
  }

  // Lista de Jogadores
  const blueList = document.getElementById("blue-team-list");
  const redList = document.getElementById("red-team-list");
  const spectatorList = document.getElementById("spectator-list");
  
  blueList.innerHTML = "";
  redList.innerHTML = "";
  spectatorList.innerHTML = "";

  const playersArr = Object.values(room.players);
  
  // Título com contagem
  const lobbyTitle = document.querySelector("#combat-lobby h2");
  lobbyTitle.innerHTML = `Sala: <span id="display-room-code">${room.code}</span> <small style="font-size: 0.9rem; color: var(--fg-dim); margin-left: 10px;">(${playersArr.length} jogadores)</small>`;

  playersArr.forEach(p => {
    const li = document.createElement("li");
    li.style.display = "flex";
    li.style.justifyContent = "space-between";
    li.style.alignItems = "center";
    
    const isMe = p.id === socket.id;
    const isHostMarker = p.id === room.host ? ' <i data-lucide="crown" style="width:14px; color:var(--yellow)"></i>' : '';
    
    let adminButtons = "";
    if (isHost && !isMe) {
        const otherTeam = p.team === "blue" ? "red" : (p.team === "red" ? "blue" : "blue");
        adminButtons = `
            <div style="display: flex; gap: 5px;">
                <button onclick="movePlayer('${p.id}', '${otherTeam}')" title="Mover Time" style="background: var(--blue); color: white; border: none; padding: 4px 8px; border-radius: 6px; cursor: pointer;"><i data-lucide="shuffle" style="width: 14px; height: 14px;"></i></button>
                <button onclick="kickPlayer('${p.id}')" title="Kickar" style="background: var(--red); color: white; border: none; padding: 4px 8px; border-radius: 6px; cursor: pointer;"><i data-lucide="user-x" style="width: 14px; height: 14px;"></i></button>
            </div>
        `;
    }

    li.innerHTML = `
        <span>${p.name}${isHostMarker} ${isMe ? '<strong style="color: var(--purple)"> (Você)</strong>' : ''}</span>
        ${adminButtons}
    `;
    
    if (isMe) li.style.borderLeft = "3px solid var(--purple)";
    
    if (p.team === "blue") blueList.appendChild(li);
    else if (p.team === "red") redList.appendChild(li);
    else spectatorList.appendChild(li);
  });
  
  lucide.createIcons();
}

function kickPlayer(playerId) {
    if (confirm("Tem certeza que deseja expulsar este jogador?")) {
        socket.emit("kick_player", { roomCode: currentRoom.code, playerId });
    }
}

function movePlayer(playerId, targetTeam) {
    socket.emit("move_player", { roomCode: currentRoom.code, playerId, targetTeam });
}

function toggleTeamLock() {
    socket.emit("toggle_team_lock", { roomCode: currentRoom.code });
}

function showLoadingPopup(message) {
  const overlay = document.createElement("div");
  overlay.className = "loading-overlay";
  overlay.id = "global-loading-popup";
  
  overlay.innerHTML = `
    <div class="loading-card">
      <div class="loading-icon-ai">🧠</div>
      <h2>Processando...</h2>
      <p>${message}</p>
    </div>
  `;
  
  document.body.appendChild(overlay);
}

function hideLoadingPopup() {
  const overlay = document.getElementById("global-loading-popup");
  if (overlay) overlay.remove();
}

function showCombatLobby(room) {
  showScreen("combat-lobby");
  refreshLobbyUI(room);
}

// Remover a função updateLobbyPlayers antiga

function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `feedback-toast ${type}`;
  toast.style.position = "fixed";
  toast.style.bottom = "20px";
  toast.style.right = "20px";
  toast.style.zIndex = "2000";
  toast.style.padding = "12px 24px";
  toast.style.borderRadius = "12px";
  toast.style.background = "var(--bg)";
  toast.style.border = `1px solid var(--border)`;
  toast.style.boxShadow = "0 10px 30px rgba(0,0,0,0.3)";
  toast.style.color = "var(--fg)";
  toast.style.animation = "slideIn 0.3s ease-out";
  
  let icon = "info";
  if (type === "success") {
    icon = "check-circle";
    toast.style.borderColor = "var(--green)";
    toast.style.color = "var(--green)";
  } else if (type === "error") {
    icon = "alert-circle";
    toast.style.borderColor = "var(--red)";
    toast.style.color = "var(--red)";
  }

  toast.innerHTML = `<i data-lucide="${icon}" style="width:18px; height:18px; vertical-align:middle; margin-right:8px;"></i> ${message}`;
  
  document.body.appendChild(toast);
  lucide.createIcons();

  setTimeout(() => {
    toast.style.animation = "slideOut 0.3s ease-in forwards";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function selectTeam(team) {
  socket.emit("select_team", { roomCode: currentRoom.code, team });
  let teamName = "Espectador";
  if (team === 'blue') teamName = "Time Azul";
  else if (team === 'red') teamName = "Time Vermelho";
  
  showToast(`Você entrou no ${teamName}`, "success");
}

// --- Ações do Servidor ---
function createRoom() {
  const theme = document.getElementById("combat-topic").value;
  if (!theme) return showToast("Digite um tema", "error");
  setupSocket();
  socket.emit("create_room", { theme, userName: currentUser.name });
}

function joinRoom() {
  const code = document.getElementById("room-code-input").value;
  if (code.length !== 6) return showToast("O código deve ter 6 dígitos", "error");
  setupSocket();
  socket.emit("join_room", { roomCode: code, userName: currentUser.name });
}

function startCombat() {
  socket.emit("start_quiz", { roomCode: currentRoom.code });
}

function addBotCombat() {
  if (currentRoom) {
    socket.emit("add_bot", { roomCode: currentRoom.code });
  }
}

// --- Quiz Rápido ---
let isLinkMode = false;
function toggleAdminLinkMode() {
  isLinkMode = !isLinkMode;
  
  const standardInputs = document.getElementById('quick-quiz-standard-inputs');
  const linkGroup = document.getElementById('admin-link-quiz-group');
  const toggleBtn = document.getElementById('admin-mode-toggle-btn');
  const startBtn = document.getElementById('btn-start-quick-quiz');

  if (isLinkMode) {
      standardInputs.classList.add('hidden');
      linkGroup.classList.remove('hidden');
      toggleBtn.innerHTML = '<i data-lucide="edit-3"></i> Mudar para Modo Tema';
      startBtn.innerHTML = 'Gerar Quiz dos Links';
  } else {
      standardInputs.classList.remove('hidden');
      linkGroup.classList.add('hidden');
      toggleBtn.innerHTML = '<i data-lucide="link"></i> Gerar Quiz a partir de links';
      startBtn.innerHTML = 'Iniciar Quiz';
  }
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function startQuickQuiz() {
  const amount = document.querySelector('input[name="amount"]:checked').value;
  let res;
  
  showLoader();
  try {
    if (isLinkMode) {
      const linksInput = document.getElementById("quick-quiz-links").value;
      const urls = linksInput.split(',').map(u => u.trim()).filter(Boolean);
      if (urls.length === 0) {
        hideLoader();
        return showToast("Insira pelo menos um link válido para começar", "error");
      }
      
      res = await fetch(API_URL + "/quiz/generate-from-links", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true"
        },
        body: JSON.stringify({ urls, amount }),
        credentials: 'include'
      });
    } else {
      const topic = document.getElementById("quick-topic").value;
      if (!topic) {
        hideLoader();
        return showToast("Digite um tema para começar", "error");
      }
      
      res = await fetch(API_URL + "/quiz/generate", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true"
        },
        body: JSON.stringify({ topic, amount }),
        credentials: 'include'
      });
    }
    
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || "Falha ao gerar quiz");
    }
    
    const quiz = await res.json();
    currentQuiz = quiz.questions;
    gameMode = 'quick';
    questionIndex = 0;
    userAnswers = [];
    feedbackCache.clear(); // Limpa cache para nova partida
    
    document.getElementById("curr-q").textContent = 1;
    document.getElementById("total-q").textContent = currentQuiz.length;
    document.getElementById("combat-scoreboard").classList.add("hidden");
    
    renderQuestion(currentQuiz[0]);
    showScreen("game-area");
    startTimeLimit();
  } catch (err) {
    alert(err.message);
  } finally {
    hideLoader();
  }
}

// --- Área de Jogo ---
function renderQuestion(q, isSpectator = false) {
  const container = document.getElementById("question-container");
  const nextBtn = document.getElementById("next-btn");
  
  container.innerHTML = `<p class="${isSpectator ? 'spectator-question' : ''}">${q.question}</p>`;
  
  // Reset botão
  nextBtn.disabled = true;
  nextBtn.textContent = "Confirmar Resposta";
  nextBtn.classList.toggle("hidden", isSpectator);

  // Injetar Painel de Desenvolvedor se aplicável
  if (!isSpectator && currentUser && currentUser.isAdmin && localStorage.getItem('dev-mode-active') === 'true') {
    const devBox = document.createElement("div");
    devBox.id = "dev-toolbox";
    devBox.style.cssText = "position:absolute; top:10px; right:10px; background:var(--bg-dark); border:1px solid var(--purple); border-radius:10px; padding:10px; z-index:100; box-shadow:0 5px 15px rgba(0,0,0,0.5);";
    
    devBox.innerHTML = `
        <div style="font-size: 0.65rem; color: var(--purple); font-weight: 800; margin-bottom: 8px; text-transform: uppercase;">Muriquiz Dev Tools</div>
        <div style="display: flex; gap: 5px;">
            <button onclick="devAutoSolveQuiz('perfect')" title="Acertar Tudo" style="background:var(--green); color:var(--bg-dark); border:none; padding:5px; border-radius:5px; cursor:pointer;"><i data-lucide="check-circle" style="width:14px; height:14px;"></i></button>
            <button onclick="devAutoSolveQuiz('random')" title="Aleatório" style="background:var(--yellow); color:var(--bg-dark); border:none; padding:5px; border-radius:5px; cursor:pointer;"><i data-lucide="shuffle" style="width:14px; height:14px;"></i></button>
            <button onclick="devAutoSolveQuiz('fail')" title="Errar Tudo" style="background:var(--red); color:var(--bg-dark); border:none; padding:5px; border-radius:5px; cursor:pointer;"><i data-lucide="x-circle" style="width:14px; height:14px;"></i></button>
        </div>
    `;
    container.style.position = "relative";
    container.appendChild(devBox);
    lucide.createIcons();
  }
  
  if (q.type === "multiple_choice") {
    const optionsList = document.createElement("div");
    optionsList.className = `options-list ${isSpectator ? 'spectator-options' : ''}`;
    
    q.options.forEach(opt => {
      const optionItem = document.createElement("div");
      optionItem.className = "option-item";
      
      optionItem.innerHTML = `
        <div class="option-check" ${isSpectator ? 'style="display:none"' : ''}></div>
        <div class="option-text">${opt}</div>
      `;
      
      if (!isSpectator) {
        optionItem.onclick = () => {
          document.querySelectorAll(".option-item").forEach(item => item.classList.remove("selected"));
          optionItem.classList.add("selected");
          nextBtn.disabled = false;
        };
      } else {
        optionItem.style.cursor = "default";
        optionItem.style.pointerEvents = "none";
      }
      
      optionsList.appendChild(optionItem);
    });
    
    container.appendChild(optionsList);
  } else {
    if (!isSpectator) {
      const input = document.createElement("input");
      input.type = "text";
      input.placeholder = "Sua resposta...";
      input.className = "open-input";
      input.id = "open-answer";
      input.oninput = () => {
        nextBtn.disabled = input.value.trim().length === 0;
      };
      container.appendChild(input);
    } else {
      const p = document.createElement("p");
      p.style.color = "var(--fg-dim)";
      p.style.fontStyle = "italic";
      p.style.textAlign = "center";
      p.style.marginTop = "20px";
      p.textContent = "(Pergunta Dissertativa - Aguardando jogadores)";
      container.appendChild(p);
    }
  }
}

function showFeedbackPopup(isCorrect, correctAnswer = null) {
  // Não mostra feedback para espectadores (visão neutra)
  const myPlayer = currentRoom?.players[socket.id];
  if (myPlayer && myPlayer.team === "spectator") return;

  const overlay = document.createElement("div");
  overlay.className = "feedback-overlay";
  
  overlay.innerHTML = `
    <div class="feedback-card ${isCorrect ? 'correct' : 'wrong'}">
      <div class="feedback-icon">${isCorrect ? '✅' : '❌'}</div>
      <h2>${isCorrect ? 'Correto!' : 'Não foi dessa vez!'}</h2>
      <p>${isCorrect ? 'Muito bem, continue assim!' : `A resposta correta era: <strong>${correctAnswer || '---'}</strong>`}</p>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  setTimeout(() => {
    overlay.style.opacity = "0";
    overlay.style.transition = "opacity 0.3s ease";
    setTimeout(() => overlay.remove(), 300);
  }, 2000);
}



function nextQuickQuestion() {
  questionIndex++;
  if (questionIndex < currentQuiz.length) {
    document.getElementById("curr-q").textContent = questionIndex + 1;
    renderQuestion(currentQuiz[questionIndex]);
    resetTimer();
  } else {
    finishQuickQuiz();
  }
}

async function devAutoSolveQuiz(strategy = 'perfect') {
  const strategyNames = { 'perfect': 'Tudo Certo', 'random': 'Aleatório', 'fail': 'Tudo Errado' };
  if (!confirm(`Desenvolvedor: Deseja resolver o quiz com a estratégia "${strategyNames[strategy]}"?`)) return;
  
  showLoader();
  try {
    const questions = gameMode === 'micro-enem' ? microQuestionsData : currentQuiz;
    
    // Formata o quiz se for Micro-ENEM (que tem estrutura diferente da API original)
    const formattedQuestions = gameMode === 'micro-enem' ? questions.map(q => {
        const letters = ['A', 'B', 'C', 'D', 'E'];
        return {
            type: "multiple_choice",
            question: q.context || q.body || q.title,
            correct: q.correctAlternativeIndex !== undefined ? letters[q.correctAlternativeIndex] : q.correctAlternative.toUpperCase()
        };
    }) : questions;

    const res = await fetch(API_URL + "/quiz/solve-auto", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quiz: { questions: formattedQuestions },
        strategy: strategy
      }),
      credentials: 'include'
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || "Falha na resolução automática");
    }

    const data = await res.json();
    
    if (gameMode === 'micro-enem') {
        userAnswers = data.answers;
        finishMicroEnem();
    } else {
        reviewData = currentQuiz; // Preparar dados para revisão
        showResults({ mode: 'quick', analysis: data.analysis });
    }
    
    showToast(`Quiz resolvido (${strategyNames[strategy]})`, "success");
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    hideLoader();
  }
}

// --- Timer ---
function startTimeLimit() {
  timeRemaining = 180;
  updateTimerDisplay();
  gameTimer = setInterval(() => {
    timeRemaining--;
    updateTimerDisplay();
    if (timeRemaining <= 0) {
      if (gameMode === 'quick') {
        userAnswers.push("");
        nextQuickQuestion();
      }
    }
  }, 1000);
}

function resetTimer() {
  clearInterval(gameTimer);
  startTimeLimit();
}

function startTimerDisplay() {
  // Para combate, o timer vem do socket, apenas atualizamos a tela
  document.getElementById("next-btn").disabled = false;
  document.getElementById("next-btn").textContent = "Confirmar Resposta";
}

function updateTimerDisplay() {
  const mins = Math.floor(timeRemaining / 60);
  const secs = timeRemaining % 60;
  document.getElementById("game-timer").textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// --- Resultados ---
async function finishQuickQuiz() {
  clearInterval(gameTimer);
  showLoader();
  try {
    const res = await fetch(API_URL + "/quiz/submit", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true"
      },
      body: JSON.stringify({
        quiz: { questions: currentQuiz },
        answers: userAnswers
      }),
      credentials: 'include'
    });
    const analysis = await res.json();
    
    reviewData = currentQuiz; // Preparar dados para revisão
    showResults({ mode: 'quick', analysis });
  } catch (err) {
    alert("Erro ao analisar resultados");
  } finally {
    hideLoader();
  }
}

function showResults(data) {
  showScreen("results-screen");
  const content = document.getElementById("results-content");
  content.innerHTML = "";

  if (data.mode === 'quick') {
    document.getElementById("results-title").textContent = "Análise do seu Desempenho";
    const analysis = data.analysis;
    content.innerHTML = `
      <h3>Resumo</h3>
      <p>${analysis.resumo}</p>
      <h3>Dificuldades</h3>
      <p>${analysis.dificuldades}</p>
      <h3>Conteúdo de Apoio</h3>
      <p>${analysis.content}</p>
      
      <div style="text-align: center; margin-top: 30px; border-top: 1px solid var(--border); padding-top: 20px;">
        <p style="color: var(--fg-dim); margin-bottom: 20px;">Deseja entender profundamente cada resposta com ajuda da IA?</p>
        <button onclick="startReview()" class="btn-primary" style="padding: 18px 30px; font-size: 1.2rem; width: auto;">
          <i data-lucide="book-open" style="width: 20px; vertical-align: middle; margin-right: 10px;"></i> Iniciar Revisão Pedagógica
        </button>
      </div>
    `;
  } else {
    document.getElementById("results-title").textContent = "Fim do Combate!";
    const winnerText = data.winner === 'draw' ? "Empate!" : `Vitória do Time ${data.winner === 'blue' ? 'Azul' : 'Vermelho'}!`;
    const winnerColor = data.winner === 'draw' ? 'var(--yellow)' : `var(--${data.winner})`;
    
    document.getElementById("leave-results-btn").classList.remove("hidden");

    let rankingsHtml = `
      <h2 style="color: ${winnerColor}; text-align: center; font-size: 2.5rem; margin-bottom: 20px;">${winnerText}</h2>
      <div class="final-scores" style="display: flex; justify-content: space-around; margin-bottom: 30px; font-size: 1.5rem; font-weight: bold;">
        <div style="color: var(--blue)">Time Azul: ${data.scores.blue}/${data.targets.blue}</div>
        <div style="color: var(--red)">Time Vermelho: ${data.scores.red}/${data.targets.red}</div>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        <div class="team-ranking-box" style="background: rgba(0, 123, 255, 0.1); padding: 20px; border-radius: 15px; border: 1px solid var(--blue);">
          <h3 style="color: var(--blue); margin-top: 0;">Time Azul</h3>
          ${renderTeamRanking(data.players, "blue", data.mvps.blue)}
        </div>
        <div class="team-ranking-box" style="background: rgba(220, 53, 69, 0.1); padding: 20px; border-radius: 15px; border: 1px solid var(--red);">
          <h3 style="color: var(--red); margin-top: 0;">Time Vermelho</h3>
          ${renderTeamRanking(data.players, "red", data.mvps.red)}
        </div>
      </div>
    `;
    content.innerHTML = rankingsHtml;
  }
  lucide.createIcons();
}

function renderTeamRanking(players, team, mvp) {
  const teamPlayers = Object.values(players)
    .filter(p => p.team === team)
    .sort((a, b) => b.score - a.score);
    
  if (teamPlayers.length === 0) return "<p>Nenhum jogador</p>";
  
  return `
    <ul style="list-style: none; padding: 0;">
      ${teamPlayers.map(p => `
        <li style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
          <span>
            ${p.name} 
            ${mvp && p.id === mvp.id ? '<span style="color: var(--yellow); font-size: 0.8rem; border: 1px solid var(--yellow); padding: 2px 6px; border-radius: 10px; margin-left: 5px;">👑 MVP</span>' : ''}
          </span>
          <strong>${p.score} acertos</strong>
        </li>
      `).join('')}
    </ul>
  `;
}

// --- Helpers ---
function showLoader() { document.getElementById("page-loader").classList.remove("hidden"); }
function hideLoader() { document.getElementById("page-loader").classList.add("hidden"); }
function logout() {
  // Limpar sessão e redirecionar
  sessionStorage.clear();
  window.location.href = getBaseUrl() + 'pages/login/index.html';
}
function toggleSettings() { document.querySelector(".sidebar-settings").classList.toggle("collapsed"); }
function setTheme(theme) {
  document.documentElement.classList.remove('light-theme', 'contrast-theme');
  if (theme !== 'dark') document.documentElement.classList.add(theme + '-theme');
  localStorage.setItem('preferred-theme', theme);
}
function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  const mainContent = document.querySelector(".main-content");
  const toggleBtn = document.querySelector(".sidebar-toggle");

  sidebar.classList.toggle("open");
  mainContent.classList.toggle("pushed");
  toggleBtn.classList.toggle("active");
}

window.onbeforeunload = function() {
  if (gameMode === 'combat' && currentRoom && currentRoom.status !== 'finished') {
    return "Você está em um combate ativo. Tem certeza que deseja sair?";
  }
  if (gameMode === 'essay') {
    return "Você está escrevendo uma redação. Tem certeza que deseja sair? (O rascunho foi salvo automaticamente)";
  }
};

// ============================================================
// MODO REDAÇÃO
// ============================================================

// Estado da redação
let essayThemeData = null;       // Dados completos do tema gerado pela IA
let essayNorteadoresData = null; // Textos norteadores (pode vir junto ou separado)
let essayAutoSaveTimer = null;   // Timer de auto-save

const ESSAY_MAX_LINES = 30;      // Número máximo de linhas
const ESSAY_LINE_HEIGHT = 32;    // Altura em px de cada linha (ajustar conforme CSS)
const ESSAY_DRAFT_KEY = 'essay-draft-current'; // Chave do localStorage para o rascunho

/** Exibe a tela de configuração do modo Redação */
function showEssayConfig() {
  showScreen('essay-config');
}

/** Inicia o modo Redação: chama a IA, monta a área de escrita */
async function startEssayMode() {
  const btn = document.getElementById('start-essay-btn');
  btn.disabled = true;
  btn.innerHTML = '<div class="loader-spinner" style="width:22px;height:22px;display:inline-block;vertical-align:middle;margin-right:10px;"></div> Gerando tema...';

  showLoadingPopup('A IA está preparando um tema relevante para o ENEM...');

  try {
    const res = await fetch(API_URL + '/quiz/essay-theme', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'
      },
      credentials: 'include'
    });

    if (!res.ok) throw new Error('Falha ao gerar tema de redação');

    const data = await res.json();
    essayThemeData = data;
    essayNorteadoresData = data.norteadores || null;

    // Preenche o cabeçalho
    document.getElementById('essay-theme-title').textContent = data.tema;

    // Preenche as competências do ENEM
    const compEl = document.getElementById('essay-competencias');
    if (data.competencias && data.competencias.length > 0) {
      compEl.innerHTML = data.competencias.map(c =>
        `<span class="essay-competencia-tag">${c}</span>`
      ).join('');
    }

    // Configura o modo
    gameMode = 'essay';
    setupSocket();
    hideNavigation();
    showScreen('essay-area');

    // Inicializa a área de escrita
    initEssayArea();

    // Tenta carregar rascunho anterior
    loadDraft();

  } catch (err) {
    showToast('Erro ao gerar tema: ' + err.message, 'error');
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="pencil" style="width:22px;vertical-align:middle;margin-right:10px;"></i> Iniciar Redação';
    lucide.createIcons();
  } finally {
    hideLoadingPopup();
  }
}

/** Inicializa a área de escrita: cria os números de linha e configura o textarea */
function initEssayArea() {
  const lineNumbers = document.getElementById('essay-line-numbers');
  lineNumbers.innerHTML = '';

  // Cria os 30 números de linha
  for (let i = 1; i <= ESSAY_MAX_LINES; i++) {
    const span = document.createElement('span');
    span.textContent = i;
    span.id = `line-num-${i}`;
    if (i === 1) span.classList.add('line-active');
    lineNumbers.appendChild(span);
  }

  // Foca no textarea
  const textarea = document.getElementById('essay-textarea');
  textarea.value = '';
  textarea.focus();

  // Atualiza os contadores iniciais
  updateEssayCounters(textarea);

  // Auto-save a cada 30 segundos
  clearInterval(essayAutoSaveTimer);
  essayAutoSaveTimer = setInterval(() => {
    saveDraft(true); // true = silencioso
  }, 30000);

  lucide.createIcons();
}

/** Callback de input do textarea — atualiza contadores e linhas ativas */
function onEssayInput() {
  const textarea = document.getElementById('essay-textarea');
  updateEssayCounters(textarea);

  // Destaca o número da linha atual
  const linesText = textarea.value.split('\n');
  const cursorPos = textarea.selectionStart;
  let charCount = 0;
  let currentLine = 1;
  for (let i = 0; i < linesText.length; i++) {
    charCount += linesText[i].length + 1; // +1 pelo \n
    if (cursorPos <= charCount) {
      currentLine = i + 1;
      break;
    }
  }

  // Atualiza highlight da linha ativa
  document.querySelectorAll('#essay-line-numbers span').forEach(el => el.classList.remove('line-active'));
  const activeEl = document.getElementById(`line-num-${currentLine}`);
  if (activeEl) activeEl.classList.add('line-active');
}

/** Previne digitar além de 30 linhas */
function onEssayKeydown(event) {
  if (event.key === 'Enter') {
    const textarea = document.getElementById('essay-textarea');
    const lines = textarea.value.split('\n');
    if (lines.length >= ESSAY_MAX_LINES) {
      event.preventDefault();
      showToast(`Limite de ${ESSAY_MAX_LINES} linhas atingido!`, 'error');
    }
  }
}

/** Atualiza contadores de linhas, palavras e barra de progresso */
function updateEssayCounters(textarea) {
  const text = textarea.value;
  const lines = text === '' ? [] : text.split('\n');
  const lineCount = Math.min(lines.length, ESSAY_MAX_LINES);
  const wordCount = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;

  // Atualiza contadores no header
  document.getElementById('essay-line-count').textContent = `${lineCount} ${lineCount === 1 ? 'linha' : 'linhas'}`;
  document.getElementById('essay-word-count').textContent = `${wordCount} ${wordCount === 1 ? 'palavra' : 'palavras'}`;

  // Atualiza barra de progresso
  const progress = Math.min((lineCount / ESSAY_MAX_LINES) * 100, 100);
  document.getElementById('essay-progress-fill').style.width = `${progress}%`;
  document.getElementById('essay-progress-text').textContent = `${lineCount} / ${ESSAY_MAX_LINES} linhas`;

  // Cor da barra de progresso: verde até 25 linhas, amarelo de 26-29, vermelho em 30
  const fillEl = document.getElementById('essay-progress-fill');
  fillEl.classList.remove('progress-ok', 'progress-warn', 'progress-full');
  if (lineCount < 26) fillEl.classList.add('progress-ok');
  else if (lineCount < 30) fillEl.classList.add('progress-warn');
  else fillEl.classList.add('progress-full');

  // Destaca números de linha preenchidos
  document.querySelectorAll('#essay-line-numbers span').forEach((el, i) => {
    el.classList.toggle('line-filled', i < lineCount);
  });
}

/** Salva o rascunho no localStorage */
function saveDraft(silent = false) {
  const textarea = document.getElementById('essay-textarea');
  if (!textarea) return;

  const draftData = {
    tema: essayThemeData?.tema || '',
    text: textarea.value,
    savedAt: new Date().toISOString()
  };

  localStorage.setItem(ESSAY_DRAFT_KEY, JSON.stringify(draftData));

  if (!silent) {
    const btn = document.getElementById('btn-save-draft');
    const original = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="check-circle"></i> Salvo!';
    btn.style.background = 'var(--green)';
    lucide.createIcons();
    setTimeout(() => {
      btn.innerHTML = original;
      btn.style.background = '';
      lucide.createIcons();
    }, 2000);
  }
}

/** Carrega o rascunho do localStorage (se existir e for do mesmo tema) */
function loadDraft() {
  try {
    const saved = localStorage.getItem(ESSAY_DRAFT_KEY);
    if (!saved) return;
    const draft = JSON.parse(saved);

    if (draft.tema === essayThemeData?.tema && draft.text && draft.text.length > 0) {
      // Perguntar se quer restaurar
      const textarea = document.getElementById('essay-textarea');
      textarea.value = draft.text;
      updateEssayCounters(textarea);
      showToast('Rascunho anterior restaurado.', 'info');
    }
  } catch (e) {
    // Ignora erros de parse
  }
}

/** Abre o modal de textos norteadores */
function openNorteadoresModal() {
  const overlay = document.getElementById('norteadores-overlay');
  overlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  const contentEl = document.getElementById('norteadores-content');

  // Se já temos os dados, renderiza imediatamente
  if (essayNorteadoresData && essayNorteadoresData.length > 0) {
    renderNorteadores(contentEl, essayNorteadoresData);
  } else {
    // Mostra loading e aguarda
    contentEl.innerHTML = `
      <div class="norteadores-loading">
        <div class="loader-spinner" style="width:28px;height:28px;margin:0 auto 16px;"></div>
        <p>A IA está preparando os textos de apoio...</p>
      </div>
    `;
  }

  lucide.createIcons();
}

/** Renderiza os textos norteadores no modal */
function renderNorteadores(container, norteadores) {
  if (!norteadores || norteadores.length === 0) {
    container.innerHTML = '<p style="color:var(--fg-dim);text-align:center;padding:20px;">Nenhum texto norteador disponível.</p>';
    return;
  }

  container.innerHTML = norteadores.map((n, i) => `
    <div class="norteador-item">
      <div class="norteador-num">Texto ${i + 1}</div>
      <div class="norteador-tipo">${n.tipo || 'Texto de apoio'}</div>
      <p class="norteador-texto">${n.texto}</p>
      ${n.fonte ? `<div class="norteador-fonte">Fonte: ${n.fonte}</div>` : ''}
    </div>
  `).join('');
}

/** Fecha o modal de textos norteadores */
function closeNorteadoresModal(event) {
  // Fecha se: chamado diretamente (sem event), ou se clicou exatamente no overlay
  if (event && event.target !== document.getElementById('norteadores-overlay')) return;
  const overlay = document.getElementById('norteadores-overlay');
  overlay.classList.add('hidden');
  document.body.style.overflow = '';
}

/** Sai do modo Redação com confirmação */
function exitEssayMode() {
  if (confirm('Tem certeza que deseja sair? Seu rascunho será salvo automaticamente.')) {
    saveDraft(true); // salva silenciosamente
    clearInterval(essayAutoSaveTimer);
    gameMode = null;
    essayThemeData = null;
    essayNorteadoresData = null;
    showNavigation();
    showScreen('selection-screen');
  }
}

/** Inicia a correção da redação enviando os dados para a IA */
async function correctEssay() {
  const textarea = document.getElementById('essay-textarea');
  if (!textarea) return;

  const text = textarea.value.trim();
  if (text.length < 50) {
    showToast("Por favor, escreva uma redação mais longa (mínimo de 50 caracteres) antes de solicitar a correção.", "warning");
    return;
  }

  // Garante que o socket está inicializado e conectado
  setupSocket();
  if (!socket || !socket.connected) {
    showLoadingPopup("Conectando ao servidor para envio...");
    setTimeout(() => {
      if (!socket || !socket.connected) {
        hideLoadingPopup();
        showToast("Não foi possível conectar ao servidor. Verifique sua internet.", "error");
        return;
      }
      hideLoadingPopup();
      sendEssayForCorrection(text);
    }, 1500);
  } else {
    sendEssayForCorrection(text);
  }
}

/** Envia o evento de correção pelo socket ativo */
function sendEssayForCorrection(text) {
  const btn = document.getElementById('btn-correct-essay');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<div class="loader-spinner" style="width:18px;height:18px;display:inline-block;vertical-align:middle;margin-right:10px;"></div> Corrigindo...';
  }

  showLoadingPopup("A IA está corrigindo sua redação com base nos critérios do ENEM. Isso pode levar alguns segundos...");

  // Salva o rascunho preventivamente
  saveDraft(true);

  const theme = essayThemeData?.tema || "Tema Geral ENEM";

  // Verifica se havia um prefetch pronto para este texto+tema
  const prefetchKey = buildEssayPrefetchKey(text, theme);
  const hasPrefetch = essayPrefetchState.cacheKey === prefetchKey &&
                      essayPrefetchState.status === 'prefetched';

  if (hasPrefetch) {
    console.log(`[Essay] Usando prefetch pronto: ${prefetchKey}`);
    // O servidor já tem em cache — envia com a cacheKey para recuperar rapidamente
    socket.emit("correctEssay", {
      text: text,
      theme: theme,
      cacheKey: prefetchKey
    });
  } else {
    console.log(`[Essay] Sem prefetch disponível – corrigindo normalmente`);
    socket.emit("correctEssay", {
      text: text,
      theme: theme
    });
  }

  // Reseta estado de prefetch (será reativado no handleEssayCorrectionResult)
  essayPrefetchState.status = 'idle';
  essayPrefetchState.cacheKey = null;
}

/** Processa o resultado da correção vindo do backend */
function handleEssayCorrectionResult(data) {
  hideLoadingPopup();
  const btn = document.getElementById('btn-correct-essay');
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="brain-circuit"></i> Corrigir Redação';
  }

  if (!data || !data.markedText) {
    showToast("Erro ao processar a resposta da IA. Tente novamente.", "error");
    return;
  }

  const textarea = document.getElementById('essay-textarea');
  const correctedView = document.getElementById('essay-corrected-view');
  
  // 1. Oculta o editor e mostra a visualização marcada
  textarea.classList.add('hidden');
  correctedView.classList.remove('hidden');
  correctedView.innerHTML = data.markedText;

  // 2. Preenche o feedback geral
  document.getElementById('essay-general-feedback').textContent = data.generalFeedback || "Sem feedback geral.";

  // 3. Preenche a lista de notas explicativas
  const notesContainer = document.getElementById('essay-notes-list');
  notesContainer.innerHTML = '';

  if (data.notes && data.notes.length > 0) {
    data.notes.forEach(note => {
      const noteEl = document.createElement('div');
      noteEl.className = `essay-note-item note-${note.color || 'yellow'}`;
      noteEl.id = `essay-note-${note.id}`;

      let labelText = "Dica de Melhoria";
      if (note.color === 'red') labelText = "Erro Grave";
      else if (note.color === 'green') labelText = "Ponto Positivo";

      noteEl.innerHTML = `
        <div class="essay-note-title-bar">
          <span class="essay-note-label label-${note.color || 'yellow'}">${labelText}</span>
          <span class="essay-note-id">Nota #${note.id}</span>
        </div>
        <div class="essay-note-excerpt">"${note.excerpt || ''}"</div>
        <div class="essay-note-explanation">${note.explanation || ''}</div>
      `;
      notesContainer.appendChild(noteEl);
    });
  } else {
    notesContainer.innerHTML = '<p style="color:var(--fg-dim);text-align:center;padding:10px;">Nenhuma marcação específica foi feita no texto.</p>';
  }

  // 4. Mostra o contêiner de resultados
  const resultsSection = document.getElementById('essay-correction-results');
  resultsSection.classList.remove('hidden');

  // 5. Altera os botões de ação inferiores
  const actionsContainer = document.getElementById('essay-bottom-actions');
  actionsContainer.innerHTML = `
    <button class="btn-essay-action btn-edit-back" id="btn-edit-back" onclick="editEssayAgain()">
      <i data-lucide="edit"></i>
      Editar Redação
    </button>
    <button class="btn-essay-action btn-new-essay" id="btn-new-essay" onclick="resetAndNewEssay()">
      <i data-lucide="plus-circle"></i>
      Nova Redação
    </button>
  `;

  lucide.createIcons();

  // 6. Rola suavemente até o início do feedback
  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // 7. Dispara prefetch de uma nova correção em background
  //    (caso o usuário edite e envie novamente, a IA já estará trabalhando)
  //    Aguarda 3s para não competir com o upload atual
  setTimeout(() => {
    scheduleEssayPrefetch();
  }, 3000);
}

/** Manipulador de erro vindo do backend */
function handleEssayCorrectionError(err) {
  hideLoadingPopup();
  const btn = document.getElementById('btn-correct-essay');
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="brain-circuit"></i> Corrigir Redação';
  }
  // Reseta estado de prefetch em caso de erro
  essayPrefetchState.status = 'idle';
  essayPrefetchState.cacheKey = null;
  showToast(err.message || "Ocorreu um erro ao corrigir a redação. Tente novamente.", "error");
}

/** Permite que o aluno edite novamente o texto original */
function editEssayAgain() {
  const textarea = document.getElementById('essay-textarea');
  const correctedView = document.getElementById('essay-corrected-view');
  const resultsSection = document.getElementById('essay-correction-results');
  
  textarea.classList.remove('hidden');
  correctedView.classList.add('hidden');
  resultsSection.classList.add('hidden');

  // Restaura o botão de correção original
  const actionsContainer = document.getElementById('essay-bottom-actions');
  actionsContainer.innerHTML = `
    <button class="btn-essay-correct" id="btn-correct-essay" onclick="correctEssay()">
      <i data-lucide="brain-circuit"></i>
      Corrigir Redação
    </button>
  `;
  lucide.createIcons();

  // Rola de volta para o papel e foca no editor
  textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
  textarea.focus();

  // Agenda prefetch da próxima correção (texto atual já digitado)
  // Aguarda 5s para o usuário começar a editar antes de gerar
  setTimeout(() => scheduleEssayPrefetch(), 5000);
}

/** Reseta a redação e busca um novo tema do ENEM */
function resetAndNewEssay() {
  if (confirm("Tem certeza de que deseja iniciar uma nova redação? Isso apagará seu rascunho atual e a correção.")) {
    localStorage.removeItem(ESSAY_DRAFT_KEY);
    
    // Limpa a tela
    const textarea = document.getElementById('essay-textarea');
    textarea.value = '';
    textarea.classList.remove('hidden');
    
    const correctedView = document.getElementById('essay-corrected-view');
    correctedView.innerHTML = '';
    correctedView.classList.add('hidden');
    
    const resultsSection = document.getElementById('essay-correction-results');
    resultsSection.classList.add('hidden');
    
    // Restaura o botão original
    const actionsContainer = document.getElementById('essay-bottom-actions');
    actionsContainer.innerHTML = `
      <button class="btn-essay-correct" id="btn-correct-essay" onclick="correctEssay()">
        <i data-lucide="brain-circuit"></i>
        Corrigir Redação
      </button>
    `;
    lucide.createIcons();
    
    // Inicia um novo tema
    startEssayMode();
  }
}

/** Listener de clique global para navegar suavemente do trecho destacado até a nota explicativa correspondente */
document.addEventListener('click', (event) => {
  const highlightSpan = event.target.closest('[data-note-id]');
  if (highlightSpan) {
    const noteId = highlightSpan.getAttribute('data-note-id');
    const noteEl = document.getElementById(`essay-note-${noteId}`);
    if (noteEl) {
      noteEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      noteEl.classList.add('flash-highlight');
      setTimeout(() => {
        noteEl.classList.remove('flash-highlight');
      }, 1800);
    }
  }
});

// ── Sistema de Prefetch para Modo Redação ────────────────────────────────────

/**
 * Agenda o prefetch da próxima correção de redação.
 * Usa o texto atual do textarea + tema para construir a cacheKey.
 * Só dispara se o socket estiver conectado e o texto tiver >= 50 chars.
 */
function scheduleEssayPrefetch() {
  if (!socket || !socket.connected) return;
  if (gameMode !== 'essay') return;

  const textarea = document.getElementById('essay-textarea');
  if (!textarea) return;

  const text = textarea.value.trim();
  const theme = essayThemeData?.tema || "Tema Geral ENEM";

  if (text.length < 50) return; // Texto muito curto, não vale prefetch

  const cacheKey = buildEssayPrefetchKey(text, theme);

  // Já está prefetchando ou pronto para este texto — nada a fazer
  if (essayPrefetchState.cacheKey === cacheKey &&
      (essayPrefetchState.status === 'prefetching' || essayPrefetchState.status === 'prefetched')) {
    return;
  }

  console.log(`[Essay Prefetch] Agendando prefetch: ${cacheKey}`);
  essayPrefetchState.cacheKey = cacheKey;
  essayPrefetchState.status = 'prefetching';
  essayPrefetchState.pendingText = text;
  essayPrefetchState.pendingTheme = theme;

  // Indicador visual sutil no botão de correção
  updateEssayPrefetchUI('prefetching');

  socket.emit('prefetchEssayCorrection', { text, theme, cacheKey });
}

/**
 * Atualiza o indicador visual de prefetch no botão da redação.
 * @param {'prefetching'|'prefetched'|'idle'} status
 */
function updateEssayPrefetchUI(status) {
  const btn = document.getElementById('btn-correct-essay');
  if (!btn) return;

  // Remove badge anterior
  const existing = document.getElementById('essay-prefetch-badge');
  if (existing) existing.remove();

  if (status === 'prefetching') {
    const badge = document.createElement('div');
    badge.id = 'essay-prefetch-badge';
    badge.style.cssText = [
      'position:absolute', 'top:-8px', 'right:-8px',
      'background:var(--purple)', 'color:var(--bg-dark)',
      'border-radius:50%', 'width:18px', 'height:18px',
      'display:flex', 'align-items:center', 'justify-content:center',
      'font-size:10px', 'font-weight:800'
    ].join(';');
    badge.textContent = '↻';
    badge.title = 'IA preparando correção em segundo plano...';
    btn.style.position = 'relative';
    btn.appendChild(badge);
  } else if (status === 'prefetched') {
    const badge = document.createElement('div');
    badge.id = 'essay-prefetch-badge';
    badge.style.cssText = [
      'position:absolute', 'top:-8px', 'right:-8px',
      'background:var(--green)', 'color:var(--bg-dark)',
      'border-radius:50%', 'width:18px', 'height:18px',
      'display:flex', 'align-items:center', 'justify-content:center',
      'font-size:12px', 'font-weight:800'
    ].join(';');
    badge.textContent = '✓';
    badge.title = 'Correção já preparada! Será instantânea.';
    btn.style.position = 'relative';
    btn.appendChild(badge);
  }
}

/**
 * Registra os handlers de eventos de prefetch de redação no socket.
 * Deve ser chamado dentro de setupSocket() após a criação do socket.
 */
function registerEssayPrefetchHandlers(sock) {
  // O servidor confirmou que o prefetch foi iniciado
  sock.on('essayPrefetchStarted', ({ cacheKey }) => {
    if (essayPrefetchState.cacheKey === cacheKey) {
      console.log(`[Essay Prefetch] Servidor confirmou início: ${cacheKey}`);
    }
  });

  // O servidor concluiu o prefetch — a correção está em cache
  sock.on('essayPrefetchReady', ({ cacheKey }) => {
    if (essayPrefetchState.cacheKey === cacheKey) {
      console.log(`[Essay Prefetch] Pronto! ${cacheKey}`);
      essayPrefetchState.status = 'prefetched';
      updateEssayPrefetchUI('prefetched');
      showToast('Correção pré-carregada! Será instantânea quando você enviar.', 'success');
    }
  });

  // O servidor confirmou que a correção começou a ser processada
  sock.on('essayCorrectionStarted', ({ cacheKey }) => {
    console.log(`[Essay] Correção iniciada no servidor: ${cacheKey}`);
  });
}
