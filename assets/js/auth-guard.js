/**
 * Simple Auth Guard
 * Prevents unauthenticated users from accessing protected pages.
 * Also redirects authenticated users away from login/register pages.
 */
(function() {
    const token = localStorage.getItem('Token');
    const path = window.location.pathname;
    
    // Check if we are on an auth page (login or register)
    const isAuthPage = path.includes('login') || path.includes('register');
    
    // Determine the base path for redirects
    // Since we are in /pages/<folder>/index.html, we use relative paths
    
    if (!token && !isAuthPage) {
        // Not logged in and trying to access a protected page
        console.warn("Access denied. Redirecting to login...");
        window.location.href = '../login/index.html';
    } 
    
    if (token && isAuthPage) {
        // Already logged in and trying to access login/register
        console.info("Already logged in. Redirecting to quiz...");
        window.location.href = '../quiz/index.html';
    }
})();
