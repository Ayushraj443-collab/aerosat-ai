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
  Zap,
  Key,
  Lock,
  Globe,
  Info
} from 'lucide-react';
import { api } from '../services/api';
import type {
  GroundStation,
  ObservationRecord,
  UploadValidationResponse,
  ConnectorStatusItem,
  Sentinel5PProductItem,
  CopernicusAuthTestResponse,
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
  const [provenanceSummary, setProvenanceSummary] = useState<any>(null);
  const [ingestionReport, setIngestionReport] = useState<any>(null);

  // Filter states
  const [obsPollutant, setObsPollutant] = useState<string>('NO2');
  const [obsDate, setObsDate] = useState<string>('');
  const [obsProvenanceType, setObsProvenanceType] = useState<string>('ALL');
  const [obsLimit, setObsLimit] = useState<number>(50);

  // Copernicus OAuth Diagnostic State
  const [authDiag, setAuthDiag] = useState<CopernicusAuthTestResponse | null>(null);
  const [testingAuth, setTestingAuth] = useState<boolean>(false);

  // Sentinel-5P Pixel Sampling State
  const [pixelLat, setPixelLat] = useState<number>(28.6476);
  const [pixelLon, setPixelLon] = useState<number>(77.3158);
  const [pixelDate, setPixelDate] = useState<string>('2024-01-05');
  const [pixelPollutant, setPixelPollutant] = useState<string>('NO2');
  const [samplingPixel, setSamplingPixel] = useState<boolean>(false);
  const [pixelResult, setPixelResult] = useState<any>(null);

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
    loadProvenanceSummary();
    loadIngestionReport();
  }, [dataMode]);

  useEffect(() => {
    if (activeTab === 'observations') {
      loadObservations();
      loadProvenanceSummary();
    } else if (activeTab === 'connectors') {
      loadIngestionReport();
    }
  }, [activeTab, obsPollutant, obsDate, obsLimit, obsProvenanceType, dataMode]);

  async function loadProvenanceSummary() {
    try {
      const res = await api.getProvenanceSummary(dataMode);
      setProvenanceSummary(res.summary);
    } catch (err) {
      console.error('Failed to load provenance summary:', err);
    }
  }

  async function loadIngestionReport() {
    try {
      const res = await api.getSatelliteIngestionReport();
      setIngestionReport(res);
    } catch (err) {
      console.error('Failed to load ingestion report:', err);
    }
  }

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
      const isMatched = obsProvenanceType === 'VERIFIED_COLLOCATION';
      const obsTypeParam = obsProvenanceType === 'ALL' ? undefined : obsProvenanceType;
      const data = await api.getObservations({
        mode: dataMode,
        date: obsDate || undefined,
        pollutant: obsPollutant,
        observation_type: obsTypeParam,
        matched_only: obsProvenanceType === 'ALL' ? false : isMatched,
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

  async function handleTestAuth() {
    setTestingAuth(true);
    try {
      const res = await api.testCopernicusAuth();
      setAuthDiag(res);
      loadConnectors();
    } catch (err: any) {
      setAuthDiag({
        credentials_configured: false,
        token_request: 'FAILURE',
        auth_provider: 'auto',
        http_status: null,
        error_category: 'NETWORK_ERROR',
        timestamp: new Date().toISOString(),
        details: err.message || 'Diagnostic request failed'
      });
    } finally {
      setTestingAuth(false);
    }
  }

  async function handleSamplePixel(e: React.FormEvent) {
    e.preventDefault();
    setSamplingPixel(true);
    setPixelResult(null);
    try {
      const res = await api.fetchSentinel5PObservation({
        latitude: pixelLat,
        longitude: pixelLon,
        date: pixelDate,
        pollutant: pixelPollutant
      });
      setPixelResult(res);
    } catch (err: any) {
      setPixelResult({ status: 'ERROR', message: err.message || 'Failed to query pixel' });
    } finally {
      setSamplingPixel(false);
    }
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header with Mode Status */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Database className="w-6 h-6 text-cyan-400" />
            <span>Sentinel-5P Satellite & CPCB Ground Observations</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Official P19 Dataset Repository: Spaceborne tropospheric NO₂ columns paired with continuous ambient CPCB monitoring stations.
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
            <div className="flex flex-wrap items-center gap-3">
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

          {/* Dynamic Database Provenance Accounting Strip */}
          {isReal && provenanceSummary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/80 border border-slate-800 p-3.5 rounded-xl font-mono text-xs shadow-inner">
              <div className="space-y-0.5">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Verified Collocations</span>
                <span className="text-base font-bold text-emerald-400">{provenanceSummary.verified_collocations_count}</span>
                <span className="text-[10px] text-slate-500 block">S5P L2 + CPCB Pairs</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">CPCB Ground Monitors</span>
                <span className="text-base font-bold text-cyan-400">{provenanceSummary.ground_monitors_count}</span>
                <span className="text-[10px] text-slate-500 block">In-situ Reference</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">CAMS Reanalyses</span>
                <span className="text-base font-bold text-teal-400">{provenanceSummary.cams_reanalysis_count}</span>
                <span className="text-[10px] text-slate-500 block">Atmospheric Model</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Raw L2 Granules</span>
                <span className="text-base font-bold text-amber-300">{ingestionReport?.total_granules_in_archive ?? 6}</span>
                <span className="text-[10px] text-slate-500 block">{ingestionReport?.total_archive_size_mb ? `${ingestionReport.total_archive_size_mb} MB Archive` : '>3.65 GB NetCDF'}</span>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Date:</span>
            <select
              aria-label="Filter Observation Date"
              value={obsDate}
              onChange={(e) => setObsDate(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
            >
              <option value="">All Matched Dates</option>
              <option value="2024-01-01">2024-01-01 (Winter Orbit 32219)</option>
              <option value="2024-01-03">2024-01-03 (Winter Orbit 32247)</option>
              <option value="2024-01-05">2024-01-05 (Winter Orbit 32275)</option>
              <option value="2024-01-07">2024-01-07 (Winter Orbit 32304)</option>
              <option value="2024-01-10">2024-01-10 (Winter Orbit 32349)</option>
              <option value="2024-05-20">2024-05-20 (Summer Orbit 34205)</option>
            </select>
            {obsDate && (
              <button
                onClick={() => setObsDate('')}
                className="text-[10px] text-cyan-400 hover:text-cyan-300 font-mono underline"
              >
                Clear
              </button>
            )}
          </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">Type:</span>
                <select
                  aria-label="Filter Observation Type"
                  value={obsProvenanceType}
                  onChange={(e) => setObsProvenanceType(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
                >
                  <option value="ALL">All Provenance Types</option>
                  <option value="VERIFIED_COLLOCATION">Verified S5P-CPCB Collocations</option>
                  <option value="GROUND_MONITOR">CPCB Ground Monitors</option>
                  <option value="CAMS_REANALYSIS">CAMS Reanalysis Model</option>
                  <option value="DIRECT_SATELLITE">Direct Satellite Observations</option>
                </select>
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
                NO VERIFIED MATCHED OBSERVATIONS AVAILABLE
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                No genuine satellite-ground matched observations match the selected filter ({obsPollutant}{obsDate ? `, ${obsDate}` : ''}).
                {isReal && obsPollutant !== 'NO2'
                  ? ' Sentinel-5P Level-2 granules in this project are configured for NO2 tropospheric column matching.'
                  : ' Select NO2 or an available Sentinel-5P overpass date (e.g. 2024-01-01) to view matched records.'}
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
            <div className="space-y-3">
              {/* Scientific Unit Distinction Notice */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-300 flex items-start gap-3 shadow-inner">
                <Info className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <div className="font-semibold text-white flex items-center gap-2">
                    <span>Measurement Unit Distinction & Modeling Methodology</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/60">
                      P19 Requirement
                    </span>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    <strong>Sentinel-5P/TROPOMI</strong> measures total atmospheric column density (<code className="text-cyan-300">10¹⁵ molec/cm²</code> or <code className="text-cyan-300">µmol/m²</code>) vertically integrated from surface to top-of-atmosphere. 
                    In contrast, <strong>CPCB ground stations</strong> measure near-surface ambient breathing concentration (<code className="text-emerald-300">µg/m³</code>). 
                    These are physically distinct quantities that cannot be compared directly as identical units; the spatial AI model bridges them by fusing column density with boundary layer height, wind ventilation, and topography.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Date / Time (UTC)</th>
                      <th className="py-2.5 px-3">Station</th>
                      <th className="py-2.5 px-3 text-right">Ground Level (µg/m³)</th>
                      <th className="py-2.5 px-3 text-right">Satellite Column (10¹⁵ molec/cm²)</th>
                      <th className="py-2.5 px-3 text-right">Sat QA</th>
                      <th className="py-2.5 px-3 text-right">BLH (m)</th>
                      <th className="py-2.5 px-3 text-right">Wind (m/s)</th>
                      <th className="py-2.5 px-3 text-right">Temp (°C)</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Source Provenance</th>
                    </tr>
                  </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                  {observations.map((row, idx) => {
                    const oType = row.observation_type || (row.satellite_column && row.ground_value ? 'VERIFIED_COLLOCATION' : 'GROUND_MONITOR');
                    return (
                    <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-2.5 px-3 text-slate-400">{row.observation_time || row.date}</td>
                      <td className="py-2.5 px-3 font-sans text-slate-200 font-medium truncate max-w-xs">
                        {row.station_name}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-cyan-400">
                        {row.ground_value} {row.unit}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-200">
                        {row.satellite_column !== null && row.satellite_column !== undefined && Number(row.satellite_column) > 0
                          ? Number(row.satellite_column).toFixed(4)
                          : 'N/A'}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                          row.satellite_qa !== null && row.satellite_qa !== undefined && Number(row.satellite_qa) >= 0.5
                            ? 'text-emerald-400 bg-emerald-950/40'
                            : row.satellite_qa !== null && row.satellite_qa !== undefined && Number(row.satellite_qa) > 0
                            ? 'text-amber-400 bg-amber-950/40'
                            : 'text-slate-400 bg-slate-900/40'
                        }`}>
                          {row.satellite_qa !== null && row.satellite_qa !== undefined && Number(row.satellite_qa) > 0
                            ? Number(row.satellite_qa).toFixed(2)
                            : 'N/A'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-400">{row.boundary_layer_height_m || '—'}</td>
                      <td className="py-2.5 px-3 text-right text-slate-400">{row.wind_speed_ms || '—'}</td>
                      <td className="py-2.5 px-3 text-right text-slate-400">{row.temperature_c || '—'}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                          oType === 'VERIFIED_COLLOCATION'
                            ? 'bg-emerald-950/50 text-emerald-300 border-emerald-800'
                            : oType === 'CAMS_REANALYSIS'
                            ? 'bg-purple-950/50 text-purple-300 border-purple-800'
                            : oType === 'DIRECT_SATELLITE'
                            ? 'bg-cyan-950/50 text-cyan-300 border-cyan-800'
                            : oType === 'SYNTHETIC_DEMO'
                            ? 'bg-amber-950/50 text-amber-300 border-amber-800'
                            : 'bg-blue-950/50 text-blue-300 border-blue-800'
                        }`}>
                          {oType === 'VERIFIED_COLLOCATION' ? 'S5P-CPCB Match' :
                           oType === 'CAMS_REANALYSIS' ? 'CAMS Model' :
                           oType === 'DIRECT_SATELLITE' ? 'Direct S5P' :
                           oType === 'SYNTHETIC_DEMO' ? 'Synthetic' : 'Ground Monitor'}
                        </span>
                      </td>
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
                    );
                  })}
                </tbody>
              </table>
            </div>
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

          {/* Copernicus Authentication & Diagnostic Card */}
          <div className="bg-navy-900/90 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Key className="w-4 h-4 text-cyan-400" />
                  <span>Copernicus Sentinel Hub / CDSE OAuth Authentication</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Secure backend-only client credentials authentication for real Sentinel-5P TROPOMI data access. Secrets are never exposed.
                </p>
              </div>

              <button
                onClick={handleTestAuth}
                disabled={testingAuth}
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 flex items-center gap-2 flex-shrink-0"
              >
                {testingAuth ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                <span>{testingAuth ? 'Testing OAuth...' : 'Test Copernicus Auth'}</span>
              </button>
            </div>

            {authDiag ? (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 font-mono text-xs">
                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 block uppercase">Credentials In .env</span>
                  <span className={`font-bold px-2 py-0.5 rounded text-[11px] inline-block ${
                    authDiag.credentials_configured ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800' : 'bg-amber-950/80 text-amber-400 border border-amber-800'
                  }`}>
                    {authDiag.credentials_configured ? 'CONFIGURED' : 'NOT CONFIGURED'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 block uppercase">OAuth Token Request</span>
                  <span className={`font-bold px-2 py-0.5 rounded text-[11px] inline-block ${
                    authDiag.token_request === 'SUCCESS' ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800' : authDiag.token_request === 'NOT_CONFIGURED' ? 'bg-slate-800 text-slate-300' : 'bg-rose-950/80 text-rose-400 border border-rose-800'
                  }`}>
                    {authDiag.token_request}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 block uppercase">HTTP Status / Error</span>
                  <span className="font-bold text-slate-200">
                    {authDiag.http_status ? `HTTP ${authDiag.http_status}` : '—'}{' '}
                    {authDiag.error_category && <span className="text-rose-400 text-[10px]">({authDiag.error_category})</span>}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                  <span className="text-[10px] text-slate-400 block uppercase">Auth Provider</span>
                  <span className="text-cyan-400 font-bold truncate block">{authDiag.auth_provider}</span>
                </div>

                <div className="md:col-span-4 p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-xs text-slate-300 flex items-start gap-2">
                  <Lock className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-sans">{authDiag.details}</p>
                    <span className="text-[10px] text-slate-500 font-mono">Diagnostic Timestamp: {authDiag.timestamp}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-slate-500" />
                  <span>Click <strong>Test Copernicus Auth</strong> to probe Copernicus Sentinel Hub OAuth endpoints live.</span>
                </div>
                <span className="text-[10px] font-mono text-slate-500">Safe Test — Never Logs Secrets</span>
              </div>
            )}

            {/* Beginner-friendly local credentials setup guide */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2 text-xs">
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                <Lock className="w-3.5 h-3.5 text-cyan-400" />
                <span>How to configure your Copernicus credentials locally</span>
              </span>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Open <code className="text-cyan-300 bg-slate-900 px-1 py-0.5 rounded font-mono">backend/.env</code> in your local editor and paste your Sentinel Hub OAuth client credentials:
              </p>
              <pre className="bg-slate-950 p-2.5 rounded-lg border border-slate-800/80 text-[11px] font-mono text-cyan-400 overflow-x-auto">
{`COPERNICUS_CLIENT_ID="<your-oauth-client-id>"
COPERNICUS_CLIENT_SECRET="<your-oauth-client-secret>"
COPERNICUS_AUTH_PROVIDER="auto"`}
              </pre>
              <p className="text-[10px] text-slate-500 font-mono">
                * Note: <code className="text-slate-400">backend/.env</code> is ignored by Git and never committed or exposed to the browser.
              </p>
            </div>
          </div>

          {/* Real Sentinel-5P Pixel Sampler */}
          <div className="bg-navy-900/80 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Globe className="w-4 h-4 text-cyan-400" />
                  <span>Sentinel-5P / TROPOMI Pixel Sampler</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Directly retrieve real tropospheric column observations for coordinates and dates via authenticated Sentinel Hub Statistical API.
                </p>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800">
                L2 Pixel Sampling
              </span>
            </div>

            <form onSubmit={handleSamplePixel} className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Latitude</label>
                <input
                  type="number"
                  step="0.0001"
                  value={pixelLat}
                  onChange={(e) => setPixelLat(parseFloat(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Longitude</label>
                <input
                  type="number"
                  step="0.0001"
                  value={pixelLon}
                  onChange={(e) => setPixelLon(parseFloat(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Observation Date</label>
                <input
                  type="date"
                  value={pixelDate}
                  onChange={(e) => setPixelDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Pollutant</label>
                <select
                  value={pixelPollutant}
                  onChange={(e) => setPixelPollutant(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200 font-mono"
                >
                  <option value="NO2">NO2 (Tropospheric Column)</option>
                  <option value="PM2.5">Aerosol Index (PM2.5 Proxy)</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={samplingPixel}
                  className="w-full py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {samplingPixel ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
                  <span>{samplingPixel ? 'Sampling...' : 'Sample Pixel'}</span>
                </button>
              </div>
            </form>

            {pixelResult && (
              <div className={`p-4 rounded-xl border text-xs font-mono space-y-2 ${
                pixelResult.status === 'SUCCESS'
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                  : pixelResult.status === 'BLOCKED'
                  ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                  : 'bg-slate-950 border-slate-800 text-slate-300'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold flex items-center gap-1.5">
                    {pixelResult.status === 'SUCCESS' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-amber-400" />}
                    <span>STATUS: {pixelResult.status}</span>
                  </span>
                  <span className="text-[10px] text-slate-400">{pixelResult.source || 'Sentinel-5P Connector'}</span>
                </div>
                {pixelResult.satellite_column !== undefined && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Measured Column:</span>
                      <span className="font-bold text-cyan-300 text-sm">{pixelResult.satellite_column} {pixelResult.unit}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">QA Flag:</span>
                      <span className="font-bold text-emerald-400">{pixelResult.satellite_qa}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Valid Samples:</span>
                      <span className="text-slate-200">{pixelResult.sample_count}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Observation Time:</span>
                      <span className="text-slate-300">{pixelResult.observation_time}</span>
                    </div>
                  </div>
                )}
                {pixelResult.message && <p className="font-sans text-[11px] text-slate-300">{pixelResult.message}</p>}
                {pixelResult.error && <p className="font-sans text-[11px] text-rose-300">{pixelResult.error}</p>}
              </div>
            )}
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

            {/* Local Verified Level-2 OFFL Archive Panel */}
            {ingestionReport && ingestionReport.granules && (
              <div className="space-y-3 pt-3 border-t border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Local Sentinel-5P OFFL L2 Archive ({ingestionReport.total_granules_in_archive} Granules — {ingestionReport.total_archive_size_mb} MB)</span>
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/70 border border-emerald-800 px-2 py-0.5 rounded">
                    {ingestionReport.verified_collocated_pairs_in_db} Verified Collocations In DB
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px] font-mono">
                    <thead className="bg-slate-950 text-slate-400">
                      <tr>
                        <th className="py-1.5 px-2">NetCDF Granule</th>
                        <th className="py-1.5 px-2">Date</th>
                        <th className="py-1.5 px-2 text-right">Size</th>
                        <th className="py-1.5 px-2">Product & Domain</th>
                        <th className="py-1.5 px-2 text-right">QA Filter</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {ingestionReport.granules.map((g: any, i: number) => (
                        <tr key={i} className="hover:bg-slate-900/40">
                          <td className="py-1.5 px-2 text-cyan-400 truncate max-w-xs" title={g.filename}>
                            {g.filename}
                          </td>
                          <td className="py-1.5 px-2 text-emerald-300 font-semibold">{g.date}</td>
                          <td className="py-1.5 px-2 text-right text-slate-200">{g.size_mb} MB</td>
                          <td className="py-1.5 px-2 text-slate-400 text-[10px] truncate max-w-xs">{g.product}</td>
                          <td className="py-1.5 px-2 text-right text-teal-400">≥ {g.qa_threshold_applied}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="text-[10px] text-slate-400 bg-slate-950/60 border border-slate-800/80 rounded p-2 flex flex-wrap items-center justify-between gap-1">
                  <span><strong>Collocation Tolerance:</strong> ≤ {ingestionReport.collocation_criteria?.max_spatial_distance_km} km | Matching: Afternoon Overpass (~13:30 LST)</span>
                  <span className="text-cyan-400 font-semibold">{ingestionReport.collocation_criteria?.spatial_rationale}</span>
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

            {/* Quick Sample Dataset Reference */}
            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                <span className="text-slate-300">
                  Ready-to-use official sample dataset: <code className="text-cyan-300 bg-slate-900 px-1 py-0.5 rounded font-mono">data/raw/cpcb_caaqms_sample_delhi.csv</code> (22 validated hourly records across Delhi CAAQMS stations).
                </span>
              </div>
              <span className="text-[10px] text-emerald-400 font-mono px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800 flex-shrink-0">
                Official CCR Format
              </span>
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
                <div className="flex items-center gap-2">
                  {uploadResult.already_registered && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                      IDEMPOTENT (ALREADY REGISTERED)
                    </span>
                  )}
                  {uploadResult.source_classification && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-750">
                      {uploadResult.source_classification}
                    </span>
                  )}
                  <span className={`text-xs font-mono px-2 py-0.5 rounded border ${uploadResult.is_valid ? 'bg-emerald-950 text-emerald-400 border-emerald-800' : 'bg-rose-950 text-rose-400 border-rose-800'}`}>
                    {uploadResult.is_valid ? 'SCHEMA VALIDATED' : 'VALIDATION WARNINGS'}
                  </span>
                </div>
              </div>

              {/* Ingestion & Acceptance Counters */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-850">
                  <span className="text-slate-400">Total Raw Rows</span>
                  <div className="text-base font-bold text-white font-mono">{uploadResult.row_count}</div>
                  <span className="text-[10px] text-slate-500 block">Raw CSV lines</span>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-emerald-900/40">
                  <span className="text-emerald-400">Accepted Records</span>
                  <div className="text-base font-bold text-emerald-300 font-mono">
                    {uploadResult.accepted_records_count ?? uploadResult.row_count}
                  </div>
                  <span className="text-[10px] text-emerald-400/70 block">
                    {uploadResult.pollutant_records_breakdown && Object.keys(uploadResult.pollutant_records_breakdown).length > 1
                      ? Object.entries(uploadResult.pollutant_records_breakdown).map(([p, cnt]) => `${cnt} ${p}`).join(', ')
                      : 'Observation records'}
                  </span>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-rose-900/40">
                  <span className="text-rose-400">Rejected Records</span>
                  <div className="text-base font-bold text-rose-300 font-mono">
                    {uploadResult.rejected_records_count ?? 0}
                  </div>
                  <span className="text-[10px] text-slate-500 block">Failed QA checks</span>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-850">
                  <span className="text-slate-400">Duplicates Filtered</span>
                  <div className="text-base font-bold text-amber-300 font-mono">
                    {uploadResult.duplicate_count ?? 0}
                  </div>
                  <span className="text-[10px] text-slate-500 block">Exact station-time dupes</span>
                </div>
              </div>

              {/* Station Coordinate Resolution */}
              {uploadResult.stations_resolved && uploadResult.stations_resolved.length > 0 && (
                <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1.5 text-xs">
                  <div className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
                    <span>Resolved CPCB Stations ({uploadResult.stations_resolved.length}):</span>
                    <span className="text-[10px] text-cyan-400 font-mono">Exact Lat/Lon Lookup</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {uploadResult.stations_resolved.map((stn, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-slate-900 border border-slate-750 text-[10px] text-slate-200 font-mono">
                        {stn}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {uploadResult.unresolved_stations && uploadResult.unresolved_stations.length > 0 && (
                <div className="p-3 bg-rose-950/40 rounded-xl border border-rose-800/60 space-y-1.5 text-xs">
                  <div className="text-[11px] font-semibold text-rose-300">
                    Unresolved Stations (Rejected to prevent coordinate fabrication):
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {uploadResult.unresolved_stations.map((stn, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-rose-900/60 border border-rose-700 text-[10px] text-rose-200 font-mono">
                        {stn}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Spatial Bounds & Pollutant */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-850">
                  <span className="text-slate-400">Pollutant Detected</span>
                  <div className="text-base font-bold text-cyan-400 font-mono">
                    {uploadResult.pollutant_detected || 'None (Generic)'}
                  </div>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-850">
                  <span className="text-slate-400">Date Range</span>
                  <div className="text-[11px] font-mono text-slate-200">
                    {uploadResult.date_range.start ? `${uploadResult.date_range.start.slice(0, 10)} to ${uploadResult.date_range.end.slice(0, 10)}` : 'N/A'}
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

              {/* Detailed Per-Pollutant Breakdown with Counts & Date Ranges */}
              {uploadResult.pollutants_summary && Object.keys(uploadResult.pollutants_summary).length > 0 && (
                <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs">
                  <div className="text-[11px] font-semibold text-slate-300 flex items-center justify-between border-b border-slate-850 pb-1.5">
                    <span className="flex items-center gap-1.5">
                      <Table className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Individual Pollutant Accounting & Date Ranges:</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">Independent Column Verification</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                    {Object.entries(uploadResult.pollutants_summary).map(([pol, info]) => (
                      <div key={pol} className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-cyan-300 font-mono text-sm">{pol}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 font-mono">
                            {info.count} observations
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono space-y-0.5">
                          <div>Date Range: <span className="text-slate-200">{info.date_range.start}{info.date_range.end !== info.date_range.start ? ` to ${info.date_range.end}` : ''}</span></div>
                          {info.min_value !== null && info.max_value !== null && (
                            <div>Observed: <span className="text-slate-200">{info.min_value} – {info.max_value} {info.unit}</span></div>
                          )}
                          <div>Stations: <span className="text-slate-300">{info.stations_count} CAAQMS ({info.stations.slice(0, 3).join(', ')}{info.stations.length > 3 ? '…' : ''})</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Rejection reasons */}
              {uploadResult.rejection_reasons && Object.keys(uploadResult.rejection_reasons).length > 0 && (
                <div className="p-3 bg-amber-950/30 rounded-xl border border-amber-800/40 space-y-1.5 text-xs">
                  <span className="text-xs font-semibold text-amber-300">Rejection Breakdown:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-amber-200">
                    {Object.entries(uploadResult.rejection_reasons).map(([reason, count]) => (
                      <div key={reason} className="flex justify-between border-b border-amber-900/40 pb-0.5">
                        <span className="capitalize">{reason.replace(/_/g, ' ')}:</span>
                        <span className="font-mono font-bold">{count} records</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
              <div key={d.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-200 text-xs">{d.filename}</span>
                    <span className="text-[10px] text-slate-400 font-mono bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                      ID: {d.id}
                    </span>
                    {d.content_hash && (
                      <span className="text-[10px] text-cyan-400/80 font-mono bg-cyan-950/30 px-1.5 py-0.5 rounded border border-cyan-800/40" title={d.content_hash}>
                        sha256:{d.content_hash.slice(0, 10)}…
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    <span className="text-slate-300 font-semibold">{d.raw_rows_count ?? d.row_count}</span> raw rows 
                    {' '}→{' '}
                    <span className="text-emerald-300 font-semibold">{d.accepted_records_count ?? d.row_count}</span> accepted observation records
                    {' '}| Uploaded {d.uploaded_at ? d.uploaded_at.slice(0, 10) : 'N/A'}
                    {' '}| Pollutant: <span className="text-cyan-300 font-semibold">{d.pollutant || (d.pollutants && d.pollutants.join(', ')) || 'Multi'}</span>
                  </div>
                  {d.pollutants_summary && Object.keys(d.pollutants_summary).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1 text-[10px] font-mono">
                      {Object.entries(d.pollutants_summary).map(([pol, pinfo]: [string, any]) => (
                        <span key={pol} className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                          <strong className="text-cyan-400">{pol}</strong>: {pinfo.count} records ({pinfo.date_range?.start || 'N/A'}{pinfo.date_range?.end && pinfo.date_range.end !== pinfo.date_range.start ? ` to ${pinfo.date_range.end}` : ''})
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {d.source_classification && (
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                      d.source_classification === 'GENUINE_CPCB_CAAQMS_REPORT'
                        ? 'text-emerald-400 border-emerald-800/60 bg-emerald-950/40'
                        : d.source_classification === 'CPCB_CAAQMS_SAMPLE_ARCHIVE'
                        ? 'text-cyan-400 border-cyan-800/60 bg-cyan-950/40'
                        : 'text-amber-400 border-amber-800/60 bg-amber-950/40'
                    }`}>
                      {d.source_classification.replace(/_/g, ' ')}
                    </span>
                  )}
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${d.is_valid ? 'text-emerald-400 border-emerald-800/60 bg-emerald-950/30' : 'text-amber-400 border-amber-800/60 bg-amber-950/30'}`}>
                    {d.is_valid ? 'SCHEMA VALID' : 'FLAGGED'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
