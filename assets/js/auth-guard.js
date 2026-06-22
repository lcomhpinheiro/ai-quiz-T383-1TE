(async function() {
    const API_URL = "https://muriquiz.online";
    
    function getBaseUrl() {
        const path = window.location.pathname;
        const pagesIndex = path.indexOf('/pages/');
        if (pagesIndex !== -1) {
            return path.substring(0, pagesIndex + 1);
        }
        return '../../'; // fallback depth 2 prefix
    }
    
    const baseUrl = getBaseUrl();
    const path = window.location.pathname;
    
    // Pages that are public and shouldn't trigger unauthorized redirect
    // (though logged-in users will be redirected to quiz)
    const isAuthPage = path.includes('login') || 
                       path.includes('register') || 
                       path.includes('forgot-password') || 
                       path.includes('reset-password') || 
                       path.includes('confirm-delete');
    
    try {
        const response = await fetch(`${API_URL}/user/me`, { credentials: 'include' });
        const isLoggedIn = response.ok;

        if (!isLoggedIn && !isAuthPage) {
            console.warn("Access denied. Redirecting to login...");
            window.location.href = baseUrl + 'pages/login/index.html';
            return;
        } 
        
        if (isLoggedIn && isAuthPage) {
            console.info("Already logged in. Redirecting to quiz...");
            window.location.href = baseUrl + 'pages/quiz/index.html';
            return;
        }
    } catch (error) {
        console.error("Auth check failed:", error);
        if (!isAuthPage) {
            window.location.href = baseUrl + 'pages/login/index.html';
            return;
        }
    }
})();

// Add notification notice for official site when user enters
document.addEventListener('DOMContentLoaded', () => {
    const lastShown = localStorage.getItem('official-site-notice-last-shown');
    const now = Date.now();
    // Notice appears from time to time (every 12 hours)
    const interval = 12 * 60 * 60 * 1000; 

    if (!lastShown || (now - parseInt(lastShown) > interval)) {
        showOfficialSiteNotice();
    }
});

function showOfficialSiteNotice() {
    if (document.getElementById('official-site-notice-styles')) return;

    // CSS rules for the notification modal (modern glassmorphism UI)
    const style = document.createElement('style');
    style.id = 'official-site-notice-styles';
    style.textContent = `
        .official-notice-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(10, 10, 15, 0.7);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            z-index: 99999;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: opacity 0.4s ease;
        }
        .official-notice-card {
            background: linear-gradient(135deg, rgba(26, 26, 36, 0.95), rgba(18, 18, 24, 0.98));
            border: 1px solid rgba(129, 140, 248, 0.2);
            border-radius: 20px;
            padding: 32px;
            width: 90%;
            max-width: 460px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 40px rgba(99, 102, 241, 0.15);
            color: #ffffff;
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            position: relative;
            transform: scale(0.9);
            transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
            text-align: center;
        }
        .official-notice-overlay.active {
            opacity: 1;
        }
        .official-notice-overlay.active .official-notice-card {
            transform: scale(1);
        }
        .official-notice-close {
            position: absolute;
            top: 18px;
            right: 18px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 50%;
            color: rgba(255, 255, 255, 0.6);
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        .official-notice-close:hover {
            color: #ffffff;
            background: rgba(239, 68, 68, 0.2);
            border-color: rgba(239, 68, 68, 0.4);
            transform: rotate(90deg);
        }
        .official-notice-icon {
            font-size: 52px;
            margin-bottom: 20px;
            display: inline-block;
            animation: float 3s ease-in-out infinite;
        }
        .official-notice-title {
            font-size: 24px;
            font-weight: 800;
            margin: 0 0 12px 0;
            letter-spacing: -0.5px;
            background: linear-gradient(135deg, #a78bfa, #818cf8, #60a5fa);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .official-notice-text {
            font-size: 14.5px;
            color: rgba(255, 255, 255, 0.75);
            line-height: 1.6;
            margin: 0 0 28px 0;
        }
        .official-notice-actions {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .official-notice-btn-primary {
            background: linear-gradient(135deg, #6366f1, #4f46e5);
            color: #ffffff;
            border: none;
            border-radius: 10px;
            padding: 14px 28px;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            text-decoration: none;
            display: inline-block;
            box-shadow: 0 10px 20px -10px rgba(99, 102, 241, 0.5);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .official-notice-btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 15px 25px -10px rgba(99, 102, 241, 0.6);
            filter: brightness(1.1);
        }
        .official-notice-btn-secondary {
            background: transparent;
            color: rgba(255, 255, 255, 0.5);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 10px;
            padding: 12px 28px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        .official-notice-btn-secondary:hover {
            background: rgba(255, 255, 255, 0.05);
            color: #ffffff;
            border-color: rgba(255, 255, 255, 0.2);
        }
        @keyframes float {
            0%, 100% { transform: translateY(0) rotate(0deg); }
            50% { transform: translateY(-8px) rotate(3deg); }
        }
    `;
    document.head.appendChild(style);

    const overlay = document.createElement('div');
    overlay.className = 'official-notice-overlay';
    overlay.innerHTML = `
        <div class="official-notice-card">
            <button class="official-notice-close" aria-label="Fechar aviso">&times;</button>
            <div class="official-notice-icon">🚀</div>
            <h3 class="official-notice-title">Temos Nosso Site Oficial!</h3>
            <p class="official-notice-text">
                O MuriQuiz agora está no ar com seu próprio domínio oficial! Acesse a plataforma oficial para desfrutar de novos recursos, maior velocidade e estabilidade.
            </p>
            <div class="official-notice-actions">
                <a href="https://muriquiz.online" class="official-notice-btn-primary" id="official-notice-redirect">Ir para a Página Oficial</a>
                <button class="official-notice-btn-secondary" id="official-notice-close-btn">Fechar</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Trigger open animation
    setTimeout(() => {
        overlay.classList.add('active');
    }, 10);

    const closeNotice = () => {
        overlay.classList.remove('active');
        localStorage.setItem('official-site-notice-last-shown', Date.now().toString());
        setTimeout(() => {
            overlay.remove();
        }, 400);
    };

    overlay.querySelector('.official-notice-close').addEventListener('click', closeNotice);
    overlay.querySelector('#official-notice-close-btn').addEventListener('click', closeNotice);
    overlay.querySelector('#official-notice-redirect').addEventListener('click', () => {
        localStorage.setItem('official-site-notice-last-shown', Date.now().toString());
    });
}
