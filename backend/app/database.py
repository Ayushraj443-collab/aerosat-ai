import sqlite3
import json
import logging
import hashlib
from contextlib import contextmanager
from typing import Generator, List, Dict, Any, Optional, Tuple
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
            dataset_version TEXT DEFAULT '1.0',
            observation_type TEXT DEFAULT 'GROUND_MONITOR',
            is_verified_collocation INTEGER DEFAULT 0
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
            content_hash TEXT,
            uploaded_at TEXT NOT NULL,
            row_count INTEGER NOT NULL,
            raw_rows_count INTEGER,
            accepted_records_count INTEGER,
            rejected_records_count INTEGER,
            duplicate_count INTEGER DEFAULT 0,
            columns_json TEXT NOT NULL,
            bounding_box_json TEXT,
            pollutant TEXT,
            pollutants_json TEXT,
            is_valid INTEGER NOT NULL DEFAULT 1,
            data_mode TEXT NOT NULL DEFAULT 'REAL',
            source_classification TEXT DEFAULT 'UNVERIFIED_UPLOAD',
            registered_at TEXT,
            last_imported_at TEXT,
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

        ensure_col("observations", "observation_type", "TEXT DEFAULT 'GROUND_MONITOR'")
        ensure_col("observations", "is_verified_collocation", "INTEGER DEFAULT 0")
        ensure_col("model_registry", "data_mode", "TEXT DEFAULT 'DEMO'")
        ensure_col("model_registry", "dataset_version", "TEXT")
        ensure_col("model_registry", "dataset_fingerprint", "TEXT")
        ensure_col("model_registry", "validation_method", "TEXT")
        ensure_col("model_registry", "is_preliminary", "INTEGER DEFAULT 0")
        ensure_col("predictions_history", "data_mode", "TEXT DEFAULT 'DEMO'")
        ensure_col("uploaded_datasets", "data_mode", "TEXT DEFAULT 'REAL'")
        ensure_col("uploaded_datasets", "content_hash", "TEXT")
        ensure_col("uploaded_datasets", "raw_rows_count", "INTEGER")
        ensure_col("uploaded_datasets", "accepted_records_count", "INTEGER")
        ensure_col("uploaded_datasets", "rejected_records_count", "INTEGER")
        ensure_col("uploaded_datasets", "duplicate_count", "INTEGER DEFAULT 0")
        ensure_col("uploaded_datasets", "pollutants_json", "TEXT")
        ensure_col("uploaded_datasets", "source_classification", "TEXT DEFAULT 'UNVERIFIED_UPLOAD'")
        ensure_col("uploaded_datasets", "registered_at", "TEXT")
        ensure_col("uploaded_datasets", "last_imported_at", "TEXT")

        # Indices on observation columns once migration is ensured
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_obs_type ON observations(observation_type);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_obs_verified ON observations(is_verified_collocation);")

        # Migrate and categorize observation types based on authoritative source provenance
        cursor.execute("""
        UPDATE observations 
        SET observation_type = 'VERIFIED_COLLOCATION', is_verified_collocation = 1
        WHERE source_name LIKE '%Sentinel-5P%' AND source_name LIKE '%CPCB%'
          AND satellite_column IS NOT NULL AND satellite_column > 0
          AND ground_value IS NOT NULL AND ground_value > 0;
        """)
        cursor.execute("""
        UPDATE observations 
        SET observation_type = 'CAMS_REANALYSIS', is_verified_collocation = 0
        WHERE (source_name LIKE '%Copernicus Atmosphere Monitoring Service%' OR source_name LIKE '%CAMS%')
          AND (observation_type IS NULL OR observation_type != 'CAMS_REANALYSIS');
        """)
        cursor.execute("""
        UPDATE observations 
        SET observation_type = 'GROUND_MONITOR', is_verified_collocation = 0
        WHERE (source_name = 'CPCB CAAQMS Official Network' OR (source_name LIKE '%CPCB%' AND (satellite_column IS NULL OR satellite_column = 0)))
          AND (observation_type IS NULL OR observation_type != 'GROUND_MONITOR');
        """)
        cursor.execute("""
        UPDATE observations 
        SET observation_type = 'SYNTHETIC_DEMO', is_verified_collocation = 0
        WHERE (data_mode = 'DEMO' OR source_name LIKE '%Synthetic%' OR source_name LIKE '%Simulat%')
          AND (observation_type IS NULL OR observation_type != 'SYNTHETIC_DEMO');
        """)

        # Drop the erroneous unique constraint on filename to support identical filenames with different contents
        cursor.execute("DROP INDEX IF EXISTS idx_uploaded_datasets_filename;")

        # Backfill content_hash for historical rows if missing
        cursor.execute("SELECT rowid, id, filename, uploaded_at FROM uploaded_datasets WHERE content_hash IS NULL OR content_hash = '';")
        unhashed_rows = cursor.fetchall()
        for r in unhashed_rows:
            r_id = r["id"]
            fname = r["filename"]
            raw_dir = settings.DATA_RAW_DIR
            c_hash = None
            for cand in [raw_dir / fname, raw_dir / f"{r_id}_{fname}"]:
                if cand.exists() and cand.is_file():
                    try:
                        with open(cand, "rb") as f:
                            c_hash = hashlib.sha256(f.read()).hexdigest()
                        break
                    except Exception:
                        pass
            if not c_hash:
                c_hash = hashlib.sha256(f"{fname}_{r['uploaded_at']}_{r['rowid']}".encode("utf-8")).hexdigest()
            cursor.execute("UPDATE uploaded_datasets SET content_hash = ? WHERE rowid = ?", (c_hash, r["rowid"]))

        # Deduplicate uploaded_datasets based on content_hash while strictly preserving observations
        cursor.execute("""
        DELETE FROM uploaded_datasets
        WHERE rowid NOT IN (
            SELECT max(rowid) FROM uploaded_datasets WHERE content_hash IS NOT NULL GROUP BY content_hash
        );
        """)
        cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_uploaded_datasets_content_hash ON uploaded_datasets(content_hash);")

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
        cursor.execute("UPDATE connector_status SET category = 'atmospheric' WHERE connector_id = 'copernicus-cams-airquality' AND category = 'ground';")
        cursor.execute("UPDATE uploaded_datasets SET pollutant = 'NO2, PM2.5' WHERE pollutants_json LIKE '%NO2%' AND pollutants_json LIKE '%PM2.5%' AND pollutant != 'NO2, PM2.5';")
        
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
        
    logger.info("SQLite database initialized successfully with real-data schemas and provenance categorization.")

def insert_observations(records: List[Dict[str, Any]]) -> int:
    """Insert a batch of observation records into SQLite database with full provenance categorization."""
    if not records:
        return 0
    sql = """
    INSERT OR REPLACE INTO observations (
        id, data_mode, source_name, source_product, source_record_id,
        observation_time, retrieved_at, station_id, station_name,
        latitude, longitude, pollutant, ground_value, unit,
        satellite_column, satellite_qa, temperature_c, relative_humidity_pct,
        wind_speed_ms, wind_direction_deg, boundary_layer_height_m,
        elevation_m, road_density_proxy, quality_flag, dataset_version,
        observation_type, is_verified_collocation
    ) VALUES (
        :id, :data_mode, :source_name, :source_product, :source_record_id,
        :observation_time, :retrieved_at, :station_id, :station_name,
        :latitude, :longitude, :pollutant, :ground_value, :unit,
        :satellite_column, :satellite_qa, :temperature_c, :relative_humidity_pct,
        :wind_speed_ms, :wind_direction_deg, :boundary_layer_height_m,
        :elevation_m, :road_density_proxy, :quality_flag, :dataset_version,
        :observation_type, :is_verified_collocation
    );
    """
    inserted = 0
    with db_session() as conn:
        cursor = conn.cursor()
        for r in records:
            row = dict(r)
            if "id" not in row:
                row["id"] = f"{row.get('station_id', 'STN')}_{row.get('pollutant', 'NO2')}_{row.get('observation_time', 'NOW')[:19]}"
            
            # Infer observation_type and is_verified_collocation if not explicitly supplied
            if "observation_type" not in row or not row["observation_type"]:
                sname = str(row.get("source_name", ""))
                dmode = str(row.get("data_mode", "REAL")).upper()
                sat_col = row.get("satellite_column")
                grd_val = row.get("ground_value")
                has_sat = sat_col is not None and float(sat_col or 0) > 0
                has_grd = grd_val is not None and float(grd_val or 0) > 0

                if dmode == "DEMO" or "synthetic" in sname.lower() or "simulat" in sname.lower():
                    row["observation_type"] = "SYNTHETIC_DEMO"
                    row["is_verified_collocation"] = 0
                elif "sentinel-5p" in sname.lower() and "cpcb" in sname.lower() and has_sat and has_grd:
                    row["observation_type"] = "VERIFIED_COLLOCATION"
                    row["is_verified_collocation"] = 1
                elif "copernicus atmosphere" in sname.lower() or "cams" in sname.lower():
                    row["observation_type"] = "CAMS_REANALYSIS"
                    row["is_verified_collocation"] = 0
                elif has_sat and not has_grd:
                    row["observation_type"] = "DIRECT_SATELLITE"
                    row["is_verified_collocation"] = 0
                else:
                    row["observation_type"] = "GROUND_MONITOR"
                    row["is_verified_collocation"] = 0

            if "is_verified_collocation" not in row:
                row["is_verified_collocation"] = 1 if row.get("observation_type") == "VERIFIED_COLLOCATION" else 0

            cursor.execute(sql, row)
            inserted += 1
    return inserted

def get_observations_from_db(
    data_mode: str = "REAL",
    pollutant: Optional[str] = None,
    date: Optional[str] = None,
    station_id: Optional[str] = None,
    observation_type: Optional[str] = None,
    matched_only: bool = False,
    limit: int = 1000
) -> List[Dict[str, Any]]:
    """
    Retrieve observations strictly filtered by data_mode, pollutant, date, station_id,
    provenance observation_type, and matched status.
    All filters are evaluated directly in SQL before ORDER BY and LIMIT.
    """
    with db_session() as conn:
        cursor = conn.cursor()
        query = "SELECT * FROM observations WHERE data_mode = ?"
        params: List[Any] = [data_mode.upper()]
        if pollutant:
            query += " AND UPPER(pollutant) = ?"
            params.append(pollutant.upper())
        if date:
            query += " AND substr(observation_time, 1, 10) = ?"
            params.append(date.strip())
        if station_id:
            query += " AND station_id = ?"
            params.append(station_id.strip())
        if observation_type:
            query += " AND UPPER(observation_type) = ?"
            params.append(observation_type.strip().upper())
        if matched_only:
            query += " AND satellite_column IS NOT NULL AND satellite_column > 0 AND ground_value IS NOT NULL AND ground_value > 0"
            if data_mode.upper() == "REAL":
                query += " AND source_name LIKE '%Sentinel-5P%' AND source_name LIKE '%CPCB%'"
        query += " ORDER BY observation_time DESC LIMIT ?"
        params.append(limit)
        cursor.execute(query, params)
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

def count_observations(
    data_mode: str = "REAL",
    pollutant: Optional[str] = None,
    observation_type: Optional[str] = None,
    matched_only: bool = False
) -> int:
    """Return count of observations for given mode, pollutant, observation_type, and matched filter."""
    with db_session() as conn:
        cursor = conn.cursor()
        query = "SELECT COUNT(*) as cnt FROM observations WHERE data_mode = ?"
        params: List[Any] = [data_mode.upper()]
        if pollutant:
            query += " AND UPPER(pollutant) = ?"
            params.append(pollutant.upper())
        if observation_type:
            query += " AND UPPER(observation_type) = ?"
            params.append(observation_type.strip().upper())
        if matched_only:
            query += " AND satellite_column IS NOT NULL AND satellite_column > 0 AND ground_value IS NOT NULL AND ground_value > 0"
            if data_mode.upper() == "REAL":
                query += " AND source_name LIKE '%Sentinel-5P%' AND source_name LIKE '%CPCB%'"
        cursor.execute(query, params)
        res = cursor.fetchone()
        return res["cnt"] if res else 0

def get_observation_provenance_summary(data_mode: Optional[str] = None) -> Dict[str, Any]:
    """
    Generate an auditable, empirical summary of database records classified strictly by
    data provenance type: VERIFIED_COLLOCATION, GROUND_MONITOR, CAMS_REANALYSIS, DIRECT_SATELLITE, and SYNTHETIC_DEMO.
    """
    with db_session() as conn:
        cursor = conn.cursor()
        base_where = "WHERE data_mode = ?" if data_mode else ""
        base_params = [data_mode.upper()] if data_mode else []

        cursor.execute(f"SELECT COUNT(*) as total FROM observations {base_where}", base_params)
        total_records = cursor.fetchone()["total"]

        # Counts by observation_type
        type_counts = {
            "VERIFIED_COLLOCATION": 0,
            "GROUND_MONITOR": 0,
            "CAMS_REANALYSIS": 0,
            "DIRECT_SATELLITE": 0,
            "SYNTHETIC_DEMO": 0
        }
        cursor.execute(f"""
            SELECT observation_type, COUNT(*) as cnt 
            FROM observations 
            {base_where}
            GROUP BY observation_type
        """, base_params)
        for row in cursor.fetchall():
            otype = row["observation_type"]
            if otype in type_counts:
                type_counts[otype] = row["cnt"]

        # Unique stations
        cursor.execute(f"SELECT COUNT(DISTINCT station_id) as stn_cnt FROM observations {base_where}", base_params)
        unique_stations = cursor.fetchone()["stn_cnt"]

        # Date range
        cursor.execute(f"SELECT MIN(observation_time) as min_t, MAX(observation_time) as max_t FROM observations {base_where}", base_params)
        t_row = cursor.fetchone()
        date_range = {
            "start": (t_row["min_t"] or "")[:10] if t_row else None,
            "end": (t_row["max_t"] or "")[:10] if t_row else None
        }

        # Breakdown by pollutant
        cursor.execute(f"SELECT pollutant, COUNT(*) as cnt FROM observations {base_where} GROUP BY pollutant", base_params)
        pollutant_breakdown = {r["pollutant"]: r["cnt"] for r in cursor.fetchall()}

        # Breakdown by data_mode
        cursor.execute("SELECT data_mode, COUNT(*) as cnt FROM observations GROUP BY data_mode")
        mode_breakdown = {r["data_mode"]: r["cnt"] for r in cursor.fetchall()}

        return {
            "total_records": total_records,
            "verified_collocations": type_counts["VERIFIED_COLLOCATION"],
            "ground_monitors": type_counts["GROUND_MONITOR"],
            "cams_reanalysis": type_counts["CAMS_REANALYSIS"],
            "direct_satellite": type_counts["DIRECT_SATELLITE"],
            "synthetic_demo": type_counts["SYNTHETIC_DEMO"],
            "unique_stations": unique_stations,
            "date_range": date_range,
            "by_data_mode": mode_breakdown,
            "breakdown_by_pollutant": pollutant_breakdown
        }

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

def get_uploaded_dataset_by_hash(content_hash: str) -> Optional[Dict[str, Any]]:
    """Retrieve an uploaded dataset record strictly by its content hash."""
    if not content_hash:
        return None
    with db_session() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM uploaded_datasets WHERE content_hash = ? LIMIT 1;", (content_hash,))
        row = cursor.fetchone()
        return dict(row) if row else None

def upsert_uploaded_dataset(dataset_data: Dict[str, Any]) -> Tuple[Dict[str, Any], bool]:
    """
    Idempotently register or update an uploaded dataset.
    Uses content_hash as the canonical stable identity.
    Returns (dataset_record_dict, newly_registered: bool).
    If dataset with same content_hash exists, updates metadata and last_imported_at without creating a duplicate row.
    """
    content_hash = dataset_data.get("content_hash")
    now_iso = datetime.now(timezone.utc).isoformat()
    
    with db_session() as conn:
        cursor = conn.cursor()
        existing = None
        if content_hash:
            cursor.execute("SELECT * FROM uploaded_datasets WHERE content_hash = ? LIMIT 1;", (content_hash,))
            existing = cursor.fetchone()
            
        if existing:
            ds_id = existing["id"]
            cursor.execute("""
            UPDATE uploaded_datasets SET
                last_imported_at = ?,
                row_count = ?,
                raw_rows_count = COALESCE(?, raw_rows_count),
                accepted_records_count = COALESCE(?, accepted_records_count),
                rejected_records_count = COALESCE(?, rejected_records_count),
                duplicate_count = COALESCE(?, duplicate_count),
                columns_json = COALESCE(?, columns_json),
                bounding_box_json = COALESCE(?, bounding_box_json),
                pollutant = COALESCE(?, pollutant),
                pollutants_json = COALESCE(?, pollutants_json),
                is_valid = ?,
                source_classification = COALESCE(?, source_classification),
                summary_json = COALESCE(?, summary_json)
            WHERE id = ?;
            """, (
                now_iso,
                dataset_data.get("row_count", existing["row_count"]),
                dataset_data.get("raw_rows_count"),
                dataset_data.get("accepted_records_count"),
                dataset_data.get("rejected_records_count"),
                dataset_data.get("duplicate_count"),
                dataset_data.get("columns_json"),
                dataset_data.get("bounding_box_json"),
                dataset_data.get("pollutant"),
                dataset_data.get("pollutants_json"),
                1 if dataset_data.get("is_valid", existing["is_valid"]) else 0,
                dataset_data.get("source_classification"),
                dataset_data.get("summary_json"),
                ds_id
            ))
            cursor.execute("SELECT * FROM uploaded_datasets WHERE id = ?;", (ds_id,))
            updated_row = dict(cursor.fetchone())
            return updated_row, False
        else:
            ds_id = dataset_data.get("id") or f"ds_{content_hash[:10] if content_hash else 'custom'}"
            cursor.execute("""
            INSERT INTO uploaded_datasets (
                id, filename, content_hash, uploaded_at, row_count, raw_rows_count,
                accepted_records_count, rejected_records_count, duplicate_count,
                columns_json, bounding_box_json, pollutant, pollutants_json,
                is_valid, data_mode, source_classification, registered_at,
                last_imported_at, summary_json
            ) VALUES (
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?
            );
            """, (
                ds_id,
                dataset_data.get("filename", "unknown.csv"),
                content_hash,
                dataset_data.get("uploaded_at") or now_iso,
                dataset_data.get("row_count", 0),
                dataset_data.get("raw_rows_count", dataset_data.get("row_count", 0)),
                dataset_data.get("accepted_records_count", 0),
                dataset_data.get("rejected_records_count", 0),
                dataset_data.get("duplicate_count", 0),
                dataset_data.get("columns_json", "[]"),
                dataset_data.get("bounding_box_json", "{}"),
                dataset_data.get("pollutant"),
                dataset_data.get("pollutants_json", "[]"),
                1 if dataset_data.get("is_valid", True) else 0,
                dataset_data.get("data_mode", "REAL"),
                dataset_data.get("source_classification", "UNVERIFIED_UPLOAD"),
                dataset_data.get("registered_at") or now_iso,
                now_iso,
                dataset_data.get("summary_json", "{}")
            ))
            cursor.execute("SELECT * FROM uploaded_datasets WHERE id = ?;", (ds_id,))
            new_row = dict(cursor.fetchone())
            return new_row, True

