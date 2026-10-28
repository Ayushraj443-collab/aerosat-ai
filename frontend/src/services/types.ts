export type DataMode = 'REAL' | 'DEMO';

export interface DataSourceInfo {
  id: string;
  name: string;
  description: string;
  category: 'satellite' | 'ground' | 'meteorology' | 'geographic' | 'atmospheric';
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

export interface ConnectorStatusItem {
  connector_id: string;
  name: string;
  category: 'satellite' | 'ground' | 'meteorology' | 'atmospheric' | 'geographic';
  status: 'VERIFIED' | 'IMPLEMENTED_BUT_UNVERIFIED' | 'BLOCKED' | 'FAILED';
  endpoint_url: string;
  auth_required: boolean;
  auth_configured: boolean;
  last_queried_at?: string;
  record_count: number;
  sample_record?: Record<string, any>;
  last_error?: string;
  notes: string;
}

export interface ConnectorStatusResponse {
  timestamp: string;
  connectors: ConnectorStatusItem[];
  summary?: {
    verified_connectors: number;
    blocked_connectors: number;
    total_records: number;
  };
}

export interface Sentinel5PQueryRequest {
  pollutant?: string;
  start_date?: string;
  end_date?: string;
  min_lat?: number;
  max_lat?: number;
  min_lon?: number;
  max_lon?: number;
  top?: number;
  limit?: number;
}

export interface Sentinel5PProductItem {
  product_id: string;
  granule_name: string;
  pollutant: string;
  acquisition_start: string;
  acquisition_end: string;
  content_length_bytes: number;
  footprint_wkt?: string;
  online_status: string;
}

export interface Sentinel5PQueryResponse {
  status: string;
  query_timestamp: string;
  total_found: number;
  products: Sentinel5PProductItem[];
  source_catalogue_url: string;
  auth_required_for_download: boolean;
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
  data_mode?: DataMode;
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
  satellite_column: number | null;
  satellite_qa: number | null;
  temperature_c?: number | null;
  relative_humidity_pct?: number | null;
  wind_speed_ms?: number | null;
  wind_direction_deg?: number | null;
  boundary_layer_height_m?: number | null;
  elevation_m?: number | null;
  road_density_proxy?: number | null;
  is_demo: boolean;
  data_mode: DataMode;
  source_name: string;
  source_product: string;
  source_record_id?: string;
  observation_time?: string;
  retrieved_at?: string;
  quality_flag?: number;
  dataset_version?: string;
  observation_type?: 'VERIFIED_COLLOCATION' | 'GROUND_MONITOR' | 'CAMS_REANALYSIS' | 'DIRECT_SATELLITE' | 'SYNTHETIC_DEMO';
  is_verified_collocation?: boolean;
}

export interface ProvenanceBreakdown {
  total_records: number;
  verified_collocations: number;
  ground_monitors: number;
  cams_reanalysis: number;
  direct_satellite: number;
  synthetic_demo: number;
  unique_stations: number;
  date_range: { start?: string | null; end?: string | null };
  by_data_mode: Record<string, number>;
  breakdown_by_pollutant: Record<string, number>;
}

export interface ObservationProvenanceSummaryResponse {
  timestamp: string;
  status: string;
  summary: ProvenanceBreakdown;
  scientific_notice: string;
}

export interface PredictionRequest {
  latitude: number;
  longitude: number;
  date: string;
  pollutant: string;
  target_resolution_km: number;
  model_algorithm?: string;
  data_mode?: DataMode;
}

export interface UncertaintyEstimate {
  lower_bound_90ci: number;
  upper_bound_90ci: number;
  standard_deviation: number;
  confidence_level: string;
}

export interface InputProvenance {
  satellite_product: string;
  satellite_granule?: string | null;
  satellite_column_value?: number | null;
  satellite_column_status?: string | null;
  satellite_column_reason?: string | null;
  satellite_unit: string;
  satellite_qa_value?: number | null;
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
  data_mode?: DataMode;
  provenance_status?: 'REAL' | 'REAL_COPERNICUS_CAMS' | 'DEMO' | 'UNVERIFIED' | 'UNAVAILABLE';
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
  status?: string;
  result_type?: string;
  estimated_value: number | null;
  unit: string;
  aqi_category: string;
  uncertainty?: UncertaintyEstimate | null;
  data_availability_notice?: string | null;
  model_info: {
    model_id: string;
    model_name: string;
    algorithm: string;
    r2_score: number;
    mae: number;
    is_preliminary?: boolean;
    data_limitation_notice?: string | null;
  };
  provenance: InputProvenance;
  provenance_status?: 'REAL' | 'DEMO' | 'UNVERIFIED';
}

export interface PredictionHistoryItem {
  id: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  date: string;
  pollutant: string;
  target_resolution_km: number;
  estimated_value: number | null;
  unit: string;
  uncertainty_lower?: number | null;
  uncertainty_upper?: number | null;
  model_version: string;
  is_demo: boolean;
  data_mode: DataMode;
  provenance_status: 'REAL' | 'DEMO' | 'UNVERIFIED';
  provenance?: InputProvenance | Record<string, any>;
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
  data_mode: DataMode;
  training_source?: string;
  dataset_version?: string;
  dataset_fingerprint?: string;
  validation_method?: string;
  is_preliminary?: boolean;
  data_limitation_notice?: string;
}

export interface PollutantDetail {
  count: number;
  date_range: {
    start: string;
    end: string;
  };
  stations_count: number;
  stations: string[];
  min_value?: number | null;
  max_value?: number | null;
  avg_value?: number | null;
  unit: string;
}

export interface UploadValidationResponse {
  dataset_id: string;
  filename: string;
  uploaded_at: string;
  row_count: number;
  raw_rows_count?: number;
  accepted_records_count?: number;
  rejected_records_count?: number;
  duplicate_count?: number;
  rejection_reasons?: Record<string, number>;
  stations_resolved?: string[];
  unresolved_stations?: string[];
  source_classification?: string;
  content_hash?: string;
  newly_registered?: boolean;
  already_registered?: boolean;
  pollutant_records_breakdown?: Record<string, number>;
  pollutants_detected?: string[];
  pollutants_summary?: Record<string, PollutantDetail>;
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
    satellite_column: number | null;
    satellite_qa: number | null;
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
    data_mode: DataMode;
    source_provenance?: string;
    scientific_disclaimer: string;
  };
  features: GeoJsonGridFeature[];
}

export interface CopernicusAuthTestResponse {
  credentials_configured: boolean;
  token_request: 'SUCCESS' | 'FAILURE' | 'NOT_CONFIGURED';
  auth_provider: string;
  http_status: number | null;
  error_category: string | null;
  timestamp: string;
  details: string;
}

export interface LocationSummaryRequest {
  city_name: string;
  state_region: string;
  country: string;
  latitude: number;
  longitude: number;
  date?: string;
  data_mode?: DataMode;
}

export interface LocationSummaryPollutantCard {
  code: string;
  name: string;
  value: number;
  unit: string;
  satValue: string;
  satUnit: string;
  category: string;
  badgeColor: string;
  cpcbLimit: number;
  whoLimit: number;
  desc: string;
  is_modeled: boolean;
  model_id: string | null;
  uncertainty_lower: number | null;
  uncertainty_upper: number | null;
  is_ground_truth: boolean;
  ground_observation_time: string | null;
  is_extrapolated?: boolean;
  validation_status?: string;
}

export interface LocationSummaryResponse {
  city_name: string;
  state_region: string;
  country: string;
  latitude: number;
  longitude: number;
  requested_date: string;
  is_current_date: boolean;
  data_mode: DataMode;
  data_availability: {
    is_current_available: boolean;
    has_matched_ground_observation?: boolean;
    has_matched_satellite_granule?: boolean;
    has_atmospheric_model?: boolean;
    verification_badge_type?: string;
    provenance_classification?: string;
    ground_observation_count_for_date?: number;
    satellite_granule_count_for_date?: number;
    status_message: string;
    latest_verified_timestamp: string;
    selected_query_date?: string;
    query_timestamp?: string;
    latest_satellite_timestamp?: string;
    latest_ground_timestamp?: string;
    satellite_status?: string;
    ground_status?: string;
    is_extrapolated_estimate?: boolean;
    calibration_baseline_info?: string;
  };
  meteorology: {
    temperature_c: number;
    relative_humidity_pct: number;
    wind_speed_ms: number;
    wind_direction_deg: number;
    boundary_layer_height_m: number;
    ventilation_index: number;
    source: string;
  };
  pollutants: LocationSummaryPollutantCard[];
  nearest_station: {
    station_id: string;
    name: string;
    distance_km: number;
    elevation_m: number;
    station_type: string;
    latest_observation_time: string;
  };
  statistics: {
    total_observations_count: number;
    live_connectors_count: number;
    monitored_stations_count: number;
    active_model_name: string;
  };
  regional_domain_str: string;
}

export interface MilestoneDateItem {
  date: string;
  tier: string;
  label: string;
  city_scope: string;
  description: string;
}

export interface DateCoverageStationInfo {
  station_id?: string;
  station_name?: string;
  distance_km?: number;
  has_records: boolean;
  total_records: number;
  min_date?: string;
  max_date?: string;
  pollutants: string[];
}

export interface SatelliteGranuleInfo {
  date: string;
  filename: string;
  pollutant: string;
  file_size_mb: number;
  orbit_number?: number;
}

export interface DateCoverageResponse {
  timestamp: string;
  data_mode: string;
  queried_city?: string;
  queried_coordinates?: { latitude: number; longitude: number };
  station_info: DateCoverageStationInfo;
  total_in_situ_records: number;
  total_stations: number;
  global_date_range: { min?: string; max?: string };
  satellite_granules: SatelliteGranuleInfo[];
  milestone_dates: MilestoneDateItem[];
  in_situ_dates_for_city: string[];
  summary_message: string;
}



