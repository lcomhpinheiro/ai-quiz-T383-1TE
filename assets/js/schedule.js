const API_URL = "https://ai-quiz-students-backend.onrender.com"
const schoolYearSelect = document.getElementById('school-year');
const modalityGroup = document.getElementById('modality-group');
const modalitySelect = document.getElementById('modality');
const tableContainer = document.getElementById('table-container');
const scheduleBody = document.getElementById('schedule-body');
const scheduleForm = document.getElementById('schedule-form');
const btnEdit = document.getElementById('btn-edit');
const actionsContainer = document.querySelector('.actions');
const saveBtn = actionsContainer.querySelector('button');

let isEditing = false;
let currentScheduleData = null;

function validateTable() {
    if (!isEditing) {
        actionsContainer.classList.add('hidden');
        return;
    }

    const selects = scheduleBody.querySelectorAll('select');
    if (selects.length === 0) {
        actionsContainer.classList.add('hidden');
        return;
    }

    let allFilled = true;
    selects.forEach(select => {
        if (!select.value) {
            allFilled = false;
        }
    });

    if (allFilled) {
        actionsContainer.classList.remove('hidden');
    } else {
        actionsContainer.classList.add('hidden');
    }
}

const subjectsData = {
    fundamental1: [
        "Língua Portuguesa", "Matemática", "Ciências da Natureza", 
        "Geografia", "História", "Arte", "Educação Física", "Ensino Religioso"
    ],
    fundamental1_plus: [
        "Língua Portuguesa", "Matemática", "Ciências da Natureza", 
        "Geografia", "História", "Arte", "Educação Física", "Ensino Religioso", "Língua Inglesa"
    ],
    fundamental2: [
        "Língua Portuguesa", "Matemática", "Ciências", 
        "Geografia", "História", "Arte", "Educação Física", "Ensino Religioso", "Língua Inglesa"
    ],
    medio: [
        "Língua Portuguesa", "Língua Inglesa", "Arte", "Educação Física", 
        "Matemática", "Biologia", "Física", "Química", 
        "História", "Geografia", "Filosofia", "Sociologia"
    ]
};

document.addEventListener('DOMContentLoaded', async () => {
    await loadInitialData();
});

async function loadInitialData() {
    const token = localStorage.getItem('Token');
    if (!token) {
        window.location.href = '../login/index.html';
        return;
    }

    try {
        const response = await fetch(`${API_URL}/schedule/data`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.schedule) {
            currentScheduleData = data.schedule;
            schoolYearSelect.value = data.schedule.year;
            modalitySelect.value = data.schedule.modality;
            
            modalityGroup.classList.remove('hidden');
            tableContainer.classList.remove('hidden');
            
            generateTable(data.schedule.modality, data.schedule.schedule);
            setFormDisabled(true);
            btnEdit.classList.remove('hidden');
        } else {
            // Se não houver schedule, é o registro inicial
            document.body.classList.add('registration-mode');
            isEditing = true; // Habilita validação para registro
        }
        
        // Carregar nome do usuário para a sidebar
        const userRes = await fetch(`${API_URL}/user/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (userRes.ok) {
            const userData = await userRes.json();
            document.getElementById('userNameGreeting').textContent = `Olá, ${userData.name.split(' ')[0]}`;
        }

        validateTable();

    } catch (err) {
        console.error('Erro ao carregar dados:', err);
    }
}

function setFormDisabled(disabled) {
    const elements = scheduleForm.querySelectorAll('select, button[type="submit"]');
    elements.forEach(el => {
        el.disabled = disabled;
    });
    schoolYearSelect.disabled = disabled;
    modalitySelect.disabled = disabled;
    isEditing = !disabled;
    validateTable();
}

function enableEditing() {
    setFormDisabled(false);
    btnEdit.classList.add('hidden');
}

function getSubjectsForYear(yearValue) {
    if (!yearValue) return [];
    if (yearValue.endsWith('m')) {
        return subjectsData.medio;
    }
    
    const yearNum = parseInt(yearValue);
    if (yearNum >= 1 && yearNum <= 2) {
        return subjectsData.fundamental1;
    } else if (yearNum >= 3 && yearNum <= 5) {
        return subjectsData.fundamental1_plus;
    } else if (yearNum >= 6 && yearNum <= 9) {
        return subjectsData.fundamental2;
    }
    return [];
}

schoolYearSelect.addEventListener('change', () => {
    if (schoolYearSelect.value) {
        modalityGroup.classList.remove('hidden');
        if (modalitySelect.value) {
            generateTable(modalitySelect.value);
        }
    }
});

modalitySelect.addEventListener('change', () => {
    const modality = modalitySelect.value;
    if (modality) {
        generateTable(modality);
        tableContainer.classList.remove('hidden');
    }
});

function generateTable(modality, savedData = null) {
    const rows = modality === 'regular' ? 6 : 9;
    const subjects = getSubjectsForYear(schoolYearSelect.value);
    scheduleBody.innerHTML = '';

    for (let i = 1; i <= rows; i++) {
        const tr = document.createElement('tr');
        
        const tdTime = document.createElement('td');
        tdTime.textContent = `${i}ª Aula`;
        tdTime.style.color = 'var(--fg-dim)';
        tdTime.style.fontSize = '12px';
        tr.appendChild(tdTime);

        for (let j = 0; j < 5; j++) {
            const td = document.createElement('td');
            const select = document.createElement('select');
            const slotName = `slot-${i}-${j}`;
            select.name = slotName;
            select.style.width = '100%';
            
            const defaultOption = document.createElement('option');
            defaultOption.value = "";
            defaultOption.textContent = "-";
            select.appendChild(defaultOption);

            subjects.forEach(subject => {
                const option = document.createElement('option');
                option.value = subject;
                option.textContent = subject;
                if (savedData && savedData[slotName] === subject) {
                    option.selected = true;
                }
                select.appendChild(option);
            });

            select.addEventListener('change', validateTable);

            td.appendChild(select);
            tr.appendChild(td);
        }

        scheduleBody.appendChild(tr);
    }
    validateTable();
}

scheduleForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('Token');
    
    const formData = new FormData(scheduleForm);
    const data = {
        year: schoolYearSelect.value,
        modality: modalitySelect.value,
        schedule: {}
    };

    for (let [key, value] of formData.entries()) {
        if (value) {
            data.schedule[key] = value;
        }
    }

    try {
        const response = await fetch(`${API_URL}/schedule/save`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (response.ok) {
            alert('Horário salvo com sucesso!');
            window.location.href = '../quiz/index.html';
        } else {
            alert('Erro ao salvar horário: ' + (result.msg || 'Erro desconhecido'));
        }
    } catch (err) {
        console.error('Erro:', err);
        alert('Erro ao conectar com o servidor.');
    }
});

// Sidebar e Logout Functions
function toggleSidebar() {
    const sidebar = document.getElementById("sidebar");
    sidebar.classList.toggle("open");
}

async function logout() {
    const token = localStorage.getItem('Token');
    try {
        await fetch(`${API_URL}/auth/logout`, { 
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
    } catch (error) {
        console.error('Erro ao fazer logout:', error);
    }
    localStorage.removeItem('Token');
    window.location.href = "../login/index.html";
}
