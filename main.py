from fastapi import FastAPI, File, UploadFile, Form, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from typing import Optional
import joblib
import pandas as pd
import io
import logging

import json
from PyPDF2 import PdfReader
from sqlalchemy.orm.session import Session
from typing import Optional, List

from services.role_engine import rank_roles
from services.feature_analyzer import build_complete_feature_vector
from services.database import engine, get_db, Base
from services.models import User, AnalysisResult, QuizResult
from services.quiz_generator import generate_quiz_questions
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
        "github_username": current_user.github_username or "",
        "leetcode_username": current_user.leetcode_username or "",
        "resume_filename": current_user.resume_filename or "",
    }


# ═══════════════════════════════════════════════════════════════════════════════
# HELPER: Analysis Pipeline
# ═══════════════════════════════════════════════════════════════════════════════

def run_analysis_pipeline(
    user: User,
    db: Session,
    resume_text: str = "",
    github_username: str = "",
    leetcode_username: str = "",
):
    """
    Core logic to extract features, run model, and save result.
    call this whenever profile details change.
    """
    # If no resume text provided, try to use saved
    if not resume_text:
        resume_text = user.resume_text or ""
    
    # If no usernames provided, use saved
    if not github_username:
        github_username = user.github_username or ""
    if not leetcode_username:
        leetcode_username = user.leetcode_username or ""

    # 1. Extract feature vector
    feature_vector = build_complete_feature_vector(
        resume_text=resume_text,
        github_username=github_username,
        leetcode_username=leetcode_username,
    )

    # 2. Run readiness prediction
    df = pd.DataFrame([feature_vector])
    for col in feature_columns:
        if col not in df.columns:
            df[col] = 0
    df = df[feature_columns]

    raw_score = float(model.predict(df)[0])

    # 3. Calibrate score
    MODEL_MIN = 6.0
    MODEL_MAX = 80.0
    readiness = ((raw_score - MODEL_MIN) / (MODEL_MAX - MODEL_MIN)) * 100
    readiness = max(0, min(100, readiness))
    readiness = round(readiness, 2)

    # 4. Categorise
    if readiness >= 75:
        category = "Placement Ready"
    elif readiness >= 50:
        category = "Almost Ready"
    else:
        category = "Needs Improvement"

    # 5. Role ranking
    top_roles = rank_roles(feature_vector, top_k=3)
    role_list = [{"role": role, "score": round(score, 4)} for role, score in top_roles]

    # 6. Save result
    try:
        analysis = AnalysisResult(
            user_id=user.id,
            resume_text_preview=resume_text[:200] if resume_text else "",
            github_username=github_username,
            leetcode_username=leetcode_username,
            features=json.dumps(feature_vector) if isinstance(feature_vector, dict) else feature_vector, # Ensure JSON serializable
            readiness_score=readiness,
            readiness_category=category,
            recommended_roles=role_list,
        )
        db.add(analysis)
        db.commit()
        db.refresh(analysis)
        logger.info("Auto-analysis saved: %s", analysis.id)
        return analysis
    except Exception as exc:
        logger.error("Failed to save analysis: %s", exc)
        db.rollback()
        return None

# ═══════════════════════════════════════════════════════════════════════════════
# PROFILE ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@app.put("/auth/profile")
async def update_profile(
    name: Optional[str] = Form(None),
    github_username: Optional[str] = Form(None),
    leetcode_username: Optional[str] = Form(None),
    resume: UploadFile = File(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update the current user's profile details."""
    new_resume_text = None

    if name is not None:
        current_user.name = name.strip()
    
    if github_username is not None:
        current_user.github_username = github_username.strip()

    if leetcode_username is not None:
        current_user.leetcode_username = leetcode_username.strip()

    # Handle resume upload
    if resume and resume.filename:
        try:
            filename = resume.filename
            pdf_bytes = await resume.read() # Use await for async file read
            
            # Extract text using PyPDF2
            reader = PdfReader(io.BytesIO(pdf_bytes))
            text = ""
            for page in reader.pages:
                extracted = page.extract_text()
                if extracted:
                    text += extracted + "\n"
            
            # Save strictly necessary fields
            current_user.resume_filename = filename
            current_user.resume_text = text  # Store text for analysis
            
            new_resume_text = text
            logger.info("Updated resume for user %s: %s", current_user.email, filename)
        except Exception as e:
            logger.error("Failed to process resume upload: %s", e)
            raise HTTPException(status_code=400, detail="Invalid PDF file")

    db.commit()
    db.refresh(current_user)

    # 3. Trigger Auto-Analysis
    # We pass the NEW text if uploaded, otherwise None (helper uses saved)
    latest_analysis = run_analysis_pipeline(
        user=current_user,
        db=db,
        resume_text=new_resume_text if new_resume_text else None,
        # Helper will fetch saved usernames from User object
    )

    return {
        "user": {
            "id": str(current_user.id),
            "name": current_user.name,
            "resume_filename": current_user.resume_filename,
            "email": current_user.email,
            "github_username": current_user.github_username,
            "leetcode_username": current_user.leetcode_username,
        },
        "analysis": {
            "status": "success",
            "readiness_score": latest_analysis.readiness_score,
            "readiness_category": latest_analysis.readiness_category,
            "recommended_roles": latest_analysis.recommended_roles,
            "total_features_used": len([v for v in (latest_analysis.features.values() if isinstance(latest_analysis.features, dict) else {}) if v > 0]),
            "created_at": latest_analysis.created_at
        } if latest_analysis else None
    }


@app.get("/analysis/latest")
def get_latest_analysis(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the most recent analysis result for the user."""
    # Query AnalysisResult table
    latest = (
        db.query(AnalysisResult)
        .filter(AnalysisResult.user_id == current_user.id)
        .order_by(AnalysisResult.created_at.desc())
        .first()
    )

    if not latest:
        return {"status": "no_analysis"}

    return {
        "status": "success",
        "readiness_score": latest.readiness_score,
        "readiness_category": latest.readiness_category,
        "recommended_roles": latest.recommended_roles,
        "total_features_used": len([v for v in (latest.features.values() if isinstance(latest.features, dict) else {}) if v > 0]),
        "created_at": latest.created_at
    }


# NOTE: analyze-full-profile is now deprecated/redundant effectively,
# but can be kept as a direct tool if needed. 



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
    resume: Optional[UploadFile] = File(None),
    github_username: str = Form(""),
    leetcode_username: str = Form(""),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    All-in-one endpoint: accepts a PDF resume + usernames via
    multipart/form-data, extracts features, runs the readiness model,
    saves the result to Supabase, and returns a combined response.

    If no resume is uploaded, uses the previously saved resume.
    Requires JWT authentication.
    """
    # ── 1. Extract text from uploaded PDF (or use saved) ──────────────
    resume_text = ""
    resume_filename = ""
    if resume and resume.filename:
        resume_filename = resume.filename
        try:
            contents = await resume.read()
            reader = PdfReader(io.BytesIO(contents))
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    resume_text += page_text + "\n"
        except Exception as exc:
            logger.error("Failed to parse uploaded PDF: %s", exc)
    elif current_user.resume_text:
        # Fall back to saved resume
        resume_text = current_user.resume_text
        resume_filename = current_user.resume_filename or "saved_resume.pdf"

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

    raw_score = float(model.predict(df)[0])

    # ── 3b. Calibrate score ──────────────────────────────────────────
    # The XGBoost model outputs in a compressed range (~6 to ~80).
    # Normalize to a 0-100 scale for user-friendly display.
    MODEL_MIN = 6.0    # model output when all features = 0
    MODEL_MAX = 80.0   # model output when all features maxed
    readiness = ((raw_score - MODEL_MIN) / (MODEL_MAX - MODEL_MIN)) * 100
    readiness = max(0, min(100, readiness))  # clamp to 0-100
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

        # Auto-save usernames and resume to user profile
        if github_username.strip() and not current_user.github_username:
            current_user.github_username = github_username.strip()
        if leetcode_username.strip() and not current_user.leetcode_username:
            current_user.leetcode_username = leetcode_username.strip()
        if resume_text and resume_filename:
            current_user.resume_text = resume_text
            current_user.resume_filename = resume_filename

        db.commit()
        logger.info("Saved analysis result %s for user %s", analysis.id, current_user.id)
    except Exception as exc:
        logger.error("Failed to save analysis result: %s", exc)
        db.rollback()
        # Don't crash — still return the result to the user

    # ── Debug: Print non-zero features for user visibility ────────────────
    non_zero_features = {k: v for k, v in feature_vector.items() if v > 0}
    print("\n════════════════════════════════════════════════════════════════")
    print(f" ANALYSIS RESULT FOR: {current_user.name}")
    print(f" ----------------------------------------------------------------")
    print(f" READINESS SCORE: {readiness}")
    print(f" DETECTED FEATURES: {len(non_zero_features)}")
    print(f" NON-ZERO VALUES: {non_zero_features}")
    print("════════════════════════════════════════════════════════════════\n")

    return {
        "readiness_score": readiness,
        "readiness_category": category,
        "recommended_roles": role_list,
        "total_features_used": len(non_zero_features),
        "features": non_zero_features,
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

    # 1️⃣ Readiness Prediction (with calibration)
    raw_score = float(model.predict(df)[0])
    MODEL_MIN = 6.0
    MODEL_MAX = 80.0
    readiness = ((raw_score - MODEL_MIN) / (MODEL_MAX - MODEL_MIN)) * 100
    readiness = max(0, min(100, readiness))

    # 2️⃣ Role Ranking
    top_roles = rank_roles(data.features)

    return {
        "readiness_score": round(readiness, 2),
        "recommended_roles": top_roles
    }


# ═══════════════════════════════════════════════════════════════════════════════
# QUIZ ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

class QuizGenerateRequest(BaseModel):
    role: str
    difficulty: str

class QuizSubmitRequest(BaseModel):
    role: str
    difficulty: str
    score: int
    totalQuestions: int
    answers: list # List of objects
    resultId: Optional[str] = None

@app.post("/api/quiz/generate")
def generate_quiz_endpoint(
    data: QuizGenerateRequest, 
    current_user: User = Depends(get_current_user)
):
    try:
        questions = generate_quiz_questions(data.role, data.difficulty)
        return {"questions": questions}
    except ValueError as e:
        logger.error("Quiz generation failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error("Quiz generation failed: %s", e)
        raise HTTPException(status_code=500, detail="Failed to generate quiz")

@app.post("/api/quiz/submit")
def submit_quiz_endpoint(
    data: QuizSubmitRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        # Check if result_id is provided for retest (updates existing result)
        if data.resultId:
            result = db.query(QuizResult).filter(
                QuizResult.id == data.resultId, 
                QuizResult.user_id == current_user.id
            ).first()
            
            if result:
                result.role = data.role
                result.difficulty = data.difficulty
                result.score = data.score
                result.total_questions = data.totalQuestions
                result.answers = data.answers
                # created_at remains the same, or we could update a updated_at field
                db.commit()
                db.refresh(result)
                return {"message": "Quiz result updated successfully", "resultId": str(result.id)}
        
        # New submission
        result = QuizResult(
            user_id=current_user.id,
            role=data.role,
            difficulty=data.difficulty,
            score=data.score,
            total_questions=data.totalQuestions,
            answers=data.answers
        )
        db.add(result)
        db.commit()
        db.refresh(result)
        return {"message": "Quiz submitted successfully", "resultId": str(result.id)}
    except Exception as e:
        logger.error("Quiz submit failed: %s", e)
        # db.rollback() # Handled by session usually but good practice
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/quiz/results")
def get_quiz_results(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    results = db.query(QuizResult).filter(QuizResult.user_id == current_user.id).order_by(QuizResult.created_at.desc()).all()
    return {"results": results}

@app.get("/api/quiz/roles")
def get_quiz_roles(current_user: User = Depends(get_current_user)):
     roles = [
        'Backend Developer', 'Frontend Developer', 'Full Stack Developer',
        'ML Engineer', 'Data Scientist', 'Data Engineer',
        'Java Developer', 'Python Developer', 'DevOps Engineer',
        'Cloud Engineer', 'Mobile Developer', 'iOS Developer',
        'Android Developer', 'QA / Test Engineer', 'Cybersecurity Analyst',
        'AI Research Engineer', 'Game Developer', 'Blockchain Developer',
        'Database Administrator', 'Systems Engineer', 'UI/UX Designer',
    ]
     return {"roles": roles}

