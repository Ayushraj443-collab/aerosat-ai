from pydantic import BaseModel, Field, field_validator, model_validator
from typing import List, Dict, Any, Optional
from datetime import date as DateType
from enum import Enum

class DataMode(str, Enum):
    REAL = "REAL"
    DEMO = "DEMO"

class HealthResponse(BaseModel):
    status: str
    timestamp: str
    version: str
    demo_mode: bool
    default_data_mode: Optional[str] = "REAL"
    environment: str
    loaded_models: List[str]
    storage_status: Dict[str, Any]

class DataSourceInfo(BaseModel):
    id: str
    name: str
    description: str
    category: str  # satellite | ground | meteorology | geographic
    product: str
    status: str    # VERIFIED | IMPLEMENTED_BUT_UNVERIFIED | BLOCKED | FAILED | active
    spatial_coverage: str
    native_resolution: str
    temporal_frequency: str
    data_provider: str
    auth_required: bool
    is_demo: bool
    setup_guide: Optional[str] = None

class GroundStation(BaseModel):
    station_id: str
    name: str
    city: str
    latitude: float
    longitude: float
    elevation_m: float
    station_type: str
    operational_status: str
    latest_reading: Optional[Dict[str, Any]] = None
    is_demo: bool = True
    data_mode: str = "DEMO"

class ObservationRecord(BaseModel):
    date: str
    station_id: str
    station_name: str
    latitude: float
    longitude: float
    pollutant: str
    ground_value: float
    unit: str
    satellite_column: Optional[float] = None
    satellite_qa: Optional[float] = None
    temperature_c: Optional[float] = None
    relative_humidity_pct: Optional[float] = None
    wind_speed_ms: Optional[float] = None
    wind_direction_deg: Optional[float] = None
    boundary_layer_height_m: Optional[float] = None
    elevation_m: Optional[float] = None
    road_density_proxy: Optional[float] = None
    is_demo: bool = True
    # Scientific Provenance Fields
    data_mode: str = "DEMO"
    source_name: str = "Synthetic Simulation Generator"
    source_product: str = "Simulated Matched Observations"
    source_record_id: Optional[str] = None
    observation_time: Optional[str] = None
    retrieved_at: Optional[str] = None
    quality_flag: float = 1.0
    dataset_version: Optional[str] = "1.0"
    observation_type: str = "SYNTHETIC_DEMO"  # VERIFIED_COLLOCATION | GROUND_MONITOR | CAMS_REANALYSIS | DIRECT_SATELLITE | SYNTHETIC_DEMO
    is_verified_collocation: bool = False

class ProvenanceBreakdown(BaseModel):
    total_records: int
    verified_collocations: int
    ground_monitors: int
    cams_reanalysis: int
    direct_satellite: int
    synthetic_demo: int
    unique_stations: int
    date_range: Dict[str, Optional[str]]
    by_data_mode: Dict[str, int]
    breakdown_by_pollutant: Dict[str, int]

class ObservationProvenanceSummaryResponse(BaseModel):
    timestamp: str
    status: str
    summary: ProvenanceBreakdown
    scientific_notice: str

class ConnectorStatusItem(BaseModel):
    connector_id: str
    name: str
    category: str  # satellite | ground | meteorology
    status: str    # VERIFIED | IMPLEMENTED_BUT_UNVERIFIED | BLOCKED | FAILED
    endpoint_url: str
    auth_required: bool
    auth_configured: bool
    last_queried_at: Optional[str] = None
    record_count: int = 0
    sample_record: Optional[Dict[str, Any]] = None
    last_error: Optional[str] = None
    notes: str

class ConnectorStatusResponse(BaseModel):
    timestamp: str
    connectors: List[ConnectorStatusItem]

class Sentinel5PProductItem(BaseModel):
    product_id: str
    granule_name: str
    pollutant: str
    acquisition_start: str
    acquisition_end: str
    content_length_bytes: int
    footprint_wkt: Optional[str] = None
    online_status: str

class Sentinel5PQueryRequest(BaseModel):
    pollutant: str = "NO2"
    min_lat: float = 28.30
    max_lat: float = 28.88
    min_lon: float = 76.90
    max_lon: float = 77.45
    start_date: str = "2024-01-01"
    end_date: str = "2024-01-10"
    top: int = 5

class Sentinel5PQueryResponse(BaseModel):
    status: str
    query_timestamp: str
    total_found: int
    products: List[Sentinel5PProductItem]
    source_catalogue_url: str
    auth_required_for_download: bool

class PredictionRequest(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Latitude in decimal degrees")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Longitude in decimal degrees")
    date: str = Field(..., description="Observation date (YYYY-MM-DD)")
    pollutant: str = Field("NO2", description="Pollutant: NO2, PM2.5, SO2, CO, O3")
    target_resolution_km: float = Field(1.0, ge=0.5, le=20.0, description="Target spatial grid resolution in km")
    model_algorithm: Optional[str] = Field("random_forest", description="Algorithm: random_forest, gradient_boosting")
    data_mode: str = Field("DEMO", description="Data mode: REAL or DEMO")

    @field_validator("pollutant")
    def validate_pollutant(cls, v):
        valid = ["NO2", "PM2.5", "SO2", "CO", "O3"]
        if v.upper() not in valid:
            raise ValueError(f"Pollutant must be one of {valid}")
        return v.upper()

class UncertaintyEstimate(BaseModel):
    lower_bound_90ci: float
    upper_bound_90ci: float
    standard_deviation: float
    confidence_level: str = "90%"

class InputProvenance(BaseModel):
    satellite_product: str
    satellite_granule: Optional[str] = None
    satellite_column_value: Optional[float] = None
    satellite_column_status: Optional[str] = None
    satellite_column_reason: Optional[str] = None
    satellite_unit: str = "10^15 molec/cm2"
    satellite_qa_value: Optional[float] = None
    meteorological_features: Dict[str, Any]
    nearest_ground_station_id: str
    nearest_station_name: str
    distance_to_station_km: float
    elevation_m: float
    road_density_proxy: float
    is_demo: bool
    data_mode: str = "DEMO"
    provenance_status: Optional[str] = None
    scientific_disclaimer: str

class PredictionResponse(BaseModel):
    prediction_id: str
    timestamp: str
    latitude: float
    longitude: float
    date: str
    pollutant: str
    target_resolution_km: float
    estimated_value: Optional[float] = None
    unit: str
    aqi_category: str
    uncertainty: Optional[UncertaintyEstimate] = None
    model_info: Dict[str, Any]
    provenance: Optional[InputProvenance] = None
    provenance_status: Optional[str] = None
    status: str = "COMPLETED"  # COMPLETED | INPUTS_PENDING | UNAVAILABLE
    result_type: str = "MODEL_ESTIMATE"  # MODEL_ESTIMATE | DEMO_SIMULATION | UNAVAILABLE_PENDING_SATELLITE_OVERPASS
    data_availability_notice: Optional[str] = None

class ModelTrainRequest(BaseModel):
    pollutant: str = Field("NO2", description="Pollutant to train: NO2, PM2.5, SO2, CO, O3")
    algorithm: str = Field("bayesian_ridge", description="bayesian_ridge, ridge, elastic_net, random_forest, gradient_boosting")
    n_estimators: int = Field(100, ge=10, le=500)
    max_depth: Optional[int] = Field(12, ge=2, le=30)
    spatial_cv_folds: int = Field(3, ge=2, le=10)
    random_state: int = Field(42)
    data_mode: str = Field("DEMO", description="Data mode: REAL or DEMO")

class BaselineComparison(BaseModel):
    baseline_type: str = "Nearest Station Inverse-Distance Weighting (IDW)"
    baseline_mae: float
    baseline_rmse: float
    baseline_r2: float
    ml_improvement_mae_pct: float
    ml_improvement_rmse_pct: float

class SpatialValidationFold(BaseModel):
    fold: int
    held_out_stations: List[str]
    train_count: int
    val_count: int
    mae: float
    rmse: float
    r2: float

class ModelMetricsResponse(BaseModel):
    model_id: str
    model_name: str
    target_pollutant: str
    algorithm: str
    trained_at: str
    train_samples: int
    val_samples: int
    mae: float
    rmse: float
    r2: float
    mean_bias_error: float
    normalized_rmse_pct: float
    baseline_comparison: BaselineComparison
    spatial_validation_folds: List[SpatialValidationFold]
    feature_importances: List[Dict[str, Any]]
    observed_vs_predicted: List[Dict[str, Any]]
    residual_distribution: Dict[str, Any]
    is_demo: bool
    is_active: bool
    data_mode: str = "DEMO"
    training_source: Optional[str] = None
    dataset_version: Optional[str] = None
    dataset_fingerprint: Optional[str] = None
    validation_method: Optional[str] = None
    is_preliminary: Optional[bool] = False
    data_limitation_notice: Optional[str] = None

class UploadValidationResponse(BaseModel):
    dataset_id: str
    filename: str
    uploaded_at: str
    row_count: int
    columns: List[str]
    pollutant_detected: Optional[str]
    coordinate_bounds: Dict[str, float]
    date_range: Dict[str, str]
    missing_value_summary: Dict[str, int]
    is_valid: bool
    validation_messages: List[str]
    preview_rows: List[Dict[str, Any]]
    accepted_records_count: int = 0
    rejected_records_count: int = 0
    rejection_reasons: Dict[str, int] = Field(default_factory=dict)
    stations_resolved: List[str] = Field(default_factory=list)
    unresolved_stations: List[str] = Field(default_factory=list)
    source_classification: str = "UNVERIFIED_UPLOAD"
    duplicate_count: int = 0
    content_hash: Optional[str] = None
    newly_registered: bool = True
    already_registered: bool = False
    raw_rows_count: Optional[int] = None
    pollutant_records_breakdown: Optional[Dict[str, int]] = Field(default_factory=dict)
    pollutants_detected: Optional[List[str]] = Field(default_factory=list)
    pollutants_summary: Optional[Dict[str, Dict[str, Any]]] = Field(default_factory=dict)

class RealDataIngestionResponse(BaseModel):
    status: str
    source: str
    inserted_count: int
    timestamp: str
    pollutants: List[str]
    date_range: Dict[str, str]
    message: str

class CopernicusAuthTestResponse(BaseModel):
    credentials_configured: bool
    token_request: str
    auth_provider: str
    http_status: Optional[int] = None
    error_category: Optional[str] = None
    timestamp: str
    details: str

class LocationSummaryRequest(BaseModel):
    city_name: str = "Delhi"
    state_region: str = "Delhi-NCR"
    country: str = "India"
    latitude: float = Field(default=28.6139, ge=8.0, le=38.0)
    longitude: float = Field(default=77.2090, ge=68.0, le=98.0)
    date: Optional[str] = None
    data_mode: str = "REAL"

    @model_validator(mode="before")
    @classmethod
    def handle_aliases(cls, values):
        if isinstance(values, dict):
            if "city" in values and "city_name" not in values:
                values["city_name"] = values["city"]
            if "state" in values and "state_region" not in values:
                values["state_region"] = values["state"]
            if "target_date" in values and "date" not in values:
                values["date"] = values["target_date"]
        return values

class LocationSummaryPollutantCard(BaseModel):
    code: str
    name: str
    value: Optional[float] = None
    unit: str
    satValue: str
    satUnit: str
    category: str
    badgeColor: str
    cpcbLimit: float
    whoLimit: float
    desc: str
    is_modeled: bool = True
    model_id: Optional[str] = None
    uncertainty_lower: Optional[float] = None
    uncertainty_upper: Optional[float] = None
    is_ground_truth: bool = False
    ground_observation_time: Optional[str] = None
    is_extrapolated: bool = False
    validation_status: str = "VALIDATED_HISTORICAL"

class LocationSummaryResponse(BaseModel):
    city_name: str
    state_region: str
    country: str
    latitude: float
    longitude: float
    requested_date: str
    is_current_date: bool
    data_mode: str
    data_availability: Dict[str, Any]
    meteorology: Dict[str, Any]
    pollutants: List[LocationSummaryPollutantCard]
    nearest_station: Dict[str, Any]
    statistics: Dict[str, Any]
    regional_domain_str: str

class MilestoneDateItem(BaseModel):
    date: str
    tier: str  # IN_SITU_MATCHED | SATELLITE_L2_MATCHED | VERIFIED_COLLOCATION | CAMS_ATMOSPHERIC_MODEL
    label: str
    city_scope: str
    description: str

class DateCoverageStationInfo(BaseModel):
    station_id: Optional[str] = None
    station_name: Optional[str] = None
    distance_km: Optional[float] = None
    has_records: bool = False
    total_records: int = 0
    min_date: Optional[str] = None
    max_date: Optional[str] = None
    pollutants: List[str] = []

class SatelliteGranuleInfo(BaseModel):
    date: str
    filename: str
    pollutant: str = "NO2"
    file_size_mb: float
    orbit_number: Optional[int] = None

class DateCoverageResponse(BaseModel):
    timestamp: str
    data_mode: str
    queried_city: Optional[str] = None
    queried_coordinates: Optional[Dict[str, float]] = None
    station_info: DateCoverageStationInfo
    total_in_situ_records: int
    total_stations: int
    global_date_range: Dict[str, Optional[str]]
    satellite_granules: List[SatelliteGranuleInfo]
    milestone_dates: List[MilestoneDateItem]
    in_situ_dates_for_city: List[str]
    summary_message: str



