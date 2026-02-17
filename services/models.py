"""
SQLAlchemy ORM models for HireReady 2.0.

Tables:
  - users:            Registered user accounts
  - analysis_results: Stored analysis outcomes linked to a user
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Float, Text, DateTime, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from services.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(Text, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    # Relationship to analysis results
    analyses = relationship("AnalysisResult", back_populates="user")


class AnalysisResult(Base):
    __tablename__ = "analysis_results"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    resume_text_preview = Column(String(200), default="")
    github_username = Column(String(100), default="")
    leetcode_username = Column(String(100), default="")
    features = Column(JSON, nullable=False)
    readiness_score = Column(Float, nullable=False)
    readiness_category = Column(String(50), nullable=False)
    recommended_roles = Column(JSON, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    # Relationship back to user
    user = relationship("User", back_populates="analyses")
