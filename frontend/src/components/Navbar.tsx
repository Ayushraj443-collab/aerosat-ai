import React from 'react';
import {
  Satellite,
  MapPin,
  Compass,
  Cpu,
  BarChart3,
  Database
} from 'lucide-react';
import type { DataMode } from '../services/types';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  backendHealthy: boolean;
  dataMode: DataMode;
  setDataMode: (mode: DataMode) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  backendHealthy,
  dataMode,
  setDataMode
}) => {
  const navItems = [
    { id: 'overview', label: 'Overview', icon: Compass },
    { id: 'data', label: 'Satellite/CPCB Data', icon: Database },
    { id: 'map', label: 'Air-Quality Map', icon: MapPin },
    { id: 'predict', label: 'Spatial Downscaling', icon: Cpu },
    { id: 'evaluation', label: 'Model Evaluation', icon: BarChart3 },
  ];

  return (
    <header className="sticky top-0 z-50 bg-navy-950/90 backdrop-blur-md border-b border-slate-800 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 cursor-pointer flex-shrink-0" onClick={() => setActiveTab('overview')}>
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-teal-700 flex items-center justify-center shadow-lg shadow-cyan-950/50 border border-cyan-400/30 flex-shrink-0">
              <Satellite className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-white">AeroSat-AI</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-cyan-950 text-cyan-400 border border-cyan-800/60 font-semibold whitespace-nowrap">
                  S5P/TROPOMI
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block whitespace-nowrap">
                Spatial Air-Quality Prediction & Downscaling
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1 lg:space-x-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-slate-800 text-cyan-400 border border-slate-700 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Controls: Mode Switcher & Backend Health */}
          <div className="flex items-center gap-2.5 sm:gap-3 flex-shrink-0">
            {/* Real / Demo Mode Toggle */}
            <div className="flex items-center bg-slate-900 border border-slate-700/60 rounded-lg p-0.5 text-xs font-medium">
              <button
                onClick={() => setDataMode('REAL')}
                title="Switch to Real Verified Data Mode"
                className={`px-2.5 py-1 rounded flex items-center gap-1.5 transition-all ${
                  dataMode === 'REAL'
                    ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${dataMode === 'REAL' ? 'bg-emerald-200 animate-pulse' : 'bg-slate-500'}`} />
                REAL DATA
              </button>
              <button
                onClick={() => setDataMode('DEMO')}
                title="Switch to Demonstration Mode"
                className={`px-2.5 py-1 rounded flex items-center gap-1.5 transition-all ${
                  dataMode === 'DEMO'
                    ? 'bg-amber-600 text-white shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${dataMode === 'DEMO' ? 'bg-amber-200' : 'bg-slate-500'}`} />
                DEMO
              </button>
            </div>

            {/* Backend Health Pill */}
            <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs">
              <span className={`w-2 h-2 rounded-full ${backendHealthy ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
              <span className="text-[11px] font-mono text-slate-300">
                {backendHealthy ? 'API Online' : 'Connecting...'}
              </span>
            </div>

            {/* Mobile Dropdown */}
            <div className="md:hidden flex items-center">
              <select
                aria-label="Navigation Pages"
                value={activeTab}
                onChange={(e) => setActiveTab(e.target.value)}
                className="bg-slate-900 text-slate-200 text-xs rounded border border-slate-700 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              >
                {navItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
