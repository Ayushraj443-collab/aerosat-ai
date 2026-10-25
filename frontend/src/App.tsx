import { useState, useEffect } from 'react';
import { DemoBanner } from './components/DemoBanner';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';

import { OverviewPage } from './pages/OverviewPage';
import { MapPage } from './pages/MapPage';
import { PredictionPage } from './pages/PredictionPage';
import { EvaluationPage } from './pages/EvaluationPage';
import { DataExplorerPage } from './pages/DataExplorerPage';
import { ResearchPage } from './pages/ResearchPage';

import { api } from './services/api';

export function App() {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [backendHealthy, setBackendHealthy] = useState<boolean>(false);

  // Cross-page state for transferring coordinates from map to prediction workspace
  const [pendingPredictionCoord, setPendingPredictionCoord] = useState<{
    lat: number;
    lon: number;
    pollutant: string;
  } | null>(null);

  useEffect(() => {
    async function checkHealth() {
      try {
        const res = await api.getHealth();
        if (res.status === 'healthy') {
          setBackendHealthy(true);
        }
      } catch (err) {
        console.warn('Backend health check error:', err);
        setBackendHealthy(false);
      }
    }
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  function handleMapCoordinateSelect(lat: number, lon: number, pollutant: string) {
    setPendingPredictionCoord({ lat, lon, pollutant });
    setActiveTab('predict');
  }

  return (
    <div className="min-h-screen flex flex-col bg-navy-950 text-slate-100 selection:bg-cyan-500 selection:text-slate-950">
      {/* Persistent Demonstration & Scientific Limitation Banner */}
      <DemoBanner />

      {/* Main Navbar Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        backendHealthy={backendHealthy}
      />

      {/* Main Page Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {activeTab === 'overview' && (
          <OverviewPage onNavigate={(tab) => setActiveTab(tab)} />
        )}

        {activeTab === 'map' && (
          <MapPage onSelectCoordinateForPrediction={handleMapCoordinateSelect} />
        )}

        {activeTab === 'predict' && (
          <PredictionPage
            initialLat={pendingPredictionCoord?.lat}
            initialLon={pendingPredictionCoord?.lon}
            initialPollutant={pendingPredictionCoord?.pollutant}
          />
        )}

        {activeTab === 'evaluation' && <EvaluationPage />}

        {activeTab === 'data' && <DataExplorerPage />}

        {activeTab === 'research' && <ResearchPage />}
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}

export default App;
