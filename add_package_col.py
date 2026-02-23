"""Add package_lpa column to jobs table."""
from services.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    conn.execute(text("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS package_lpa DOUBLE PRECISION"))
    conn.commit()
    print("package_lpa column added to jobs table")
