import React from 'react';
import { Satellite, Shield, ExternalLink, Activity } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-navy-950 border-t border-slate-800 text-slate-400 text-xs py-8 mt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="space-y-2 md:col-span-2">
          <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm">
            <Satellite className="w-4 h-4 text-cyan-400" />
            <span>AeroSat-AI Environmental Intelligence System</span>
          </div>
          <p className="text-slate-400 text-xs leading-relaxed max-w-lg">
            An advanced geospatial machine learning application pairing European Space Agency Sentinel-5P/TROPOMI 
            satellite column observations with India Central Pollution Control Board (CPCB) continuous monitoring stations. 
            Engineered for high-resolution spatial downscaling and local air quality estimation.
          </p>
          <div className="pt-2 text-[11px] text-slate-500 font-mono">
            Designed for University Capstone & Engineering Research Demonstration
          </div>
        </div>

        <div>
          <h4 className="text-slate-200 font-medium mb-2.5 text-xs uppercase tracking-wider">Data Providers</h4>
          <ul className="space-y-1.5 text-xs text-slate-400">
            <li>
              <a
                href="https://dataspace.copernicus.eu"
                target="_blank"
                rel="noreferrer"
                className="hover:text-cyan-400 transition-colors flex items-center gap-1"
              >
                <span>Copernicus Data Space (CDSE)</span>
                <ExternalLink className="w-3 h-3 text-slate-600" />
              </a>
            </li>
            <li>
              <a
                href="https://cpcb.nic.in"
                target="_blank"
                rel="noreferrer"
                className="hover:text-cyan-400 transition-colors flex items-center gap-1"
              >
                <span>CPCB India (CAAQMS Network)</span>
                <ExternalLink className="w-3 h-3 text-slate-600" />
              </a>
            </li>
            <li>
              <a
                href="https://open-meteo.com"
                target="_blank"
                rel="noreferrer"
                className="hover:text-cyan-400 transition-colors flex items-center gap-1"
              >
                <span>Open-Meteo & ECMWF IFS / ERA5</span>
                <ExternalLink className="w-3 h-3 text-slate-600" />
              </a>
            </li>
            <li>
              <a
                href="https://openaq.org"
                target="_blank"
                rel="noreferrer"
                className="hover:text-cyan-400 transition-colors flex items-center gap-1"
              >
                <span>OpenAQ Global In-situ Air Platform</span>
                <ExternalLink className="w-3 h-3 text-slate-600" />
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-slate-200 font-medium mb-2.5 text-xs uppercase tracking-wider">Methodology & Integrity</h4>
          <ul className="space-y-1.5 text-xs text-slate-400">
            <li className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-teal-400" />
              <span>Spatial GroupKFold Validation</span>
            </li>
            <li className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-amber-400" />
              <span>Uncertainty Quantification (90% CI)</span>
            </li>
            <li className="text-[11px] text-slate-500 pt-1">
              Zero synthetic records mixed with live feeds. Full data provenance on every inference.
            </li>
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500">
        <div>&copy; 2026 AeroSat-AI. Open Science Research & Geospatial Downscaling Framework.</div>
        <div className="mt-2 sm:mt-0 font-mono">EPSG:4326 | WGS84 Datum | FastApi + Scikit-Learn + React</div>
      </div>
    </footer>
  );
};
