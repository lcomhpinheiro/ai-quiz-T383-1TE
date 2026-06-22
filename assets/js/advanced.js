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

async function loadUserData() {
    try {
        const res = await fetch(API_URL + "/user/me", { credentials: 'include' });
        if (res.ok) {
            const data = await res.json();
            currentUser = data.user;
            document.getElementById("userNameGreeting").textContent = `Olá, ${currentUser.name.split(' ')[0]}`;
            
            // Revelar seção de desenvolvedor se for admin
            if (currentUser.isAdmin) {
                const devSection = document.getElementById("dev-section");
                if (devSection) devSection.classList.remove("hidden");
                
                const nav = document.querySelector('.sidebar-nav');
                if (nav && !nav.querySelector('a[href="/admin"]')) {
                    const adminLink = document.createElement('a');
                    adminLink.href = '/admin';
                    adminLink.className = 'nav-item';
                    adminLink.innerHTML = '<i data-lucide="shield-alert"></i> Admin';
                    nav.appendChild(adminLink);
                    if (typeof lucide !== 'undefined') lucide.createIcons();
                }

                // Carregar estado do toggle
                const isDevMode = localStorage.getItem('dev-mode-active') === 'true';
                const toggle = document.getElementById("dev-mode-toggle");
                if (toggle) {
                    toggle.checked = isDevMode;
                    toggleDevMode();
                }
            }

            // Carregar estado do toggle de notificações
            const isNotificationsEnabled = localStorage.getItem('notifications-enabled') === 'true';
            const notifToggle = document.getElementById("notification-toggle");
            if (notifToggle) {
                notifToggle.checked = isNotificationsEnabled;
            }
        }
    } catch (err) {
        console.error("Erro ao carregar dados do usuário:", err);
    } finally {
        hideLoader();
    }
}

function toggleDevMode() {
    const isChecked = document.getElementById("dev-mode-toggle").checked;
    const devTools = document.getElementById("dev-tools");
    
    if (isChecked) {
        devTools.classList.remove("hidden");
        localStorage.setItem('dev-mode-active', 'true');
    } else {
        devTools.classList.add("hidden");
        localStorage.setItem('dev-mode-active', 'false');
    }
}

async function devAutoSolve() {
    if (!currentUser || !currentUser.isAdmin) return;
    
    // Como esta página (advanced) não tem um quiz ativo, 
    // esta função é um atalho global que pode ser chamado via console ou integrada 
    // futuramente na learning.js se o modo dev estiver ativo lá.
    alert("Função de Desenvolvedor: Esta ferramenta está configurada para ser usada durante um Quiz ativo na página de Aprendizado. No backend, a rota /quiz/solve-auto já está protegida para seu usuário admin.");
}

function toggleSidebar() {
    const sidebar = document.getElementById("sidebar");
    const mainContent = document.querySelector(".main-content");
    const toggleBtn = document.querySelector(".sidebar-toggle");
    
    sidebar.classList.toggle("open");
    if (mainContent) mainContent.classList.toggle("pushed");
    if (toggleBtn) toggleBtn.classList.toggle("active");
}

async function logout() {
    try {
        await fetch(API_URL + '/auth/logout', { method: 'POST', credentials: 'include' });
    } catch (error) {
        console.error('Erro ao fazer logout:', error);
    }
    window.location.href = getBaseUrl() + 'pages/login/index.html';
}

// Funções de Deletar Conta (Modais)
function deleteAccount() {
    const overlay = document.getElementById("delete-overlay");
    const modal = document.getElementById("modal-confirm");
    overlay.classList.add("active");
    modal.classList.add("active");
}

function closeDeleteModal() {
    const overlay = document.getElementById("delete-overlay");
    const modal = document.getElementById("modal-confirm");
    overlay.classList.remove("active");
    modal.classList.remove("active");
}

async function confirmDeleteAccount() {
    try {
        const res = await fetch(API_URL + "/auth/request-delete-account", {
            method: 'POST',
            credentials: 'include'
        });

        if (res.ok) {
            // Fecha o modal de confirmação
            closeDeleteModal();
            
            // Pequeno delay para a animação de saída terminar antes de mostrar o próximo
            setTimeout(() => {
                const overlay = document.getElementById("delete-overlay");
                const modalSuccess = document.getElementById("modal-success");
                overlay.classList.add("active");
                modalSuccess.classList.add("active");
            }, 300);
        } else {
            const data = await res.json();
            alert(data.msg || "Erro ao solicitar exclusão de conta.");
        }
    } catch (err) {
        console.error("Erro ao solicitar exclusão:", err);
        alert("Erro de conexão ao solicitar exclusão de conta.");
    }
}

function closeSuccessModal() {
    const overlay = document.getElementById("delete-overlay");
    const modalSuccess = document.getElementById("modal-success");
    overlay.classList.remove("active");
    modalSuccess.classList.remove("active");
    
    // Deslogar o usuário e mandar para o login
    logout();
}

async function toggleSystemNotifications() {
    const isChecked = document.getElementById("notification-toggle").checked;
    if (isChecked) {
        if ("Notification" in window) {
            const permission = await Notification.requestPermission();
            if (permission === "granted") {
                localStorage.setItem('notifications-enabled', 'true');
                localStorage.setItem('notifications-ask-again', 'false');
                showToast("Notificações do sistema ativadas!", "success");
            } else {
                document.getElementById("notification-toggle").checked = false;
                localStorage.setItem('notifications-enabled', 'false');
                showToast("Permissão de notificação negada pelo navegador.", "error");
            }
        } else {
            document.getElementById("notification-toggle").checked = false;
            showToast("Seu navegador não suporta notificações de sistema.", "error");
        }
    } else {
        localStorage.setItem('notifications-enabled', 'false');
        showToast("Notificações do sistema desativadas.", "info");
    }
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
    if (type === 'info') {
        toast.style.backgroundColor = 'rgba(122,162,247,0.15)';
        toast.style.color = '#7aa2f7';
        toast.style.borderColor = 'rgba(122,162,247,0.3)';
    }
    
    document.body.appendChild(toast)
    setTimeout(() => toast.remove(), 4000)
}

document.addEventListener("DOMContentLoaded", () => {
    loadUserData();
});
