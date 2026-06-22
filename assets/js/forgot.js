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
    
    if (type === 'success') {
        setTimeout(() => notification.remove(), 10000)
    }
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
    const group = input.parentElement
    group.classList.remove('error')
}

document.getElementById('email').addEventListener('input', () => clearError('email'))

form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const email = document.getElementById('email').value.trim()
    
    if (!email || !email.includes('@')) {
        showError('email', 'E-mail válido é obrigatório')
        return
    }

    const btn = form.querySelector('button')
    btn.disabled = true
    btn.innerHTML = '<i data-lucide="loader-2"></i> Enviando...'
    lucide.createIcons()

    try {
        const response = await fetch(API_URL + '/auth/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        })
        const data = await response.json()
        
        // Sempre mostra a mensagem de "enviado se existir" por segurança e UX
        showNotification(data.msg || 'Link de recuperação enviado com sucesso! Verifique sua caixa de entrada e spam.', 'success')
        form.reset()
    } catch (error) {
        console.error('Erro:', error)
        showNotification('Erro ao conectar com o servidor.')
    } finally {
        btn.disabled = false
        btn.innerHTML = '<i data-lucide="send"></i> Enviar Link'
        lucide.createIcons()
    }
})
