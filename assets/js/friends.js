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

let searchDebounceTimeout;
function debounceSearch(func, delay = 300) {
    return (...args) => {
        clearTimeout(searchDebounceTimeout);
        searchDebounceTimeout = setTimeout(() => func(...args), delay);
    };
}

document.addEventListener('DOMContentLoaded', async () => {
    await loadUserProfile()
    await loadInbox()       // carrega inbox PRIMEIRO para mostrar badge
    await loadFriends()

    // Logout
    const logoutBtn = document.getElementById('logout-btn')
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try { await fetch(API_URL + '/auth/logout', { method: 'POST', credentials: 'include' }) }
            catch (e) { console.error('Erro no logout:', e) }
            window.location.href = getBaseUrl() + 'pages/login/index.html'
        })
    }

    // Enviar solicitação de amizade
    const addFriendBtn  = document.getElementById('add-friend-btn')
    const searchInput   = document.getElementById('friend-search-input')
    const searchResults = document.getElementById('search-results')

    if (addFriendBtn && searchInput) {
        addFriendBtn.addEventListener('click', () => sendFriendRequest())
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') sendFriendRequest()
        })
    }

    if (searchInput && searchResults) {
        searchInput.addEventListener('input', debounceSearch(async (e) => {
            const query = e.target.value.trim();
            if (!query) {
                searchResults.innerHTML = '';
                searchResults.classList.add('hidden');
                return;
            }

            try {
                const response = await fetch(`${API_URL}/friend/search-users?q=${encodeURIComponent(query)}`, { credentials: 'include' });
                if (!response.ok) throw new Error('Erro na busca');
                const users = await response.json();

                if (users.length === 0) {
                    searchResults.innerHTML = '<div class="search-result-no-results">Nenhum usuário encontrado.</div>';
                    searchResults.classList.remove('hidden');
                    return;
                }

                searchResults.innerHTML = '';
                users.forEach(user => {
                    const item = document.createElement('div');
                    item.className = 'search-result-item';

                    // Clicar no item preenche o input com o username
                    item.addEventListener('click', (ev) => {
                        if (ev.target.closest('.search-result-action-btn')) return; // ignorar se clicou no botão
                        searchInput.value = user.username;
                        searchResults.classList.add('hidden');
                    });

                    const info = document.createElement('div');
                    info.className = 'search-result-info';

                    const img = document.createElement('img');
                    img.src = user.profilePhoto;
                    img.alt = user.name;
                    img.className = 'search-result-avatar';

                    const details = document.createElement('div');
                    details.className = 'search-result-details';

                    const name = document.createElement('span');
                    name.className = 'search-result-name';
                    name.textContent = user.name;

                    const usernameStr = document.createElement('span');
                    usernameStr.className = 'search-result-username';
                    usernameStr.textContent = `@${user.username}`;

                    details.appendChild(name);
                    details.appendChild(usernameStr);
                    info.appendChild(img);
                    info.appendChild(details);
                    item.appendChild(info);

                    const btn = document.createElement('button');
                    btn.className = 'search-result-action-btn';
                    
                    if (user.isFriend) {
                        btn.disabled = true;
                        btn.innerHTML = '<i data-lucide="check"></i> Amigo';
                    } else {
                        btn.innerHTML = '<i data-lucide="user-plus"></i> Adicionar';
                        btn.addEventListener('click', async (ev) => {
                            ev.stopPropagation();
                            btn.disabled = true;
                            btn.innerHTML = '<i data-lucide="loader-2" style="width:14px;height:14px;animation:spin 1s linear infinite;"></i>';
                            lucide.createIcons();
                            const success = await sendFriendRequestDirectly(user.username);
                            if (success) {
                                btn.innerHTML = '<i data-lucide="check"></i> Enviado';
                                lucide.createIcons();
                            } else {
                                btn.disabled = false;
                                btn.innerHTML = '<i data-lucide="user-plus"></i> Adicionar';
                                lucide.createIcons();
                            }
                        });
                    }

                    item.appendChild(btn);
                    searchResults.appendChild(item);
                });

                searchResults.classList.remove('hidden');
                lucide.createIcons();
            } catch (err) {
                console.error('Erro ao buscar usuários:', err);
            }
        }, 300));

        // Fechar dropdown ao clicar fora
        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
                searchResults.classList.add('hidden');
            }
        });

        // Mostrar dropdown novamente ao focar no input se tiver texto
        searchInput.addEventListener('focus', () => {
            if (searchInput.value.trim() && searchResults.children.length > 0) {
                searchResults.classList.remove('hidden');
            }
        });
    }
})

// ─────────────────────────────────────────────
// Envia solicitação de amizade diretamente da lista de busca
// ─────────────────────────────────────────────
async function sendFriendRequestDirectly(username) {
    try {
        const response = await fetch(API_URL + '/friend/request', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ username }),
            credentials: 'include'
        })
        const data = await response.json()

        if (response.ok) {
            showToast(data.msg, 'success')
            // Se houve auto-aceitação, atualiza a lista de amigos também
            if (data.autoAccepted) await loadFriends()
            return true
        } else {
            showToast(data.msg || 'Erro ao enviar solicitação.', 'error')
            return false
        }
    } catch (error) {
        console.error('Erro ao enviar solicitação:', error)
        showToast('Erro de conexão com o servidor.', 'error')
        return false
    }
}

// ─────────────────────────────────────────────
// Envia solicitação de amizade
// ─────────────────────────────────────────────
async function sendFriendRequest() {
    const searchInput  = document.getElementById('friend-search-input')
    const addFriendBtn = document.getElementById('add-friend-btn')
    const username = searchInput.value.trim()

    if (!username) return showToast('Digite um username para buscar.', 'error')

    try {
        addFriendBtn.disabled     = true
        addFriendBtn.innerHTML  = '<i data-lucide="loader-2"></i> Enviando...'
        lucide.createIcons()

        const response = await fetch(API_URL + '/friend/request', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ username }),
            credentials: 'include'
        })
        const data = await response.json()

        if (response.ok) {
            showToast(data.msg, 'success')
            searchInput.value = ''
            const searchResults = document.getElementById('search-results')
            if (searchResults) {
                searchResults.innerHTML = ''
                searchResults.classList.add('hidden')
            }
            // Se houve auto-aceitação, atualiza a lista de amigos também
            if (data.autoAccepted) await loadFriends()
        } else {
            showToast(data.msg || 'Erro ao enviar solicitação.', 'error')
        }
    } catch (error) {
        console.error('Erro ao enviar solicitação:', error)
        showToast('Erro de conexão com o servidor.', 'error')
    } finally {
        addFriendBtn.disabled    = false
        addFriendBtn.innerHTML = '<i data-lucide="user-plus"></i> Enviar Solicitação'
        lucide.createIcons()
    }
}

// ─────────────────────────────────────────────
// Carrega o inbox de solicitações pendentes
// ─────────────────────────────────────────────
async function loadInbox() {
    const inboxSection  = document.getElementById('inbox-section')
    const inboxList     = document.getElementById('inbox-list')
    const inboxBadge    = document.getElementById('sidebar-inbox-badge')
    const inboxCount    = document.getElementById('inbox-count-badge')
    const template      = document.getElementById('request-card-template')

    try {
        const response = await fetch(API_URL + '/friend/inbox', { credentials: 'include' })
        const data     = await response.json()

        if (!response.ok) return

        const requests = data.requests || []

        // Atualiza badge no sidebar
        if (requests.length > 0) {
            inboxBadge.textContent = requests.length
            inboxBadge.style.display = 'inline-flex'
            inboxCount.textContent   = requests.length
            inboxSection.style.display = 'block'
        } else {
            inboxBadge.style.display   = 'none'
            inboxSection.style.display = 'none'
        }

        inboxList.innerHTML = ''

        requests.forEach((req) => {
            const clone = template.content.cloneNode(true)

            clone.querySelector('.request-avatar').src = req.profilePhoto
            clone.querySelector('.request-avatar').alt = req.name
            clone.querySelector('.request-name').textContent    = req.name
            clone.querySelector('.request-username').textContent = `@${req.username}`
            clone.querySelector('.request-time').textContent    = formatRelativeTime(req.sentAt)

            const acceptBtn  = clone.querySelector('.accept-btn')
            const declineBtn = clone.querySelector('.decline-btn')

            acceptBtn.addEventListener('click',  () => respondToRequest(req.username, 'accept'))
            declineBtn.addEventListener('click', () => respondToRequest(req.username, 'decline'))

            inboxList.appendChild(clone)
        })
        lucide.createIcons()
    } catch (error) {
        console.error('Erro ao carregar inbox:', error)
    }
}

// ─────────────────────────────────────────────
// Aceita ou recusa uma solicitação do inbox
// ─────────────────────────────────────────────
async function respondToRequest(username, action) {
    const endpoint = action === 'accept' ? '/friend/accept' : '/friend/decline'

    try {
        const response = await fetch(endpoint, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ username }),
            credentials: 'include'
        })
        const data = await response.json()

        if (response.ok) {
            showToast(data.msg, 'success')
            // Recarrega inbox e lista de amigos para refletir a mudança
            await loadInbox()
            await loadFriends()
        } else {
            showToast(data.msg || 'Erro ao processar solicitação.', 'error')
        }
    } catch (error) {
        console.error('Erro ao responder solicitação:', error)
        showToast('Erro de conexão.', 'error')
    }
}

// ─────────────────────────────────────────────
// Carrega lista de amigos confirmados
// ─────────────────────────────────────────────
async function loadFriends() {
    const friendsListEl = document.getElementById('friends-list')
    const template      = document.getElementById('friend-card-template')

    try {
        const response = await fetch(API_URL + '/friend/list', { credentials: 'include' })
        const data     = await response.json()

        if (response.ok) {
            friendsListEl.innerHTML = ''

            if (data.friends && data.friends.length > 0) {
                data.friends.forEach((friend) => {
                    const clone = template.content.cloneNode(true)

                    clone.querySelector('.friend-avatar').src = friend.profilePhoto
                    clone.querySelector('.friend-avatar').alt = friend.name
                    clone.querySelector('.friend-name').textContent     = friend.name
                    clone.querySelector('.friend-username').textContent = `@${friend.username}`

                    clone.querySelector('.view-profile-btn').href = `/p/${friend.username}`
                    clone.querySelector('.remove-friend-btn').addEventListener('click', () =>
                        removeFriend(friend.username)
                    )

                    friendsListEl.appendChild(clone)
                })
                lucide.createIcons()
            } else {
                friendsListEl.innerHTML = `
                    <div class="empty-state">
                        <p>Você ainda não tem amigos adicionados.</p>
                        <p style="font-size:0.9rem;margin-top:10px;color:var(--fg-dim);">
                            Use o campo acima para buscar pelo username de seus colegas!
                        </p>
                    </div>`
            }
        } else {
            friendsListEl.innerHTML = '<div class="empty-state"><p>Erro ao carregar amigos.</p></div>'
        }
    } catch (error) {
        console.error('Erro ao listar amigos:', error)
        friendsListEl.innerHTML = '<div class="empty-state"><p>Erro de conexão ao carregar amigos.</p></div>'
    }
}

// ─────────────────────────────────────────────
// Remove amigo confirmado
// ─────────────────────────────────────────────
async function removeFriend(username) {
    if (!confirm(`Tem certeza que deseja remover @${username} da sua lista de amigos?`)) return

    try {
        const response = await fetch(API_URL + '/friend/remove', {
            method:  'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ username }),
            credentials: 'include'
        })
        const data = await response.json()

        if (response.ok) {
            showToast(data.msg, 'success')
            await loadFriends()
        } else {
            showToast(data.msg || 'Erro ao remover amigo.', 'error')
        }
    } catch (error) {
        console.error('Erro ao remover amigo:', error)
        showToast('Erro de conexão ao remover amigo.', 'error')
    }
}

// ─────────────────────────────────────────────
// Carrega dados básicos do usuário logado (greeting)
// ─────────────────────────────────────────────
async function loadUserProfile() {
    try {
        const response = await fetch(API_URL + '/user/me', { credentials: 'include' })
        if (response.ok) {
            const data = await response.json()
            const greetingEl = document.getElementById('userNameGreeting')
            if (greetingEl && data.user) {
                greetingEl.textContent = `Olá, ${data.user.name.split(' ')[0]}`
                
                if (data.user.isAdmin) {
                    const nav = document.querySelector('.sidebar-nav')
                    if (nav && !nav.querySelector('a[href="/admin"]')) {
                        const adminLink = document.createElement('a')
                        adminLink.href = '/admin'
                        adminLink.className = 'nav-item'
                        adminLink.innerHTML = '<i data-lucide="shield-alert"></i> Admin'
                        nav.appendChild(adminLink)
                        if (typeof lucide !== 'undefined') lucide.createIcons()
                    }
                }
            }
        } else if (response.status === 401) {
            window.location.href = getBaseUrl() + 'pages/login/index.html'
        }
    } catch (error) {
        console.error('Erro ao carregar perfil:', error)
    } finally {
        hideLoader()
    }
}

// ─────────────────────────────────────────────
// Utilitário: tempo relativo ("há 2 min", "há 1h")
// ─────────────────────────────────────────────
function formatRelativeTime(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins  = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days  = Math.floor(diff / 86400000)

    if (mins  < 1)  return 'agora mesmo'
    if (mins  < 60) return `há ${mins} min`
    if (hours < 24) return `há ${hours}h`
    return `há ${days}d`
}

// ─────────────────────────────────────────────
// Utilitário: toast de feedback (evita alert())
// ─────────────────────────────────────────────
function showToast(msg, type = 'success') {
    const existing = document.getElementById('toast-msg')
    if (existing) existing.remove()

    const toast = document.createElement('div')
    toast.id = 'toast-msg'
    toast.textContent = msg
    toast.style.cssText = `
        position: fixed; bottom: 30px; right: 30px; z-index: 9999;
        padding: 14px 22px; border-radius: 12px; font-weight: 600;
        font-size: 0.95rem; max-width: 360px;
        background-color: ${type === 'success' ? 'rgba(158,206,106,0.15)' : 'rgba(247,118,142,0.15)'};
        color: ${type === 'success' ? '#9ece6a' : '#f7768e'};
        border: 1px solid ${type === 'success' ? 'rgba(158,206,106,0.3)' : 'rgba(247,118,142,0.3)'};
        box-shadow: 0 8px 24px rgba(0,0,0,0.3);
        animation: slideIn 0.3s ease;
    `
    document.body.appendChild(toast)
    setTimeout(() => toast.remove(), 4000)
}

function toggleSidebar() {
    const sidebar    = document.getElementById('sidebar')
    const mainContent = document.getElementById('main-content')
    const toggleBtn  = document.querySelector('.sidebar-toggle')

    sidebar.classList.toggle('open')
    mainContent.classList.toggle('pushed')
    if (toggleBtn) toggleBtn.classList.toggle('active')
}
