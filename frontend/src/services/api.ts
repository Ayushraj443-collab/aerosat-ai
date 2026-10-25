import type {
  DataSourceInfo,
  GroundStation,
  ObservationRecord,
  PredictionRequest,
  PredictionResponse,
  ModelMetricsResponse,
  UploadValidationResponse,
  MapLayersResponse,
  GeoJsonGridCollection,
  ConnectorStatusResponse,
  Sentinel5PQueryRequest,
  Sentinel5PQueryResponse,
  DataMode
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

  async getConnectorsStatus(): Promise<ConnectorStatusResponse> {
    const res = await fetch(`${API_BASE}/data/connectors/status`);
    return handleResponse(res);
  },

  async querySentinel5PCatalogue(params: Sentinel5PQueryRequest): Promise<Sentinel5PQueryResponse> {
    const res = await fetch(`${API_BASE}/data/connectors/sentinel5p/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return handleResponse(res);
  },

  async fetchLiveMeteorology(latitude: number, longitude: number): Promise<any> {
    const res = await fetch(`${API_BASE}/data/connectors/meteo/fetch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latitude, longitude }),
    });
    return handleResponse(res);
  },

  async triggerRealDataIngestion(): Promise<any> {
    const res = await fetch(`${API_BASE}/data/ingest-real`, {
      method: 'POST',
    });
    return handleResponse(res);
  },

  async importCpcbCsv(file: File, pollutant: string = 'NO2'): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/data/import-cpcb?pollutant=${pollutant}`, {
      method: 'POST',
      body: formData,
    });
    return handleResponse(res);
  },

  async getStations(mode: DataMode = 'DEMO'): Promise<GroundStation[]> {
    const res = await fetch(`${API_BASE}/data/stations?mode=${mode.toLowerCase()}`);
    return handleResponse(res);
  },

  async getObservations(params: {
    mode?: DataMode;
    date?: string;
    pollutant?: string;
    station_id?: string;
    limit?: number;
  }): Promise<ObservationRecord[]> {
    const query = new URLSearchParams();
    query.set('mode', (params.mode || 'DEMO').toLowerCase());
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
    mode?: DataMode;
    date?: string;
    pollutant?: string;
    resolution_km?: number;
    min_lat?: number;
    max_lat?: number;
    min_lon?: number;
    max_lon?: number;
  }): Promise<GeoJsonGridCollection> {
    const query = new URLSearchParams();
    query.set('mode', (params.mode || 'DEMO').toLowerCase());
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

  async getPredictionHistory(limit: number = 20, mode?: DataMode): Promise<any[]> {
    const query = new URLSearchParams();
    query.set('limit', limit.toString());
    if (mode) query.set('mode', mode.toLowerCase());
    const res = await fetch(`${API_BASE}/predictions/history?${query.toString()}`);
    return handleResponse(res);
  },

  // Model
  async getModelStatus(mode?: DataMode): Promise<any> {
    const query = mode ? `?mode=${mode.toLowerCase()}` : '';
    const res = await fetch(`${API_BASE}/model/status${query}`);
    return handleResponse(res);
  },

  async getModelMetrics(pollutant: string = 'NO2', mode: DataMode = 'DEMO'): Promise<ModelMetricsResponse> {
    const res = await fetch(`${API_BASE}/model/metrics?pollutant=${pollutant}&mode=${mode.toLowerCase()}`);
    return handleResponse(res);
  },

  async trainModel(params: {
    pollutant: string;
    algorithm: string;
    n_estimators?: number;
    max_depth?: number;
    spatial_cv_folds?: number;
    data_mode?: DataMode;
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
        data_mode: params.data_mode || 'DEMO',
      }),
    });
    return handleResponse(res);
  },
};
