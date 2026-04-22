const API_URL = "https://ai-quiz-students-backend.onrender.com/quiz";
//const API_URL = "http://localhost:3000/quiz";
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

  const maxRetries = 5;
  let attempt = 0;

  while (attempt < maxRetries) {
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

      if (!res.ok) throw new Error("Erro na resposta");

      const data = await res.json();

      renderAnalysis(data);
      return;

    } catch (err) {
      attempt++;

      console.warn(`Tentativa ${attempt} falhou`);

      if (attempt >= maxRetries) {
        console.error(err);
        alert("Erro ao enviar respostas após várias tentativas");
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}

async function generateQuiz() {
  const topic = document.getElementById("topic").value;

  if (!topic) {
    alert("Digite um tema");
    return;
  }

  document.getElementById("quizContainer").innerHTML = "";
  document.getElementById("result").innerHTML = "";

  const maxRetries = 5;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      const res = await fetch(API_URL + "/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ topic })
      });

      if (!res.ok) throw new Error("Erro na resposta");

      const quiz = await res.json();

      renderQuiz(quiz);
      return;

    } catch (err) {
      attempt++;

      console.warn(`Tentativa ${attempt} falhou`);

      if (attempt >= maxRetries) {
        console.error(err);
        alert("Erro ao gerar quiz após várias tentativas");
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
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