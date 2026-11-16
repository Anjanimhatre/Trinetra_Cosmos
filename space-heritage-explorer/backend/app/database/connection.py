"""Neon PostgreSQL connection helpers.

Initialise the schema once:  python -m app.database.connection
"""
import os
from contextlib import contextmanager
from pathlib import Path

import psycopg
from dotenv import load_dotenv
from pgvector.psycopg import register_vector

load_dotenv()

SCHEMA_PATH = Path(__file__).resolve().parents[2] / "schema.sql"


def _database_url() -> str:
    url = os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL is not set (see .env.example)")
    return url


@contextmanager
def get_connection():
    """Yield a connection with the pgvector type registered.
    Commits on success, rolls back on error."""
    with psycopg.connect(_database_url()) as conn:
        register_vector(conn)
        yield conn


def init_db() -> None:
    # No register_vector here: the extension may not exist yet.
    with psycopg.connect(_database_url()) as conn:
        conn.execute(SCHEMA_PATH.read_text())
    print("Schema ready.")


if __name__ == "__main__":
    init_db()
