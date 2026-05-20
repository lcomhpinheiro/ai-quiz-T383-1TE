const API_URL = "https://ai-quiz-students-backend.onrender.com"
let cropper;
const profileImg = document.getElementById('profile-img');
const imageUpload = document.getElementById('image-upload');
const cropperModal = document.getElementById('cropper-modal');
const imageToCrop = document.getElementById('image-to-crop');
const confirmCropBtn = document.getElementById('confirm-crop');
const cancelCropBtn = document.getElementById('cancel-crop');

function getImageUrl(path) {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return `${API_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

document.addEventListener('DOMContentLoaded', async () => {
    await loadUserProfile();

    // Evento de seleção de arquivo
    imageUpload.addEventListener('change', (e) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            const reader = new FileReader();
            reader.onload = (event) => {
                imageToCrop.src = event.target.result;
                cropperModal.style.display = 'block';
                
                if (cropper) {
                    cropper.destroy();
                }
                
                cropper = new Cropper(imageToCrop, {
                    aspectRatio: 1, // Quadrado
                    viewMode: 1,
                    autoCropArea: 1
                });
            };
            reader.readAsDataURL(files[0]);
        }
    });

    // Cancelar corte
    cancelCropBtn.addEventListener('click', () => {
        cropperModal.style.display = 'none';
        imageUpload.value = ''; // Reseta o input
    });

    // Confirmar corte e enviar
    confirmCropBtn.addEventListener('click', () => {
        const token = localStorage.getItem('Token');
        const canvas = cropper.getCroppedCanvas({
            width: 500,
            height: 500
        });

        canvas.toBlob(async (blob) => {
            const formData = new FormData();
            formData.append('image', blob, 'profile.png');

            try {
                confirmCropBtn.disabled = true;
                confirmCropBtn.textContent = 'Enviando...';

                const response = await fetch(`${API_URL}/user/upload-photo`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formData
                });

                if (response.ok) {
                    const data = await response.json();
                    profileImg.src = getImageUrl(data.profilePhoto);
                    cropperModal.style.display = 'none';
                    alert('Foto atualizada com sucesso!');
                } else {
                alert('Erro ao enviar imagem.');
                }
            } catch (error) {
                console.error('Erro no upload:', error);
                alert('Erro de conexão.');
            } finally {
                confirmCropBtn.disabled = false;
                confirmCropBtn.textContent = 'Salvar Alteração';
                imageUpload.value = '';
            }
        }, 'image/png');
    });
});

async function loadUserProfile() {
    const token = localStorage.getItem('Token');
    if (!token) {
        window.location.href = '../login/index.html';
        return;
    }

    const usernameEl = document.getElementById('username');
    const nameEl = document.getElementById('name');
    const emailEl = document.getElementById('email');
    const greetingEl = document.getElementById('userNameGreeting');

    try {
        const response = await fetch(`${API_URL}/user/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            const user = data.user;

            if (user) {
                usernameEl.textContent = user.username;
                nameEl.textContent = user.name;
                emailEl.textContent = user.email;
                profileImg.src = getImageUrl(user.profilePhoto);
                greetingEl.textContent = `Olá, ${user.name.split(' ')[0]}`;
            }
        } else if (response.status === 401) {
            window.location.href = '../login/index.html';
        }
    } catch (error) {
        console.error('Erro ao carregar perfil:', error);
    }
}

async function logout() {
    const token = localStorage.getItem('Token');
    try {
        await fetch(`${API_URL}/auth/logout`, { 
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
    } catch (error) {
        console.error('Erro ao fazer logout no servidor:', error);
    }
    localStorage.removeItem('Token');
    window.location.href = "../login/index.html";
}

function toggleSidebar() {
    const sidebar = document.getElementById("sidebar");
    const mainContent = document.querySelector(".main-content");
    const toggleBtn = document.querySelector(".sidebar-toggle");
    
    sidebar.classList.toggle("open");
    mainContent.classList.toggle("pushed");
    toggleBtn.classList.toggle("active");
}
