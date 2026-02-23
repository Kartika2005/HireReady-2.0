"""
Minimal Flask login system for TPO_login table.
No JWT, no sessions — just register & login with hashed passwords.
"""

import os
import psycopg2
from psycopg2 import errors as pg_errors
from flask import Flask, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv

# ── Load .env ────────────────────────────────────────────────────────────────
load_dotenv()

app = Flask(__name__)


# ── Database helper ──────────────────────────────────────────────────────────
def get_conn():
    """Return a new psycopg2 connection using env-var credentials."""
    return psycopg2.connect(
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        host=os.getenv("DB_HOST", "localhost"),
        port=os.getenv("DB_PORT", "5432"),
    )


# ── /register ────────────────────────────────────────────────────────────────
@app.route("/register", methods=["POST"])
def register():
    """Hash the password and INSERT into TPO_login."""
    data = request.get_json(force=True)
    email = (data.get("email") or "").strip().lower()
    password = data.get("password")

    if not email or not password:
        return jsonify({"error": "email and password are required"}), 400

    hashed = generate_password_hash(password)

    try:
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO TPO_login (email, password) VALUES (%s, %s)",
            (email, hashed),
        )
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"message": "registered successfully"}), 201

    except pg_errors.UniqueViolation:
        return jsonify({"error": "email already exists"}), 409

    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


# ── /login ───────────────────────────────────────────────────────────────────
@app.route("/login", methods=["POST"])
def login():
    """Verify email + password against TPO_login."""
    data = request.get_json(force=True)
    email = (data.get("email") or "").strip().lower()
    password = data.get("password")

    if not email or not password:
        return jsonify({"error": "email and password are required"}), 400

    try:
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(
            "SELECT password FROM TPO_login WHERE email = %s",
            (email,),
        )
        row = cur.fetchone()
        cur.close()
        conn.close()

        if not row:
            return jsonify({"error": "invalid credentials"}), 401

        if not check_password_hash(row[0], password):
            return jsonify({"error": "invalid credentials"}), 401

        return jsonify({"message": "login successful"}), 200

    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


# ── Run ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    app.run(debug=True, port=5000)
