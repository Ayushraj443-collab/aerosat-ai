import sqlite3
import json
import logging
from contextlib import contextmanager
from typing import Generator
from app.config import settings

logger = logging.getLogger(__name__)

_db_initialized = False

def get_db_connection() -> sqlite3.Connection:
    global _db_initialized
    conn = sqlite3.connect(str(settings.DATABASE_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    if not _db_initialized:
        _db_initialized = True
        init_db()
    return conn

@contextmanager
def db_session() -> Generator[sqlite3.Connection, None, None]:
    conn = get_db_connection()
    try:
        yield conn
        conn.commit()
    except Exception as e:
        conn.rollback()
        logger.error(f"Database error: {e}")
        raise
    finally:
        conn.close()

def init_db():
    """Initialize database tables for predictions history, dataset uploads, and model registry."""
    with db_session() as conn:
        cursor = conn.cursor()
        
        # Predictions History Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS predictions_history (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            date TEXT NOT NULL,
            pollutant TEXT NOT NULL,
            target_resolution REAL NOT NULL,
            estimated_value REAL NOT NULL,
            unit TEXT NOT NULL,
            uncertainty_lower REAL NOT NULL,
            uncertainty_upper REAL NOT NULL,
            model_version TEXT NOT NULL,
            is_demo INTEGER NOT NULL DEFAULT 1,
            provenance_json TEXT
        );
        """)
        
        # Uploaded Datasets Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS uploaded_datasets (
            id TEXT PRIMARY KEY,
            filename TEXT NOT NULL,
            uploaded_at TEXT NOT NULL,
            row_count INTEGER NOT NULL,
            columns_json TEXT NOT NULL,
            bounding_box_json TEXT,
            pollutant TEXT,
            is_valid INTEGER NOT NULL DEFAULT 1,
            summary_json TEXT
        );
        """)
        
        # Model Registry Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS model_registry (
            model_id TEXT PRIMARY KEY,
            model_name TEXT NOT NULL,
            target_pollutant TEXT NOT NULL,
            trained_at TEXT NOT NULL,
            algorithm TEXT NOT NULL,
            train_samples INTEGER NOT NULL,
            val_samples INTEGER NOT NULL,
            mae REAL NOT NULL,
            rmse REAL NOT NULL,
            r2 REAL NOT NULL,
            baseline_mae REAL,
            baseline_rmse REAL,
            baseline_r2 REAL,
            is_active INTEGER NOT NULL DEFAULT 1,
            is_demo INTEGER NOT NULL DEFAULT 1,
            hyperparams_json TEXT,
            feature_names_json TEXT
        );
        """)
        
        # System Logs / Audit
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS system_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            event_type TEXT NOT NULL,
            message TEXT NOT NULL,
            details_json TEXT
        );
        """)
        
    logger.info("SQLite database initialized successfully.")
