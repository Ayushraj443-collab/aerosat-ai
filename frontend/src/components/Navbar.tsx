import React from 'react';
import {
  Satellite,
  MapPin,
  Compass,
  Cpu,
  BarChart3,
  Database,
  BookOpen
} from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  backendHealthy: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, backendHealthy }) => {
  const navItems = [
    { id: 'overview', label: 'Overview', icon: Compass },
    { id: 'map', label: 'Pollution Map', icon: MapPin },
    { id: 'predict', label: 'Prediction Workspace', icon: Cpu },
    { id: 'evaluation', label: 'Model Evaluation', icon: BarChart3 },
    { id: 'data', label: 'Data Explorer', icon: Database },
    { id: 'research', label: 'Research & About', icon: BookOpen },
  ];

  return (
    <header className="sticky top-0 z-50 bg-navy-950/90 backdrop-blur-md border-b border-slate-800 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('overview')}>
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-teal-700 flex items-center justify-center shadow-lg shadow-cyan-950/50 border border-cyan-400/30">
              <Satellite className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-white">AeroSat-AI</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-cyan-950 text-cyan-400 border border-cyan-800/60 font-semibold">
                  S5P/TROPOMI
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Spatial Air-Quality Prediction & Downscaling
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-slate-800 text-cyan-400 border border-slate-700 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Backend Health & Status Pill */}
          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs">
              <span className={`w-2 h-2 rounded-full ${backendHealthy ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
              <span className="text-[11px] font-mono text-slate-300">
                {backendHealthy ? 'API Online' : 'Connecting...'}
              </span>
            </div>

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
