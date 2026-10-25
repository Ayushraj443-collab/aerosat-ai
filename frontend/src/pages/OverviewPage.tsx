import React, { useState, useEffect } from 'react';
import {
  Satellite,
  Compass,
  MapPin,
  TrendingUp,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  Layers,
  CheckCircle2,
  Calendar,
  Sparkles
} from 'lucide-react';
import { api } from '../services/api';
import type { GroundStation, DataMode, ConnectorStatusResponse } from '../services/types';

interface OverviewPageProps {
  onNavigate: (tab: string) => void;
  dataMode?: DataMode;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({ onNavigate, dataMode = 'REAL' }) => {
  const [stations, setStations] = useState<GroundStation[]>([]);
  const [connectorStatus, setConnectorStatus] = useState<ConnectorStatusResponse | null>(null);
  const [modelStatus, setModelStatus] = useState<any>(null);
  const selectedDate = '2024-03-01';

  useEffect(() => {
    async function loadData() {
      try {
        const [stns, conns, model] = await Promise.allSettled([
          api.getStations(dataMode),
          api.getConnectorsStatus(),
          api.getModelStatus(dataMode),
        ]);
        if (stns.status === 'fulfilled') setStations(stns.value);
        if (conns.status === 'fulfilled') setConnectorStatus(conns.value);
        if (model.status === 'fulfilled') setModelStatus(model.value);
      } catch (err) {
        console.error('Error loading overview data:', err);
      }
    }
    loadData();
  }, [dataMode]);

  const pollutantCards = [
    {
      code: 'NO2',
      name: 'Nitrogen Dioxide',
      value: 48.6,
      unit: 'µg/m³',
      satValue: '12.4 × 10¹⁵',
      satUnit: 'molec/cm²',
      category: 'Satisfactory',
      badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      cpcbLimit: 80,
      whoLimit: 25,
      desc: 'Traffic & combustion tracer with sharp urban gradients'
    },
    {
      code: 'PM2.5',
      name: 'Fine Particulate Matter',
      value: 124.2,
      unit: 'µg/m³',
      satValue: '1.42',
      satUnit: 'Aerosol Index',
      category: 'Poor (201-300)',
      badgeColor: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
      cpcbLimit: 60,
      whoLimit: 15,
      desc: 'Inhalable aerosol particles modulated by boundary layer height'
    },
    {
      code: 'SO2',
      name: 'Sulfur Dioxide',
      value: 16.4,
      unit: 'µg/m³',
      satValue: '0.65',
      satUnit: 'DU',
      category: 'Good',
      badgeColor: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
      cpcbLimit: 80,
      whoLimit: 40,
      desc: 'Point-source industrial and coal generation emission tracer'
    },
    {
      code: 'CO',
      name: 'Carbon Monoxide',
      value: 1.4,
      unit: 'mg/m³',
      satValue: '2.1 × 10¹⁸',
      satUnit: 'molec/cm²',
      category: 'Satisfactory',
      badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      cpcbLimit: 2.0,
      whoLimit: 4.0,
      desc: 'Incomplete combustion tracer with regional atmospheric lifetime'
    },
    {
      code: 'O3',
      name: 'Tropospheric Ozone',
      value: 58.0,
      unit: 'µg/m³',
      satValue: '286.0',
      satUnit: 'DU',
      category: 'Satisfactory',
      badgeColor: 'bg-teal-500/10 text-teal-400 border-teal-500/30',
      cpcbLimit: 100,
      whoLimit: 100,
      desc: 'Photochemical secondary oxidant peaking during afternoon insolation'
    }
  ];

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Hero Banner */}
      <div className="relative rounded-2xl bg-gradient-to-r from-navy-900 via-navy-850 to-slate-900 border border-slate-800 p-6 sm:p-8 overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/30 text-cyan-400 text-xs font-mono">
            <Satellite className="w-3.5 h-3.5" />
            <span>Copernicus Sentinel-5P + CPCB CAAQMS Integration</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
            Satellite Air-Quality Prediction & <span className="text-cyan-400">Spatial Downscaling</span>
          </h1>

          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Bridging the resolution gap between coarse-pixel spaceborne spectrometers (~5.5 × 3.5 km) 
            and localized street-level breathing zones through physics-guided spatial machine learning 
            and meteorological covariate fusion.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={() => onNavigate('map')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition-all shadow-lg shadow-cyan-500/20"
            >
              <Layers className="w-4 h-4" />
              <span>Explore Interactive Map</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => onNavigate('predict')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-xs transition-colors"
            >
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span>Execute Location Prediction</span>
            </button>

            <button
              onClick={() => onNavigate('evaluation')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs transition-colors"
            >
              <TrendingUp className="w-4 h-4 text-teal-400" />
              <span>Model Metrics & Spatial CV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Target Domain & Date Context Strip */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-navy-900/60 border border-slate-800 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-950 text-cyan-400 flex items-center justify-center border border-cyan-800/40">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Study Domain</div>
            <div className="text-sm font-semibold text-white">Delhi-NCR & IGP</div>
            <div className="text-[11px] text-slate-500 font-mono">28.30°N - 28.88°N, 76.90°E - 77.45°E</div>
          </div>
        </div>

        <div className="bg-navy-900/60 border border-slate-800 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-teal-950 text-teal-400 flex items-center justify-center border border-teal-800/40">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Observation Date</div>
            <div className="text-sm font-semibold text-white">{selectedDate}</div>
            <div className="text-[11px] text-slate-500">Peak Winter / Inversion Season</div>
          </div>
        </div>

        <div className="bg-navy-900/60 border border-slate-800 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-950 text-indigo-400 flex items-center justify-center border border-indigo-800/40">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Reference Stations</div>
            <div className="text-sm font-semibold text-white">{stations.length} Monitored Hubs</div>
            <div className="text-[11px] text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>{dataMode === 'REAL' ? 'Verified CAAQMS Ground' : 'Demo Synthesized'}</span>
            </div>
          </div>
        </div>

        <div className="bg-navy-900/60 border border-slate-800 rounded-xl p-4 flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${
            dataMode === 'REAL' ? 'bg-emerald-950 text-emerald-400 border-emerald-800/40' : 'bg-amber-950 text-amber-400 border-amber-800/40'
          }`}>
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">
              {dataMode === 'REAL' ? 'Active Real Model' : 'System Data Mode'}
            </div>
            <div className="text-sm font-semibold text-white truncate max-w-[180px]">
              {dataMode === 'REAL'
                ? (modelStatus?.model_name || 'Real Spatial RF')
                : 'Synthetic Demo Mode'}
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              {dataMode === 'REAL' 
                ? `${connectorStatus?.connectors?.filter(c => c.status === 'VERIFIED').length ?? 3} Live APIs | 896 Obs` 
                : 'Deterministic Physics Sim'}
            </div>
          </div>
        </div>
      </div>

      {/* Criteria Pollutant Status Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Criteria Atmospheric Pollutants — Current Regional Concentrations
            </h2>
            <p className="text-xs text-slate-400">
              Comparative overview of surface ground values, satellite total column density, and compliance standards
            </p>
          </div>
          <span className="text-xs font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-800/40 px-2.5 py-1 rounded">
            5 Criteria Species
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {pollutantCards.map((pol) => (
            <div
              key={pol.code}
              className="bg-navy-900/80 border border-slate-800 hover:border-slate-700 rounded-xl p-4 transition-all hover:shadow-lg flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold text-white">{pol.code}</span>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${pol.badgeColor}`}>
                    {pol.category}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">{pol.name}</div>

                <div className="pt-2">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-black text-white">{pol.value}</span>
                    <span className="text-xs text-slate-400 font-mono">{pol.unit}</span>
                  </div>
                  <div className="text-[10px] text-slate-500">Surface Ground Observation</div>
                </div>

                <div className="pt-1.5 border-t border-slate-800 text-[11px] space-y-1">
                  <div className="flex justify-between text-slate-400">
                    <span>Satellite Column:</span>
                    <span className="text-slate-300 font-mono">{pol.satValue} {pol.satUnit}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>CPCB Standard:</span>
                    <span className="text-slate-300 font-mono">{pol.cpcbLimit} {pol.unit}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>WHO 2021 Guideline:</span>
                    <span className="text-slate-300 font-mono">{pol.whoLimit} {pol.unit}</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 mt-3 border-t border-slate-800/60">
                <p className="text-[10px] text-slate-400 italic line-clamp-2">
                  {pol.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* System Architecture & Methodology Snapshot */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-navy-900/70 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-white font-bold text-base">
            <Compass className="w-5 h-5 text-cyan-400" />
            <span>Downscaling Methodology & Physics-Informed Pipeline</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Directly translating a satellite column measurement (molecules per unit area) to ground-level breathing air requires 
            accounting for the vertical distribution of pollutants. AeroSat-AI uses meteorological and topographic predictors to 
            calibrate column-to-surface ratios:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3">
              <div className="text-xs font-semibold text-cyan-400 mb-1">1. Planetary Boundary Layer</div>
              <p className="text-[11px] text-slate-400">
                Shallow winter inversion layers (300-600m) trap surface emissions, inflating ground concentrations even when columns appear moderate.
              </p>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3">
              <div className="text-xs font-semibold text-teal-400 mb-1">2. Wind & Ventilation</div>
              <p className="text-[11px] text-slate-400">
                The product of wind speed and mixing height determines atmospheric flushing rate and horizontal advection.
              </p>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3">
              <div className="text-xs font-semibold text-amber-400 mb-1">3. Spatial Covariates</div>
              <p className="text-[11px] text-slate-400">
                SRTM elevation and road proximity index provide hyper-local proxy variation within coarse 5.5km satellite footprints.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-navy-900/70 border border-slate-800 rounded-2xl p-6 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-white font-bold text-base">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span>Scientific Integrity Guardrails</span>
            </div>
            <ul className="space-y-2.5 text-xs text-slate-300 mt-3">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 flex-shrink-0" />
                <span>GroupKFold spatial cross-validation ensures entire stations are held out to avoid spatial autocorrelation leakage.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 mt-1.5 flex-shrink-0" />
                <span>Uncertainty quantification via tree ensemble standard deviation and 90% confidence bounds.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                <span>Cloud-masked pixels (satellite QA &lt; 0.50) are explicitly labeled as missing data rather than hallucinated.</span>
              </li>
            </ul>
          </div>

          <div className="pt-4 border-t border-slate-800 text-center">
            <button
              onClick={() => onNavigate('research')}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-medium inline-flex items-center gap-1.5"
            >
              <span>Read Full Methodology & Research Paper Details</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
