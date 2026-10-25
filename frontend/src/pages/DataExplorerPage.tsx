import React, { useState, useEffect } from 'react';
import {
  Database,
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Table,
  MapPin,
  RefreshCw,
  Radio,
  Search,
  ExternalLink,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { api } from '../services/api';
import type {
  GroundStation,
  ObservationRecord,
  UploadValidationResponse,
  ConnectorStatusItem,
  Sentinel5PProductItem,
  DataMode
} from '../services/types';

interface DataExplorerPageProps {
  dataMode: DataMode;
  onToggleMode: (mode: DataMode) => void;
}

export const DataExplorerPage: React.FC<DataExplorerPageProps> = ({ dataMode, onToggleMode }) => {
  const [activeTab, setActiveTab] = useState<'observations' | 'connectors' | 'stations' | 'upload' | 'datasets'>('observations');
  const [stations, setStations] = useState<GroundStation[]>([]);
  const [observations, setObservations] = useState<ObservationRecord[]>([]);
  const [connectors, setConnectors] = useState<ConnectorStatusItem[]>([]);
  const [datasets, setDatasets] = useState<any[]>([]);

  // Filter states
  const [obsPollutant, setObsPollutant] = useState<string>('NO2');
  const [obsLimit, setObsLimit] = useState<number>(50);

  // Sentinel-5P live query state
  const [cdsePollutant, setCdsePollutant] = useState<string>('NO2');
  const [cdseStartDate, setCdseStartDate] = useState<string>('2024-01-01');
  const [cdseEndDate, setCdseEndDate] = useState<string>('2024-01-10');
  const [cdseLoading, setCdseLoading] = useState<boolean>(false);
  const [cdseResults, setCdseResults] = useState<Sentinel5PProductItem[]>([]);
  const [cdseError, setCdseError] = useState<string | null>(null);

  // Ingestion state
  const [ingesting, setIngesting] = useState<boolean>(false);
  const [ingestMessage, setIngestMessage] = useState<string | null>(null);

  // Upload states
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadResult, setUploadResult] = useState<UploadValidationResponse | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [loading, setLoading] = useState<boolean>(false);

  const isReal = dataMode === 'REAL';

  useEffect(() => {
    loadConnectors();
    loadStations();
    loadDatasets();
  }, [dataMode]);

  useEffect(() => {
    if (activeTab === 'observations') {
      loadObservations();
    }
  }, [activeTab, obsPollutant, obsLimit, dataMode]);

  async function loadConnectors() {
    try {
      const res = await api.getConnectorsStatus();
      setConnectors(res.connectors);
    } catch (err) {
      console.error('Failed to load connector statuses:', err);
    }
  }

  async function loadStations() {
    try {
      const data = await api.getStations(dataMode);
      setStations(data);
    } catch (err) {
      console.error('Failed to load stations:', err);
    }
  }

  async function loadObservations() {
    try {
      setLoading(true);
      const data = await api.getObservations({
        mode: dataMode,
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

  async function handleQueryCDSE(e: React.FormEvent) {
    e.preventDefault();
    setCdseLoading(true);
    setCdseError(null);
    try {
      const res = await api.querySentinel5PCatalogue({
        pollutant: cdsePollutant,
        start_date: cdseStartDate,
        end_date: cdseEndDate,
        min_lat: 28.30,
        max_lat: 28.88,
        min_lon: 76.90,
        max_lon: 77.45,
        top: 5
      });
      setCdseResults(res.products);
      loadConnectors();
    } catch (err: any) {
      setCdseError(err.message || 'CDSE catalogue query failed');
    } finally {
      setCdseLoading(false);
    }
  }

  async function handleTriggerIngestion() {
    setIngesting(true);
    setIngestMessage(null);
    try {
      const res = await api.triggerRealDataIngestion();
      setIngestMessage(`Ingestion successful: ${res.inserted_count} real observations verified in SQLite.`);
      loadObservations();
      loadConnectors();
    } catch (err: any) {
      setIngestMessage(`Ingestion error: ${err.message}`);
    } finally {
      setIngesting(false);
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
      {/* Header with Mode Status */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Database className="w-6 h-6 text-cyan-400" />
            <span>Geospatial Data Explorer & Verified Ingestion Engine</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Audit ground sensors, execute live spaceborne OData granule discovery, and inspect scientifically matched observations.
          </p>
        </div>

        {/* Real / Demo Toggle Pill */}
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs self-start md:self-auto">
          <span className="text-[11px] text-slate-400 px-2 font-medium">Data Mode:</span>
          <button
            onClick={() => onToggleMode('REAL')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-bold transition-all ${
              isReal
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isReal ? 'bg-emerald-200 animate-pulse' : 'bg-slate-500'}`} />
            REAL DATA
          </button>
          <button
            onClick={() => onToggleMode('DEMO')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-bold transition-all ${
              !isReal
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${!isReal ? 'bg-amber-200' : 'bg-slate-500'}`} />
            DEMO
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('observations')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'observations'
              ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Table className="w-3.5 h-3.5" />
          <span>Matched Observation Records ({observations.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('connectors')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'connectors'
              ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Radio className="w-3.5 h-3.5" />
          <span>Live Connectors & Granule Discovery ({connectors.length})</span>
        </button>

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
          onClick={() => setActiveTab('upload')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'upload'
              ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <UploadCloud className="w-3.5 h-3.5" />
          <span>Upload CPCB / Dataset</span>
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

            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400 font-medium">Mode:</span>
              <span className={`px-2.5 py-1 rounded text-xs font-mono font-bold border ${
                isReal ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800' : 'bg-amber-950/60 text-amber-400 border-amber-800'
              }`}>
                {dataMode}
              </span>

              <span className="text-xs text-slate-400 font-medium ml-2">Row Limit:</span>
              <select
                aria-label="Row Limit"
                value={obsLimit}
                onChange={(e) => setObsLimit(parseInt(e.target.value))}
                className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
              >
                <option value="25">25 rows</option>
                <option value="50">50 rows</option>
                <option value="100">100 rows</option>
                <option value="200">200 rows</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
              <span>Loading observation records...</span>
            </div>
          ) : observations.length === 0 ? (
            <div className="py-16 text-center space-y-4 max-w-lg mx-auto">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                NO VERIFIED REAL DATA AVAILABLE
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                No verified real observations currently match the selected filter. 
                Trigger live ingestion from Copernicus Atmosphere (CAMS) or upload an official CPCB CSV.
              </p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={handleTriggerIngestion}
                  disabled={ingesting}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>{ingesting ? 'Ingesting...' : 'Ingest Verified Observations'}</span>
                </button>
                <button
                  onClick={() => onToggleMode('DEMO')}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs"
                >
                  Switch to Demo Mode
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Date / Time (UTC)</th>
                    <th className="py-2.5 px-3">Station</th>
                    <th className="py-2.5 px-3 text-right">Ground ({obsPollutant})</th>
                    <th className="py-2.5 px-3 text-right">Satellite Column</th>
                    <th className="py-2.5 px-3 text-right">Sat QA</th>
                    <th className="py-2.5 px-3 text-right">BLH (m)</th>
                    <th className="py-2.5 px-3 text-right">Wind (m/s)</th>
                    <th className="py-2.5 px-3 text-right">Temp (°C)</th>
                    <th className="py-2.5 px-3">Source Provenance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                  {observations.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-2.5 px-3 text-slate-400">{row.observation_time || row.date}</td>
                      <td className="py-2.5 px-3 font-sans text-slate-200 font-medium truncate max-w-xs">
                        {row.station_name}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-cyan-400">
                        {row.ground_value} {row.unit}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-200">
                        {row.satellite_column !== null ? row.satellite_column : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                          row.satellite_qa && row.satellite_qa >= 0.5 ? 'text-emerald-400 bg-emerald-950/40' : 'text-amber-400 bg-amber-950/40'
                        }`}>
                          {row.satellite_qa !== null ? row.satellite_qa : '—'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-400">{row.boundary_layer_height_m || '—'}</td>
                      <td className="py-2.5 px-3 text-right text-slate-400">{row.wind_speed_ms || '—'}</td>
                      <td className="py-2.5 px-3 text-right text-slate-400">{row.temperature_c || '—'}</td>
                      <td className="py-2.5 px-3 font-sans text-[11px]">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono border ${
                          row.data_mode === 'REAL'
                            ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60'
                            : 'bg-amber-950/40 text-amber-300 border-amber-800/60'
                        }`}>
                          <span>{row.data_mode}</span>
                          <span>•</span>
                          <span className="truncate max-w-[140px]">{row.source_name}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Connectors & Granule Discovery */}
      {activeTab === 'connectors' && (
        <div className="space-y-6">
          {/* Connector Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {connectors.map((c) => {
              const isVerified = c.status === 'VERIFIED';
              const isBlocked = c.status === 'BLOCKED';
              return (
                <div
                  key={c.connector_id}
                  className={`bg-navy-900/80 border rounded-2xl p-5 space-y-3 shadow-xl transition-all ${
                    isVerified ? 'border-emerald-500/30' : isBlocked ? 'border-amber-500/30' : 'border-rose-500/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                        {c.category} connector
                      </span>
                      <h3 className="text-sm font-bold text-white mt-0.5">{c.name}</h3>
                    </div>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase font-bold flex items-center gap-1 ${
                        isVerified
                          ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800'
                          : isBlocked
                          ? 'bg-amber-950/80 text-amber-400 border-amber-800'
                          : 'bg-rose-950/80 text-rose-400 border-rose-800'
                      }`}
                    >
                      {isVerified ? (
                        <ShieldCheck className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <AlertTriangle className="w-3 h-3 text-amber-400" />
                      )}
                      <span>{c.status}</span>
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">{c.notes}</p>

                  <div className="pt-2 border-t border-slate-800 text-[11px] font-mono text-slate-400 space-y-1">
                    <div className="flex justify-between">
                      <span>Verified Records:</span>
                      <span className="text-white font-bold">{c.record_count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Auth Required:</span>
                      <span className={c.auth_required ? 'text-amber-400' : 'text-emerald-400'}>
                        {c.auth_required ? (c.auth_configured ? 'Configured' : 'Missing Key') : 'None (Open)'}
                      </span>
                    </div>
                    <div className="flex justify-between truncate">
                      <span>Endpoint:</span>
                      <span className="text-slate-300 truncate max-w-[170px]" title={c.endpoint_url}>
                        {c.endpoint_url}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Interactive ESA Copernicus CDSE Sentinel-5P Granule Query */}
          <div className="bg-navy-900/80 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Search className="w-4 h-4 text-cyan-400" />
                  <span>Live Copernicus Data Space (CDSE) Sentinel-5P Granule Explorer</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Execute live spatial OData queries to discover authentic Sentinel-5P Level-2 granules over Delhi-NCR.
                </p>
              </div>

              <a
                href="https://catalogue.dataspace.copernicus.eu"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-mono"
              >
                <span>CDSE Portal</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <form onSubmit={handleQueryCDSE} className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Target Pollutant Product</label>
                <select
                  value={cdsePollutant}
                  onChange={(e) => setCdsePollutant(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-slate-200 font-mono"
                >
                  <option value="NO2">NO2 (Tropospheric Column)</option>
                  <option value="PM2.5">Aerosol Index / Optical Depth (PM2.5)</option>
                  <option value="CO">CO (Carbon Monoxide)</option>
                  <option value="SO2">SO2 (Sulfur Dioxide)</option>
                  <option value="O3">O3 (Tropospheric Ozone)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Start Date</label>
                <input
                  type="date"
                  value={cdseStartDate}
                  onChange={(e) => setCdseStartDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">End Date</label>
                <input
                  type="date"
                  value={cdseEndDate}
                  onChange={(e) => setCdseEndDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200 font-mono"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={cdseLoading}
                  className="w-full py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {cdseLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  <span>{cdseLoading ? 'Querying CDSE...' : 'Live Search CDSE'}</span>
                </button>
              </div>
            </form>

            {cdseError && (
              <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs">
                {cdseError}
              </div>
            )}

            {cdseResults.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <span className="text-xs font-semibold text-slate-300">
                  Retrieved ESA Sentinel-5P Granules ({cdseResults.length}):
                </span>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px] font-mono">
                    <thead className="bg-slate-950 text-slate-400">
                      <tr>
                        <th className="py-1.5 px-2">Granule Name</th>
                        <th className="py-1.5 px-2">Acquisition Window</th>
                        <th className="py-1.5 px-2 text-right">Size</th>
                        <th className="py-1.5 px-2">Product ID</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850 text-slate-300">
                      {cdseResults.map((p) => (
                        <tr key={p.product_id} className="hover:bg-slate-900/40">
                          <td className="py-1.5 px-2 text-cyan-400 truncate max-w-sm" title={p.granule_name}>
                            {p.granule_name}
                          </td>
                          <td className="py-1.5 px-2 text-slate-400">
                            {p.acquisition_start ? p.acquisition_start.slice(0, 19).replace('T', ' ') : '—'}
                          </td>
                          <td className="py-1.5 px-2 text-right text-slate-300">
                            {(p.content_length_bytes / (1024 * 1024)).toFixed(1)} MB
                          </td>
                          <td className="py-1.5 px-2 text-slate-400 text-[10px] truncate max-w-xs">
                            {p.product_id}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Ingestion Trigger Button */}
            <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-400">
                {ingestMessage && <span className="text-emerald-400 font-medium">{ingestMessage}</span>}
              </div>
              <button
                onClick={handleTriggerIngestion}
                disabled={ingesting}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>{ingesting ? 'Ingesting Real Data...' : 'Re-Seed Verified Observations into Database'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Tab Content: Upload & Validate */}
      {activeTab === 'upload' && (
        <div className="space-y-6">
          <form onSubmit={handleFileUpload} className="bg-navy-900/80 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <UploadCloud className="w-4 h-4 text-cyan-400" />
              <span>Official CPCB CAAQMS CSV Importer & Validator</span>
            </h2>
            <p className="text-xs text-slate-400">
              Upload an official CPCB station report downloaded from{' '}
              <a href="https://app.cpcbccr.com/ccr/" target="_blank" rel="noreferrer" className="text-cyan-400 underline">
                app.cpcbccr.com/ccr
              </a>{' '}
              or generic CSV. The validator resolves station coordinates, verifies date formats, excludes negative values, and tags genuine observations with <code className="text-emerald-400 bg-slate-950 px-1 py-0.5 rounded">data_mode=REAL</code>.
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
                <div className="text-[10px] text-slate-500 font-mono">Maximum size: 15 MB | Standardized CPCB CCR Schema</div>
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
                  <span>Validating & Importing Records...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Import & Validate Genuine Records</span>
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
            <div className="p-4 rounded-xl bg-slate-950 border border-emerald-800/40 flex items-center justify-between">
              <div>
                <div className="font-semibold text-emerald-300 text-xs flex items-center gap-2">
                  <span>SQLite Verified Observations Table (Real Corpus)</span>
                  <span className="text-[10px] bg-emerald-950 text-emerald-400 px-1.5 py-0.2 rounded font-mono">
                    data_mode = REAL
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                  Verified observations from Copernicus CAMS & Open-Meteo ERA5 across Delhi CAAQMS Stations
                </div>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 px-2.5 py-1 rounded bg-emerald-950 border border-emerald-800/60 font-bold">
                REAL ACTIVE
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <div className="font-semibold text-slate-200 text-xs flex items-center gap-2">
                  <span>synthetic_sentinel5p_cpcb_pairs.csv (Demo Corpus)</span>
                  <span className="text-[10px] bg-amber-950 text-amber-400 px-1.5 py-0.2 rounded font-mono">
                    data_mode = DEMO
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                  Calibrated synthetic demonstration dataset (200 records, Delhi-NCR)
                </div>
              </div>
              <span className="text-[10px] font-mono text-amber-400 px-2.5 py-1 rounded bg-amber-950 border border-amber-800/40">
                DEMO BACKUP
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
