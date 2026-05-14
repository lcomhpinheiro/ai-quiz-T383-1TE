# 🧠 AI Quiz Master

A modern and intelligent web application that generates personalized quizzes using Artificial Intelligence to assist in studying and content reinforcement.

---

## 🚀 Features

- **Intelligent Generation**: Creates quizzes based on any topic provided by the user.
- **Hybrid Questions**: Support for multiple-choice and open-ended questions.
- **Performance Analysis**: Feedback system that analyzes answers and provides a summary of difficulty points.
- **Authentication System**: User registration and login to ensure security and personalization.
- **Responsive Interface**: Modern and adaptable design for different screen sizes (Desktop and Mobile).

---

## 🏗️ Project Structure (Frontend)

The project follows a professional and scalable organization:

```text
frontend/
├── assets/             # Static resources
│   ├── css/            # Styling (Quiz, Authentication)
│   ├── js/             # Application logic (Modulated by functionality)
│   └── img/            # Icons and images
├── pages/              # Application pages
│   ├── quiz/           # Main quiz generator interface
│   ├── login/          # Access screen
│   └── register/       # Registration screen
└── index.html          # Entry point (Intelligent redirection)
```

---

## 🖥️ Usage Flow

1. **Access**: User logs in (or registers).
2. **Topic**: Types a study topic in the indicated field.
3. **Generation**: Clicks **"Generate"** for the AI to create the quiz.
4. **Answers**: Answers the questions (chooses options or types text).
5. **Evaluation**: Clicks **"Submit answers"** to receive a detailed AI analysis.

---

## 🧩 Technologies Used

- **Frontend**: HTML5, CSS3 (Vanilla), Modern JavaScript (ES6+).
- **Communication**: Fetch API for integration with the backend.
- **Backend (Reference)**: Node.js, Express, Sequelize (SQLite), and integration with OpenRouter (AI).

---

## 📝 Version Notes

- **v1.1.0**: Complete reorganization of frontend architecture and robust authentication integration.
- **v1.0.0**: Initial launch with basic quiz generator.
