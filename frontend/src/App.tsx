import { useState, useEffect } from 'react';
import { DemoBanner } from './components/DemoBanner';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { ErrorBoundary } from './components/ErrorBoundary';

import { OverviewPage } from './pages/OverviewPage';
import { MapPage } from './pages/MapPage';
import { PredictionPage } from './pages/PredictionPage';
import { EvaluationPage } from './pages/EvaluationPage';
import { DataExplorerPage } from './pages/DataExplorerPage';

import { api } from './services/api';
import type { DataMode } from './services/types';

import type { SelectedLocation } from './pages/OverviewPage';

// Helper to format client local date as YYYY-MM-DD
export const getLocalTodayDateString = (d: Date = new Date()): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function App() {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [backendHealthy, setBackendHealthy] = useState<boolean>(false);
  const [dataMode, setDataMode] = useState<DataMode>('REAL');

  // Shared Global Location & Date State
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation>({
    city: 'Delhi',
    state: 'Delhi-NCR',
    country: 'India',
    lat: 28.6139,
    lon: 77.2090,
  });
  const [selectedDate, setSelectedDate] = useState<string>('2024-01-07');

  // Cross-page state for transferring coordinates from map to prediction workspace
  const [pendingPredictionCoord, setPendingPredictionCoord] = useState<{
    lat: number;
    lon: number;
    pollutant: string;
    date?: string;
    city?: string;
  } | null>(null);

  const [mapInitial, setMapInitial] = useState<{
    lat: number;
    lon: number;
    city?: string;
    date?: string;
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

  function handleLocationChange(loc: SelectedLocation) {
    setSelectedLocation(loc);
    setMapInitial({
      lat: loc.lat,
      lon: loc.lon,
      city: loc.city,
      date: selectedDate,
    });
    setPendingPredictionCoord({
      lat: loc.lat,
      lon: loc.lon,
      pollutant: 'NO2',
      date: selectedDate,
      city: loc.city,
    });
  }

  function handleDateChange(date: string) {
    setSelectedDate(date);
    setMapInitial((prev) => (prev ? { ...prev, date } : { lat: selectedLocation.lat, lon: selectedLocation.lon, city: selectedLocation.city, date }));
    setPendingPredictionCoord((prev) => (prev ? { ...prev, date } : { lat: selectedLocation.lat, lon: selectedLocation.lon, pollutant: 'NO2', date, city: selectedLocation.city }));
  }

  function handleMapCoordinateSelect(lat: number, lon: number, pollutant: string) {
    setPendingPredictionCoord({ lat, lon, pollutant, date: selectedDate, city: selectedLocation.city });
    setActiveTab('predict');
  }

  function handleNavigate(tab: string, locationData?: { lat: number; lon: number; city?: string; date?: string }) {
    if (locationData) {
      if (tab === 'map') {
        setMapInitial({
          lat: locationData.lat,
          lon: locationData.lon,
          city: locationData.city,
          date: locationData.date,
        });
      } else if (tab === 'predict') {
        setPendingPredictionCoord({
          lat: locationData.lat,
          lon: locationData.lon,
          pollutant: 'NO2',
          date: locationData.date,
          city: locationData.city,
        });
      }
    }
    setActiveTab(tab);
  }

  return (
    <div className="min-h-screen flex flex-col bg-navy-950 text-slate-100 selection:bg-cyan-500 selection:text-slate-950">
      {/* Persistent Demonstration & Real Data Mode Banner */}
      <DemoBanner dataMode={dataMode} onToggleMode={setDataMode} />

      {/* Main Navbar Header with Mode Switcher */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        backendHealthy={backendHealthy}
        dataMode={dataMode}
        setDataMode={setDataMode}
      />

      {/* Main Page Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <ErrorBoundary>
          {activeTab === 'overview' && (
            <OverviewPage
              onNavigate={handleNavigate}
              dataMode={dataMode}
              selectedLocation={selectedLocation}
              onLocationChange={handleLocationChange}
              selectedDate={selectedDate}
              onDateChange={handleDateChange}
            />
          )}

          {activeTab === 'map' && (
            <MapPage
              onSelectCoordinateForPrediction={handleMapCoordinateSelect}
              dataMode={dataMode}
              initialLat={mapInitial?.lat || selectedLocation.lat}
              initialLon={mapInitial?.lon || selectedLocation.lon}
              initialCity={mapInitial?.city || selectedLocation.city}
              initialDate={mapInitial?.date || selectedDate}
              onLocationChange={handleLocationChange}
              onDateChange={handleDateChange}
            />
          )}

          {activeTab === 'predict' && (
            <PredictionPage
              initialLat={pendingPredictionCoord?.lat || selectedLocation.lat}
              initialLon={pendingPredictionCoord?.lon || selectedLocation.lon}
              initialPollutant={pendingPredictionCoord?.pollutant || 'NO2'}
              initialDate={pendingPredictionCoord?.date || selectedDate}
              initialCity={pendingPredictionCoord?.city || selectedLocation.city}
              dataMode={dataMode}
              onLocationChange={handleLocationChange}
              onDateChange={handleDateChange}
            />
          )}

          {activeTab === 'evaluation' && (
            <EvaluationPage dataMode={dataMode} />
          )}

          {activeTab === 'data' && (
            <DataExplorerPage dataMode={dataMode} onToggleMode={setDataMode} />
          )}
        </ErrorBoundary>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}

export default App;
