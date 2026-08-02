import os
from pathlib import Path
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException, Depends, status
from pydantic import BaseModel

from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import google.generativeai as genai

from database import engine, Base, get_db
import models
from auth import hash_password, verify_password, create_access_token, get_current_user

# Create Database tables
Base.metadata.create_all(bind=engine)

# Load .env relative to main.py directory
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path, override=True)

api_key = os.getenv("GEMINI_API_KEY", "").strip() or os.getenv("GOOGLE_API_KEY", "").strip()
if api_key:
    genai.configure(api_key=api_key)
else:
    print("WARNING: Neither GEMINI_API_KEY nor GOOGLE_API_KEY found in environment variables or .env file.")

model_name = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
model = genai.GenerativeModel(model_name)

app = FastAPI(title="Aether AI Backend API")

raw_origins = os.getenv("ALLOWED_ORIGINS", "*")
origins = [o.strip() for o in raw_origins.split(",") if o.strip()] if raw_origins and raw_origins != "*" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Pydantic Schemas ---
class UserAuthRequest(BaseModel):
    email: str
    password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict

class ChatSessionCreate(BaseModel):
    title: Optional[str] = "New Chat"

class ChatSessionResponse(BaseModel):
    id: int
    title: str
    created_at: str
    updated_at: str

class ChatMessageResponse(BaseModel):
    id: int
    sender: str
    text: str
    timestamp: str

class GenerateRequest(BaseModel):
    prompt: Optional[str] = ""
    session_id: Optional[int] = None
    file_name: Optional[str] = None
    file_content: Optional[str] = None



# --- Authentication Endpoints ---
@app.post("/register", response_model=AuthResponse)
def register(req: UserAuthRequest, db: Session = Depends(get_db)):
    email_clean = req.email.lower().strip()
    if not email_clean or "@" not in email_clean or "." not in email_clean:
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")

    if not req.password or len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")


    existing = db.query(models.User).filter(models.User.email == email_clean).first()
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists.")

    hashed_pw = hash_password(req.password)
    user = models.User(email=email_clean, password_hash=hashed_pw)
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id, user.email)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user.id, "email": user.email, "name": user.email.split("@")[0]}
    }


@app.post("/login", response_model=AuthResponse)
def login(req: UserAuthRequest, db: Session = Depends(get_db)):
    email_clean = req.email.lower().strip()
    user = db.query(models.User).filter(models.User.email == email_clean).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    token = create_access_token(user.id, user.email)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user.id, "email": user.email, "name": user.email.split("@")[0]}
    }


@app.get("/me")
def get_me(current_user: models.User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.email.split("@")[0]
    }


# --- Recent Chat Sessions Endpoints ---
@app.get("/chats")
def list_chats(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Auto-purge any empty sessions (sessions with 0 messages)
    empty_sessions = (
        db.query(models.ChatSession)
        .filter(
            models.ChatSession.user_id == current_user.id,
            ~models.ChatSession.messages.any()
        )
        .all()
    )
    if empty_sessions:
        for s in empty_sessions:
            db.delete(s)
        db.commit()

    sessions = (
        db.query(models.ChatSession)
        .filter(models.ChatSession.user_id == current_user.id)
        .order_by(models.ChatSession.updated_at.desc())
        .all()
    )
    return [
        {
            "id": s.id,
            "title": s.title,
            "created_at": s.created_at.isoformat(),
            "updated_at": s.updated_at.isoformat()
        }
        for s in sessions
    ]



@app.post("/chats")
def create_chat(
    req: ChatSessionCreate = ChatSessionCreate(),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    session = models.ChatSession(user_id=current_user.id, title=req.title or "New Chat")
    db.add(session)
    db.commit()
    db.refresh(session)
    return {
        "id": session.id,
        "title": session.title,
        "created_at": session.created_at.isoformat(),
        "updated_at": session.updated_at.isoformat()
    }


@app.delete("/chats/{session_id}")
def delete_chat(
    session_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    session = (
        db.query(models.ChatSession)
        .filter(models.ChatSession.id == session_id, models.ChatSession.user_id == current_user.id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found.")

    db.delete(session)
    db.commit()
    return {"message": "Chat session deleted successfully."}


@app.get("/chats/{session_id}/messages")
def get_chat_messages(
    session_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    session = (
        db.query(models.ChatSession)
        .filter(models.ChatSession.id == session_id, models.ChatSession.user_id == current_user.id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found.")

    messages = (
        db.query(models.ChatMessage)
        .filter(models.ChatMessage.session_id == session_id)
        .order_by(models.ChatMessage.id.asc())
        .all()
    )
    return [
        {
            "id": m.id,
            "sender": m.sender,
            "text": m.text,
            "timestamp": m.timestamp.isoformat()
        }
        for m in messages
    ]


@app.get("/file-usage")
def get_file_usage(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    now_utc = datetime.now(timezone.utc)
    start_of_today = datetime(now_utc.year, now_utc.month, now_utc.day, tzinfo=timezone.utc)

    uploads_count = (
        db.query(models.ChatMessage)
        .join(models.ChatSession, models.ChatMessage.session_id == models.ChatSession.id)
        .filter(
            models.ChatSession.user_id == current_user.id,
            models.ChatMessage.sender == "user",
            models.ChatMessage.text.like("📎%"),
            models.ChatMessage.timestamp >= start_of_today
        )
        .count()
    )

    return {
        "uploads_today": uploads_count,
        "limit": 2,
        "remaining": max(0, 2 - uploads_count)
    }


# --- Gemini Generation & Persistence Endpoint ---
@app.post("/generate")
def generate_response(
    request: GenerateRequest,
    current_user: Optional[models.User] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    raw_prompt = request.prompt.strip() if request.prompt else ""
    if request.file_content:
        # Check daily file upload limit (max 2 per day)
        if current_user:
            now_utc = datetime.now(timezone.utc)
            start_of_today = datetime(now_utc.year, now_utc.month, now_utc.day, tzinfo=timezone.utc)

            uploads_count = (
                db.query(models.ChatMessage)
                .join(models.ChatSession, models.ChatMessage.session_id == models.ChatSession.id)
                .filter(
                    models.ChatSession.user_id == current_user.id,
                    models.ChatMessage.sender == "user",
                    models.ChatMessage.text.like("📎%"),
                    models.ChatMessage.timestamp >= start_of_today
                )
                .count()
            )

            if uploads_count >= 2:
                raise HTTPException(
                    status_code=400,
                    detail="Daily file upload limit reached (2/2 per day). You can upload files again tomorrow."
                )

        file_header = f"📎 [Attached File: {request.file_name or 'Uploaded File'}]\n"
        full_api_prompt = (
            f"{file_header}```\n{request.file_content}\n```\n\nUser Question:\n{raw_prompt}"
            if raw_prompt
            else f"{file_header}```\n{request.file_content}\n```\n\nPlease analyze and summarize the attached file content above."
        )
        display_user_text = f"📎 {request.file_name or 'Uploaded File'}\n{raw_prompt}" if raw_prompt else f"📎 {request.file_name or 'Uploaded File'}"
    else:
        if not raw_prompt:
            raise HTTPException(status_code=400, detail="Prompt or file attachment cannot be empty.")
        full_api_prompt = raw_prompt
        display_user_text = raw_prompt


    # 1. Resolve or Create Chat Session if user is authenticated
    session = None
    if current_user:
        if request.session_id:
            session = (
                db.query(models.ChatSession)
                .filter(models.ChatSession.id == request.session_id, models.ChatSession.user_id == current_user.id)
                .first()
            )

        if not session:
            title_text = raw_prompt[:30] + ("..." if len(raw_prompt) > 30 else "") if raw_prompt else (request.file_name or "File Analysis")
            session = models.ChatSession(user_id=current_user.id, title=title_text)
            db.add(session)
            db.commit()
            db.refresh(session)
        elif session.title == "New Chat":
            title_text = raw_prompt[:30] + ("..." if len(raw_prompt) > 30 else "") if raw_prompt else (request.file_name or "File Analysis")
            session.title = title_text
            db.commit()

        # Save user message to database
        user_msg = models.ChatMessage(session_id=session.id, sender="user", text=display_user_text)
        db.add(user_msg)
        db.commit()

    # 2. Call Gemini API
    active_key = os.getenv("GEMINI_API_KEY", "").strip() or os.getenv("GOOGLE_API_KEY", "").strip()
    if not active_key:
        raise HTTPException(
            status_code=401,
            detail="⚠️ Missing GEMINI_API_KEY. Please verify your API key is set in Backend/.env or environment variables."
        )
    genai.configure(api_key=active_key)

    try:
        active_model_name = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
        active_model = genai.GenerativeModel(active_model_name)
        response = active_model.generate_content(full_api_prompt)
        text_content = getattr(response, "text", "")
        if not text_content and hasattr(response, "candidates") and response.candidates:
            for candidate in response.candidates:
                if candidate.content and candidate.content.parts:
                    text_content = "".join([part.text for part in candidate.content.parts if hasattr(part, "text")])
                    if text_content:
                        break

        text_result = text_content or "No response generated by the model."

        # 3. Save assistant message to database if session exists

        if session:
            ai_msg = models.ChatMessage(session_id=session.id, sender="assistant", text=text_result)
            db.add(ai_msg)
            db.commit()

        return {
            "response": text_result,
            "session_id": session.id if session else None,
            "session_title": session.title if session else None
        }

    except HTTPException:
        raise
    except Exception as e:
        err_msg = str(e).lower()
        if any(kw in err_msg for kw in ["429", "quota", "resourceexhausted", "resource_exhausted", "credit", "exceeded", "limit"]):
            raise HTTPException(
                status_code=429,
                detail="⚠️ API Key credits or quota exhausted. Please update your GEMINI_API_KEY in backend .env or check your API usage limits."
            )
        elif any(kw in err_msg for kw in ["api_key", "adc", "unauthorized", "permission_denied", "invalid"]):
            raise HTTPException(
                status_code=401,
                detail="⚠️ Invalid or unauthorized GEMINI_API_KEY. Please verify your API key in the backend environment."
            )
        else:
            raise HTTPException(status_code=500, detail=f"Gemini API Error: {str(e)}")