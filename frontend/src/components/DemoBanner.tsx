import React, { useState } from 'react';
import { AlertTriangle, Info, ChevronDown, ChevronUp, Satellite, ShieldAlert } from 'lucide-react';

export const DemoBanner: React.FC = () => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-amber-950/40 border-b border-amber-500/30 text-amber-200 px-4 py-2.5 text-xs">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-medium">
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono uppercase tracking-wider text-[10px]">
            <AlertTriangle className="w-3 h-3 text-amber-400 animate-pulse" />
            DEMONSTRATION DATA
          </span>
          <span className="text-slate-300">
            Running in reproducible demonstration mode with calibrated synthetic Delhi-NCR atmospheric pairs.
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 transition-colors underline underline-offset-2"
          >
            <Info className="w-3.5 h-3.5" />
            <span>Scientific Limitations & Real Connectors</span>
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="max-w-7xl mx-auto mt-3 pt-3 border-t border-amber-500/20 text-slate-300 grid md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
              <ShieldAlert className="w-4 h-4" />
              <span>Core Scientific Grounding & Limitation</span>
            </div>
            <p className="leading-relaxed text-slate-400 text-[11px]">
              Sentinel-5P/TROPOMI satellite observations measure atmospheric column densities at ~5.5 × 3.5 km nadir resolution.
              Spatially downscaled concentrations (1.0 - 2.0 km) represent statistical model estimates that combine satellite retrievals with planetary boundary layer height, wind dispersion, and topographic proxies.
              They are not newly observed street-level truth and carry quantifiable confidence intervals.
            </p>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-cyan-400 font-semibold">
              <Satellite className="w-4 h-4" />
              <span>Enabling Live Copernicus CDSE / CPCB Feeds</span>
            </div>
            <p className="leading-relaxed text-slate-400 text-[11px]">
              To ingest real daily Sentinel-5P L2 swaths, obtain free Copernicus Data Space credentials at{' '}
              <a href="https://dataspace.copernicus.eu" target="_blank" rel="noreferrer" className="text-cyan-400 underline">
                dataspace.copernicus.eu
              </a>{' '}
              and set <code className="text-amber-300 bg-slate-900 px-1 py-0.5 rounded">COPERNICUS_CLIENT_ID</code> in backend <code className="text-slate-200">.env</code>.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
