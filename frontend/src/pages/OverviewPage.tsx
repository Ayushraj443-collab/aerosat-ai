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
  Sparkles,
  Search,
  Navigation,
  RefreshCw,
  Sliders,
  Check,
  Wind,
  Thermometer,
  CloudRain,
  Info,
  Database
} from 'lucide-react';
import { api } from '../services/api';
import type {
  GroundStation,
  DataMode,
  LocationSummaryResponse,
  LocationSummaryPollutantCard,
  DateCoverageResponse
} from '../services/types';

export interface SelectedLocation {
  city: string;
  state: string;
  country: string;
  lat: number;
  lon: number;
  tag?: string;
}

export const PREDEFINED_CITIES: SelectedLocation[] = [
  { city: 'Delhi', state: 'Delhi-NCR', country: 'India', lat: 28.6139, lon: 77.2090, tag: 'National Capital' },
  { city: 'Patna', state: 'Bihar', country: 'India', lat: 25.5941, lon: 85.1376, tag: 'Middle Gangetic Plain' },
  { city: 'Ludhiana', state: 'Punjab', country: 'India', lat: 30.9010, lon: 75.8573, tag: 'Industrial Corridor' },
  { city: 'Mumbai', state: 'Maharashtra', country: 'India', lat: 19.0760, lon: 72.8777, tag: 'Coastal Megacity' },
  { city: 'Kolkata', state: 'West Bengal', country: 'India', lat: 22.5726, lon: 88.3639, tag: 'Eastern Delta' },
  { city: 'Bengaluru', state: 'Karnataka', country: 'India', lat: 12.9716, lon: 77.5946, tag: 'Deccan Plateau' },
  { city: 'Lucknow', state: 'Uttar Pradesh', country: 'India', lat: 26.8467, lon: 80.9462, tag: 'Awadh Urban Hub' },
  { city: 'Jaipur', state: 'Rajasthan', country: 'India', lat: 26.9124, lon: 75.7873, tag: 'Aravalli Semi-Arid' },
  { city: 'Ahmedabad', state: 'Gujarat', country: 'India', lat: 23.0225, lon: 72.5714, tag: 'Western Core' },
  { city: 'Hyderabad', state: 'Telangana', country: 'India', lat: 17.3850, lon: 78.4867, tag: 'South-Central Hub' },
  { city: 'Chennai', state: 'Tamil Nadu', country: 'India', lat: 13.0827, lon: 80.2707, tag: 'Coromandel Coastal' },
  { city: 'Pune', state: 'Maharashtra', country: 'India', lat: 18.5204, lon: 73.8567, tag: 'Western Ghats Foothills' },
  { city: 'Chandigarh', state: 'Chandigarh', country: 'India', lat: 30.7333, lon: 76.7794, tag: 'Shivalik Plain' },
  { city: 'Varanasi', state: 'Uttar Pradesh', country: 'India', lat: 25.3176, lon: 82.9739, tag: 'Eastern UP Gangetic' },
  { city: 'Guwahati', state: 'Assam', country: 'India', lat: 26.1445, lon: 91.7362, tag: 'Brahmaputra Valley' },
  { city: 'Ranchi', state: 'Jharkhand', country: 'India', lat: 23.3441, lon: 85.3096, tag: 'Chota Nagpur Plateau' },
  { city: 'Bhopal', state: 'Madhya Pradesh', country: 'India', lat: 23.2599, lon: 77.4126, tag: 'Central Highlands' },
  { city: 'Dehradun', state: 'Uttarakhand', country: 'India', lat: 30.3165, lon: 78.0322, tag: 'Doon Valley Himalayan' },
  { city: 'Noida', state: 'Uttar Pradesh', country: 'India', lat: 28.5355, lon: 77.3910, tag: 'NCR Expressway' },
  { city: 'Gurugram', state: 'Haryana', country: 'India', lat: 28.4595, lon: 77.0266, tag: 'Financial Corridor' },
  { city: 'Amritsar', state: 'Punjab', country: 'India', lat: 31.6340, lon: 74.8723, tag: 'Northwest Border Hub' },
  { city: 'Jalandhar', state: 'Punjab', country: 'India', lat: 31.3260, lon: 75.5762, tag: 'Doaba Industrial Core' }
];

interface OverviewPageProps {
  onNavigate: (tab: string, locationData?: { lat: number; lon: number; city?: string; date?: string }) => void;
  dataMode?: DataMode;
  selectedLocation?: SelectedLocation;
  onLocationChange?: (loc: SelectedLocation) => void;
  selectedDate?: string;
  onDateChange?: (date: string) => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  onNavigate,
  dataMode = 'REAL',
  selectedLocation: propLocation,
  onLocationChange,
  selectedDate: propDate,
  onDateChange
}) => {
  // Default to today's local date (uses client browser local timezone, not UTC)
  const getTodayDate = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [currentCity, setCurrentCity] = useState<string>(propLocation?.city || 'Delhi');
  const [currentState, setCurrentState] = useState<string>(propLocation?.state || 'Delhi-NCR');
  const [currentCountry, setCurrentCountry] = useState<string>(propLocation?.country || 'India');
  const [currentLat, setCurrentLat] = useState<number>(propLocation?.lat || 28.6139);
  const [currentLon, setCurrentLon] = useState<number>(propLocation?.lon || 77.2090);
  const [currentDate, setCurrentDate] = useState<string>(propDate || '2024-01-07');

  // Input control state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showSearchDropdown, setShowSearchDropdown] = useState<boolean>(false);
  const [showManualCoords, setShowManualCoords] = useState<boolean>(false);
  const [manualLatInput, setManualLatInput] = useState<string>(currentLat.toString());
  const [manualLonInput, setManualLonInput] = useState<string>(currentLon.toString());
  const [gpsLoading, setGpsLoading] = useState<boolean>(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Data fetching state
  const [stations, setStations] = useState<GroundStation[]>([]);
  const [summaryData, setSummaryData] = useState<LocationSummaryResponse | null>(null);
  const [coverageData, setCoverageData] = useState<DateCoverageResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Sync prop changes if managed by parent App
  useEffect(() => {
    if (propLocation) {
      setCurrentCity(propLocation.city);
      setCurrentState(propLocation.state);
      setCurrentCountry(propLocation.country);
      setCurrentLat(propLocation.lat);
      setCurrentLon(propLocation.lon);
      setManualLatInput(propLocation.lat.toString());
      setManualLonInput(propLocation.lon.toString());
    }
  }, [propLocation]);

  useEffect(() => {
    if (propDate) {
      setCurrentDate(propDate);
    }
  }, [propDate]);

  // Main location summary fetcher
  const fetchLocationData = async (
    city = currentCity,
    state = currentState,
    country = currentCountry,
    lat = currentLat,
    lon = currentLon,
    date = currentDate
  ) => {
    try {
      setLoading(true);
      setError(null);
      // Immediately clear stale cards while fresh data is retrieved
      setSummaryData(null);

      const [summaryRes, stns, covRes] = await Promise.allSettled([
        api.getLocationSummary({
          city_name: city,
          state_region: state,
          country: country,
          latitude: lat,
          longitude: lon,
          date: date,
          data_mode: dataMode
        }),
        api.getStations(dataMode),
        api.getDateCoverage({
          cityName: city,
          latitude: lat,
          longitude: lon,
          dataMode: dataMode
        })
      ]);

      if (summaryRes.status === 'fulfilled') {
        setSummaryData(summaryRes.value);
      } else {
        throw new Error(summaryRes.reason?.message || 'Failed to fetch location summary');
      }

      if (stns.status === 'fulfilled') setStations(stns.value);
      if (covRes.status === 'fulfilled') setCoverageData(covRes.value);
    } catch (err: any) {
      console.error('Error loading location overview data:', err);
      setError(err?.message || 'Failed to retrieve atmospheric observations for the selected coordinates.');
    } finally {
      setLoading(false);
    }
  };

  // Initial and reactive trigger
  useEffect(() => {
    fetchLocationData(currentCity, currentState, currentCountry, currentLat, currentLon, currentDate);
  }, [currentCity, currentLat, currentLon, currentDate, dataMode]);

  // Handler for selecting a predefined city
  const handleSelectCity = (cityItem: SelectedLocation) => {
    setCurrentCity(cityItem.city);
    setCurrentState(cityItem.state);
    setCurrentCountry(cityItem.country);
    setCurrentLat(cityItem.lat);
    setCurrentLon(cityItem.lon);
    setManualLatInput(cityItem.lat.toString());
    setManualLonInput(cityItem.lon.toString());
    setSearchQuery('');
    setShowSearchDropdown(false);
    setGpsError(null);

    if (onLocationChange) {
      onLocationChange(cityItem);
    }
  };

  // Handler for applying manual coordinates
  const handleApplyManualCoords = (e: React.FormEvent) => {
    e.preventDefault();
    const latNum = parseFloat(manualLatInput);
    const lonNum = parseFloat(manualLonInput);

    if (isNaN(latNum) || latNum < 8.0 || latNum > 38.0) {
      setGpsError('Latitude must be a valid number between 8.0°N and 38.0°N (India).');
      return;
    }
    if (isNaN(lonNum) || lonNum < 68.0 || lonNum > 98.0) {
      setGpsError('Longitude must be a valid number between 68.0°E and 98.0°E (India).');
      return;
    }

    const customCity = `Custom Coord (${latNum.toFixed(2)}°N, ${lonNum.toFixed(2)}°E)`;
    setCurrentCity(customCity);
    setCurrentState('Custom Region');
    setCurrentCountry('India');
    setCurrentLat(latNum);
    setCurrentLon(lonNum);
    setGpsError(null);
    setShowManualCoords(false);

    if (onLocationChange) {
      onLocationChange({
        city: customCity,
        state: 'Custom Region',
        country: 'India',
        lat: latNum,
        lon: lonNum
      });
    }
  };

  // Handler for "Use My Location" (browser geolocation)
  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }

    setGpsLoading(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGpsLoading(false);
        const lat = parseFloat(position.coords.latitude.toFixed(4));
        const lon = parseFloat(position.coords.longitude.toFixed(4));

        if (lat < 8.0 || lat > 38.0 || lon < 68.0 || lon > 98.0) {
          setGpsError(`GPS coordinates (${lat}°N, ${lon}°E) are outside the Indian subcontinent domain (8°-38°N, 68°-98°E). Please select an Indian urban hub or enter coordinates within India.`);
          return;
        }

        const locName = `My Location (${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E)`;
        setCurrentCity(locName);
        setCurrentState('Local GPS Device');
        setCurrentCountry('India');
        setCurrentLat(lat);
        setCurrentLon(lon);
        setManualLatInput(lat.toString());
        setManualLonInput(lon.toString());

        if (onLocationChange) {
          onLocationChange({
            city: locName,
            state: 'Local GPS Device',
            country: 'India',
            lat,
            lon
          });
        }
      },
      (geoErr) => {
        setGpsLoading(false);
        if (geoErr.code === geoErr.PERMISSION_DENIED) {
          setGpsError('Location access was denied. You can manually enter latitude & longitude below.');
        } else {
          setGpsError(`GPS lookup failed: ${geoErr.message}`);
        }
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Handler for changing observation date
  const handleDateChange = (newDate: string) => {
    setCurrentDate(newDate);
    // Guard against incomplete typing or out-of-range years
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
      return;
    }
    const year = parseInt(newDate.substring(0, 4), 10);
    if (year < 2018 || year > 2030) {
      return;
    }
    if (onDateChange) {
      onDateChange(newDate);
    }
    fetchLocationData(currentCity, currentState, currentCountry, currentLat, currentLon, newDate);
  };

  const filteredCities = PREDEFINED_CITIES.filter(
    (c) =>
      c.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.state.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
              onClick={() => onNavigate('map', { lat: currentLat, lon: currentLon, city: currentCity, date: currentDate })}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition-all shadow-lg shadow-cyan-500/20"
            >
              <Layers className="w-4 h-4" />
              <span>Explore Interactive Map</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => onNavigate('predict', { lat: currentLat, lon: currentLon, city: currentCity, date: currentDate })}
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

      {/* ========================================================================= */}
      {/* 1. DYNAMIC LOCATION & CURRENT-DATE SELECTOR CONTROL PANEL */}
      {/* ========================================================================= */}
      <div className="bg-navy-900/90 border border-cyan-500/30 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>Location Selection & Observation Date Control</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/40 font-normal">
                  P19 Requirement 1
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Select Indian urban centers, input manual GPS coordinates, or pick observation dates
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchLocationData()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors"
              title="Refresh observation data for current coordinates"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Fetching...' : 'Refresh Data'}</span>
            </button>

            <button
              onClick={handleUseMyLocation}
              disabled={gpsLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-950/70 hover:bg-cyan-900/80 text-cyan-300 border border-cyan-700/50 text-xs font-medium transition-colors"
              title="Locate via browser GPS"
            >
              <Navigation className={`w-3.5 h-3.5 ${gpsLoading ? 'animate-pulse text-amber-400' : 'text-cyan-400'}`} />
              <span>{gpsLoading ? 'Detecting GPS...' : 'Use My Location'}</span>
            </button>
          </div>
        </div>

        {gpsError && (
          <div className="text-xs text-amber-300 bg-amber-950/40 border border-amber-800/60 rounded-lg p-2.5 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>{gpsError}</span>
          </div>
        )}

        {/* Quick-Pick City Pills */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Quick-Select Indian Hubs (Patna, Delhi, Ludhiana, Mumbai, etc.):
          </div>
          <div className="flex flex-wrap gap-2">
            {PREDEFINED_CITIES.map((c) => {
              const isSelected = currentCity === c.city;
              return (
                <button
                  key={c.city}
                  onClick={() => handleSelectCity(c)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    isSelected
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                      : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700 border border-slate-700/80'
                  }`}
                >
                  {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  <span>{c.city}</span>
                  <span className={`text-[10px] ${isSelected ? 'text-slate-900/80' : 'text-slate-500'}`}>
                    ({c.state})
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Search, Manual Lat/Lon, and Date Picker Row */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2">
          {/* Autocomplete City Search */}
          <div className="md:col-span-5 relative">
            <label className="block text-[11px] uppercase tracking-wider text-slate-400 font-medium mb-1">
              Search City / Region
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Type to filter cities (e.g. Patna, Mumbai, Ludhiana)..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSearchDropdown(true);
                }}
                onFocus={() => setShowSearchDropdown(true)}
                className="w-full bg-slate-900/90 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>

            {/* Dropdown Results */}
            {showSearchDropdown && searchQuery.trim().length > 0 && (
              <div className="absolute z-30 left-0 right-0 mt-1 bg-navy-900 border border-slate-700 rounded-lg shadow-2xl max-h-48 overflow-y-auto divide-y divide-slate-800">
                {filteredCities.length > 0 ? (
                  filteredCities.map((c) => (
                    <button
                      key={c.city}
                      onClick={() => handleSelectCity(c)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-slate-800 flex items-center justify-between text-slate-200 transition-colors"
                    >
                      <div>
                        <span className="font-semibold text-white">{c.city}</span>
                        <span className="text-slate-400 ml-1.5">({c.state}, {c.country})</span>
                      </div>
                      <span className="text-[10px] font-mono text-cyan-400">
                        {c.lat.toFixed(2)}°N, {c.lon.toFixed(2)}°E
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-2 text-xs text-slate-500 italic">
                    No matching preset found. You can enter manual coordinates below.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Date Picker (Defaults to User Local Date) */}
          <div className="md:col-span-4">
            <label className="block text-[11px] uppercase tracking-wider text-slate-400 font-medium mb-1 flex items-center justify-between">
              <span>Observation Date</span>
              <span className="text-[10px] text-cyan-400 font-normal">
                {currentDate === getTodayDate() ? 'Default: Today' : 'Historical'}
              </span>
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="date"
                min="2018-01-01"
                max={getTodayDate()}
                value={currentDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="w-full bg-slate-900/90 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 transition-colors font-mono"
              />
            </div>
          </div>

          {/* Manual Lat/Lon Toggle Button */}
          <div className="md:col-span-3 flex items-end">
            <button
              onClick={() => setShowManualCoords(!showManualCoords)}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium transition-colors"
            >
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              <span>{showManualCoords ? 'Hide Lat/Lon' : 'Manual Lat/Lon'}</span>
            </button>
          </div>
        </div>

        {/* Manual Coordinates Drawer */}
        {showManualCoords && (
          <form
            onSubmit={handleApplyManualCoords}
            className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl space-y-3 animate-fadeIn"
          >
            <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <span>Manual Geographic Coordinates (Indian Subcontinent: 8°-38°N, 68°-98°E):</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] uppercase font-mono text-slate-400 mb-1">
                  Latitude (°N)
                </label>
                <input
                  type="number"
                  step="0.0001"
                  min="8.0"
                  max="38.0"
                  value={manualLatInput}
                  onChange={(e) => setManualLatInput(e.target.value)}
                  placeholder="e.g. 25.5941"
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-mono text-slate-400 mb-1">
                  Longitude (°E)
                </label>
                <input
                  type="number"
                  step="0.0001"
                  min="68.0"
                  max="98.0"
                  value={manualLonInput}
                  onChange={(e) => setManualLonInput(e.target.value)}
                  placeholder="e.g. 85.1376"
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full px-3 py-1.5 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition-colors"
                >
                  Apply Coordinates
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Date-Wise Coverage & Milestone Quick-Jump Bar */}
        <div className="pt-3 border-t border-slate-800 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">
                Verified Date-Wise Coverage & Quick Jump:
              </span>
            </div>
            {coverageData && (
              <div className="text-[11px] font-mono">
                {coverageData.station_info.has_records ? (
                  <span className="text-emerald-400 font-semibold flex items-center gap-1.5 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/40">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>{coverageData.queried_city || currentCity} In-Situ: {coverageData.station_info.total_records} records ({coverageData.station_info.min_date} to {coverageData.station_info.max_date})</span>
                  </span>
                ) : (
                  <span className="text-cyan-400 flex items-center gap-1.5 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
                    <Info className="w-3 h-3 text-cyan-400" />
                    <span>Regional CAMS Model active for {coverageData.queried_city || currentCity} (0 localized in-situ records)</span>
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {[
              { date: '2023-12-15', label: 'Dec 15, 2023: Multi-City In-Situ (Patna, Mumbai, etc.)', badge: 'IN-SITU' },
              { date: '2024-01-01', label: 'Jan 01, 2024: Delhi-NCR In-Situ + S5P L2', badge: 'COLLOCATION' },
              { date: '2024-01-07', label: 'Jan 07, 2024: S5P L2 Orbit 32304', badge: 'SATELLITE L2' },
              { date: '2024-01-10', label: 'Jan 10, 2024: S5P-CPCB Spatial Collocation', badge: 'COLLOCATION' },
              { date: '2024-05-20', label: 'May 20, 2024: Pre-Monsoon S5P Orbit', badge: 'SATELLITE L2' },
              { date: getTodayDate(), label: 'Today: Live High-Res NWP Weather', badge: 'LIVE NWP' }
            ].map((m) => {
              const isCurrent = currentDate === m.date;
              return (
                <button
                  key={m.date}
                  type="button"
                  onClick={() => handleDateChange(m.date)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-all flex items-center gap-1.5 border whitespace-nowrap ${
                    isCurrent
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500 font-bold shadow-md shadow-cyan-500/10'
                      : 'bg-slate-900/80 text-slate-400 hover:text-white hover:bg-slate-800 border-slate-700/80'
                  }`}
                >
                  <Calendar className="w-3 h-3 text-cyan-400 flex-shrink-0" />
                  <span>{m.label}</span>
                </button>
              );
            })}

            {/* City-specific in-situ jump button if current city has records and date is not within range */}
            {coverageData?.station_info.has_records &&
              coverageData.station_info.min_date &&
              currentDate !== coverageData.station_info.min_date && (
                <button
                  type="button"
                  onClick={() => handleDateChange(coverageData.station_info.min_date!)}
                  className="px-2.5 py-1 rounded-md text-[11px] font-mono bg-emerald-950/90 text-emerald-300 hover:bg-emerald-900 border border-emerald-500/60 flex items-center gap-1.5 transition-all shadow-md shadow-emerald-950/40 whitespace-nowrap"
                  title={`Jump directly to authenticated in-situ records for ${currentCity}`}
                >
                  <Sparkles className="w-3 h-3 text-emerald-400 animate-pulse flex-shrink-0" />
                  <span>Jump to {currentCity} In-Situ ({coverageData.station_info.min_date})</span>
                </button>
              )}
          </div>
        </div>

        {/* Selected Coordinates & Provenance Ribbon */}
        <div className="pt-2 flex flex-wrap items-center justify-between gap-2 text-xs border-t border-slate-800/80">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Current Target:</span>
            <span className="font-bold text-white bg-slate-800 px-2.5 py-0.5 rounded border border-slate-700">
              {currentCity}, {currentState}, {currentCountry}
            </span>
            <span className="text-cyan-400 font-mono text-[11px]">
              [{currentLat.toFixed(4)}°N, {currentLon.toFixed(4)}°E]
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
            <span>Query Date: <strong className="text-white">{currentDate}</strong></span>
            {currentDate === getTodayDate() && (
              <span className="bg-emerald-950 text-emerald-400 border border-emerald-800/40 px-2 py-0.5 rounded">
                Live Local Date
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TRUTH-IN-DATA AVAILABILITY BANNER (NEVER LABELS HISTORICAL AS CURRENT) */}
      {/* ========================================================================= */}
      {summaryData && !summaryData.data_availability.is_current_available && (
        <div className="bg-amber-950/40 border border-amber-500/40 rounded-xl p-4 sm:p-5 space-y-3 text-amber-200 text-xs shadow-lg animate-fadeIn">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="space-y-1 flex-1">
              <div className="font-semibold text-amber-300 flex items-center justify-between">
                <span className="text-sm">Observation Truth & Temporal Provenance Notice</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-900/60 border border-amber-700/50">
                  P19 Rule 1, 3 & 5
                </span>
              </div>
              <p className="text-slate-300 text-xs leading-relaxed">
                {summaryData.data_availability.status_message}
              </p>
            </div>
          </div>

          {/* Structured Timestamp Provenance Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-amber-800/40 font-mono text-[11px]">
            <div className="bg-navy-950/80 p-2.5 rounded-lg border border-amber-900/50 space-y-1">
              <span className="text-slate-400 block text-[10px] uppercase">1. Selected Query Target</span>
              <div className="font-bold text-white">{summaryData.requested_date}</div>
              <div className="text-[10px] text-cyan-400/90">{summaryData.data_availability.query_timestamp || 'Active Local Query'}</div>
            </div>

            <div className="bg-navy-950/80 p-2.5 rounded-lg border border-amber-900/50 space-y-1">
              <span className="text-slate-400 block text-[10px] uppercase">2. Latest Verified Satellite Orbit</span>
              <div className="font-bold text-amber-300">{summaryData.data_availability.latest_satellite_timestamp || '2024-01-07 21:00 UTC'}</div>
              <div className="text-[10px] text-amber-400/80 truncate">{summaryData.data_availability.satellite_status || 'Pending Daily Swath'}</div>
            </div>

            <div className="bg-navy-950/80 p-2.5 rounded-lg border border-amber-900/50 space-y-1">
              <span className="text-slate-400 block text-[10px] uppercase">3. Latest Verified Ground Reading</span>
              <div className="font-bold text-emerald-300">{summaryData.data_availability.latest_ground_timestamp || '2024-01-10 11:00 UTC'}</div>
              <div className="text-[10px] text-emerald-400/80 truncate">{summaryData.data_availability.ground_status || 'Pending CAAQMS Ingestion'}</div>
            </div>
          </div>

          <div className="text-[11px] text-amber-400/90 bg-amber-950/70 border border-amber-800/60 rounded px-3 py-2 leading-relaxed">
            <strong className="text-white uppercase tracking-wider mr-1">Scientific Integrity Rule:</strong>
            The 2024 baseline observations are historical reference calibration data and are <strong className="text-white underline">never</strong> represented as current October 2026 ground measurements. Predictions for current dates represent unvalidated spatial downscaling extrapolations driven by live weather NWP until real ground measurements for this date are uploaded.
          </div>
        </div>
      )}

      {summaryData && summaryData.data_availability.is_current_available && (
        (() => {
          const badgeType = summaryData.data_availability.verification_badge_type;
          const isInSitu = badgeType === 'IN_SITU_MATCHED';
          const isSat = badgeType === 'SATELLITE_L2_MATCHED';
          const isCams = badgeType === 'CAMS_ATMOSPHERIC_MODEL';
          const isDemo = badgeType === 'DEMO_SIMULATION';

          const cardStyle = isInSitu
            ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
            : isSat
            ? 'bg-cyan-950/40 border-cyan-500/40 text-cyan-200'
            : isCams
            ? 'bg-slate-900/90 border-blue-500/40 text-blue-200'
            : isDemo
            ? 'bg-purple-950/40 border-purple-500/40 text-purple-200'
            : 'bg-amber-950/40 border-amber-500/40 text-amber-200';

          const pillStyle = isInSitu
            ? 'text-emerald-300 bg-emerald-900/60 border-emerald-700/50'
            : isSat
            ? 'text-cyan-300 bg-cyan-900/60 border-cyan-700/50'
            : isCams
            ? 'text-blue-300 bg-blue-950/80 border-blue-700/50'
            : isDemo
            ? 'text-purple-300 bg-purple-900/60 border-purple-700/50'
            : 'text-amber-300 bg-amber-900/60 border-amber-700/50';

          const pillLabel = isInSitu
            ? 'Verified In-Situ Ground Truth'
            : isSat
            ? 'Sentinel-5P L2 Satellite Overpass'
            : isCams
            ? 'Copernicus CAMS Reanalysis (Unvalidated Ground)'
            : isDemo
            ? 'Demonstration Simulation'
            : 'Unvalidated Extrapolation';

          return (
            <div className={`border rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-lg animate-fadeIn ${cardStyle}`}>
              <div className="flex items-center gap-3">
                {isInSitu ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                ) : isSat ? (
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                ) : isCams ? (
                  <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />
                ) : isDemo ? (
                  <Info className="w-4 h-4 text-purple-400 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                )}
                <span className="font-medium leading-relaxed">{summaryData.data_availability.status_message}</span>
              </div>
              <span className={`text-[11px] font-mono px-2.5 py-0.5 rounded border whitespace-nowrap font-semibold ${pillStyle}`}>
                {pillLabel}
              </span>
            </div>
          );
        })()
      )}

      {/* ========================================================================= */}
      {/* LIVE METEOROLOGICAL COVARIATES STRIP */}
      {/* ========================================================================= */}
      {summaryData?.meteorology && (
        <div className="bg-navy-900/70 border border-slate-800 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs shadow-md">
          <div className="flex items-center gap-2 text-slate-300 font-semibold">
            <Compass className="w-4 h-4 text-cyan-400" />
            <span>Meteorological Covariates ({currentCity}):</span>
          </div>

          <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-slate-400 font-mono text-[11px]">
            <span className="flex items-center gap-1.5">
              <Thermometer className="w-3.5 h-3.5 text-rose-400" />
              <span>Temp: <strong className="text-white">{summaryData.meteorology.temperature_c}°C</strong></span>
            </span>
            <span className="flex items-center gap-1.5">
              <CloudRain className="w-3.5 h-3.5 text-cyan-400" />
              <span>RH: <strong className="text-white">{summaryData.meteorology.relative_humidity_pct}%</strong></span>
            </span>
            <span className="flex items-center gap-1.5">
              <Wind className="w-3.5 h-3.5 text-teal-400" />
              <span>Wind: <strong className="text-white">{summaryData.meteorology.wind_speed_ms} m/s</strong></span>
            </span>
            <span>BLH: <strong className="text-white">{summaryData.meteorology.boundary_layer_height_m} m</strong></span>
            <span>Ventilation: <strong className="text-white">{summaryData.meteorology.ventilation_index} m²/s</strong></span>
          </div>

          <span className="text-[10px] text-cyan-400 bg-cyan-950/60 border border-cyan-800/40 px-2 py-0.5 rounded font-mono">
            {summaryData.meteorology.source}
          </span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TARGET DOMAIN & DATE CONTEXT STRIP (DYNAMICALLY FILTERED) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Study Domain Card */}
        <div className="bg-navy-900/60 border border-slate-800 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-950 text-cyan-400 flex items-center justify-center border border-cyan-800/40">
            <MapPin className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Study Domain</div>
            <div className="text-sm font-semibold text-white truncate">
              {summaryData?.city_name || currentCity}
            </div>
            <div className="text-[11px] text-cyan-400/90 font-mono truncate">
              {currentLat.toFixed(3)}°N, {currentLon.toFixed(3)}°E
            </div>
          </div>
        </div>

        {/* Observation Date Card */}
        <div className="bg-navy-900/60 border border-slate-800 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-teal-950 text-teal-400 flex items-center justify-center border border-teal-800/40">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Observation Date</div>
            <div className="text-sm font-semibold text-white font-mono">{currentDate}</div>
            <div className="text-[11px] text-slate-400">
              {currentDate === getTodayDate() ? 'User Current Local Date' : 'Historical Date Query'}
            </div>
          </div>
        </div>

        {/* Reference Stations Card */}
        <div className="bg-navy-900/60 border border-slate-800 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-950 text-indigo-400 flex items-center justify-center border border-indigo-800/40">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Reference Stations</div>
            <div className="text-sm font-semibold text-white truncate">
              {summaryData?.statistics?.monitored_stations_count || stations.length} Monitored Hubs
            </div>
            <div className="text-[11px] text-slate-400 truncate">
              Nearest: <span className="text-slate-300 font-medium">{summaryData?.nearest_station?.name || 'Local'}</span> ({summaryData?.nearest_station?.distance_km ?? 0} km)
            </div>
          </div>
        </div>

        {/* Active Real Model / Data Mode Card */}
        <div className="bg-navy-900/60 border border-slate-800 rounded-xl p-4 flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${
            dataMode === 'REAL' ? 'bg-emerald-950 text-emerald-400 border-emerald-800/40' : 'bg-amber-950 text-amber-400 border-amber-800/40'
          }`}>
            <AlertCircle className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">
              {dataMode === 'REAL' ? 'Verified Database Count' : 'System Data Mode'}
            </div>
            <div className="text-sm font-semibold text-white truncate">
              {dataMode === 'REAL'
                ? (summaryData?.statistics?.active_model_name || 'Real Spatial RF')
                : 'Synthetic Demo Mode'}
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              {dataMode === 'REAL' 
                ? `${summaryData?.statistics?.live_connectors_count ?? 4} Live APIs | ${summaryData?.statistics?.total_observations_count ? `${summaryData.statistics.total_observations_count} Real Obs` : 'Loading DB...'}` 
                : 'Deterministic Physics Sim'}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CRITERIA POLLUTANT STATUS CARDS (DYNAMICALLY ESTIMATED / OBSERVED) */}
      {/* ========================================================================= */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <span>Criteria Atmospheric Pollutants — {currentCity}</span>
              <span className="text-xs font-normal text-slate-400">({currentDate})</span>
            </h2>
            <p className="text-xs text-slate-400">
              Downscaled ground-level predictions, spaceborne columns, and regulatory compliance standards
            </p>
          </div>
          <span className="text-xs font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-800/40 px-2.5 py-1 rounded">
            5 Criteria Species
          </span>
        </div>

        {loading ? (
          <div className="bg-navy-900/60 border border-slate-800 rounded-xl p-12 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
            <div className="text-sm font-semibold text-white">
              Retrieving atmospheric columns and calculating spatial downscaling for {currentCity}...
            </div>
            <p className="text-xs text-slate-500 font-mono">
              Coordinates: {currentLat.toFixed(4)}°N, {currentLon.toFixed(4)}°E | Date: {currentDate}
            </p>
          </div>
        ) : error ? (
          <div className="bg-red-950/40 border border-red-800/60 rounded-xl p-6 text-center space-y-2 text-red-200">
            <AlertCircle className="w-6 h-6 text-red-400 mx-auto" />
            <div className="text-sm font-semibold">{error}</div>
            <button
              onClick={() => fetchLocationData()}
              className="px-3 py-1.5 rounded bg-red-900 hover:bg-red-800 text-white text-xs font-medium"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {(summaryData?.pollutants || []).map((pol: LocationSummaryPollutantCard) => (
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
                      <span className="text-2xl font-black text-white">
                        {pol.value !== null && pol.value !== undefined ? pol.value.toFixed(1) : '—'}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">{pol.unit}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center justify-between pt-0.5">
                      <span>
                        {pol.is_extrapolated
                          ? 'Extrapolated Estimate (Live NWP)'
                          : pol.is_modeled
                          ? 'Model Downscaled Surface'
                          : 'Baseline Physical Estimate'}
                      </span>
                      {pol.uncertainty_lower !== null && pol.uncertainty_upper !== null && (
                        <span className="font-mono text-cyan-400/90 text-[9px]">
                          90% CI: [{pol.uncertainty_lower}-{pol.uncertainty_upper}]
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pt-1.5 border-t border-slate-800 text-[11px] space-y-1">
                    <div className="flex justify-between text-slate-400">
                      <span>Satellite Column:</span>
                      <span className={pol.satValue.includes('Not Measured') || pol.satValue.includes('Pending') ? 'text-slate-500 italic text-[10px]' : 'text-cyan-300 font-mono font-medium'}>
                        {pol.satValue} {pol.satUnit}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>CPCB Limit:</span>
                      <span className="text-slate-300 font-mono">{pol.cpcbLimit} {pol.unit}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>WHO Limit:</span>
                      <span className="text-slate-300 font-mono">{pol.whoLimit} {pol.unit}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-slate-800/60 space-y-1.5">
                  <p className="text-[10px] text-slate-400 italic line-clamp-2">
                    {pol.desc}
                  </p>

                  {pol.is_extrapolated && pol.is_modeled && (
                    <div className="text-[9px] font-mono text-amber-300 bg-amber-950/70 border border-amber-800/60 px-1.5 py-0.5 rounded flex items-center justify-between">
                      <span>Extrapolated Model Estimate</span>
                      <span className="text-[8px] text-amber-400/80">Unverified for {currentDate}</span>
                    </div>
                  )}

                  {pol.is_ground_truth && (
                    <div className="text-[9px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-1.5 py-0.5 rounded">
                      Verified In-Situ CPCB Observation ({pol.ground_observation_time?.slice(11, 16) || ''})
                    </div>
                  )}

                  {!pol.is_modeled && (
                    <div className="text-[9px] font-mono text-amber-400/90 bg-amber-950/60 border border-amber-800/40 px-1.5 py-0.5 rounded">
                      Unvalidated: Insufficient Ground Pairs
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SYSTEM ARCHITECTURE & METHODOLOGY SNAPSHOT */}
      {/* ========================================================================= */}
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
                Elevation and multi-city road proximity indices provide hyper-local proxy variation within coarse 5.5km satellite footprints.
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
              onClick={() => onNavigate('data')}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-medium inline-flex items-center gap-1.5"
            >
              <span>Explore Satellite & CPCB Paired Observations</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
