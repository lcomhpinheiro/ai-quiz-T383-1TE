(async function() {
    const API_URL = "https://ai-quiz-students-backend.onrender.com";
    const path = window.location.pathname;
    const isAuthPage = path.includes('login') || path.includes('register');
    
    try {
        const response = await fetch(`${API_URL}/user/me`, { credentials: 'include' });
        const isLoggedIn = response.ok;

        if (!isLoggedIn && !isAuthPage) {
            console.warn("Access denied. Redirecting to login...");
            window.location.href = '../login/index.html';
        } 
        
        if (isLoggedIn && isAuthPage) {
            console.info("Already logged in. Redirecting to quiz...");
            window.location.href = '../quiz/index.html';
        }
    } catch (error) {
        console.error("Auth check failed:", error);
        if (!isAuthPage) {
            window.location.href = '../login/index.html';
        }
    }
})();
