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

let cropper;

const profileImg    = document.getElementById('profile-img');
const imageUpload   = document.getElementById('image-upload');
const cropperModal  = document.getElementById('cropper-modal');
const imageToCrop   = document.getElementById('image-to-crop');
const confirmCropBtn = document.getElementById('confirm-crop');
const cancelCropBtn  = document.getElementById('cancel-crop');

document.addEventListener('DOMContentLoaded', async () => {
    const pathParts       = window.location.pathname.split('/');
    const isPublicProfile = pathParts.includes('p');
    const targetUsername  = isPublicProfile ? pathParts[pathParts.length - 1] : null;

    initTheme();
    await loadUserProfile(targetUsername);

    if (!isPublicProfile && imageUpload) {
        imageUpload.addEventListener('change', (e) => {
            const files = e.target.files;
            if (files && files.length > 0) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    imageToCrop.src = event.target.result;
                    cropperModal.style.display = 'block';
                    if (cropper) cropper.destroy();
                    cropper = new Cropper(imageToCrop, {
                        aspectRatio: 1, viewMode: 1, autoCropArea: 1
                    });
                };
                reader.readAsDataURL(files[0]);
            }
        });

        cancelCropBtn.addEventListener('click', () => {
            cropperModal.style.display = 'none';
            imageUpload.value = '';
        });

        confirmCropBtn.addEventListener('click', () => {
            const canvas = cropper.getCroppedCanvas({ width: 500, height: 500 });
            canvas.toBlob(async (blob) => {
                const formData = new FormData();
                formData.append('image', blob, 'profile.png');
                try {
                    confirmCropBtn.disabled     = true;
                    confirmCropBtn.innerHTML  = '<i data-lucide="loader-2"></i> Enviando...';
                    lucide.createIcons();
                    const response = await fetch(API_URL + '/user/upload-photo', {
                        method: 'POST', body: formData, credentials: 'include'
                    });
                    if (response.ok) {
                        const data = await response.json();
                        profileImg.src = data.profilePhoto;
                        cropperModal.style.display = 'none';
                        alert('Foto atualizada com sucesso!');
                    } else {
                        alert('Erro ao enviar imagem.');
                    }
                } catch (error) {
                    console.error('Erro no upload:', error);
                    alert('Erro de conexão.');
                } finally {
                    confirmCropBtn.disabled    = false;
                    confirmCropBtn.innerHTML = '<i data-lucide="check"></i> Salvar Alteração';
                    lucide.createIcons();
                    imageUpload.value = '';
                }
            }, 'image/png');
        });
    } else if (isPublicProfile) {
        const uploadLabel = document.querySelector('.upload-label');
        if (uploadLabel) uploadLabel.remove();
        if (imageUpload)  imageUpload.remove();
        document.getElementById('preferences-section').style.display = 'none'
    }
});

// ── Lógica da Bio ────────────────────────────────────────────────────────────
const editBioBtn = document.getElementById('edit-bio-btn');
const cancelBioBtn = document.getElementById('cancel-bio-btn');
const saveBioBtn = document.getElementById('save-bio-btn');
const bioInput = document.getElementById('bio-input');
const bioText = document.getElementById('bio-text');
const bioDisplayContainer = document.getElementById('bio-display-container');
const bioEditContainer = document.getElementById('bio-edit-container');

if (editBioBtn) {
    editBioBtn.addEventListener('click', () => {
        bioInput.value = bioText.textContent === 'Nenhuma bio informada.' ? '' : bioText.textContent;
        bioDisplayContainer.classList.add('hidden');
        bioEditContainer.classList.remove('hidden');
        bioInput.focus();
    });
}

if (cancelBioBtn) {
    cancelBioBtn.addEventListener('click', () => {
        bioDisplayContainer.classList.remove('hidden');
        bioEditContainer.classList.add('hidden');
    });
}

if (saveBioBtn) {
    saveBioBtn.addEventListener('click', async () => {
        const newBio = bioInput.value.trim();
        try {
            saveBioBtn.disabled = true;
            saveBioBtn.textContent = 'Salvando...';

            const res = await fetch(API_URL + '/user/bio', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bio: newBio }),
                credentials: 'include'
            });

            if (res.ok) {
                const data = await res.json();
                bioText.textContent = data.bio || 'Nenhuma bio informada.';
                bioDisplayContainer.classList.remove('hidden');
                bioEditContainer.classList.add('hidden');
            } else {
                alert('Erro ao salvar bio.');
            }
        } catch (err) {
            console.error('Erro ao salvar bio:', err);
            alert('Erro de conexão.');
        } finally {
            saveBioBtn.disabled = false;
            saveBioBtn.textContent = 'Salvar';
        }
    });
}

function formatMemberSince(dateStr) {
    if (!dateStr) return 'Maio de 2026';
    const date = new Date(dateStr);
    const months = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return `${months[date.getMonth()]} de ${date.getFullYear()}`;
}

async function loadUserProfile(targetUsername = null) {
    const usernameEl  = document.getElementById('username');
    const nameEl      = document.getElementById('name');
    const emailEl     = document.getElementById('email');
    const sinceEl     = document.getElementById('member-since');
    const bioTxtEl    = document.getElementById('bio-text');
    const greetingEl  = document.getElementById('userNameGreeting');
    const profileTitle = document.querySelector('h1');

    try {
        const meResponse = await fetch(API_URL + '/user/me', { credentials: 'include' });
        if (!meResponse.ok) {
            if (meResponse.status === 401) window.location.href = getBaseUrl() + 'pages/login/index.html';
            return;
        }
        const meData = await meResponse.json();
        greetingEl.textContent = `Olá, ${meData.user.name.split(' ')[0]}`;

        if (meData.user && meData.user.isAdmin) {
            const nav = document.querySelector('.sidebar-nav');
            if (nav && !nav.querySelector('a[href="/admin"]')) {
                const adminLink = document.createElement('a');
                adminLink.href = '/admin';
                adminLink.className = 'nav-item';
                adminLink.innerHTML = '<i data-lucide="shield-alert"></i> Admin';
                nav.appendChild(adminLink);
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }
        }

        if (targetUsername) {
            // ── Perfil público de outro usuário ──────────────────────
            const response = await fetch(`${API_URL}/friend/profile/${targetUsername}`, { credentials: 'include' });
            if (response.ok) {
                const data    = await response.json();
                const profile = data.profile;

                usernameEl.textContent  = profile.username;
                nameEl.textContent      = profile.name;
                profileImg.src          = profile.profilePhoto;
                profileTitle.textContent = `Perfil de ${profile.name.split(' ')[0]}`;

                if (sinceEl) sinceEl.textContent = formatMemberSince(profile.createdAt);
                if (bioTxtEl) bioTxtEl.textContent = profile.bio || 'Nenhuma bio informada.';
                if (editBioBtn) editBioBtn.classList.add('hidden');

                if (emailEl) document.getElementById('email-item').style.display = 'none';

                // Botão de amizade com 4 estados
                setupFriendshipButton(profile);
                
                // Esconde histórico em perfil público
                const historySec = document.querySelector('.history-section');
                if(historySec) historySec.style.display = 'none';
            } else {
                alert('Usuário não encontrado.');
                window.location.href = getBaseUrl() + 'pages/friends/index.html';
            }
        } else {
            // ── Meu próprio perfil ────────────────────────────────────
            const user = meData.user;
            usernameEl.textContent = user.username;
            nameEl.textContent     = user.name;
            emailEl.textContent    = user.email;
            profileImg.src         = user.profilePhoto;

            if (sinceEl) sinceEl.textContent = formatMemberSince(user.createdAt);
            if (bioTxtEl) bioTxtEl.textContent = user.bio || 'Nenhuma bio informada.';
        }
    } catch (error) {
        console.error('Erro ao carregar perfil:', error);
    } finally {
        hideLoader();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Botão de amizade dinâmico — 4 estados possíveis:
//   1. isFriend        → "Remover Amigo"      (vermelho)
//   2. receivedRequest → "Aceitar Solicitação" (verde) + "Recusar" (vermelho)
//   3. hasPendingRequest → "Solicitação Enviada" (desabilitado, amarelo)
//   4. nenhum          → "Adicionar Amigo"     (roxo)
// ─────────────────────────────────────────────────────────────────────────────
function setupFriendshipButton(profile) {
    const infoSection = document.querySelector('.user-info-section');
    const container   = document.createElement('div');
    container.style.cssText = 'margin-top:20px; display:flex; gap:10px;';

    const btnBase = `
        width:100%; padding:15px; border-radius:12px; border:none;
        font-weight:700; cursor:pointer; font-size:1rem; transition:all 0.2s;
    `;

    if (profile.isFriend) {
        // ── Já são amigos → botão Remover ────────────────────────────
        const btn = document.createElement('button');
        btn.innerHTML = '<i data-lucide="trash-2"></i> Remover Amigo';
        btn.style.cssText = btnBase + `
            background-color:rgba(247,118,142,0.1); color:#f7768e;
            border:1px solid rgba(247,118,142,0.2); flex:1;
        `;
        btn.onclick = async () => {
            if (!confirm(`Remover @${profile.username} da sua lista de amigos?`)) return;
            btn.disabled = true;
            const res = await fetch(API_URL + '/friend/remove', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ username: profile.username }),
                credentials: 'include'
            });
            if (res.ok) location.reload();
            else { const d = await res.json(); alert(d.msg); btn.disabled = false; }
        };
        container.appendChild(btn);

    } else if (profile.receivedRequest) {
        // ── Ele me enviou solicitação → Aceitar / Recusar ─────────────
        const acceptBtn  = document.createElement('button');
        const declineBtn = document.createElement('button');

        acceptBtn.innerHTML = '<i data-lucide="check"></i> Aceitar Solicitação';
        acceptBtn.style.cssText = btnBase + `
            background-color:#bb9af7; color:#16161e; flex:1;
        `;

        declineBtn.innerHTML = '<i data-lucide="x"></i> Recusar';
        declineBtn.style.cssText = btnBase + `
            background-color:rgba(247,118,142,0.1); color:#f7768e;
            border:1px solid rgba(247,118,142,0.2); flex:none; padding:15px 20px;
        `;

        acceptBtn.onclick = async () => {
            acceptBtn.disabled = declineBtn.disabled = true;
            const res = await fetch(API_URL + '/friend/accept', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ username: profile.username }),
                credentials: 'include'
            });
            if (res.ok) location.reload();
            else { const d = await res.json(); alert(d.msg); acceptBtn.disabled = declineBtn.disabled = false; }
        };

        declineBtn.onclick = async () => {
            acceptBtn.disabled = declineBtn.disabled = true;
            const res = await fetch(API_URL + '/friend/decline', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ username: profile.username }),
                credentials: 'include'
            });
            if (res.ok) location.reload();
            else { const d = await res.json(); alert(d.msg); acceptBtn.disabled = declineBtn.disabled = false; }
        };

        container.appendChild(acceptBtn);
        container.appendChild(declineBtn);

    } else if (profile.hasPendingRequest) {
        // ── Eu enviei e está pendente → desabilitado ──────────────────
        const btn = document.createElement('button');
        btn.innerHTML = '<i data-lucide="clock"></i> Solicitação Enviada';
        btn.disabled = true;
        btn.style.cssText = btnBase + `
            background-color:rgba(224,175,104,0.1); color:#e0af68;
            border:1px solid rgba(224,175,104,0.2); flex:1; cursor:not-allowed; opacity:0.7;
        `;
        container.appendChild(btn);

    } else {
        // ── Sem vínculo → Adicionar ───────────────────────────────────
        const btn = document.createElement('button');
        btn.innerHTML = '<i data-lucide="user-plus"></i> Adicionar Amigo';
        btn.style.cssText = btnBase + `
            background-color:#bb9af7; color:#16161e; flex:1;
        `;
        btn.onclick = async () => {
            btn.disabled    = true;
            btn.innerHTML = '<i data-lucide="loader-2"></i> Enviando...';
            lucide.createIcons();
            const res = await fetch(API_URL + '/friend/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ username: profile.username }),
                credentials: 'include'
            });
            if (res.ok) location.reload();
            else {
                const d = await res.json();
                alert(d.msg);
                btn.disabled    = false;
                btn.innerHTML = '<i data-lucide="user-plus"></i> Adicionar Amigo';
                lucide.createIcons();
            }
        };
        container.appendChild(btn);
    }

    infoSection.appendChild(container);
    lucide.createIcons();
}

async function logout() {
    try { await fetch(API_URL + '/auth/logout', { method: 'POST', credentials: 'include' }); }
    catch (e) { console.error('Erro no logout:', e); }
    window.location.href = getBaseUrl() + 'pages/login/index.html';
}

function toggleSidebar() {
    const sidebar     = document.getElementById('sidebar');
    const mainContent = document.querySelector('.main-content');
    const toggleBtn   = document.querySelector('.sidebar-toggle');

    sidebar.classList.toggle('open');
    mainContent.classList.toggle('pushed');
    toggleBtn.classList.toggle('active');
}

function initTheme() {
    const savedTheme = localStorage.getItem('preferred-theme') || 'dark';
    setTheme(savedTheme);
}

function setTheme(theme) {
    document.documentElement.classList.remove('light-theme', 'contrast-theme');
    if (theme !== 'dark') document.documentElement.classList.add(theme + '-theme');
    localStorage.setItem('preferred-theme', theme);
}

function showLoader() { document.getElementById("page-loader").classList.remove("hidden"); }
function hideLoader() { document.getElementById("page-loader").classList.add("hidden"); }
