import type {
  DataSourceInfo,
  GroundStation,
  ObservationRecord,
  PredictionRequest,
  PredictionResponse,
  ModelMetricsResponse,
  UploadValidationResponse,
  MapLayersResponse,
  GeoJsonGridCollection
} from './types';

const API_BASE = '/api';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorDetail = 'API request failed';
    try {
      const errJson = await res.json();
      errorDetail = errJson.detail || errJson.message || errorDetail;
    } catch {
      errorDetail = `HTTP ${res.status}: ${res.statusText}`;
    }
    throw new Error(errorDetail);
  }
  return res.json();
}

export const api = {
  // Health
  async getHealth(): Promise<any> {
    const res = await fetch(`${API_BASE}/health`);
    return handleResponse(res);
  },

  // Sources & Stations
  async getDataSources(): Promise<DataSourceInfo[]> {
    const res = await fetch(`${API_BASE}/data/sources`);
    return handleResponse(res);
  },

  async getStations(): Promise<GroundStation[]> {
    const res = await fetch(`${API_BASE}/data/stations`);
    return handleResponse(res);
  },

  async getObservations(params: {
    date?: string;
    pollutant?: string;
    station_id?: string;
    limit?: number;
  }): Promise<ObservationRecord[]> {
    const query = new URLSearchParams();
    if (params.date) query.set('date', params.date);
    if (params.pollutant) query.set('pollutant', params.pollutant);
    if (params.station_id) query.set('station_id', params.station_id);
    if (params.limit) query.set('limit', params.limit.toString());
    const res = await fetch(`${API_BASE}/data/observations?${query.toString()}`);
    return handleResponse(res);
  },

  async uploadDataset(file: File): Promise<UploadValidationResponse> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/data/upload`, {
      method: 'POST',
      body: formData,
    });
    return handleResponse(res);
  },

  async getDatasets(): Promise<any[]> {
    const res = await fetch(`${API_BASE}/data/datasets`);
    return handleResponse(res);
  },

  // Map
  async getMapLayers(): Promise<MapLayersResponse> {
    const res = await fetch(`${API_BASE}/map/layers`);
    return handleResponse(res);
  },

  async getDownscaledGrid(params: {
    date?: string;
    pollutant?: string;
    resolution_km?: number;
    min_lat?: number;
    max_lat?: number;
    min_lon?: number;
    max_lon?: number;
  }): Promise<GeoJsonGridCollection> {
    const query = new URLSearchParams();
    if (params.date) query.set('date', params.date);
    if (params.pollutant) query.set('pollutant', params.pollutant);
    if (params.resolution_km) query.set('resolution_km', params.resolution_km.toString());
    if (params.min_lat !== undefined) query.set('min_lat', params.min_lat.toString());
    if (params.max_lat !== undefined) query.set('max_lat', params.max_lat.toString());
    if (params.min_lon !== undefined) query.set('min_lon', params.min_lon.toString());
    if (params.max_lon !== undefined) query.set('max_lon', params.max_lon.toString());
    const res = await fetch(`${API_BASE}/map/downscaled-grid?${query.toString()}`);
    return handleResponse(res);
  },

  // Predict
  async predict(req: PredictionRequest): Promise<PredictionResponse> {
    const res = await fetch(`${API_BASE}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    return handleResponse(res);
  },

  async getPredictionHistory(limit: number = 20): Promise<any[]> {
    const res = await fetch(`${API_BASE}/predictions/history?limit=${limit}`);
    return handleResponse(res);
  },

  // Model
  async getModelStatus(): Promise<any> {
    const res = await fetch(`${API_BASE}/model/status`);
    return handleResponse(res);
  },

  async getModelMetrics(pollutant: string = 'NO2'): Promise<ModelMetricsResponse> {
    const res = await fetch(`${API_BASE}/model/metrics?pollutant=${pollutant}`);
    return handleResponse(res);
  },

  async trainModel(params: {
    pollutant: string;
    algorithm: string;
    n_estimators?: number;
    max_depth?: number;
    spatial_cv_folds?: number;
  }): Promise<ModelMetricsResponse> {
    const res = await fetch(`${API_BASE}/model/train`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pollutant: params.pollutant,
        algorithm: params.algorithm,
        n_estimators: params.n_estimators || 100,
        max_depth: params.max_depth || 12,
        spatial_cv_folds: params.spatial_cv_folds || 5,
      }),
    });
    return handleResponse(res);
  },
};
