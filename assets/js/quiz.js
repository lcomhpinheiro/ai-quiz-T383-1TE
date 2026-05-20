const API_URL = "https://ai-quiz-students-backend.onrender.com"
let currentQuiz = null

async function loadUserData() {
  const token = localStorage.getItem('Token')
  if (!token) {
    window.location.href = '../login/index.html'
    return
  }

  try {
    const res = await fetch(`${API_URL}/user/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (res.ok) {
      const data = await res.json()
      document.getElementById("userNameGreeting").textContent = `Olá, ${data.user.name}`
    } else if (res.status === 401) {
      window.location.href = '../login/index.html'
    }
  } catch (err) {
    console.error("Erro ao carregar dados do usuário:", err)
  }
}

document.addEventListener("DOMContentLoaded", loadUserData)

async function logout() {
  const token = localStorage.getItem('Token')
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

function renderQuiz(quiz) {
  currentQuiz = quiz

  const container = document.getElementById("quizContainer")
  const submitBtn = document.getElementById("submitBtn")
  container.innerHTML = ""

  quiz.questions.forEach((q, index) => {
    const wrapper = document.createElement("div")
    wrapper.className = "quiz-card"

    const title = document.createElement("p")
    title.textContent = `${index + 1}. ${q.question}`
    wrapper.appendChild(title)


    if (q.type === "multiple_choice") {
      const select = document.createElement("select")
      select.id = `q_${index}`

      const defaultOption = document.createElement("option")
      defaultOption.textContent = "Selecione uma opção"
      defaultOption.value = ""
      defaultOption.disabled = true
      defaultOption.selected = true
      select.appendChild(defaultOption)

      q.options.forEach(option => {
        const opt = document.createElement("option")
        opt.value = option
        opt.textContent = option
        select.appendChild(opt)
      })

      wrapper.appendChild(select)
    }


    if (q.type === "open") {
      const input = document.createElement("input")
      input.type = "text"
      input.id = `q_${index}`
      input.placeholder = "Sua resposta aqui..."
      input.className = "open-input"

      wrapper.appendChild(input)
    }

    container.appendChild(wrapper)
  })

  submitBtn.style.display = "block"
}


function getAnswers() {
  const answers = {}

  currentQuiz.questions.forEach((_, index) => {
    const el = document.getElementById(`q_${index}`)
    answers[index] = el ? el.value : ""
  })

  return answers
}


async function submitAnswers() {
  const token = localStorage.getItem('Token')
  const answers = getAnswers()
  const submitBtn = document.getElementById("submitBtn")
  
  submitBtn.disabled = true
  submitBtn.textContent = "Analisando..."

  const maxRetries = 5
  let attempt = 0

  while (attempt < maxRetries) {
    try {
      const res = await fetch(`${API_URL}/quiz/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          quiz: currentQuiz,
          answers: answers
        })
      })

      if (!res.ok) throw new Error("Erro na resposta")

      const data = await res.json()

      renderAnalysis(data)
      submitBtn.disabled = false
      submitBtn.textContent = "Finalizar e Analisar"
      return

    } catch (err) {
      attempt++
      if (attempt >= maxRetries) {
        console.error(err)
        alert("Erro ao enviar respostas")
        submitBtn.disabled = false
        submitBtn.textContent = "Finalizar e Analisar"
        return
      }
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
    }
  }
}

async function generateQuiz() {
  const token = localStorage.getItem('Token')
  const topic = document.getElementById("topic").value
  const genBtn = document.querySelector(".btn-generate")

  if (!topic) {
    alert("Digite um tema")
    return
  }

  genBtn.disabled = true
  genBtn.textContent = "Gerando..."
  
  document.getElementById("quizContainer").innerHTML = ""
  document.getElementById("result").style.display = "none"
  document.getElementById("result").innerHTML = ""

  const maxRetries = 5
  let attempt = 0

  while (attempt < maxRetries) {
    try {
      const res = await fetch(`${API_URL}/quiz/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ topic })
      })

      if (!res.ok) throw new Error("Erro na resposta")

      const quiz = await res.json()

      renderQuiz(quiz)
      genBtn.disabled = false
      genBtn.textContent = "Gerar Quiz"
      return

    } catch (err) {
      attempt++
      if (attempt >= maxRetries) {
        console.error(err)
        alert("Erro ao gerar quiz")
        genBtn.disabled = false
        genBtn.textContent = "Gerar Quiz"
        return
      }
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
    }
  }
}

function renderAnalysis(data) {
  const container = document.getElementById("result")
  container.style.display = "block"
  container.innerHTML = ""

  Object.entries(data).forEach(([key, value]) => {
    const title = document.createElement("h2")
    title.textContent = formatTitle(key)
    container.appendChild(title)

    if (Array.isArray(value)) {
      const ul = document.createElement("ul")

      value.forEach(item => {
        const li = document.createElement("li")
        li.textContent = item
        ul.appendChild(li)
      })

      container.appendChild(ul)
    } else {
      const p = document.createElement("p")
      p.textContent = value
      container.appendChild(p)
    }
  })
  
  // Scroll suave para o resultado
  container.scrollIntoView({ behavior: 'smooth' })
}

function formatTitle(text) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
