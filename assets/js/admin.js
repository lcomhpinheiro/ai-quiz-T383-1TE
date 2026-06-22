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

let currentUser = null;
let socket = null;
let loadedUsers = []; // Cache do resultado da busca

document.addEventListener('DOMContentLoaded', async () => {
    await loadUserProfile();
    setupSocket();
    requestNotificationPermission();
    
    // Bind search bar keypress (enter)
    const searchInput = document.getElementById("admin-user-search");
    if (searchInput) {
        searchInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") searchAdminUsers();
        });
    }
});

async function loadUserProfile() {
    try {
        const response = await fetch(API_URL + '/user/me', { credentials: 'include' });
        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            
            if (!currentUser || !currentUser.isAdmin) {
                // Se não for admin, redireciona de volta pro learning
                window.location.href = getBaseUrl() + 'pages/quiz/index.html';
                return;
            }

            document.getElementById('userNameGreeting').textContent = `Olá, ${currentUser.name.split(' ')[0]}`;
        } else {
            window.location.href = getBaseUrl() + 'pages/login/index.html';
        }
    } catch (error) {
        console.error('Erro ao carregar perfil:', error);
        window.location.href = getBaseUrl() + 'pages/login/index.html';
    } finally {
        hideLoader();
    }
}

function setupSocket() {
    if (socket && socket.connected) return;
    
    console.log("[Socket] Inicializando conexão...");
    socket = io('https://www.muriquiz.online');

    socket.on("connect", () => {
        console.log("[Socket] Conectado! Socket ID:", socket.id);
        if (currentUser) {
            const uid = currentUser.id || currentUser._id;
            console.log("[Socket] Registrando usuário no socket:", uid);
            socket.emit("register_user", { userId: uid });
        } else {
            console.warn("[Socket] currentUser não definido no connect!");
        }
    });

    socket.on("message", ({ text, type }) => {
        console.log("[Socket] Mensagem recebida:", text, type);
        showToast(text, type);
        
        // Disparar notificação nativa do navegador se ativo nas configurações
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
                console.error("Erro ao exibir notificação nativa:", err);
            }
        } else {
            console.log("[Socket] Notificação nativa não disparada. enabled:", localStorage.getItem('notifications-enabled'), "permission:", Notification.permission);
        }
    });

    socket.on("connect_error", () => {
        console.error("Erro de conexão Socket.io");
    });
}

async function searchAdminUsers() {
    const searchInput = document.getElementById("admin-user-search");
    const query = searchInput.value.trim();
    if (!query) {
        return showToast("Digite um termo para pesquisar.", "error");
    }

    const tbody = document.getElementById("admin-users-tbody");
    tbody.innerHTML = `
        <tr>
            <td colspan="6" class="table-empty">
                <i data-lucide="loader-2" style="width: 32px; height: 32px; color: var(--purple); margin-bottom: 10px; display: block; margin-left: auto; margin-right: auto; animation: spin 1s linear infinite;"></i>
                Buscando usuários...
            </td>
        </tr>
    `;
    lucide.createIcons();

    try {
        const res = await fetch(`${API_URL}/admin/users/search?q=${encodeURIComponent(query)}`, { credentials: 'include' });
        if (!res.ok) throw new Error("Erro na busca");
        const users = await res.json();
        
        loadedUsers = users;
        tbody.innerHTML = "";

        if (users.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="table-empty">Nenhum usuário correspondente encontrado.</td>
                </tr>
            `;
            return;
        }

        users.forEach(u => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><img class="table-avatar" src="${u.profilePhoto}" alt="${u.name}"></td>
                <td style="font-weight: 700; color: var(--fg);">${u.name}</td>
                <td>@${u.username}</td>
                <td>${u.email}</td>
                <td>
                    <span class="${u.isAdmin ? 'badge-admin' : 'badge-user'}">
                        ${u.isAdmin ? 'Admin' : 'Estudante'}
                    </span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-action-edit" onclick="openEditModal('${u._id}')">
                            <i data-lucide="user-cog"></i> Editar
                        </button>
                        <button class="btn-action-notify" onclick="openNotifyModal('${u._id}')">
                            <i data-lucide="send"></i> Notificar
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
        lucide.createIcons();
    } catch (err) {
        console.error(err);
        showToast("Erro ao buscar usuários do servidor.", "error");
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="table-empty" style="color: var(--red);">Erro ao realizar a busca. Tente novamente.</td>
            </tr>
        `;
    }
}

function openEditModal(userId) {
    const user = loadedUsers.find(u => u._id === userId);
    if (!user) return;

    document.getElementById("edit-user-id").value = user._id;
    document.getElementById("edit-user-name").value = user.name;
    document.getElementById("edit-user-username").value = user.username;
    document.getElementById("edit-user-email").value = user.email;
    document.getElementById("edit-user-bio").value = user.bio || "";
    document.getElementById("edit-user-isadmin").checked = !!user.isAdmin;

    document.getElementById("edit-user-modal").classList.remove("hidden");
    lucide.createIcons();
}

function closeEditModal() {
    document.getElementById("edit-user-modal").classList.add("hidden");
}

async function saveUserChanges(e) {
    e.preventDefault();

    const userId = document.getElementById("edit-user-id").value;
    const saveBtn = document.getElementById("save-user-btn");
    
    const name = document.getElementById("edit-user-name").value.trim();
    const username = document.getElementById("edit-user-username").value.trim();
    const email = document.getElementById("edit-user-email").value.trim();
    const bio = document.getElementById("edit-user-bio").value.trim();
    const isAdmin = document.getElementById("edit-user-isadmin").checked;

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i data-lucide="loader-2" style="width: 14px; height: 14px; animation: spin 1s linear infinite;"></i> Salvando...';
    lucide.createIcons();

    try {
        const response = await fetch(`${API_URL}/admin/users/${userId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, username, email, bio, isAdmin }),
            credentials: 'include'
        });
        const data = await response.json();

        if (response.ok) {
            showToast("Perfil de usuário atualizado com sucesso!", "success");
            closeEditModal();
            searchAdminUsers(); // Atualizar tabela
        } else {
            showToast(data.msg || "Erro ao salvar alterações.", "error");
        }
    } catch (err) {
        console.error(err);
        showToast("Erro de rede ao salvar alterações.", "error");
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = 'Salvar Alterações';
        lucide.createIcons();
    }
}

function openNotifyModal(userId) {
    const user = loadedUsers.find(u => u._id === userId);
    if (!user) return;

    document.getElementById("notify-user-id").value = user._id;
    document.getElementById("notify-user-target-display").textContent = `${user.name} (@${user.username})`;
    document.getElementById("notify-message").value = "";

    document.getElementById("notify-user-modal").classList.remove("hidden");
    lucide.createIcons();
}

function closeNotifyModal() {
    document.getElementById("notify-user-modal").classList.add("hidden");
}

async function sendUserNotification(e) {
    e.preventDefault();

    const userId = document.getElementById("notify-user-id").value;
    const message = document.getElementById("notify-message").value.trim();
    const type = document.getElementById("notify-type").value;
    const sendBtn = document.getElementById("send-notify-btn");

    sendBtn.disabled = true;
    sendBtn.innerHTML = '<i data-lucide="loader-2" style="width: 14px; height: 14px; animation: spin 1s linear infinite;"></i> Enviando...';
    lucide.createIcons();

    try {
        const response = await fetch(`${API_URL}/admin/users/${userId}/notify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, type }),
            credentials: 'include'
        });
        const data = await response.json();

        if (response.ok) {
            showToast("Notificação enviada em tempo real!", "success");
            closeNotifyModal();
        } else {
            showToast(data.msg || "Erro ao disparar notificação.", "error");
        }
    } catch (err) {
        console.error(err);
        showToast("Erro de rede ao enviar notificação.", "error");
    } finally {
        sendBtn.disabled = false;
        sendBtn.innerHTML = 'Disparar Evento';
        lucide.createIcons();
    }
}

// ── Utilitários Comuns ──

async function logout() {
    try { await fetch(API_URL + '/auth/logout', { method: 'POST', credentials: 'include' }) }
    catch (e) { console.error('Erro no logout:', e) }
    window.location.href = getBaseUrl() + 'pages/login/index.html'
}

function toggleSidebar() {
    const sidebar    = document.getElementById('sidebar')
    const mainContent = document.getElementById('main-content')
    const toggleBtn  = document.querySelector('.sidebar-toggle')

    sidebar.classList.toggle('open')
    mainContent.classList.toggle('pushed')
    if (toggleBtn) toggleBtn.classList.toggle('active')
}

function showToast(msg, type = 'success') {
    const existing = document.getElementById('toast-msg')
    if (existing) existing.remove()

    const toast = document.createElement('div')
    toast.id = 'toast-msg'
    toast.textContent = msg
    toast.style.cssText = `
        position: fixed; bottom: 30px; right: 30px; z-index: 9999;
        padding: 14px 22px; border-radius: 12px; font-weight: 600;
        font-size: 0.95rem; max-width: 360px;
        background-color: ${type === 'success' ? 'rgba(158,206,106,0.15)' : 'rgba(247,118,142,0.15)'};
        color: ${type === 'success' ? '#9ece6a' : '#f7768e'};
        border: 1px solid ${type === 'success' ? 'rgba(158,206,106,0.3)' : 'rgba(247,118,142,0.3)'};
        box-shadow: 0 8px 24px rgba(0,0,0,0.3);
        animation: slideIn 0.3s ease;
    `
    // Para alertas neutros (info)
    if (type === 'info') {
        toast.style.backgroundColor = 'rgba(122,162,247,0.15)';
        toast.style.color = '#7aa2f7';
        toast.style.borderColor = 'rgba(122,162,247,0.3)';
    }
    
    document.body.appendChild(toast)
    setTimeout(() => toast.remove(), 4000)
}

function hideLoader() {
    const loader = document.getElementById('page-loader');
    if (loader) loader.classList.add('hidden');
}

function showLoader() {
    const loader = document.getElementById('page-loader');
    if (loader) loader.classList.remove('hidden');
}

// ── Notificações e Disparo em Massa ──

function requestNotificationPermission() {
    if ("Notification" in window) {
        if (Notification.permission === "default") {
            Notification.requestPermission();
        }
    }
}

function toggleMassTargetList() {
    const targetType = document.getElementById("mass-target-type").value;
    const group = document.getElementById("mass-usernames-group");
    if (targetType === "list") {
        group.classList.remove("hidden");
    } else {
        group.classList.add("hidden");
    }
}

async function sendMassNotification(e) {
    e.preventDefault();

    const targetType = document.getElementById("mass-target-type").value;
    const type = document.getElementById("mass-notify-type").value;
    const message = document.getElementById("mass-message").value.trim();
    const usernamesInput = document.getElementById("mass-usernames").value;
    const sendBtn = document.getElementById("mass-notify-btn");

    if (!message) {
        return showToast("Digite uma mensagem para disparar.", "error");
    }

    let url = "/admin/notify-all";
    let body = { message, type };

    if (targetType === "list") {
        const usernames = usernamesInput.split(",").map(u => u.trim()).filter(Boolean);
        if (usernames.length === 0) {
            return showToast("A lista de usernames é obrigatória para o envio direcionado.", "error");
        }
        url = "/admin/notify-group";
        body.usernames = usernames;
    }

    sendBtn.disabled = true;
    sendBtn.innerHTML = '<i data-lucide="loader-2" style="width: 14px; height: 14px; animation: spin 1s linear infinite;"></i> Disparando...';
    lucide.createIcons();

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            credentials: 'include'
        });
        const data = await res.json();

        if (res.ok) {
            showToast(data.msg || "Disparo concluído com sucesso!", "success");
            document.getElementById("mass-message").value = "";
            document.getElementById("mass-usernames").value = "";
        } else {
            showToast(data.msg || "Erro ao disparar notificações.", "error");
        }
    } catch (err) {
        console.error(err);
        showToast("Erro de rede ao realizar o disparo.", "error");
    } finally {
        sendBtn.disabled = false;
        sendBtn.innerHTML = '<i data-lucide="send"></i> Disparar Notificação';
        lucide.createIcons();
    }
}

// ── Teste de IA (Anti-Alucinação) ──

async function runAiTest() {
    const btn = document.getElementById("ai-test-btn");
    const statusSpan = document.getElementById("ai-test-status");
    const resultWrapper = document.getElementById("ai-test-result-wrapper");
    const resultTitle = document.getElementById("ai-test-result-title");
    const questionsList = document.getElementById("ai-test-questions-list");

    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader-2" style="width: 14px; height: 14px; animation: spin 1s linear infinite;"></i> Executando...';
    statusSpan.textContent = "Extraindo conteúdo da página de Frações e gerando quiz...";
    resultWrapper.classList.add("hidden");
    questionsList.innerHTML = "";
    lucide.createIcons();

    try {
        const response = await fetch(API_URL + '/admin/test-ai-quiz', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        });
        const data = await response.json();

        if (response.ok) {
            showToast("Quiz anti-alucinação gerado com sucesso!", "success");
            statusSpan.textContent = "Teste concluído!";
            resultTitle.innerHTML = `<i data-lucide="check-circle" style="color: var(--green); width: 20px; height: 20px; vertical-align: middle;"></i> Quiz Gerado: ${data.articleTitle || 'Frações'}`;
            
            const quizData = data.quiz;
            if (quizData && Array.isArray(quizData.questions)) {
                quizData.questions.forEach((q, idx) => {
                    const qDiv = document.createElement("div");
                    qDiv.style.cssText = "border-left: 3px solid var(--purple); padding-left: 15px; margin-bottom: 15px;";
                    
                    let optionsHtml = "";
                    if (q.options && Array.isArray(q.options)) {
                        optionsHtml = `<ul style="list-style: none; padding-left: 0; margin-top: 5px; color: var(--fg-dim);">
                            ${q.options.map(opt => {
                                const isCorrect = opt.trim().startsWith(q.correct) || opt.trim().startsWith(`${q.correct})`);
                                return `<li style="margin-bottom: 4px; ${isCorrect ? 'color: var(--green); font-weight: 700;' : ''}">${opt}</li>`;
                            }).join('')}
                        </ul>`;
                    }

                    qDiv.innerHTML = `
                        <h4 style="color: var(--fg); font-weight: 700; margin-bottom: 4px; font-size: 1.05rem;">Questão ${idx + 1}</h4>
                        <p style="color: var(--fg); margin: 0; font-size: 0.95rem; line-height: 1.4;">${q.question}</p>
                        ${optionsHtml}
                        ${q.correct ? `<p style="margin-top: 5px; font-size: 0.85rem; color: var(--green); font-weight: 600; text-transform: uppercase;">Resposta Correta: Alternativa ${q.correct}</p>` : ''}
                    `;
                    questionsList.appendChild(qDiv);
                });
            } else {
                questionsList.innerHTML = `<p style="color: var(--red);">Nenhuma questão estruturada encontrada na resposta da IA.</p>`;
            }

            resultWrapper.classList.remove("hidden");
            lucide.createIcons();
        } else {
            showToast(data.error || "Erro ao executar o teste da IA.", "error");
            statusSpan.textContent = "Erro na execução do teste.";
        }
    } catch (err) {
        console.error(err);
        showToast("Erro de conexão ao executar o teste.", "error");
        statusSpan.textContent = "Erro de rede.";
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="play"></i> Iniciar Teste de IA';
        lucide.createIcons();
    }
}
