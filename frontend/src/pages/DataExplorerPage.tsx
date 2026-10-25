import React, { useState, useEffect } from 'react';
import {
  Database,
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Table,
  MapPin,
  RefreshCw
} from 'lucide-react';
import { api } from '../services/api';
import type { GroundStation, ObservationRecord, UploadValidationResponse } from '../services/types';

export const DataExplorerPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'stations' | 'observations' | 'upload' | 'datasets'>('stations');
  const [stations, setStations] = useState<GroundStation[]>([]);
  const [observations, setObservations] = useState<ObservationRecord[]>([]);
  const [datasets, setDatasets] = useState<any[]>([]);

  // Filter states
  const [obsPollutant, setObsPollutant] = useState<string>('NO2');
  const [obsLimit, setObsLimit] = useState<number>(50);

  // Upload states
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadResult, setUploadResult] = useState<UploadValidationResponse | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    loadStations();
    loadDatasets();
  }, []);

  useEffect(() => {
    if (activeTab === 'observations') {
      loadObservations();
    }
  }, [activeTab, obsPollutant, obsLimit]);

  async function loadStations() {
    try {
      const data = await api.getStations();
      setStations(data);
    } catch (err) {
      console.error('Failed to load stations:', err);
    }
  }

  async function loadObservations() {
    try {
      setLoading(true);
      const data = await api.getObservations({
        pollutant: obsPollutant,
        limit: obsLimit,
      });
      setObservations(data);
    } catch (err) {
      console.error('Failed to load observations:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadDatasets() {
    try {
      const data = await api.getDatasets();
      setDatasets(data);
    } catch (err) {
      console.error('Failed to load datasets:', err);
    }
  }

  async function handleFileUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadFile) return;

    setUploading(true);
    setUploadError(null);
    setUploadResult(null);

    try {
      const res = await api.uploadDataset(uploadFile);
      setUploadResult(res);
      loadDatasets();
    } catch (err: any) {
      setUploadError(err.message || 'File upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
          <Database className="w-6 h-6 text-cyan-400" />
          <span>Geospatial Data Explorer & Validation Engine</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Inspect ground-station sensor networks, paired spaceborne observation swaths, and validate external air quality datasets.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('stations')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'stations'
              ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <MapPin className="w-3.5 h-3.5" />
          <span>CPCB Ground Stations ({stations.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('observations')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'observations'
              ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Table className="w-3.5 h-3.5" />
          <span>Satellite-Ground Matched Pairs</span>
        </button>

        <button
          onClick={() => setActiveTab('upload')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'upload'
              ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <UploadCloud className="w-3.5 h-3.5" />
          <span>Upload & Validate Dataset</span>
        </button>

        <button
          onClick={() => setActiveTab('datasets')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'datasets'
              ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Registered Datasets ({datasets.length})</span>
        </button>
      </div>

      {/* Tab Content: Ground Stations */}
      {activeTab === 'stations' && (
        <div className="bg-navy-900/80 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <MapPin className="w-4 h-4 text-cyan-400" />
              <span>CPCB Continuous Ambient Air Quality Monitoring Stations (CAAQMS)</span>
            </h2>
            <span className="text-[10px] text-slate-400 font-mono">Region: Delhi-NCR Network</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Station ID</th>
                  <th className="py-2.5 px-3">Station Name</th>
                  <th className="py-2.5 px-3">City</th>
                  <th className="py-2.5 px-3">Coordinates</th>
                  <th className="py-2.5 px-3">Elevation</th>
                  <th className="py-2.5 px-3">Environment Type</th>
                  <th className="py-2.5 px-3">Operational Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                {stations.map((s) => (
                  <tr key={s.station_id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-cyan-400">{s.station_id}</td>
                    <td className="py-2.5 px-3 font-sans text-slate-200 font-medium">{s.name}</td>
                    <td className="py-2.5 px-3 font-sans text-slate-400">{s.city}</td>
                    <td className="py-2.5 px-3 text-slate-300">
                      {s.latitude.toFixed(4)}°N, {s.longitude.toFixed(4)}°E
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">{s.elevation_m} m MSL</td>
                    <td className="py-2.5 px-3 font-sans text-[11px] text-slate-400">{s.station_type}</td>
                    <td className="py-2.5 px-3">
                      <span className="inline-flex items-center gap-1 text-[10px] font-sans px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span>{s.operational_status}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab Content: Observations */}
      {activeTab === 'observations' && (
        <div className="bg-navy-900/80 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400 font-medium">Filter Pollutant:</span>
              <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
                {['NO2', 'PM2.5', 'SO2', 'CO', 'O3'].map((p) => (
                  <button
                    key={p}
                    onClick={() => setObsPollutant(p)}
                    className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                      obsPollutant === p
                        ? 'bg-cyan-500 text-slate-950 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">Row Limit:</span>
              <select
                aria-label="Row Limit"
                value={obsLimit}
                onChange={(e) => setObsLimit(parseInt(e.target.value))}
                className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
              >
                <option value="25">25 rows</option>
                <option value="50">50 rows</option>
                <option value="100">100 rows</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
              <span>Loading observation records...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Station</th>
                    <th className="py-2.5 px-3 text-right">Ground ({obsPollutant})</th>
                    <th className="py-2.5 px-3 text-right">Satellite Column</th>
                    <th className="py-2.5 px-3 text-right">Sat QA</th>
                    <th className="py-2.5 px-3 text-right">BLH (m)</th>
                    <th className="py-2.5 px-3 text-right">Wind (m/s)</th>
                    <th className="py-2.5 px-3 text-right">Temp (°C)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                  {observations.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-2.5 px-3 text-slate-400">{row.date}</td>
                      <td className="py-2.5 px-3 font-sans text-slate-200 font-medium truncate max-w-xs">
                        {row.station_name}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-cyan-400">
                        {row.ground_value} {row.unit}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-200">{row.satellite_column}</td>
                      <td className="py-2.5 px-3 text-right">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${row.satellite_qa >= 0.5 ? 'text-emerald-400 bg-emerald-950/40' : 'text-amber-400 bg-amber-950/40'}`}>
                          {row.satellite_qa}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-400">{row.boundary_layer_height_m}</td>
                      <td className="py-2.5 px-3 text-right text-slate-400">{row.wind_speed_ms}</td>
                      <td className="py-2.5 px-3 text-right text-slate-400">{row.temperature_c}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Upload & Validate */}
      {activeTab === 'upload' && (
        <div className="space-y-6">
          <form onSubmit={handleFileUpload} className="bg-navy-900/80 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <UploadCloud className="w-4 h-4 text-cyan-400" />
              <span>Dataset Upload & Automated Schema Validator</span>
            </h2>
            <p className="text-xs text-slate-400">
              Upload a comma-separated value (.csv) or GeoJSON (.json, .geojson) dataset. The validation engine verifies 
              WGS84 coordinate boundaries, detects pollutant columns, counts missing values, and checks row volume before acceptance.
            </p>

            <div className="border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-xl p-8 text-center space-y-3 bg-slate-950/50">
              <input
                aria-label="Upload Dataset File"
                type="file"
                accept=".csv,.json,.geojson"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                className="hidden"
                id="file-upload-input"
              />
              <label htmlFor="file-upload-input" className="cursor-pointer block space-y-2">
                <UploadCloud className="w-8 h-8 text-cyan-400 mx-auto" />
                <div className="text-xs font-semibold text-slate-200">
                  {uploadFile ? uploadFile.name : 'Click to select CSV or GeoJSON dataset'}
                </div>
                <div className="text-[10px] text-slate-500 font-mono">Maximum size: 15 MB | EPSG:4326 Datum</div>
              </label>
            </div>

            {uploadError && (
              <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={!uploadFile || uploading}
              className="px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {uploading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Validating Dataset Schema...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Upload & Run Validation</span>
                </>
              )}
            </button>
          </form>

          {/* Upload Validation Report */}
          {uploadResult && (
            <div className="bg-navy-900/80 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl animate-fadeIn">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  {uploadResult.is_valid ? (
                    <span className="p-1 rounded bg-emerald-500/20 text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                    </span>
                  ) : (
                    <span className="p-1 rounded bg-rose-500/20 text-rose-400">
                      <AlertTriangle className="w-4 h-4" />
                    </span>
                  )}
                  <h3 className="text-sm font-bold text-white">
                    Validation Report: {uploadResult.filename}
                  </h3>
                </div>
                <span className={`text-xs font-mono px-2 py-0.5 rounded border ${uploadResult.is_valid ? 'bg-emerald-950 text-emerald-400 border-emerald-800' : 'bg-rose-950 text-rose-400 border-rose-800'}`}>
                  {uploadResult.is_valid ? 'SCHEMA VALIDATED' : 'VALIDATION WARNINGS'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-850">
                  <span className="text-slate-400">Total Rows</span>
                  <div className="text-base font-bold text-white font-mono">{uploadResult.row_count}</div>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-850">
                  <span className="text-slate-400">Pollutant Detected</span>
                  <div className="text-base font-bold text-cyan-400 font-mono">
                    {uploadResult.pollutant_detected || 'None (Generic)'}
                  </div>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-850">
                  <span className="text-slate-400">Latitude Extent</span>
                  <div className="text-[11px] font-mono text-slate-200">
                    [{uploadResult.coordinate_bounds.min_lat}° to {uploadResult.coordinate_bounds.max_lat}°]
                  </div>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-850">
                  <span className="text-slate-400">Longitude Extent</span>
                  <div className="text-[11px] font-mono text-slate-200">
                    [{uploadResult.coordinate_bounds.min_lon}° to {uploadResult.coordinate_bounds.max_lon}°]
                  </div>
                </div>
              </div>

              {uploadResult.validation_messages.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-slate-300">Validation Messages & Notices:</span>
                  <ul className="space-y-1 text-xs text-amber-300">
                    {uploadResult.validation_messages.map((msg, i) => (
                      <li key={i} className="flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-amber-400" />
                        <span>{msg}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Preview Rows */}
              {uploadResult.preview_rows.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <span className="text-xs font-semibold text-slate-300">Data Sample Preview:</span>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11px] font-mono">
                      <thead className="bg-slate-950 text-slate-400">
                        <tr>
                          {uploadResult.columns.map((c) => (
                            <th key={c} className="py-1.5 px-2 border-b border-slate-800">{c}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850 text-slate-300">
                        {uploadResult.preview_rows.map((r, idx) => (
                          <tr key={idx}>
                            {uploadResult.columns.map((c) => (
                              <td key={c} className="py-1 px-2">{String(r[c] ?? '')}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Registered Datasets */}
      {activeTab === 'datasets' && (
        <div className="bg-navy-900/80 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-400" />
              <span>Registered Environmental Datasets in Workspace</span>
            </h2>
            <button onClick={loadDatasets} className="text-xs text-cyan-400 hover:text-cyan-300">
              Refresh List
            </button>
          </div>

          <div className="space-y-3">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <div className="font-semibold text-slate-200 text-xs">
                  synthetic_sentinel5p_cpcb_pairs.csv (Baseline Training Corpus)
                </div>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                  120 Days × 15 Ground Stations × 5 Criteria Pollutants = 9,000 Paired Records
                </div>
              </div>
              <span className="text-[10px] font-mono text-cyan-400 px-2.5 py-1 rounded bg-cyan-950 border border-cyan-800/40">
                ACTIVE TRAINING
              </span>
            </div>

            {datasets.map((d) => (
              <div key={d.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-200 text-xs">{d.filename}</div>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                    {d.row_count} rows | Uploaded {d.uploaded_at.slice(0, 10)} | Pollutant: {d.pollutant || 'Multi'}
                  </div>
                </div>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${d.is_valid ? 'text-emerald-400 border-emerald-800/60 bg-emerald-950/30' : 'text-amber-400 border-amber-800/60 bg-amber-950/30'}`}>
                  {d.is_valid ? 'VALIDATED' : 'FLAGGED'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
