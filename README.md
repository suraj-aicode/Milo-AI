# MILO AI - Personal Assistant

MILO AI is a full-stack, intelligent personal assistant web application powered by **Google's Gemini 2.5 Flash** model. It features secure JWT authentication, persistent chat session management, code and document analysis, a daily file upload quota system, and a sleek, dark-themed responsive user interface.

---

## 🌟 Key Features

- **Gemini 2.5 Flash Integration**: Ultra-fast AI conversation powered by Google's latest Generative AI model.
- **User Authentication**: Secure user registration and login using bcrypt password hashing and JWT access tokens.
- **Chat Session Persistence**: Save, list, switch, and delete past chat sessions saved to a SQLite database.
- **File Upload & Code Analysis**: Upload text or code files to analyze, summarize, or debug attached content.
- **Daily File Quota System**: Built-in rate limiting (max 2 file uploads per day) with real-time remaining quota UI indicators.
- **Auto-Purge Empty Chats**: Automatically cleans up unused or empty chat sessions upon page refresh/load.
- **Quick Prompt Cards**: Built-in starter prompts for fast inspiration and interaction.
- **Modern Responsive Design**: Crafted with a glassmorphism aesthetic, dark mode styling, and smooth micro-animations.

---

## 🛠️ Tech Stack

### Backend
- **Framework**: [FastAPI](https://fastapi.tiangolo.com/) (Python 3.12+)
- **Database & ORM**: SQLite & [SQLAlchemy](https://www.sqlalchemy.org/)
- **Authentication**: PyJWT & Passlib (Bcrypt hashing)
- **AI SDK**: `google-generativeai` (Google Gemini 2.5 Flash)
- **Web Server**: Uvicorn ASGI Server

### Frontend
- **Framework**: [React](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Styling**: Tailwind CSS & Vanilla CSS (Custom design system)
- **Icons**: Material Symbols Outlined

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- [Python](https://www.python.org/) (v3.10 or higher)
- A Google Gemini API Key from [Google AI Studio](https://aistudio.google.com/app/apikey)

---

### Local Setup

#### 1. Clone the Repository
```bash
git clone https://github.com/suraj-aicode/Milo-AI.git
cd Milo-AI
```

#### 2. Backend Setup
```bash
cd Backend

# Create a virtual environment
python -m venv .venv

# Activate virtual environment
# Windows (PowerShell):
.\.venv\Scripts\Activate.ps1
# Mac/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

Create a `.env` file inside the `Backend` directory:
```env
GEMINI_API_KEY=your_google_gemini_api_key_here
SECRET_KEY=your_random_secret_key_here
ALLOWED_ORIGINS=*
```

Start the FastAPI backend server:
```bash
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

#### 3. Frontend Setup
Open a new terminal window in the project root:
```bash
cd Frontend

# Install npm dependencies
npm install

# Start Vite dev server
npm run dev
```

Open your browser and navigate to `http://localhost:5173`.

---

## 🔌 API Endpoints Reference

### Authentication
- `POST /register` - Register a new user account.
- `POST /login` - Login and obtain a JWT access token.
- `GET /me` - Retrieve current logged-in user profile.

### Chat Sessions & Messages
- `GET /chats` - List recent chat sessions for the authenticated user.
- `POST /chats` - Create a new chat session.
- `DELETE /chats/{session_id}` - Delete a chat session.
- `GET /chats/{session_id}/messages` - Retrieve all messages in a specific chat session.

### AI Generation & Usage
- `POST /generate` - Send prompt and optional attached file to Gemini AI & persist message history.
- `GET /file-usage` - Retrieve daily file upload usage and remaining quota.

---

## 🛡️ License

This project is open-source and available under the [MIT License](LICENSE).
