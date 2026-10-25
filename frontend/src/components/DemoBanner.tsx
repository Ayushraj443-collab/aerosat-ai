import React, { useState } from 'react';
import { AlertTriangle, Info, ChevronDown, ChevronUp, Satellite, ShieldAlert, CheckCircle2, Database } from 'lucide-react';
import type { DataMode } from '../services/types';

interface DemoBannerProps {
  dataMode: DataMode;
  onToggleMode: (mode: DataMode) => void;
}

export const DemoBanner: React.FC<DemoBannerProps> = ({ dataMode, onToggleMode }) => {
  const [expanded, setExpanded] = useState(false);
  const isReal = dataMode === 'REAL';

  return (
    <div className={`border-b px-4 py-2 text-xs transition-colors ${
      isReal
        ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
        : 'bg-amber-950/40 border-amber-500/30 text-amber-200'
    }`}>
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-medium">
          <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded border font-mono uppercase tracking-wider text-[10px] font-bold ${
            isReal
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
          }`}>
            {isReal ? (
              <>
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                REAL DATA MODE
              </>
            ) : (
              <>
                <AlertTriangle className="w-3 h-3 text-amber-400 animate-pulse" />
                DEMO MODE ACTIVE
              </>
            )}
          </span>
          <span className="text-slate-300">
            {isReal ? (
              <span>
                Displaying genuine verified observations from <strong className="text-emerald-300">Copernicus CAMS & ERA5</strong>, with live ESA CDSE Sentinel-5P discovery. Zero synthetic substitution.
              </span>
            ) : (
              <span>
                Running in demonstration mode with calibrated synthetic Delhi-NCR atmospheric pairs for algorithm verification.
              </span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onToggleMode(isReal ? 'DEMO' : 'REAL')}
            className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all border flex items-center gap-1.5 ${
              isReal
                ? 'bg-slate-900 border-emerald-500/40 text-emerald-300 hover:bg-slate-800'
                : 'bg-emerald-600 border-emerald-500 text-white hover:bg-emerald-500 shadow-sm'
            }`}
          >
            <Database className="w-3 h-3" />
            <span>Switch to {isReal ? 'Demo Mode' : 'Real Data Mode'}</span>
          </button>

          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 transition-colors underline underline-offset-2"
          >
            <Info className="w-3.5 h-3.5" />
            <span>{expanded ? 'Hide Details' : 'Scientific Provenance & Status'}</span>
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className={`max-w-7xl mx-auto mt-3 pt-3 border-t text-slate-300 grid md:grid-cols-2 gap-4 ${
          isReal ? 'border-emerald-500/20' : 'border-amber-500/20'
        }`}>
          <div className="space-y-1.5">
            <div className={`flex items-center gap-1.5 font-semibold ${isReal ? 'text-emerald-400' : 'text-amber-400'}`}>
              <ShieldAlert className="w-4 h-4" />
              <span>Scientific Data Isolation & Matching Rules</span>
            </div>
            <p className="leading-relaxed text-slate-400 text-[11px]">
              Real observations and synthetic demonstration records are strictly separated. 
              Satellite TROPOMI measurements represent column-integrated densities (molecules/cm² or mol/m²), 
              whereas ground stations measure surface concentrations (µg/m³). They are paired using spatial tolerances (≤ 5 km) 
              and temporal windows (± 3h) with boundary layer height scaling.
            </p>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-cyan-400 font-semibold">
              <Satellite className="w-4 h-4" />
              <span>Copernicus CDSE & CPCB Connectivity</span>
            </div>
            <p className="leading-relaxed text-slate-400 text-[11px]">
              Copernicus CDSE OData Catalogue query is live and verified without API keys. 
              Surface observations are fetched from Copernicus European Atmosphere (CAMS) and Open-Meteo ERA5. 
              Standardized CPCB CAAQMS reports can also be imported via the Data Explorer.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
