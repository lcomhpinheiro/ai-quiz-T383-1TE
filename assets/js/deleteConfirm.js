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

async function confirmDeletion() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    const processingEl = document.getElementById('status-processing');
    const successEl = document.getElementById('status-success');
    const errorEl = document.getElementById('status-error');
    const errorMsgEl = document.getElementById('error-message');

    if (!token) {
        processingEl.classList.add('hidden');
        errorEl.classList.remove('hidden');
        errorMsgEl.textContent = "Token de confirmação ausente.";
        return;
    }

    try {
        const response = await fetch(API_URL + '/auth/confirm-delete-account', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ token })
        });

        const data = await response.json();

        processingEl.classList.add('hidden');

        if (response.ok) {
            successEl.classList.remove('hidden');
        } else {
            errorEl.classList.remove('hidden');
            errorMsgEl.textContent = data.msg || "Erro ao processar exclusão.";
        }
    } catch (error) {
        console.error("Erro na requisição de exclusão:", error);
        processingEl.classList.add('hidden');
        errorEl.classList.remove('hidden');
        errorMsgEl.textContent = "Erro de conexão com o servidor.";
    }
}

document.addEventListener('DOMContentLoaded', confirmDeletion);