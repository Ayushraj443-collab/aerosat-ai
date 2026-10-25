import sqlite3
import json
import logging
from contextlib import contextmanager
from typing import Generator, List, Dict, Any, Optional
from datetime import datetime, timezone
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
    """Initialize database tables for observations, predictions history, dataset uploads, model registry, and connector status."""
    with db_session() as conn:
        cursor = conn.cursor()
        
        # Observations Table with Strict Real/Demo Mode & Provenance
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS observations (
            id TEXT PRIMARY KEY,
            data_mode TEXT NOT NULL, -- 'REAL' or 'DEMO'
            source_name TEXT NOT NULL,
            source_product TEXT NOT NULL,
            source_record_id TEXT,
            observation_time TEXT NOT NULL,
            retrieved_at TEXT NOT NULL,
            station_id TEXT,
            station_name TEXT,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            pollutant TEXT NOT NULL,
            ground_value REAL NOT NULL,
            unit TEXT NOT NULL,
            satellite_column REAL,
            satellite_qa REAL,
            temperature_c REAL,
            relative_humidity_pct REAL,
            wind_speed_ms REAL,
            wind_direction_deg REAL,
            boundary_layer_height_m REAL,
            elevation_m REAL,
            road_density_proxy REAL,
            quality_flag REAL DEFAULT 1.0,
            dataset_version TEXT DEFAULT '1.0'
        );
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_obs_mode_pollutant ON observations(data_mode, pollutant);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_obs_station ON observations(station_id);")

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
            data_mode TEXT NOT NULL DEFAULT 'DEMO',
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
            data_mode TEXT NOT NULL DEFAULT 'REAL',
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
            data_mode TEXT NOT NULL DEFAULT 'DEMO',
            hyperparams_json TEXT,
            feature_names_json TEXT
        );
        """)

        # Ensure schema migrations for existing database files
        def ensure_col(tbl, col, def_type):
            cursor.execute(f"PRAGMA table_info({tbl});")
            existing = [r["name"] for r in cursor.fetchall()]
            if col not in existing:
                cursor.execute(f"ALTER TABLE {tbl} ADD COLUMN {col} {def_type};")

        ensure_col("model_registry", "data_mode", "TEXT DEFAULT 'DEMO'")
        ensure_col("predictions_history", "data_mode", "TEXT DEFAULT 'DEMO'")
        ensure_col("uploaded_datasets", "data_mode", "TEXT DEFAULT 'REAL'")

        # Connector Status & Audit Trail Table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS connector_status (
            connector_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            status TEXT NOT NULL, -- 'VERIFIED', 'IMPLEMENTED_BUT_UNVERIFIED', 'BLOCKED', 'FAILED'
            endpoint_url TEXT NOT NULL,
            auth_required INTEGER NOT NULL DEFAULT 0,
            auth_configured INTEGER NOT NULL DEFAULT 0,
            last_queried_at TEXT,
            record_count INTEGER NOT NULL DEFAULT 0,
            last_error TEXT,
            sample_record_json TEXT,
            notes TEXT
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
        
    logger.info("SQLite database initialized successfully with real-data schemas.")

def insert_observations(records: List[Dict[str, Any]]) -> int:
    """Insert a batch of observation records into SQLite database."""
    if not records:
        return 0
    sql = """
    INSERT OR REPLACE INTO observations (
        id, data_mode, source_name, source_product, source_record_id,
        observation_time, retrieved_at, station_id, station_name,
        latitude, longitude, pollutant, ground_value, unit,
        satellite_column, satellite_qa, temperature_c, relative_humidity_pct,
        wind_speed_ms, wind_direction_deg, boundary_layer_height_m,
        elevation_m, road_density_proxy, quality_flag, dataset_version
    ) VALUES (
        :id, :data_mode, :source_name, :source_product, :source_record_id,
        :observation_time, :retrieved_at, :station_id, :station_name,
        :latitude, :longitude, :pollutant, :ground_value, :unit,
        :satellite_column, :satellite_qa, :temperature_c, :relative_humidity_pct,
        :wind_speed_ms, :wind_direction_deg, :boundary_layer_height_m,
        :elevation_m, :road_density_proxy, :quality_flag, :dataset_version
    );
    """
    inserted = 0
    with db_session() as conn:
        cursor = conn.cursor()
        for r in records:
            # Ensure required default fields
            row = dict(r)
            if "id" not in row:
                row["id"] = f"{row.get('station_id', 'STN')}_{row.get('pollutant', 'NO2')}_{row.get('observation_time', 'NOW')[:19]}"
            cursor.execute(sql, row)
            inserted += 1
    return inserted

def get_observations_from_db(
    data_mode: str = "REAL",
    pollutant: Optional[str] = None,
    limit: int = 1000
) -> List[Dict[str, Any]]:
    """Retrieve observations strictly filtered by data_mode and pollutant."""
    with db_session() as conn:
        cursor = conn.cursor()
        query = "SELECT * FROM observations WHERE data_mode = ?"
        params: List[Any] = [data_mode.upper()]
        if pollutant:
            query += " AND UPPER(pollutant) = ?"
            params.append(pollutant.upper())
        query += " ORDER BY observation_time DESC LIMIT ?"
        params.append(limit)
        cursor.execute(query, params)
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

def count_observations(data_mode: str = "REAL", pollutant: Optional[str] = None) -> int:
    """Return count of observations for given mode."""
    with db_session() as conn:
        cursor = conn.cursor()
        query = "SELECT COUNT(*) as cnt FROM observations WHERE data_mode = ?"
        params: List[Any] = [data_mode.upper()]
        if pollutant:
            query += " AND UPPER(pollutant) = ?"
            params.append(pollutant.upper())
        cursor.execute(query, params)
        res = cursor.fetchone()
        return res["cnt"] if res else 0

def record_connector_status(
    connector_id: str,
    name: str,
    category: str,
    status: str,
    endpoint_url: str,
    auth_required: bool,
    auth_configured: bool,
    record_count: int,
    last_error: Optional[str] = None,
    sample_record: Optional[Dict[str, Any]] = None,
    notes: str = ""
):
    """Record connector operational status for auditing and UI reporting."""
    now_iso = datetime.now(timezone.utc).isoformat()
    with db_session() as conn:
        cursor = conn.cursor()
        cursor.execute("""
        INSERT OR REPLACE INTO connector_status (
            connector_id, name, category, status, endpoint_url,
            auth_required, auth_configured, last_queried_at,
            record_count, last_error, sample_record_json, notes
        ) VALUES (
            ?, ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?, ?
        );
        """, (
            connector_id, name, category, status, endpoint_url,
            1 if auth_required else 0,
            1 if auth_configured else 0,
            now_iso,
            record_count,
            last_error,
            json.dumps(sample_record) if sample_record else None,
            notes
        ))

def get_all_connector_statuses() -> List[Dict[str, Any]]:
    """Retrieve statuses of all registered data connectors."""
    with db_session() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM connector_status ORDER BY category, name;")
        rows = cursor.fetchall()
        results = []
        for r in rows:
            item = dict(r)
            item["auth_required"] = bool(item.get("auth_required"))
            item["auth_configured"] = bool(item.get("auth_configured"))
            if item.get("sample_record_json"):
                try:
                    item["sample_record"] = json.loads(item["sample_record_json"])
                except Exception:
                    item["sample_record"] = None
            else:
                item["sample_record"] = None
            results.append(item)
        return results
