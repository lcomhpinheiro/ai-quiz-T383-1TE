const API_URL = "https://ai-quiz-students-backend.onrender.com/quiz";

let currentQuiz = null;

// 🔹 renderiza o quiz dinamicamente
function renderQuiz(quiz) {
  currentQuiz = quiz;

  const container = document.getElementById("quizContainer");
  container.innerHTML = "";

  quiz.questions.forEach((q, index) => {
    const wrapper = document.createElement("div");
    wrapper.style.marginBottom = "20px";

    const title = document.createElement("p");
    title.textContent = `${index + 1}. ${q.question}`;
    wrapper.appendChild(title);

    // múltipla escolha
    if (q.type === "multiple_choice") {
      const select = document.createElement("select");
      select.id = `q_${index}`;

      const defaultOption = document.createElement("option");
      defaultOption.textContent = "Selecione uma opção";
      defaultOption.value = "";
      select.appendChild(defaultOption);

      q.options.forEach(option => {
        const opt = document.createElement("option");
        opt.value = option;
        opt.textContent = option;
        select.appendChild(opt);
      });

      wrapper.appendChild(select);
    }

    // aberta
    if (q.type === "open") {
      const input = document.createElement("input");
      input.type = "text";
      input.id = `q_${index}`;
      input.placeholder = "Digite sua resposta";
      input.style.width = "300px";

      wrapper.appendChild(input);
    }

    container.appendChild(wrapper);
  });
}

// 🔹 coleta respostas
function getAnswers() {
  const answers = {};

  currentQuiz.questions.forEach((_, index) => {
    const el = document.getElementById(`q_${index}`);
    answers[index] = el ? el.value : "";
  });

  return answers;
}

// 🔹 envia respostas para o backend
async function submitAnswers() {
  const answers = getAnswers();

  try {
    const res = await fetch(API_URL + "/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        quiz: currentQuiz,
        answers: answers
      })
    });

    if (!res.ok) throw new Error("Erro ao enviar respostas");

    const data = await res.json();

    document.getElementById("result").textContent =
      JSON.stringify(data, null, 2);

  } catch (err) {
    console.error(err);
    alert("Erro ao enviar respostas");
  }
}

async function generateQuiz() {
  const topic = document.getElementById("topic").value;

  if (!topic) {
    alert("Digite um tema");
    return;
  }

  try {
    const res = await fetch("https://ai-quiz-students-backend.onrender.com/quiz/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ topic })
    });

    const quiz = await res.json();

    renderQuiz(quiz);

  } catch (err) {
    console.error(err);
    alert("Erro ao gerar quiz");
  }
}