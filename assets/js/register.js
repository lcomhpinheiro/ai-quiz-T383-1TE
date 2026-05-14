const URL = "https://ai-quiz-students-backend.onrender.com"

document.querySelector('.auth-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    
    const name = document.getElementById('name').value
    const email = document.getElementById('email').value
    const password = document.getElementById('password').value
    const confirmpassword = document.getElementById('confirm-password').value
    
    if (password !== confirmpassword) {
        alert('As senhas não coincidem.')
        return
    }
    
    try {
        const response = await fetch(`${URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password, confirmpassword})
        })
        
        const data = await response.json()
        
        if (response.ok) {
            const token = data.token
            localStorage.setItem('Token', token)
            window.location.href = '../quiz/index.html'
        }
    } catch (error) {
        console.error('Erro:', error)
        alert('Erro ao conectar com o servidor.')
    }
})
