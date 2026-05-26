const API_URL = "https://ai-quiz-students-backend.onrender.com"
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
    const group = input.parentElement
    group.classList.remove('error')
}
const inputs = form.querySelectorAll('input')
inputs.forEach(input => {
    input.addEventListener('input', () => {
        clearError(input.id)
    })
})
form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const email = document.getElementById('username').value.trim()
    const password = document.getElementById('password').value
    let hasError = false
    if (!email) {
        showError('username', 'Usuário ou email são obrigatório')
        hasError = true
    }
    if (!password) {
        showError('password', 'Senha é obrigatória')
        hasError = true
    }
    if (hasError) return
    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
            credentials: 'include'
        })
        const data = await response.json()
        if (response.ok) {
            window.location.href = '../quiz/index.html'
        } else {
            showNotification(data.msg || 'Credenciais inválidas')
        }
    } catch (error) {
        console.error('Erro:', error)
        showNotification('Erro ao conectar com o servidor. Tente novamente mais tarde.')
    }
})

const savedTheme = localStorage.getItem("theme");
if (savedTheme === "light") {
    document.body.classList.add("light");
    document.getElementById("btn-tema").textContent = "☀️ Tema Claro";
}

document.getElementById("btn-tema").addEventListener("click", () => {
    document.body.classList.toggle("light");
    const isLight = document.body.classList.contains("light");
    localStorage.setItem("theme", isLight ? "light" : "dark");

    document.getElementById("btn-tema").textContent = isLight ? "☀️ Tema Claro" : "🌙 Tema Escuro";
});
