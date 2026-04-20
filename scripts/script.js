//const API_URL = "https://ai-quiz-students-backend.onrender.com/quiz";
const API_URL = "http://localhost:3000/quiz";
let currentQuiz = null;


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


function getAnswers() {
  const answers = {};

  currentQuiz.questions.forEach((_, index) => {
    const el = document.getElementById(`q_${index}`);
    answers[index] = el ? el.value : "";
  });

  return answers;
}


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

    renderAnalysis(data);

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
    const res = await fetch(API_URL + "/generate", {
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

function renderAnalysis(data) {
  const container = document.getElementById("result");
  container.innerHTML = "";

  Object.entries(data).forEach(([key, value]) => {
    const title = document.createElement("h2");
    title.textContent = formatTitle(key);
    container.appendChild(title);

    if (Array.isArray(value)) {
      const ul = document.createElement("ul");

      value.forEach(item => {
        const li = document.createElement("li");
        li.textContent = item;
        ul.appendChild(li);
      });

      container.appendChild(ul);
    } else {
      const p = document.createElement("p");
      p.textContent = value;
      container.appendChild(p);
    }
  });
}

function formatTitle(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatTitle(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

