"""Drop the FK constraint on jobs.posted_by so TPOs can post jobs."""
from services.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    result = conn.execute(text(
        "SELECT constraint_name FROM information_schema.table_constraints "
        "WHERE table_name = 'jobs' AND constraint_type = 'FOREIGN KEY'"
    ))
    rows = result.fetchall()
    print("FK constraints on jobs:", rows)
    for row in rows:
        cname = row[0]
        print(f"Dropping constraint: {cname}")
        conn.execute(text(f'ALTER TABLE jobs DROP CONSTRAINT "{cname}"'))
    conn.commit()
    print("Done")
