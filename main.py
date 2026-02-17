from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import joblib
import pandas as pd
import io
import logging

from PyPDF2 import PdfReader

from services.role_engine import rank_roles
from services.feature_analyzer import build_complete_feature_vector

logger = logging.getLogger(__name__)

# Load model & columns
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
):
    """
    All-in-one endpoint: accepts a PDF resume + usernames via
    multipart/form-data, extracts features, runs the readiness model,
    and returns a combined response.
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

    return {
        "readiness_score": readiness,
        "readiness_category": category,
        "recommended_roles": role_list,
        "total_features_used": len(feature_vector),
    }


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
