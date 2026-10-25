export interface DataSourceInfo {
  id: string;
  name: string;
  description: string;
  category: 'satellite' | 'ground' | 'meteorology' | 'geographic';
  product: string;
  status: string;
  spatial_coverage: string;
  native_resolution: string;
  temporal_frequency: string;
  data_provider: string;
  auth_required: boolean;
  is_demo: boolean;
  setup_guide?: string;
}

export interface GroundStation {
  station_id: string;
  name: string;
  city: string;
  latitude: number;
  longitude: number;
  elevation_m: number;
  station_type: string;
  operational_status: string;
  latest_reading?: Record<string, { value: number; unit: string }>;
  is_demo: boolean;
}

export interface ObservationRecord {
  date: string;
  station_id: string;
  station_name: string;
  latitude: number;
  longitude: number;
  pollutant: string;
  ground_value: number;
  unit: string;
  satellite_column: number;
  satellite_qa: number;
  temperature_c: number;
  relative_humidity_pct: number;
  wind_speed_ms: number;
  wind_direction_deg: number;
  boundary_layer_height_m: number;
  elevation_m: number;
  road_density_proxy: number;
  is_demo: boolean;
}

export interface PredictionRequest {
  latitude: number;
  longitude: number;
  date: string;
  pollutant: string;
  target_resolution_km: number;
  model_algorithm?: string;
}

export interface UncertaintyEstimate {
  lower_bound_90ci: number;
  upper_bound_90ci: number;
  standard_deviation: number;
  confidence_level: string;
}

export interface InputProvenance {
  satellite_product: string;
  satellite_column_value: number;
  satellite_unit: string;
  satellite_qa_value: number;
  meteorological_features: {
    temperature_c: number;
    relative_humidity_pct: number;
    wind_speed_ms: number;
    wind_direction_deg: number;
    boundary_layer_height_m: number;
    ventilation_index: number;
  };
  nearest_ground_station_id: string;
  nearest_station_name: string;
  distance_to_station_km: number;
  elevation_m: number;
  road_density_proxy: number;
  is_demo: boolean;
  scientific_disclaimer: string;
}

export interface PredictionResponse {
  prediction_id: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  date: string;
  pollutant: string;
  target_resolution_km: number;
  estimated_value: number;
  unit: string;
  aqi_category: string;
  uncertainty: UncertaintyEstimate;
  model_info: {
    model_id: string;
    model_name: string;
    algorithm: string;
    r2_score: number;
    mae: number;
  };
  provenance: InputProvenance;
}

export interface SpatialValidationFold {
  fold: number;
  held_out_stations: string[];
  train_count: number;
  val_count: number;
  mae: number;
  rmse: number;
  r2: number;
}

export interface BaselineComparison {
  baseline_type: string;
  baseline_mae: number;
  baseline_rmse: number;
  baseline_r2: number;
  ml_improvement_mae_pct: number;
  ml_improvement_rmse_pct: number;
}

export interface ModelMetricsResponse {
  model_id: string;
  model_name: string;
  target_pollutant: string;
  algorithm: string;
  trained_at: string;
  train_samples: number;
  val_samples: number;
  mae: number;
  rmse: number;
  r2: number;
  mean_bias_error: number;
  normalized_rmse_pct: number;
  baseline_comparison: BaselineComparison;
  spatial_validation_folds: SpatialValidationFold[];
  feature_importances: Array<{ feature: string; importance: number }>;
  observed_vs_predicted: Array<{
    index: number;
    observed: number;
    predicted: number;
    error: number;
    date: string;
    station: string;
  }>;
  residual_distribution: {
    mean_residual: number;
    std_residual: number;
    histogram: Array<{ bin_range: string; bin_center: number; count: number }>;
  };
  is_demo: boolean;
  is_active: boolean;
}

export interface UploadValidationResponse {
  dataset_id: string;
  filename: string;
  uploaded_at: string;
  row_count: number;
  columns: string[];
  pollutant_detected: string | null;
  coordinate_bounds: {
    min_lat: number;
    max_lat: number;
    min_lon: number;
    max_lon: number;
  };
  date_range: {
    start: string;
    end: string;
  };
  missing_value_summary: Record<string, number>;
  is_valid: boolean;
  validation_messages: string[];
  preview_rows: Array<Record<string, any>>;
}

export interface MapLayersResponse {
  region: {
    min_lat: number;
    max_lat: number;
    min_lon: number;
    max_lon: number;
    center_lat: number;
    center_lon: number;
    region_name: string;
  };
  supported_pollutants: Record<string, any>;
  supported_resolutions_km: number[];
  layers: Array<{
    id: string;
    name: string;
    type: string;
    description: string;
    enabled_by_default: boolean;
    supports_uncertainty: boolean;
    opacity: number;
  }>;
}

export interface GeoJsonGridFeature {
  type: 'Feature';
  id: string;
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  properties: {
    cell_id: string;
    center_lat: number;
    center_lon: number;
    pollutant: string;
    unit: string;
    estimated_value: number | null;
    uncertainty_sd: number | null;
    uncertainty_lower_90ci: number | null;
    uncertainty_upper_90ci: number | null;
    satellite_column: number;
    satellite_qa: number;
    is_data_gap: boolean;
    gap_reason: string | null;
    aqi_category: string | null;
  };
}

export interface GeoJsonGridCollection {
  type: 'FeatureCollection';
  metadata: {
    pollutant: string;
    unit: string;
    date: string;
    target_resolution_km: number;
    cell_count: number;
    valid_cells: number;
    data_gap_cells: number;
    model_version: string;
    model_r2: number;
    crs: string;
    is_demo: boolean;
    scientific_disclaimer: string;
  };
  features: GeoJsonGridFeature[];
}
