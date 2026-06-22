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

const form = document.querySelector('.auth-form')
const notificationContainer = document.getElementById('notification-container')
function capitalize(text) {
    if (!text) return ""
    return text.charAt(0).toUpperCase() + text.slice(1)
}
function removeNotification(notification) {
    notification.classList.add('removing')
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove()
        }
    }, 300)
}
function showNotification(message, type = 'error') {
    const notification = document.createElement('div')
    notification.className = `notification ${type}`
    notification.innerHTML = `
        <span>${capitalize(message)}</span>
        <span style="cursor:pointer; margin-left: 10px;" class="close-btn">&times;</span>
    `
    notificationContainer.appendChild(notification)
    notification.querySelector('.close-btn').addEventListener('click', () => {
        removeNotification(notification)
    })
    setTimeout(() => {
        if (notification.parentElement) {
            removeNotification(notification)
        }
    }, 5000)
}
function showError(fieldId, message) {
    const input = document.getElementById(fieldId)
    const group = input.parentElement
    const errorSpan = group.querySelector('.error-message')
    group.classList.add('error')
    if (message) {
        errorSpan.textContent = capitalize(message)
    }
}
function clearError(fieldId) {
    const input = document.getElementById(fieldId)
    const group = input.parentElement.classList.contains('input-wrapper') ? input.parentElement.parentElement : input.parentElement
    group.classList.remove('error')
}

function togglePasswordVisibility(fieldId) {
    const input = document.getElementById(fieldId);
    const button = input.nextElementSibling;

    if (input.type === 'password') {
        input.type = 'text';
        button.innerHTML = '<i data-lucide="eye"></i>';
    } else {
        input.type = 'password';
        button.innerHTML = '<i data-lucide="eye-off"></i>';
    }
    lucide.createIcons();
}

const inputs = form.querySelectorAll('input')
inputs.forEach(input => {
    input.addEventListener('input', () => {
        clearError(input.id)
    })
})
const usernameInput = document.getElementById('username')
usernameInput.addEventListener('blur', async () => {
    const username = usernameInput.value.trim()
    if (username.length > 0) {
        try {
            const response = await fetch(`${API_URL}/auth/check-username/${username}`, { credentials: 'include' })
            const data = await response.json()
            if (!data.available) {
                showError('username', 'Este nome de usuário já está sendo usado')
            }
        } catch (error) {
            console.error('Erro ao verificar usuário:', error)
        }
    }
})
form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const name = document.getElementById('name').value.trim()
    const username = document.getElementById('username').value.trim()
    const email = document.getElementById('email').value.trim()
    const password = document.getElementById('password').value
    const confirmpassword = document.getElementById('confirm-password').value
    let hasError = false
    if (!name) {
        showError('name', 'Nome é obrigatório')
        hasError = true
    }
    if (!username) {
        showError('username', 'Usuário é obrigatório')
        hasError = true
    }
    if (!email || !email.includes('@')) {
        showError('email', 'E-mail inválido')
        hasError = true
    }
    if (password.length < 6) {
        showError('password', 'Senha deve ter pelo menos 6 caracteres')
        hasError = true
    }
    if (password !== confirmpassword) {
        showError('confirm-password', 'As senhas não coincidem')
        hasError = true
    }
    if (/[^a-zA-Z-0-9_]/.test(username)){
        showError('username', 'O usuário não deve conter especiais')
        hasError = true
    }
    if (hasError) return
    const btn = form.querySelector('button')
    try {
        btn.disabled = true
        btn.innerHTML = '<i data-lucide="loader-2"></i> Cadastrando...'
        lucide.createIcons()
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, username, email, password, confirmpassword}),
            credentials: 'include'
        })
        const data = await response.json()
        if (response.ok) {
            window.location.href = getBaseUrl() + 'pages/quiz/index.html'
        } else {
            showNotification(data.msg || data.message || 'Erro ao realizar cadastro')
            btn.disabled = false
            btn.innerHTML = '<i data-lucide="user-plus"></i> Cadastrar'
            lucide.createIcons()
        }
    } catch (error) {
        console.error('Erro:', error)
        showNotification('Erro ao conectar com o servidor. Tente novamente mais tarde.')
        btn.disabled = false
        btn.innerHTML = '<i data-lucide="user-plus"></i> Cadastrar'
        lucide.createIcons()
    }
})