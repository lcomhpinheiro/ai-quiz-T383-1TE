// Dynamic Base URL and API constants for static client environment
const API_URL = "https://www.muriquiz.online";

function getBaseUrl() {
    const path = window.location.pathname;
    const pagesIndex = path.indexOf('/pages/');
    if (pagesIndex !== -1) {
        return path.substring(0, pagesIndex + 1);
    }
    return '../../'; // fallback depth 2 prefix
}

// --- Estágio Global ---
let userHistoryData = [];

document.addEventListener("DOMContentLoaded", async () => {
    initTheme();
    await loadUserData();
    await loadStudyHistory();
    lucide.createIcons();
});

async function loadUserData() {
    try {
        const res = await fetch(API_URL + "/user/me", { 
            credentials: 'include',
            headers: { 'ngrok-skip-browser-warning': 'true' }
        });
        if (res.ok) {
            const data = await res.json();
            document.getElementById("userNameGreeting").textContent = `Olá, ${data.user.name.split(' ')[0]}`;
            
            if (data.user && data.user.isAdmin) {
                const nav = document.querySelector('.sidebar-nav');
                if (nav && !nav.querySelector('a[href="/admin"]')) {
                    const adminLink = document.createElement('a');
                    adminLink.href = '/admin';
                    adminLink.className = 'nav-item';
                    adminLink.innerHTML = '<i data-lucide="shield-alert"></i> Admin';
                    nav.appendChild(adminLink);
                    if (typeof lucide !== 'undefined') lucide.createIcons();
                }
            }
        }
    } catch (err) {
        console.error("Erro ao carregar dados do usuário:", err);
    } finally {
        hideLoader();
    }
}

async function loadStudyHistory() {
    try {
        const res = await fetch(API_URL + "/quiz/history", { 
            headers: { 'ngrok-skip-browser-warning': 'true' }
        });
        if (res.ok) {
            userHistoryData = await res.json();
            renderHistoryList(userHistoryData);
        }
    } catch (err) {
        console.error("Erro ao carregar histórico:", err);
    }
}

function renderHistoryList(history) {
    const list = document.getElementById("history-list");
    if (!list) return;

    if (history.length === 0) {
        list.innerHTML = `
            <div class="empty-history">
                <i data-lucide="ghost" style="width: 64px; height: 64px; color: var(--fg-dim); margin-bottom: 20px;"></i>
                <h3>Nada por aqui ainda...</h3>
                <p style="color: var(--fg-dim);">Finalize um Quiz ou Simulado para salvar suas revisões.</p>
                <a href="/learning" class="btn-primary" style="display: inline-block; margin-top: 20px; width: auto; padding: 12px 30px; text-decoration: none;">Começar a Estudar</a>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    list.innerHTML = history.map((item, index) => {
        const date = new Date(item.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
        const modeName = item.gameMode === 'quick' ? 'Quiz Rápido' : (item.gameMode === 'micro-enem' ? 'Simulado' : 'Combate');
        
        return `
            <div class="history-card" onclick="showHistoryDetail(${index})">
                <div class="history-header">
                    <span class="history-topic" title="${item.topic}">${item.topic}</span>
                    <button class="delete-history-btn" onclick="deleteHistory(event, '${item._id}')" title="Remover Histórico">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
                <div class="history-stats">
                    <span class="history-date">${date}</span>
                    <div style="display: flex; gap: 10px;">
                        <span class="badge badge-mode">${modeName}</span>
                        <span class="badge badge-score">${item.score}/${item.totalQuestions}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    lucide.createIcons();
}

async function deleteHistory(event, id) {
    event.stopPropagation();
    if (!confirm("Tem certeza que deseja remover esta revisão do seu histórico?")) return;

    try {
        const res = await fetch(`${API_URL}/quiz/history/${id}`, { method: 'DELETE' });
        if (res.ok) {
            showToast("Revisão removida com sucesso", "success");
            await loadStudyHistory();
        } else {
            showToast("Erro ao remover revisão", "error");
        }
    } catch (err) {
        console.error("Erro ao deletar histórico:", err);
        showToast("Erro de conexão", "error");
    }
}

function showHistoryDetail(index) {
    const item = userHistoryData[index];
    const overlay = document.getElementById("history-detail-overlay");
    const content = document.getElementById("history-detail-content");
    const topicTitle = document.getElementById("detail-topic");

    topicTitle.textContent = item.topic;
    
    content.innerHTML = item.questions.map((q, i) => {
        const hasFeedback = q.aiFeedback && q.aiFeedback.correctExplanation;
        
        return `
            <div class="history-question-item">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                    <strong style="color: var(--purple);">Questão ${i + 1}</strong>
                    <span style="font-size: 0.8rem; padding: 2px 8px; border-radius: 10px; background: ${q.isCorrect ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'}; color: ${q.isCorrect ? 'var(--green)' : 'var(--red)'}">
                        ${q.isCorrect ? 'ACERTOU' : 'ERROU'}
                    </span>
                </div>
                <p style="font-size: 0.95rem; margin-bottom: 15px; color: var(--fg); line-height: 1.6;">${q.questionText}</p>
                <div style="font-size: 0.9rem; color: var(--fg-dim); margin-bottom: 20px;">
                    <div>Sua resposta: <strong style="color: ${q.isCorrect ? 'var(--green)' : 'var(--red)'}">${q.userAnswer}</strong></div>
                    <div>Correta: <strong style="color: var(--green)">${q.correctAnswer}</strong></div>
                </div>

                ${hasFeedback ? `
                    <div style="background: rgba(187, 154, 247, 0.03); border: 1px solid rgba(187, 154, 247, 0.2); padding: 15px; border-radius: 12px;">
                        <h4 style="color: var(--purple); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
                            <i data-lucide="brain-circuit" style="width: 16px;"></i> Análise Pedagógica
                        </h4>
                        <p style="font-size: 0.85rem; margin-bottom: 10px; line-height: 1.5;"><strong style="color: var(--green)">Por que correta:</strong> ${q.aiFeedback.correctExplanation}</p>
                        <p style="font-size: 0.85rem; margin-bottom: 10px; line-height: 1.5;"><strong style="color: var(--red)">Alternativas:</strong> ${q.aiFeedback.incorrectAnalysis}</p>
                        <p style="font-size: 0.85rem; color: var(--yellow); line-height: 1.5;"><strong style="color: var(--yellow)">Dica:</strong> ${q.aiFeedback.distractorWarning}</p>
                        <p style="font-size: 0.85rem; margin-top: 10px; font-style: italic; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 10px;">
                            <strong style="color: var(--blue)">Atividade Sugerida:</strong> ${q.aiFeedback.suggestedActivity}
                        </p>
                    </div>
                ` : `<p style="font-size: 0.8rem; color: var(--fg-dim); font-style: italic;">Nenhuma análise pedagógica foi gerada para esta questão.</p>`}
            </div>
        `;
    }).join('');

    overlay.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    lucide.createIcons();
}

function closeHistoryDetail() {
    document.getElementById("history-detail-overlay").classList.add("hidden");
    document.body.style.overflow = "";
}

function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `feedback-toast ${type}`;
  toast.style.position = "fixed";
  toast.style.bottom = "20px";
  toast.style.right = "20px";
  toast.style.zIndex = "3000";
  toast.style.padding = "12px 24px";
  toast.style.borderRadius = "12px";
  toast.style.background = "var(--bg)";
  toast.style.border = `1px solid var(--border)`;
  toast.style.color = "var(--fg)";
  toast.style.animation = "slideIn 0.3s ease-out";
  
  if (type === "success") { toast.style.borderColor = "var(--green)"; toast.style.color = "var(--green)"; }
  else if (type === "error") { toast.style.borderColor = "var(--red)"; toast.style.color = "var(--red)"; }

  toast.innerHTML = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function logout() {
  sessionStorage.clear();
  window.location.href = getBaseUrl() + 'pages/login/index.html';
}
function hideLoader() {
    const loader = document.getElementById('page-loader');
    if (loader) {
        loader.classList.add('hidden');
    }
}
function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  const mainContent = document.querySelector(".main-content");
  const toggleBtn = document.querySelector(".sidebar-toggle");
  sidebar.classList.toggle("open");
  mainContent.classList.toggle("pushed");
  toggleBtn.classList.toggle("active");
}
function setTheme(theme) {
    document.documentElement.classList.remove('light-theme', 'contrast-theme');
    if (theme !== 'dark') document.documentElement.classList.add(`${theme}-theme`);
    localStorage.setItem('preferred-theme', theme);
}
function initTheme() {
    const savedTheme = localStorage.getItem('preferred-theme') || 'dark';
    setTheme(savedTheme);
}
function toggleSettings() {
    const settingsSection = document.querySelector('.sidebar-settings');
    if (!settingsSection) return;
    settingsSection.classList.toggle('collapsed');
}
