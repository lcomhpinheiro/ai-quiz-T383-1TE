const URL = "http://localhost:3000";

document.querySelector('.auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    try {
        const response = await fetch(`${URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            localStorage.setItem('Token', data.token);
            alert('Login realizado com sucesso!');
            window.location.href = '../quiz/index.html';
        } else {
            alert(data.msg || 'Erro ao realizar login.');
        }
    } catch (error) {
        console.error('Erro:', error);
        alert('Erro ao conectar com o servidor.');
    }
});
