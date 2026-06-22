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

function showNotification(message, type = 'error') {
    const notification = document.createElement('div')
    notification.className = `notification ${type === 'success' ? 'success' : ''}`
    notification.style.backgroundColor = type === 'success' ? 'var(--green)' : 'var(--red)'
    notification.style.color = 'white'
    notification.style.padding = '12px 16px'
    notification.style.borderRadius = '8px'
    notification.style.marginBottom = '10px'
    notification.style.display = 'flex'
    notification.style.justifyContent = 'space-between'
    notification.style.alignItems = 'center'
    
    notification.innerHTML = `
        <span>${capitalize(message)}</span>
        <span style="cursor:pointer; margin-left: 10px;" class="close-btn">&times;</span>
    `
    notificationContainer.appendChild(notification)
    
    notification.querySelector('.close-btn').addEventListener('click', () => {
        notification.remove()
    })
}

function showError(fieldId, message) {
    const input = document.getElementById(fieldId)
    const group = input.parentElement
    const errorSpan = group.querySelector('.error-message')
    group.classList.add('error')
    if (message) errorSpan.textContent = capitalize(message)
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
    input.addEventListener('input', () => clearError(input.id))
})

form.addEventListener('submit', async (e) => {
    e.preventDefault()
    
    const urlParams = new URLSearchParams(window.location.search)
    const token = urlParams.get('token')
    
    const password = document.getElementById('password').value
    const confirmpassword = document.getElementById('confirm-password').value
    
    let hasError = false
    if (password.length < 6) {
        showError('password', 'Senha deve ter pelo menos 6 caracteres')
        hasError = true
    }
    if (password !== confirmpassword) {
        showError('confirm-password', 'As senhas não coincidem')
        hasError = true
    }
    
    if (hasError) return
    if (!token) {
        showNotification('Token de recuperação não encontrado. Solicite um novo link.')
        return
    }

    const btn = form.querySelector('button')
    btn.disabled = true
    btn.innerHTML = '<i data-lucide="loader-2"></i> Atualizando...'
    lucide.createIcons()

    try {
        const response = await fetch(API_URL + '/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, password, confirmpassword })
        })
        const data = await response.json()
        
        if (response.ok) {
            showNotification(data.msg || 'Senha atualizada com sucesso!', 'success')
            setTimeout(() => {
                window.location.href = getBaseUrl() + 'pages/login/index.html'
            }, 3000)
        } else {
            showNotification(data.msg || 'Erro ao redefinir senha.')
            btn.disabled = false
            btn.innerHTML = '<i data-lucide="save"></i> Atualizar Senha'
            lucide.createIcons()
        }
    } catch (error) {
        console.error('Erro:', error)
        showNotification('Erro ao conectar com o servidor.')
        btn.disabled = false
        btn.innerHTML = '<i data-lucide="save"></i> Atualizar Senha'
        lucide.createIcons()
    }
})
