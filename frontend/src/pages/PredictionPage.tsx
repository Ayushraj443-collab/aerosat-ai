import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Calendar,
  Sparkles,
  Download,
  AlertTriangle,
  History,
  ShieldAlert,
  Compass,
  FileText
} from 'lucide-react';
import { api } from '../services/api';
import type { PredictionResponse, DataMode, PredictionHistoryItem } from '../services/types';
import { getLocalTodayDateString } from '../App';
import type { SelectedLocation } from './OverviewPage';

interface PredictionPageProps {
  initialLat?: number;
  initialLon?: number;
  initialPollutant?: string;
  initialDate?: string;
  initialCity?: string;
  dataMode?: DataMode;
  onLocationChange?: (loc: SelectedLocation) => void;
  onDateChange?: (date: string) => void;
}

const REGIONAL_PRESETS = [
  { name: 'Patna (DRM Danapur / University)', lat: 25.5941, lon: 85.1376, type: 'Middle Gangetic Plain' },
  { name: 'Ludhiana (PAU Campus Industrial)', lat: 30.9010, lon: 75.8573, type: 'Industrial Corridor' },
  { name: 'Mumbai (BKC Bandra Coastal)', lat: 19.0760, lon: 72.8777, type: 'Coastal Megacity' },
  { name: 'Kolkata (Victoria / Delta)', lat: 22.5726, lon: 88.3639, type: 'Eastern Metropolis' },
  { name: 'Bengaluru (BTM Layout IT)', lat: 12.9716, lon: 77.5946, type: 'Deccan Plateau' },
  { name: 'Lucknow (Lalbagh / Hazratganj)', lat: 26.8467, lon: 80.9462, type: 'Awadh Urban Core' },
  { name: 'Jaipur (Adarsh Nagar / Aravalli)', lat: 26.9124, lon: 75.7873, type: 'Semi-Arid Basin' },
  { name: 'Ahmedabad (Maninagar / West Core)', lat: 23.0225, lon: 72.5714, type: 'Western Hub' },
  { name: 'Hyderabad (Sanathnagar / IT Hub)', lat: 17.3850, lon: 78.4867, type: 'South-Central Hub' },
  { name: 'Anand Vihar (ISBT Delhi Border)', lat: 28.6476, lon: 77.3158, type: 'Heavy Traffic / Industrial' },
  { name: 'Connaught Place (Central Delhi)', lat: 28.6304, lon: 77.2177, type: 'Commercial Core' },
  { name: 'Punjabi Bagh (West Delhi)', lat: 28.6740, lon: 77.1310, type: 'Residential / Ring Road' },
  { name: 'IGI Airport Terminal 3', lat: 28.5562, lon: 77.0999, type: 'Aviation / Suburb' },
  { name: 'Noida Sector 62', lat: 28.6245, lon: 77.3649, type: 'IT Hub / Highway' },
  { name: 'Gurugram Sector 51', lat: 28.4299, lon: 77.0720, type: 'Urban Commercial' },
  { name: 'Ghaziabad Sanjay Nagar', lat: 28.6857, lon: 77.4538, type: 'Satellite Industrial' },
];

export const PredictionPage: React.FC<PredictionPageProps> = ({
  initialLat = 28.6476,
  initialLon = 77.3158,
  initialPollutant = 'NO2',
  initialDate,
  initialCity,
  dataMode = 'REAL',
  onLocationChange,
  onDateChange,
}) => {
  const [latitude, setLatitude] = useState<number>(initialLat);
  const [longitude, setLongitude] = useState<number>(initialLon);
  const [date, setDate] = useState<string>(initialDate || getLocalTodayDateString());
  const [currentCity, setCurrentCity] = useState<string>(initialCity || 'Delhi');
  const [pollutant, setPollutant] = useState<string>(initialPollutant);
  const [resolutionKm, setResolutionKm] = useState<number>(1.0);
  const [algorithm, setAlgorithm] = useState<string>('random_forest');

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<PredictionResponse | null>(null);
  const [history, setHistory] = useState<PredictionHistoryItem[]>([]);
  const [isDirty, setIsDirty] = useState<boolean>(false);

  useEffect(() => {
    if (initialLat) setLatitude(initialLat);
    if (initialLon) setLongitude(initialLon);
    if (initialPollutant) setPollutant(initialPollutant);
    if (initialDate) setDate(initialDate);
    if (initialCity) setCurrentCity(initialCity);
  }, [initialLat, initialLon, initialPollutant, initialDate, initialCity]);

  // Load prediction history on mount
  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    try {
      const hist = await api.getPredictionHistory(10);
      setHistory(hist);
    } catch (err) {
      console.error('Failed to load prediction history:', err);
    }
  }

  async function handlePredict(
    e?: React.FormEvent,
    overrideDate?: string,
    overrideLat?: number,
    overrideLon?: number,
    overridePollutant?: string
  ) {
    if (e) e.preventDefault();
    setError(null);
    setLoading(true);

    const targetDate = overrideDate || date;
    const targetLat = overrideLat !== undefined ? overrideLat : Number(latitude);
    const targetLon = overrideLon !== undefined ? overrideLon : Number(longitude);
    const targetPollutant = overridePollutant || pollutant;

    try {
      const res = await api.predict({
        latitude: targetLat,
        longitude: targetLon,
        date: targetDate,
        pollutant: targetPollutant,
        target_resolution_km: Number(resolutionKm),
        model_algorithm: algorithm,
        data_mode: dataMode,
      });
      setPrediction(res);
      setIsDirty(false);
      await loadHistory();
    } catch (err: any) {
      setError(err.message || 'Prediction execution failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectHistoryItem(h: PredictionHistoryItem) {
    setLatitude(h.latitude);
    setLongitude(h.longitude);
    setPollutant(h.pollutant);
    setDate(h.date);
    if (onLocationChange) {
      onLocationChange({
        city: currentCity,
        state: 'India Domain',
        country: 'India',
        lat: h.latitude,
        lon: h.longitude,
      });
    }
    if (onDateChange) {
      onDateChange(h.date);
    }
    try {
      const detail = await api.getPredictionDetail(h.id);
      setPrediction(detail);
    } catch (err) {
      console.warn('Could not load prediction detail directly, executing inference:', err);
      handlePredict(undefined, h.date, h.latitude, h.longitude, h.pollutant);
    }
  }

  function handlePresetSelect(preset: (typeof REGIONAL_PRESETS)[0]) {
    setLatitude(preset.lat);
    setLongitude(preset.lon);
    setIsDirty(true);
    const cityName = preset.name.split(' (')[0];
    setCurrentCity(cityName);
    if (onLocationChange) {
      onLocationChange({
        city: cityName,
        state: preset.type,
        country: 'India',
        lat: preset.lat,
        lon: preset.lon,
      });
    }
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Cpu className="w-6 h-6 text-cyan-400" />
            <span>Spatial Downscaling & Prediction Workspace</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Perform high-resolution localized air quality inferences with full tree-ensemble uncertainty bounds and input provenance logging.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dataMode === 'REAL' ? (
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 shadow-sm shadow-emerald-500/10">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Real ML Inferences Active
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              Demo Simulation Mode
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Form: Inputs & Configuration */}
        <div className="lg:col-span-5 space-y-6">
          <form onSubmit={handlePredict} className="bg-navy-900/80 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-xl">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-cyan-400" />
                <span>Inference Parameters</span>
              </div>
              {(currentCity || initialCity) && (
                <span className="text-[11px] font-medium text-cyan-300 bg-cyan-950/70 border border-cyan-800/60 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  {currentCity || initialCity}
                </span>
              )}
            </h2>

            {/* Quick-Jump Milestone Overpass Bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                <span>Verified Satellite Overpass Dates:</span>
                <span className="text-[10px] text-cyan-400 font-mono">S5P TROPOMI L2</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { date: '2023-12-01', label: 'Dec 01, 2023 (Pan-India)' },
                  { date: '2024-01-01', label: 'Jan 01, 2024 (Delhi-NCR)' },
                  { date: '2024-01-03', label: 'Jan 03, 2024' },
                  { date: '2024-01-05', label: 'Jan 05, 2024' },
                  { date: '2024-01-07', label: 'Jan 07, 2024' },
                  { date: '2024-01-10', label: 'Jan 10, 2024' },
                  { date: '2024-05-20', label: 'May 20, 2024' },
                ].map((item) => (
                  <button
                    key={item.date}
                    type="button"
                    disabled={loading}
                    title={`Switch date to ${item.label} and run inference`}
                    onClick={() => {
                      setDate(item.date);
                      if (onDateChange) onDateChange(item.date);
                      handlePredict(undefined, item.date);
                    }}
                    className={`px-2 py-1 rounded text-[11px] font-mono transition-all ${
                      date === item.date
                        ? 'bg-cyan-500 text-slate-950 font-extrabold shadow-sm shadow-cyan-500/30'
                        : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-cyan-500/40'
                    }`}
                  >
                    {item.date}
                  </button>
                ))}
              </div>
            </div>

            {/* Presets Quick Picker */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-medium">Regional Location Presets:</label>
              <select
                aria-label="Regional Location Presets"
                onChange={(e) => {
                  const p = REGIONAL_PRESETS.find((x) => x.name === e.target.value);
                  if (p) handlePresetSelect(p);
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="">Select a monitored hub...</option>
                {REGIONAL_PRESETS.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name} ({p.type})
                  </option>
                ))}
              </select>
            </div>

            {/* Coordinates Input */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-medium">Latitude (°N):</label>
                <input
                  type="number"
                  step="0.0001"
                  required
                  value={isNaN(latitude) ? '' : latitude}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setLatitude(val);
                    setIsDirty(true);
                    if (!isNaN(val)) {
                      const match = REGIONAL_PRESETS.find(p => Math.abs(p.lat - val) < 0.05 && Math.abs(p.lon - longitude) < 0.05);
                      const name = match ? match.name.split(' (')[0] : `Coord (${val.toFixed(2)}°N, ${longitude.toFixed(2)}°E)`;
                      setCurrentCity(name);
                      if (onLocationChange) onLocationChange({ city: name, state: 'Manual Coord', country: 'India', lat: val, lon: longitude });
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                  placeholder="28.6476"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-medium">Longitude (°E):</label>
                <input
                  type="number"
                  step="0.0001"
                  required
                  value={isNaN(longitude) ? '' : longitude}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setLongitude(val);
                    setIsDirty(true);
                    if (!isNaN(val)) {
                      const match = REGIONAL_PRESETS.find(p => Math.abs(p.lat - latitude) < 0.05 && Math.abs(p.lon - val) < 0.05);
                      const name = match ? match.name.split(' (')[0] : `Coord (${latitude.toFixed(2)}°N, ${val.toFixed(2)}°E)`;
                      setCurrentCity(name);
                      if (onLocationChange) onLocationChange({ city: name, state: 'Manual Coord', country: 'India', lat: latitude, lon: val });
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                  placeholder="77.3158"
                />
              </div>
            </div>

            {/* Date Picker */}
            <div className="space-y-1">
              <label className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Observation Date:</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => {
                  const newDate = e.target.value;
                  setDate(newDate);
                  setIsDirty(true);
                  if (onDateChange) onDateChange(newDate);
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Target Pollutant */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-medium">Target Pollutant:</label>
              <div className="grid grid-cols-5 gap-1.5">
                {['NO2', 'PM2.5', 'SO2', 'CO', 'O3'].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setPollutant(p);
                      setIsDirty(true);
                    }}
                    className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                      pollutant === p
                        ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                        : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Downscaling Grid Resolution */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-medium">Target Grid Resolution:</label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: '1.0 km (Fine)', val: 1.0 },
                  { label: '2.0 km', val: 2.0 },
                  { label: '5.0 km', val: 5.0 },
                  { label: '10 km (Coarse)', val: 10.0 },
                ].map((r) => (
                  <button
                    key={r.label}
                    type="button"
                    onClick={() => setResolutionKm(r.val)}
                    className={`py-1.5 rounded text-[11px] font-mono transition-colors ${
                      resolutionKm === r.val
                        ? 'bg-slate-800 text-cyan-400 border border-slate-700 font-semibold'
                        : 'bg-slate-950 text-slate-400 border border-slate-800'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Model Algorithm */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-medium">Spatial ML Algorithm:</label>
              <select
                aria-label="Spatial ML Algorithm"
                value={algorithm}
                onChange={(e) => setAlgorithm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="random_forest">Random Forest Regressor (Ensemble Quantile Variance)</option>
                <option value="gradient_boosting">Histogram Gradient Boosting (Tree Depth 12)</option>
              </select>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Downscaling Atmospheric Column...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Execute Spatial Prediction</span>
                </>
              )}
            </button>
          </form>

          {/* Recent Prediction History */}
          <div className="bg-navy-900/60 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-300 font-medium">
              <span className="flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-cyan-400" />
                <span>Recent Inferences ({history.length})</span>
              </span>
              <button onClick={loadHistory} className="text-[10px] text-slate-400 hover:text-cyan-400">
                Refresh
              </button>
            </div>

            {history.length === 0 ? (
              <div className="text-[11px] text-slate-500 italic py-2 text-center">No predictions executed yet.</div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {history.map((h) => (
                  <div
                    key={h.id}
                    onClick={() => handleSelectHistoryItem(h)}
                    className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-cyan-500/50 cursor-pointer transition-all flex items-center justify-between text-xs group"
                  >
                    <div>
                      <div className="font-semibold text-slate-200 group-hover:text-cyan-300 transition-colors">
                        {h.pollutant}: <span className="text-cyan-400 font-mono">{h.estimated_value} {h.unit}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {h.latitude.toFixed(3)}°N, {h.longitude.toFixed(3)}°E | {h.date}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-slate-400 font-mono">{h.target_resolution_km} km</div>
                      <div className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded text-center inline-block mt-0.5 ${
                        h.provenance_status === 'REAL'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : h.provenance_status === 'UNVERIFIED'
                          ? 'bg-slate-800 text-slate-300 border border-slate-700'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      }`}>
                        {h.provenance_status || h.data_mode || (h.is_demo === false ? 'REAL' : 'DEMO')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Prediction Results & Provenance */}
        <div className="lg:col-span-7 space-y-6">
          {prediction ? (
            <div className="bg-navy-900/80 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-2xl animate-fadeIn">
              {/* Result Header */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-mono text-cyan-400 uppercase tracking-wider">
                      Downscaled Ground Prediction Result
                    </span>
                    {prediction.result_type === 'UNAVAILABLE_PENDING_SATELLITE_OVERPASS' || prediction.status === 'INPUTS_PENDING' ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        INPUTS PENDING
                      </span>
                    ) : prediction.result_type === 'COPERNICUS_CAMS_DOWNSCALED' || prediction.provenance?.provenance_status === 'REAL_COPERNICUS_CAMS' ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                        CAMS ATMOSPHERIC REANALYSIS + NWP
                      </span>
                    ) : prediction.provenance?.provenance_status === 'REAL' || (prediction.provenance?.data_mode === 'REAL' && !prediction.provenance?.is_demo && !prediction.provenance?.satellite_product?.includes('Simulated')) ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        S5P LEVEL-2 SATELLITE DOWNSCALED
                      </span>
                    ) : prediction.provenance?.provenance_status === 'UNVERIFIED' ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-slate-800 text-slate-300 border border-slate-700">
                        UNVERIFIED PROVENANCE
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        DEMO SIMULATION
                      </span>
                    )}
                  </div>
                  <div className="text-lg font-bold text-white flex items-center gap-2">
                    <span>{prediction.pollutant} Localized Surface Concentration</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono">
                      {prediction.target_resolution_km} km Grid
                    </span>
                  </div>
                  <div className="text-xs text-slate-300 mt-1 flex flex-wrap items-center gap-2">
                    <span className="text-slate-400">Target Location:</span>
                    <span className="font-semibold text-cyan-300">{currentCity}</span>
                    <span className="font-mono text-slate-400">({prediction.latitude.toFixed(4)}°N, {prediction.longitude.toFixed(4)}°E)</span>
                    <span className="text-slate-500">•</span>
                    <span className="text-slate-400">Observation Date:</span>
                    <span className="font-mono text-cyan-300">{prediction.date}</span>
                  </div>
                </div>

                {/* Export Buttons */}
                {prediction.estimated_value !== null && (
                  <div className="flex items-center gap-2">
                    <a
                      href={`/api/export/${prediction.prediction_id}?format=csv`}
                      download
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs border border-slate-700 flex items-center gap-1.5 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>CSV</span>
                    </a>
                    <a
                      href={`/api/export/${prediction.prediction_id}?format=geojson`}
                      download
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs border border-slate-700 flex items-center gap-1.5 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>GeoJSON</span>
                    </a>
                  </div>
                )}
              </div>

              {/* Parameter Dirty Alert Banner */}
              {isDirty && (
                <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs flex items-center justify-between gap-3 shadow-md animate-fadeIn">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Parameters modified. The values shown below are from the previous query. Click to re-run.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handlePredict()}
                    disabled={loading}
                    className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider shrink-0 transition-all shadow"
                  >
                    {loading ? 'Calculating...' : 'Re-run Inference'}
                  </button>
                </div>
              )}

              {/* Data Unavailable / Inputs Pending Alert Banner */}
              {prediction.estimated_value === null ? (
                <div className="p-5 rounded-xl bg-amber-950/40 border border-amber-600/50 space-y-3">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-amber-200">
                        Spaceborne Satellite Overpass Pending for {prediction.date}
                      </h4>
                      <p className="text-xs text-amber-300/90 leading-relaxed">
                        {prediction.data_availability_notice ||
                          'In REAL mode, downscaled surface predictions require verified Sentinel-5P Level-2 satellite overpass observations. Estimation is withheld to prevent ungrounded data fabrication.'}
                      </p>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-amber-900/50 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs text-amber-300/80">
                      <span>Verified Sentinel-5P granules available in local archive: </span>
                      <div className="inline-flex flex-wrap gap-1 mt-1">
                        {['2024-01-01', '2024-01-03', '2024-01-05', '2024-01-07', '2024-01-10', '2024-05-20'].map((d) => (
                          <button
                            key={d}
                            type="button"
                            disabled={loading}
                            onClick={() => {
                              setDate(d);
                              if (onDateChange) onDateChange(d);
                              handlePredict(undefined, d);
                            }}
                            className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-colors ${
                              date === d
                                ? 'bg-cyan-500 text-slate-950 font-extrabold'
                                : 'bg-amber-900/40 hover:bg-cyan-500 hover:text-slate-950 text-amber-200 border border-amber-600/50'
                            }`}
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => {
                        const verifiedDate = '2024-01-01';
                        setDate(verifiedDate);
                        if (onDateChange) onDateChange(verifiedDate);
                        handlePredict(undefined, verifiedDate);
                      }}
                      className="px-3.5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 shadow"
                    >
                      {loading ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                          <span>Fetching Granule...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Switch to 2024-01-01 (Verified Granule)</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Primary Metric Banner */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-950/70 p-5 rounded-xl border border-slate-800">
                    <div>
                      <div className="text-xs text-slate-400">Estimated Concentration</div>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-4xl font-extrabold text-white tracking-tight">
                          {prediction.estimated_value}
                        </span>
                        <span className="text-sm font-mono text-slate-400">{prediction.unit}</span>
                      </div>
                      <div className="mt-2">
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                          NAQI: {prediction.aqi_category}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5 border-t md:border-t-0 md:border-l border-slate-800 pt-3 md:pt-0 md:pl-4">
                      <div className="text-xs text-slate-400 font-medium">Uncertainty Bounds (90% CI)</div>
                      <div className="text-sm font-mono font-bold text-cyan-300">
                        {prediction.uncertainty ? `[${prediction.uncertainty.lower_bound_90ci} — ${prediction.uncertainty.upper_bound_90ci}] ${prediction.unit}` : 'N/A'}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Ensemble Std Dev: <span className="font-mono text-slate-300">±{prediction.uncertainty?.standard_deviation ?? '0.0'} {prediction.unit}</span>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Derived from cross-tree regression variance across geographic covariates.
                      </div>
                    </div>

                    <div className="space-y-1.5 border-t md:border-t-0 md:border-l border-slate-800 pt-3 md:pt-0 md:pl-4">
                      <div className="text-xs text-slate-400 font-medium">Model Specs</div>
                      <div className="text-xs text-slate-200 font-semibold">{prediction.model_info.model_name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">Algorithm: {prediction.model_info.algorithm}</div>
                      <div className="text-[11px] text-emerald-400 font-mono">
                        Held-Out R²: {prediction.model_info.r2_score} | MAE: {prediction.model_info.mae}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Input Provenance Breakdown */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-cyan-400" />
                  <span>Input-Data Provenance & Atmospheric Features</span>
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 space-y-1">
                    <span className="text-slate-400">Satellite Product</span>
                    <div className="font-medium text-slate-200 truncate" title={prediction.provenance.satellite_granule || prediction.provenance.satellite_product}>
                      {prediction.provenance.satellite_granule ? `Sentinel-5P OFFL (${prediction.provenance.satellite_granule.slice(0, 24)}...)` : prediction.provenance.satellite_product}
                    </div>
                    <div className="text-[11px] font-mono text-cyan-400">
                      {prediction.provenance.satellite_column_value !== null &&
                      prediction.provenance.satellite_column_value !== undefined &&
                      isFinite(Number(prediction.provenance.satellite_column_value)) ? (
                        <span>
                          Column: <strong className="text-white font-mono">{Number(prediction.provenance.satellite_column_value).toFixed(4)}</strong> {prediction.provenance.satellite_unit}
                        </span>
                      ) : (
                        <span className="text-amber-400/90 text-[10px]">
                          Column: {prediction.provenance.satellite_column_reason || 'Pending Spaceborne Overpass'}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 space-y-1">
                    <span className="text-slate-400">Satellite QA Score</span>
                    {prediction.provenance.satellite_qa_value !== null && prediction.provenance.satellite_qa_value !== undefined ? (
                      <>
                        <div className="font-semibold text-emerald-400 font-mono">
                          {Number(prediction.provenance.satellite_qa_value).toFixed(2)} (QA &ge; 0.50 Passed)
                        </div>
                        <div className="text-[10px] text-slate-400">Clear-Sky Level-2 Pixel Verified</div>
                      </>
                    ) : (
                      <>
                        <div className="font-medium text-amber-400/80 font-mono text-[11px]">
                          Unavailable / Pending
                        </div>
                        <div className="text-[10px] text-slate-500">No clear-sky pixel for {prediction.date}</div>
                      </>
                    )}
                  </div>

                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 space-y-1">
                    <span className="text-slate-400">Planetary Boundary Layer</span>
                    <div className="font-semibold text-slate-200 font-mono">
                      {prediction.provenance.meteorological_features.boundary_layer_height_m} m
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Ventilation Index: {prediction.provenance.meteorological_features.ventilation_index} m²/s
                    </div>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 space-y-1">
                    <span className="text-slate-400">Wind & Weather</span>
                    <div className="font-semibold text-slate-200 font-mono">
                      {prediction.provenance.meteorological_features.wind_speed_ms} m/s @ {prediction.provenance.meteorological_features.wind_direction_deg}°
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {prediction.provenance.meteorological_features.temperature_c}°C | {prediction.provenance.meteorological_features.relative_humidity_pct}% RH
                    </div>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 space-y-1">
                    <span className="text-slate-400">Nearest Reference Station</span>
                    <div className="font-medium text-slate-200 truncate">{prediction.provenance.nearest_station_name}</div>
                    <div className="text-[11px] font-mono text-cyan-400">
                      Distance: {prediction.provenance.distance_to_station_km} km
                    </div>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 space-y-1">
                    <span className="text-slate-400">Terrain & Road Density</span>
                    <div className="font-semibold text-slate-200 font-mono">
                      Elevation: {prediction.provenance.elevation_m} m MSL
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Urban Activity Proxy: {prediction.provenance.road_density_proxy}
                    </div>
                  </div>
                </div>
              </div>

              {/* Scientific Disclaimer Card */}
              <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-600/30 text-amber-200 text-xs flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <strong className="text-amber-300">Mandatory Atmospheric Science Disclaimer:</strong>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    {prediction.provenance.scientific_disclaimer}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* Empty State */
            <div className="bg-navy-900/40 border border-slate-800 rounded-2xl p-12 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-slate-900 text-cyan-400 border border-slate-800 flex items-center justify-center mx-auto">
                <Sparkles className="w-8 h-8" />
              </div>
              <div className="max-w-md mx-auto space-y-1.5">
                <h3 className="text-base font-bold text-white">No Prediction Executed Yet</h3>
                <p className="text-xs text-slate-400">
                  Select coordinates, a target pollutant, date, and spatial resolution on the left, then click 
                  <strong className="text-cyan-400"> "Execute Spatial Prediction"</strong> to view model estimates and uncertainty.
                </p>
              </div>
              <div className="pt-2">
                <button
                  onClick={() => handlePredict()}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-semibold border border-slate-700"
                >
                  Run Sample Prediction (Anand Vihar)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
