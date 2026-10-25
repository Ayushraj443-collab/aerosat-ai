import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import {
  Layers,
  MapPin,
  Eye,
  Info,
  RefreshCw,
  Sparkles,
  AlertTriangle
} from 'lucide-react';
import { api } from '../services/api';
import type { GroundStation, GeoJsonGridCollection, DataMode } from '../services/types';

interface MapPageProps {
  onSelectCoordinateForPrediction?: (lat: number, lon: number, pollutant: string) => void;
  dataMode?: DataMode;
}

export const MapPage: React.FC<MapPageProps> = ({ onSelectCoordinateForPrediction, dataMode = 'REAL' }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const stationsLayerRef = useRef<L.LayerGroup | null>(null);
  const gridLayerRef = useRef<L.GeoJSON | null>(null);

  const [stations, setStations] = useState<GroundStation[]>([]);
  const [gridData, setGridData] = useState<GeoJsonGridCollection | null>(null);
  const [selectedPollutant, setSelectedPollutant] = useState<string>('NO2');
  const [selectedResolution, setSelectedResolution] = useState<number>(2.0);
  const [selectedDate, setSelectedDate] = useState<string>('2024-03-01');

  // Layer Toggles
  const [showStations, setShowStations] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showUncertaintyMode, setShowUncertaintyMode] = useState<boolean>(false);
  const [showCloudMask, setShowCloudMask] = useState<boolean>(true);

  const [loading, setLoading] = useState<boolean>(false);
  const [gridError, setGridError] = useState<string | null>(null);
  const [selectedCellInfo, setSelectedCellInfo] = useState<any | null>(null);
  const [clickedCoord, setClickedCoord] = useState<{ lat: number; lon: number } | null>(null);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Center on Delhi-NCR
    const map = L.map(mapContainerRef.current, {
      center: [28.6139, 77.2090],
      zoom: 10,
      minZoom: 8,
      maxZoom: 15,
    });

    // Dark Tile Layer (CartoDB Dark Matter with attribution)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    const stationsGroup = L.layerGroup().addTo(map);
    stationsLayerRef.current = stationsGroup;

    map.on('click', (e: L.LeafletMouseEvent) => {
      setClickedCoord({
        lat: Number(e.latlng.lat.toFixed(5)),
        lon: Number(e.latlng.lng.toFixed(5)),
      });
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Fetch Stations on mount and mode change
  useEffect(() => {
    async function loadStations() {
      try {
        const stns = await api.getStations(dataMode);
        setStations(stns);
      } catch (err) {
        console.error('Failed to load stations:', err);
      }
    }
    loadStations();
  }, [dataMode]);

  // Fetch Downscaled Grid when filters or dataMode change
  useEffect(() => {
    async function loadGrid() {
      try {
        setLoading(true);
        setGridError(null);
        const data = await api.getDownscaledGrid({
          mode: dataMode,
          pollutant: selectedPollutant,
          resolution_km: selectedResolution,
          date: selectedDate,
        });
        setGridData(data);
      } catch (err: any) {
        console.error('Failed to load downscaled grid:', err);
        setGridError(err.message || 'Failed to load grid');
      } finally {
        setLoading(false);
      }
    }
    loadGrid();
  }, [selectedPollutant, selectedResolution, selectedDate, dataMode]);

  // Color ramp for concentrations
  const getConcentrationColor = (val: number | null, pollutant: string): string => {
    if (val === null) return '#475569'; // missing / cloud masked
    const p = pollutant.toUpperCase();
    if (p === 'PM2.5') {
      if (val <= 30) return '#10b981';
      if (val <= 60) return '#06b6d4';
      if (val <= 90) return '#facc15';
      if (val <= 120) return '#f97316';
      if (val <= 250) return '#ef4444';
      return '#9333ea';
    } else if (p === 'NO2') {
      if (val <= 25) return '#10b981';
      if (val <= 50) return '#06b6d4';
      if (val <= 80) return '#facc15';
      if (val <= 120) return '#f97316';
      if (val <= 180) return '#ef4444';
      return '#9333ea';
    } else {
      if (val <= 15) return '#10b981';
      if (val <= 30) return '#06b6d4';
      if (val <= 50) return '#facc15';
      if (val <= 100) return '#f97316';
      return '#ef4444';
    }
  };

  // Color ramp for uncertainty (tree ensemble SD)
  const getUncertaintyColor = (sd: number | null): string => {
    if (sd === null) return '#475569';
    if (sd <= 2.0) return '#0284c7';
    if (sd <= 4.0) return '#06b6d4';
    if (sd <= 6.5) return '#eab308';
    if (sd <= 9.0) return '#f97316';
    return '#dc2626';
  };

  // Render Grid onto Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (gridLayerRef.current) {
      map.removeLayer(gridLayerRef.current);
      gridLayerRef.current = null;
    }

    if (!showGrid || !gridData) return;

    const geoJsonLayer = L.geoJSON(gridData as any, {
      style: (feature: any) => {
        const props = feature.properties;
        const isDataGap = props.is_data_gap;

        if (isDataGap && !showCloudMask) {
          return { fillOpacity: 0, weight: 0 };
        }

        if (isDataGap) {
          return {
            fillColor: '#334155',
            color: '#64748b',
            weight: 1,
            fillOpacity: 0.45,
            dashArray: '3, 3',
          };
        }

        const color = showUncertaintyMode
          ? getUncertaintyColor(props.uncertainty_sd)
          : getConcentrationColor(props.estimated_value, selectedPollutant);

        return {
          fillColor: color,
          color: color,
          weight: 0.8,
          fillOpacity: 0.65,
        };
      },
      onEachFeature: (feature: any, layer: L.Layer) => {
        const props = feature.properties;
        layer.on({
          mouseover: (e) => {
            const target = e.target;
            target.setStyle({ weight: 2, color: '#38bdf8' });
          },
          mouseout: (e) => {
            geoJsonLayer.resetStyle(e.target);
          },
          click: () => {
            setSelectedCellInfo(props);
          },
        });
      },
    });

    geoJsonLayer.addTo(map);
    gridLayerRef.current = geoJsonLayer;
  }, [gridData, showGrid, showUncertaintyMode, showCloudMask, selectedPollutant]);

  // Render Stations onto Map
  useEffect(() => {
    const stationsGroup = stationsLayerRef.current;
    if (!stationsGroup) return;

    stationsGroup.clearLayers();
    if (!showStations) return;

    stations.forEach((stn) => {
      const latestReading = stn.latest_reading?.[selectedPollutant]?.value;
      const unit = stn.latest_reading?.[selectedPollutant]?.unit || 'µg/m³';

      // Custom HTML Marker Pin
      const icon = L.divIcon({
        className: 'custom-station-icon',
        html: `
          <div style="
            background: #0f172a;
            border: 2px solid #22d3ee;
            color: #f1f5f9;
            width: 28px;
            height: 28px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 0 10px rgba(6, 182, 212, 0.6);
            font-size: 11px;
            font-weight: 700;
          ">
            <span>AQ</span>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker([stn.latitude, stn.longitude], { icon });

      const popupContent = `
        <div style="font-size: 12px; line-height: 1.4; color: #f8fafc; min-width: 210px;">
          <div style="font-weight: 700; color: #22d3ee; margin-bottom: 4px; font-size: 13px;">${stn.name}</div>
          <div style="color: #94a3b8; font-size: 11px; margin-bottom: 6px;">Station ID: ${stn.station_id} | ${stn.city}</div>
          <div style="background: #1e293b; padding: 6px 8px; border-radius: 6px; margin-bottom: 8px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
              <span style="color: #cbd5e1;">${selectedPollutant} Surface Value:</span>
              <span style="font-weight: 700; color: #f8fafc;">${latestReading ? `${latestReading} ${unit}` : 'Active Monitoring'}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #cbd5e1;">Elevation:</span>
              <span style="color: #94a3b8;">${stn.elevation_m} m MSL</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8;">
              <span>Type:</span>
              <span>${stn.station_type}</span>
            </div>
          </div>
          <div style="font-size: 10px; color: #38bdf8; text-align: center;">Click map to inspect fine-grid estimates</div>
        </div>
      `;

      marker.bindPopup(popupContent);
      stationsGroup.addLayer(marker);
    });
  }, [stations, showStations, selectedPollutant]);

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Top Controls Bar */}
      <div className="bg-navy-900/90 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex flex-wrap items-center gap-3">
          {/* Pollutant Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Pollutant:</span>
            <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
              {['NO2', 'PM2.5', 'SO2', 'CO', 'O3'].map((pol) => (
                <button
                  key={pol}
                  onClick={() => setSelectedPollutant(pol)}
                  className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                    selectedPollutant === pol
                      ? 'bg-cyan-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {pol}
                </button>
              ))}
            </div>
          </div>

          {/* Resolution Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Resolution:</span>
            <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
              {[
                { label: '1 km', value: 1.0 },
                { label: '2 km', value: 2.0 },
                { label: '5 km', value: 5.0 },
              ].map((res) => (
                <button
                  key={res.label}
                  onClick={() => setSelectedResolution(res.value)}
                  className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition-all ${
                    selectedResolution === res.value
                      ? 'bg-slate-800 text-cyan-400 border border-slate-700'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {res.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {/* Layer Toggles & Mode */}
        <div className="flex flex-wrap items-center gap-2">
          <div className={`px-2.5 py-1 rounded-md text-xs font-mono font-bold flex items-center gap-1.5 border ${
            dataMode === 'REAL'
              ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300'
              : 'bg-amber-950/70 border-amber-500/40 text-amber-300'
          }`}>
            <span className={`w-2 h-2 rounded-full ${dataMode === 'REAL' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <span>{dataMode === 'REAL' ? 'REAL SCIENTIFIC GRID' : 'DEMO GRID (SIMULATED)'}</span>
          </div>

          <button
            onClick={() => setShowStations(!showStations)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              showStations
                ? 'bg-cyan-950/60 text-cyan-400 border-cyan-800/60'
                : 'bg-slate-950 text-slate-400 border-slate-800'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Stations</span>
          </button>

          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              showGrid
                ? 'bg-cyan-950/60 text-cyan-400 border-cyan-800/60'
                : 'bg-slate-950 text-slate-400 border-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Downscaled Grid</span>
          </button>

          <button
            onClick={() => setShowUncertaintyMode(!showUncertaintyMode)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              showUncertaintyMode
                ? 'bg-amber-950/60 text-amber-400 border-amber-800/60'
                : 'bg-slate-950 text-slate-400 border-slate-800'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{showUncertaintyMode ? 'Uncertainty Mode (ON)' : 'Uncertainty View'}</span>
          </button>

          <button
            onClick={() => setShowCloudMask(!showCloudMask)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              showCloudMask
                ? 'bg-slate-800 text-slate-300 border-slate-700'
                : 'bg-slate-950 text-slate-500 border-slate-800'
            }`}
          >
            <span>Cloud Mask</span>
          </button>
        </div>
      </div>

      {gridError && (
        <div className="p-3 bg-rose-950/70 border border-rose-600/40 rounded-xl text-xs text-rose-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-400" />
          <span>{gridError}</span>
        </div>
      )}

      {/* Main Map Container */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 h-[580px] shadow-2xl">
        <div ref={mapContainerRef} className="w-full h-full z-10" />

        {/* Loading Overlay */}
        {loading && (
          <div className="absolute top-4 right-4 z-20 bg-slate-900/90 border border-slate-700 px-3.5 py-2 rounded-lg flex items-center gap-2 text-cyan-400 text-xs shadow-xl backdrop-blur-sm">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Computing {selectedResolution} km Downscaled Grid...</span>
          </div>
        )}

        {/* Floating Legend */}
        <div className="absolute bottom-6 left-6 z-20 bg-navy-950/90 border border-slate-800 rounded-xl p-3 text-xs shadow-2xl backdrop-blur-md max-w-xs">
          <div className="text-[11px] font-semibold text-slate-300 mb-1 flex items-center justify-between">
            <span>{showUncertaintyMode ? 'Model Uncertainty (90% CI Width)' : `${selectedPollutant} Concentration`}</span>
            <span className="text-[10px] text-slate-400 font-mono">
              {showUncertaintyMode ? '± Std Dev' : gridData?.metadata.unit || 'µg/m³'}
            </span>
          </div>

          {!showUncertaintyMode ? (
            <div className="space-y-1.5">
              <div className="h-2.5 w-56 rounded bg-gradient-to-r from-emerald-500 via-yellow-400 via-orange-500 to-purple-600 shadow-inner" />
              <div className="flex justify-between text-[10px] font-mono text-slate-400">
                <span>Good</span>
                <span>Satisfactory</span>
                <span>Poor</span>
                <span>Severe</span>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="h-2.5 w-56 rounded bg-gradient-to-r from-sky-600 via-cyan-400 via-amber-400 to-rose-600 shadow-inner" />
              <div className="flex justify-between text-[10px] font-mono text-slate-400">
                <span>Low (&lt;2)</span>
                <span>Moderate (4-6)</span>
                <span>High (&gt;8)</span>
              </div>
            </div>
          )}

          <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-slate-600 border border-slate-400 border-dashed inline-block" />
              <span>Missing Data (QA &lt; 0.5)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full border-2 border-cyan-400 bg-slate-900 inline-block" />
              <span>CPCB Monitor</span>
            </span>
          </div>
        </div>

        {/* Selected Cell / Clicked Point Popup Panel */}
        {(selectedCellInfo || clickedCoord) && (
          <div className="absolute top-4 left-4 z-20 bg-navy-950/95 border border-slate-700/80 rounded-xl p-4 text-xs shadow-2xl backdrop-blur-md max-w-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-1.5 text-cyan-400 font-bold">
                <MapPin className="w-4 h-4" />
                <span>{selectedCellInfo ? `Grid Cell ${selectedCellInfo.cell_id}` : 'Map Coordinate Selected'}</span>
              </div>
              <button
                onClick={() => {
                  setSelectedCellInfo(null);
                  setClickedCoord(null);
                }}
                className="text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            {selectedCellInfo && (
              <div className="space-y-2">
                {selectedCellInfo.is_data_gap ? (
                  <div className="p-2.5 rounded bg-amber-950/40 border border-amber-600/40 text-amber-300 text-[11px] flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span>Missing satellite data at this cell: {selectedCellInfo.gap_reason}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-baseline justify-between">
                      <span className="text-slate-400">Downscaled Estimate:</span>
                      <span className="text-lg font-bold text-white">
                        {selectedCellInfo.estimated_value} {selectedCellInfo.unit}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">90% Confidence Interval:</span>
                      <span className="font-mono text-cyan-300">
                        [{selectedCellInfo.uncertainty_lower_90ci} - {selectedCellInfo.uncertainty_upper_90ci}]
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Satellite Column Density:</span>
                      <span className="font-mono text-slate-300">{selectedCellInfo.satellite_column}</span>
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Satellite QA Score:</span>
                      <span className="font-mono text-emerald-400">{selectedCellInfo.satellite_qa} (Clear)</span>
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">NAQI Category:</span>
                      <span className="font-semibold text-slate-200">{selectedCellInfo.aqi_category}</span>
                    </div>
                  </>
                )}

                <div className="text-[10px] text-slate-500 font-mono">
                  Center: {selectedCellInfo.center_lat}°N, {selectedCellInfo.center_lon}°E
                </div>
              </div>
            )}

            {clickedCoord && !selectedCellInfo && (
              <div className="space-y-2">
                <div className="text-[11px] text-slate-300">
                  Target Coordinate: <span className="font-mono text-cyan-400">{clickedCoord.lat}°N, {clickedCoord.lon}°E</span>
                </div>
                <p className="text-[10px] text-slate-400">
                  Execute a localized spatial downscaling inference at this precise point using current atmospheric covariates.
                </p>
              </div>
            )}

            <button
              onClick={() => {
                const lat = selectedCellInfo ? selectedCellInfo.center_lat : clickedCoord?.lat;
                const lon = selectedCellInfo ? selectedCellInfo.center_lon : clickedCoord?.lon;
                if (lat && lon && onSelectCoordinateForPrediction) {
                  onSelectCoordinateForPrediction(lat, lon, selectedPollutant);
                }
              }}
              className="w-full mt-2 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Predict in Workspace</span>
            </button>
          </div>
        )}
      </div>

      {/* Scientific Notice Banner */}
      <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl text-xs text-slate-400 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong className="text-slate-300">Resolution Notice:</strong> Coarse Sentinel-5P TROPOMI pixels (~5.5 × 3.5 km) measure atmospheric total column molecules. 
          Downscaled 1-2 km polygon layers represent statistical model outputs incorporating topography, planetary boundary layer height, and road density proxies. 
          Independent ground stations (circles) validate model accuracy across space.
        </p>
      </div>
    </div>
  );
};
