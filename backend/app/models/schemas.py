from pydantic import BaseModel, Field, field_validator
from typing import List, Dict, Any, Optional
from datetime import date as DateType

class HealthResponse(BaseModel):
    status: str
    timestamp: str
    version: str
    demo_mode: bool
    environment: str
    loaded_models: List[str]
    storage_status: Dict[str, Any]

class DataSourceInfo(BaseModel):
    id: str
    name: str
    description: str
    category: str  # satellite | ground | meteorology | geographic
    product: str
    status: str    # active | simulated | requires_credentials
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

class ObservationRecord(BaseModel):
    date: str
    station_id: str
    station_name: str
    latitude: float
    longitude: float
    pollutant: str
    ground_value: float
    unit: str
    satellite_column: float
    satellite_qa: float
    temperature_c: float
    relative_humidity_pct: float
    wind_speed_ms: float
    wind_direction_deg: float
    boundary_layer_height_m: float
    elevation_m: float
    road_density_proxy: float
    is_demo: bool = True

class PredictionRequest(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Latitude in decimal degrees")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Longitude in decimal degrees")
    date: str = Field(..., description="Observation date (YYYY-MM-DD)")
    pollutant: str = Field("NO2", description="Pollutant: NO2, PM2.5, SO2, CO, O3")
    target_resolution_km: float = Field(1.0, ge=0.5, le=20.0, description="Target spatial grid resolution in km")
    model_algorithm: Optional[str] = Field("random_forest", description="Algorithm: random_forest, gradient_boosting")

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
    satellite_column_value: float
    satellite_unit: str
    satellite_qa_value: float
    meteorological_features: Dict[str, Any]
    nearest_ground_station_id: str
    nearest_station_name: str
    distance_to_station_km: float
    elevation_m: float
    road_density_proxy: float
    is_demo: bool
    scientific_disclaimer: str

class PredictionResponse(BaseModel):
    prediction_id: str
    timestamp: str
    latitude: float
    longitude: float
    date: str
    pollutant: str
    target_resolution_km: float
    estimated_value: float
    unit: str
    aqi_category: str
    uncertainty: UncertaintyEstimate
    model_info: Dict[str, Any]
    provenance: InputProvenance

class ModelTrainRequest(BaseModel):
    pollutant: str = Field("NO2", description="Pollutant to train: NO2, PM2.5, SO2, CO, O3")
    algorithm: str = Field("random_forest", description="random_forest or gradient_boosting")
    n_estimators: int = Field(100, ge=10, le=500)
    max_depth: Optional[int] = Field(12, ge=2, le=30)
    spatial_cv_folds: int = Field(5, ge=2, le=10)
    random_state: int = Field(42)

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
