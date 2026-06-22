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

function setTheme(themeName) {
    // Remove temas anteriores do documentElement
    document.documentElement.classList.remove('light-theme', 'contrast-theme');
    
    // Adiciona o novo tema se não for o padrão (dark)
    if (themeName !== 'dark') {
        document.documentElement.classList.add(`${themeName}-theme`);
    }
    
    // Salva a preferência
    localStorage.setItem('preferred-theme', themeName);
    
    // Atualiza estado visual dos botões
    updateThemeButtons(themeName);
}

function updateThemeButtons(activeTheme) {
    const buttons = document.querySelectorAll('.theme-btn');
    buttons.forEach(btn => {
        const theme = btn.getAttribute('data-theme');
        if (theme === activeTheme) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

function toggleSettings() {
    const settingsSection = document.querySelector('.sidebar-settings');
    if (!settingsSection) return;
    const isCollapsed = settingsSection.classList.toggle('collapsed');
    localStorage.setItem('settings-collapsed', isCollapsed);
}

function hideLoader() {
    const loader = document.getElementById('page-loader');
    if (loader) {
        loader.classList.add('hidden');
    }
}

// Inicializa o tema e estado da sidebar ao carregar a página
document.addEventListener('DOMContentLoaded', () => {
    // Tema já foi aplicado pelo script inline no head, aqui apenas sincronizamos botões
    const savedTheme = localStorage.getItem('preferred-theme') || 'dark';
    updateThemeButtons(savedTheme);

    // Estado das configurações (recolhido/aberto)
    const settingsSection = document.querySelector('.sidebar-settings');
    if (settingsSection) {
        const isCollapsed = localStorage.getItem('settings-collapsed') === 'true';
        if (isCollapsed) {
            settingsSection.classList.add('collapsed');
        }
    }

    // Verificar se devemos exibir o prompt de ativação de notificações
    checkNotificationPrompt();
});

// ── Sistema de Prompt de Notificações Customizado (Nativo do Sistema) ──

function checkNotificationPrompt() {
    if (!("Notification" in window)) return; // Sem suporte no navegador

    const permission = Notification.permission;

    // Se a permissão já foi concedida, atualiza localStorage e sai
    if (permission === 'granted') {
        localStorage.setItem('notifications-enabled', 'true');
        return;
    }

    // Se já foi negada no navegador, força desativado e sai
    if (permission === 'denied') {
        localStorage.setItem('notifications-enabled', 'false');
        return;
    }

    const hasChoice = localStorage.getItem('notifications-enabled') !== null;
    const dontAskAgain = localStorage.getItem('notifications-ask-again') === 'false';

    // Se o usuário pediu para não perguntar novamente, não mostra nada
    if (dontAskAgain) return;

    // Se já fez a escolha recentemente (sendo habilitado=false), respeitamos nesta sessão
    if (hasChoice) return;

    // Mostra o popup de opt-in
    showNotificationPopup();
}

function showNotificationPopup() {
    if (document.getElementById("notification-prompt-overlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "notification-prompt-overlay";
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
        display: flex; justify-content: center; align-items: center;
        z-index: 10000; transition: opacity 0.3s ease; opacity: 0;
    `;

    overlay.innerHTML = `
        <div style="background: var(--bg); border: 2px solid var(--border); border-radius: var(--radius-lg); padding: 25px; max-width: 400px; width: 90%; box-shadow: var(--shadow-lg); text-align: center; font-family: 'Inter', sans-serif;">
            <div style="background: rgba(187, 154, 247, 0.1); width: 60px; height: 60px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path></svg>
            </div>
            <h3 style="color: var(--fg); margin: 0 0 10px 0; font-size: 1.25rem; font-weight: 800; font-family: 'Inter', sans-serif;">Notificações do Sistema</h3>
            <p style="color: var(--fg-dim); font-size: 0.9rem; line-height: 1.5; margin: 0 0 20px 0;">Permita que o Muriquiz envie notificações nativas do sistema para mantê-lo atualizado sobre atividades e testes em tempo real.</p>
            
            <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                <button id="notif-btn-decline" style="flex: 1; padding: 12px; background: transparent; border: 1px solid var(--border); color: var(--fg); border-radius: var(--radius-sm); font-weight: 700; cursor: pointer; transition: all 0.2s; font-family: 'Inter', sans-serif;">Agora não</button>
                <button id="notif-btn-accept" style="flex: 1; padding: 12px; background: var(--purple); border: none; color: var(--bg-dark); border-radius: var(--radius-sm); font-weight: 800; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 12px rgba(187, 154, 247, 0.25); font-family: 'Inter', sans-serif;">Sim</button>
            </div>
            
            <label style="display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 0.8rem; color: var(--fg-dim); cursor: pointer; user-select: none;">
                <input type="checkbox" id="notif-dont-ask-again" style="accent-color: var(--purple); width: 15px; height: 15px; cursor: pointer;">
                Não perguntar novamente
            </label>
        </div>
    `;

    document.body.appendChild(overlay);
    
    setTimeout(() => {
        overlay.style.opacity = "1";
    }, 50);

    const btnAccept = document.getElementById("notif-btn-accept");
    const btnDecline = document.getElementById("notif-btn-decline");
    const checkDontAsk = document.getElementById("notif-dont-ask-again");

    btnDecline.addEventListener("mouseover", () => {
        btnDecline.style.backgroundColor = "rgba(255,255,255,0.05)";
    });
    btnDecline.addEventListener("mouseout", () => {
        btnDecline.style.backgroundColor = "transparent";
    });

    btnAccept.addEventListener("mouseover", () => {
        btnAccept.style.opacity = "0.9";
    });
    btnAccept.addEventListener("mouseout", () => {
        btnAccept.style.opacity = "1";
    });

    btnDecline.addEventListener("click", () => {
        localStorage.setItem('notifications-enabled', 'false');
        if (checkDontAsk.checked) {
            localStorage.setItem('notifications-ask-again', 'false');
        }
        closePopup();
    });

    btnAccept.addEventListener("click", async () => {
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
            localStorage.setItem('notifications-enabled', 'true');
            localStorage.setItem('notifications-ask-again', 'false');
        } else {
            localStorage.setItem('notifications-enabled', 'false');
            if (checkDontAsk.checked) {
                localStorage.setItem('notifications-ask-again', 'false');
            }
        }
        
        // Sincroniza o toggle se estiver na página de configurações avançadas
        const toggle = document.getElementById("notification-toggle");
        if (toggle) {
            toggle.checked = (permission === "granted");
        }
        
        closePopup();
    });

    function closePopup() {
        overlay.style.opacity = "0";
        setTimeout(() => {
            overlay.remove();
        }, 300);
    }
}

