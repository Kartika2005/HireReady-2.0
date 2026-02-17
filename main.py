from fastapi import FastAPI, File, UploadFile, Form, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from typing import Optional
import joblib
import pandas as pd
import io
import logging

from PyPDF2 import PdfReader
from sqlalchemy.orm.session import Session

from services.role_engine import rank_roles
from services.feature_analyzer import build_complete_feature_vector
from services.database import engine, get_db, Base
from services.models import User, AnalysisResult
from services.auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
)

logger = logging.getLogger(__name__)

# ── Create database tables on startup ─────────────────────────────────────────
Base.metadata.create_all(bind=engine)

# ── Load ML model & columns ──────────────────────────────────────────────────
model = joblib.load("readiness_model.pkl")
feature_columns = joblib.load("feature_columns.pkl")

app = FastAPI()

# Allow CORS for the React dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ═══════════════════════════════════════════════════════════════════════════════
# AUTH ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


@app.post("/auth/register")
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    """Create a new user account."""
    # Check for existing email
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    user = User(
        name=data.name.strip(),
        email=data.email.strip().lower(),
        password_hash=hash_password(data.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(str(user.id))

    return {
        "token": token,
        "user": {
            "id": str(user.id),
            "name": user.name,
            "email": user.email,
        },
    }


@app.post("/auth/login")
def login(data: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate and return a JWT token."""
    user = db.query(User).filter(User.email == data.email.strip().lower()).first()

    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    token = create_access_token(str(user.id))

    return {
        "token": token,
        "user": {
            "id": str(user.id),
            "name": user.name,
            "email": user.email,
        },
    }


@app.get("/auth/me")
def get_me(current_user: User = Depends(get_current_user)):
    """Return the current user's profile."""
    return {
        "id": str(current_user.id),
        "name": current_user.name,
        "email": current_user.email,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# ANALYSIS ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

class StudentFeatures(BaseModel):
    features: dict


class FeatureExtractionRequest(BaseModel):
    resume_text: str = ""
    github_username: str = ""
    leetcode_username: str = ""


@app.post("/extract-features")
def extract_features(data: FeatureExtractionRequest):
    """
    Extract a 64-feature dictionary from resume text, GitHub profile,
    and LeetCode profile. The output is directly usable as input to
    the /analyze-student endpoint.
    """
    feature_vector = build_complete_feature_vector(
        resume_text=data.resume_text,
        github_username=data.github_username,
        leetcode_username=data.leetcode_username,
    )
    return {"features": feature_vector}


@app.post("/analyze-full-profile")
async def analyze_full_profile(
    resume: UploadFile = File(...),
    github_username: str = Form(""),
    leetcode_username: str = Form(""),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    All-in-one endpoint: accepts a PDF resume + usernames via
    multipart/form-data, extracts features, runs the readiness model,
    saves the result to Supabase, and returns a combined response.

    Requires JWT authentication.
    """
    # ── 1. Extract text from uploaded PDF ─────────────────────────────
    resume_text = ""
    try:
        contents = await resume.read()
        reader = PdfReader(io.BytesIO(contents))
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                resume_text += page_text + "\n"
    except Exception as exc:
        logger.error("Failed to parse uploaded PDF: %s", exc)
        # Continue with empty resume_text — features will default to 0

    # ── 2. Extract feature vector ─────────────────────────────────────
    feature_vector = build_complete_feature_vector(
        resume_text=resume_text,
        github_username=github_username.strip(),
        leetcode_username=leetcode_username.strip(),
    )

    # ── 3. Run readiness prediction ───────────────────────────────────
    df = pd.DataFrame([feature_vector])
    for col in feature_columns:
        if col not in df.columns:
            df[col] = 0
    df = df[feature_columns]

    readiness = float(model.predict(df)[0])
    readiness = round(readiness, 2)

    # ── 4. Categorise readiness ───────────────────────────────────────
    if readiness >= 75:
        category = "Placement Ready"
    elif readiness >= 50:
        category = "Almost Ready"
    else:
        category = "Needs Improvement"

    # ── 5. Role ranking ───────────────────────────────────────────────
    top_roles = rank_roles(feature_vector, top_k=3)
    role_list = [{"role": role, "score": round(score, 4)} for role, score in top_roles]

    # ── 6. Save result to Supabase ────────────────────────────────────
    try:
        analysis = AnalysisResult(
            user_id=current_user.id,
            resume_text_preview=resume_text[:200] if resume_text else "",
            github_username=github_username.strip(),
            leetcode_username=leetcode_username.strip(),
            features=feature_vector,
            readiness_score=readiness,
            readiness_category=category,
            recommended_roles=role_list,
        )
        db.add(analysis)
        db.commit()
        logger.info("Saved analysis result %s for user %s", analysis.id, current_user.id)
    except Exception as exc:
        logger.error("Failed to save analysis result: %s", exc)
        db.rollback()
        # Don't crash — still return the result to the user

    return {
        "readiness_score": readiness,
        "readiness_category": category,
        "recommended_roles": role_list,
        "total_features_used": len(feature_vector),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# HISTORY ENDPOINT
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/history")
def get_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the current user's past analysis results, newest first."""
    results = (
        db.query(AnalysisResult)
        .filter(AnalysisResult.user_id == current_user.id)
        .order_by(AnalysisResult.created_at.desc())
        .limit(20)
        .all()
    )

    return [
        {
            "id": str(r.id),
            "github_username": r.github_username,
            "leetcode_username": r.leetcode_username,
            "readiness_score": r.readiness_score,
            "readiness_category": r.readiness_category,
            "recommended_roles": r.recommended_roles,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in results
    ]


@app.post("/analyze-student")
def analyze_student(data: StudentFeatures):

    # Convert input dict to dataframe
    df = pd.DataFrame([data.features])

    # Ensure all expected columns exist
    for col in feature_columns:
        if col not in df.columns:
            df[col] = 0

    df = df[feature_columns]

    # 1️⃣ Readiness Prediction
    readiness = float(model.predict(df)[0])

    # 2️⃣ Role Ranking
    top_roles = rank_roles(data.features)

    return {
        "readiness_score": round(readiness, 2),
        "recommended_roles": top_roles
    }
