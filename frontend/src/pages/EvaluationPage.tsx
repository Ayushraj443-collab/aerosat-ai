import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  ShieldCheck,
  RefreshCw,
  Award,
  Play,
  AlertTriangle,
  Database,
  Calendar,
  Cpu
} from 'lucide-react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  ReferenceLine
} from 'recharts';
import { api } from '../services/api';
import type { ModelMetricsResponse, DataMode } from '../services/types';

interface EvaluationPageProps {
  dataMode?: DataMode;
}

export const EvaluationPage: React.FC<EvaluationPageProps> = ({ dataMode = 'REAL' }) => {
  const [selectedPollutant, setSelectedPollutant] = useState<string>('NO2');
  const [metrics, setMetrics] = useState<ModelMetricsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [retraining, setRetraining] = useState<boolean>(false);
  const [reEvaluating, setReEvaluating] = useState<boolean>(false);
  const [trainAlgorithm, setTrainAlgorithm] = useState<string>('random_forest');
  const [trainTrees, setTrainTrees] = useState<number>(100);
  const [trainDepth, setTrainDepth] = useState<number>(12);
  const [trainFolds, setTrainFolds] = useState<number>(5);

  useEffect(() => {
    setTrainAlgorithm('random_forest');
    setTrainFolds(5);
    loadMetrics();
  }, [selectedPollutant, dataMode]);

  async function loadMetrics(forceFresh = false) {
    try {
      setLoading(true);
      const res = await api.getModelMetrics(selectedPollutant, dataMode, forceFresh);
      setMetrics(res);
    } catch (err) {
      console.error('Failed to load metrics:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleReEvaluate() {
    try {
      setReEvaluating(true);
      const res = await api.reEvaluateModel(selectedPollutant, dataMode, dataMode === 'REAL' ? trainAlgorithm : undefined);
      setMetrics(res);
    } catch (err: any) {
      alert(`Re-evaluation failed: ${err.message}`);
    } finally {
      setReEvaluating(false);
    }
  }

  async function handleRetrain(e: React.FormEvent) {
    e.preventDefault();
    try {
      setRetraining(true);
      const res = await api.trainModel({
        pollutant: selectedPollutant,
        algorithm: trainAlgorithm,
        n_estimators: Number(trainTrees),
        max_depth: Number(trainDepth),
        spatial_cv_folds: Number(trainFolds),
        data_mode: dataMode,
      });
      setMetrics(res);
    } catch (err: any) {
      alert(`Retraining failed: ${err.message}`);
    } finally {
      setRetraining(false);
    }
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header & Pollutant Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <BarChart3 className="w-6 h-6 text-cyan-400" />
              <span>Model Evaluation & Spatial Validation</span>
            </h1>
            {dataMode === 'REAL' ? (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Real Model
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/30">
                Demo Model
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400">
            {dataMode === 'REAL'
              ? 'Trained and validated on verified real CPCB stations & Copernicus Sentinel-5P atmospheric observations with GroupKFold spatial holdout.'
              : 'Demonstration spatial model trained on multi-station synthetic air quality scenarios.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleReEvaluate}
            disabled={reEvaluating || loading}
            title="Re-run fresh spatial evaluation on current observations"
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-400 border border-cyan-800/40 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${reEvaluating ? 'animate-spin text-cyan-400' : ''}`} />
            <span>{reEvaluating ? 'Evaluating...' : 'Re-run Evaluation'}</span>
          </button>

          <div className="flex items-center gap-1 bg-navy-900 p-1 rounded-xl border border-slate-800">
            {['NO2', 'PM2.5', 'SO2', 'CO', 'O3'].map((p) => (
              <button
                key={p}
                onClick={() => setSelectedPollutant(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  selectedPollutant === p
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && !metrics ? (
        <div className="py-24 text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
          <div className="text-xs text-slate-400">Loading spatial validation metrics for {selectedPollutant}...</div>
        </div>
      ) : metrics ? (
        <div className="space-y-6">
          {/* Metadata & Provenance Provenance Strip */}
          <div className="bg-navy-900/90 border border-slate-800/80 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-1.5 text-slate-300 font-mono text-[11px] bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-slate-400">Model:</span>
                <span className="text-white font-semibold">{metrics.model_id}</span>
              </span>
              <span className="flex items-center gap-1.5 text-slate-300 font-mono text-[11px] bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                <Database className="w-3.5 h-3.5 text-teal-400" />
                <span className="text-slate-400">Dataset:</span>
                <span className="text-teal-300">{metrics.dataset_version || (dataMode === 'REAL' ? 'S5P_L2_TROPOMI_CPCB_PAIRED_V2' : 'AEROSAT_DEMO_SYNTHETIC_V1')}</span>
                {metrics.dataset_fingerprint && (
                  <span className="text-[10px] text-slate-400 font-mono">({metrics.dataset_fingerprint})</span>
                )}
              </span>
              <span className="flex items-center gap-1.5 text-slate-300 font-mono text-[11px] bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-slate-400">Validation:</span>
                <span className="text-emerald-300 font-medium">{metrics.validation_method || `${metrics.spatial_validation_folds.length} Spatial Folds (GroupKFold)`}</span>
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-mono">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Evaluated: {metrics.trained_at ? new Date(metrics.trained_at).toLocaleString() : 'N/A'}</span>
            </div>
          </div>

          {/* Preliminary Evaluation Warning Banner (if N < 30 on real data) */}
          {(dataMode === 'REAL' && (metrics.val_samples < 30 || metrics.is_preliminary)) && (
            <div className="bg-amber-950/30 border border-amber-800/40 rounded-xl p-3.5 flex items-start gap-3 text-xs text-amber-200/90 shadow-sm animate-fadeIn">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold text-amber-300 flex items-center gap-2">
                  <span>Preliminary Ground Validation ({metrics.val_samples} Collocated Spatial Stations)</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase font-mono tracking-wider">
                    Scientific Protocol
                  </span>
                </div>
                <p className="text-[11px] text-amber-200/80 leading-relaxed">
                  {metrics.data_limitation_notice || `Ground truth is evaluated across ${metrics.val_samples} verified CPCB monitoring stations collocated with authentic ESA Sentinel-5P TROPOMI Level-2 orbits across multiple dates. Spatial GroupKFold validation strictly isolates held-out stations in each fold to evaluate true spatial generalization.`}
                </p>
              </div>
            </div>
          )}

          {/* Key Metric Scorecards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-navy-900/80 border border-slate-800 rounded-xl p-4 space-y-1">
              <div className="text-[11px] text-slate-400 font-medium">Out-of-Fold R²</div>
              <div className={`text-2xl sm:text-3xl font-black font-mono ${metrics.r2 >= 0 ? 'text-cyan-400' : 'text-amber-400'}`}>
                {metrics.r2.toFixed(3)}
              </div>
              <div className={`text-[10px] ${metrics.r2 >= 0 ? 'text-emerald-400' : 'text-amber-400/90'}`}>
                {metrics.r2 >= 0 ? 'Spatial Generalization Score' : 'Spatial Generalization (Held-Out)'}
              </div>
            </div>

            <div className="bg-navy-900/80 border border-slate-800 rounded-xl p-4 space-y-1">
              <div className="text-[11px] text-slate-400 font-medium">Mean Absolute Error (MAE)</div>
              <div className="text-2xl sm:text-3xl font-black text-white font-mono">
                {metrics.mae.toFixed(2)}
              </div>
              <div className="text-[10px] text-slate-400">Typical absolute deviation (µg/m³)</div>
            </div>

            <div className="bg-navy-900/80 border border-slate-800 rounded-xl p-4 space-y-1">
              <div className="text-[11px] text-slate-400 font-medium">Root Mean Sq. Error (RMSE)</div>
              <div className="text-2xl sm:text-3xl font-black text-white font-mono">
                {metrics.rmse.toFixed(2)}
              </div>
              <div className="text-[10px] text-slate-400">Penalizes large errors (µg/m³)</div>
            </div>

            <div className="bg-navy-900/80 border border-slate-800 rounded-xl p-4 space-y-1">
              <div className="text-[11px] text-slate-400 font-medium">Mean Bias Error (MBE)</div>
              <div className={`text-2xl sm:text-3xl font-black font-mono ${metrics.mean_bias_error >= 0 ? 'text-amber-400' : 'text-cyan-400'}`}>
                {metrics.mean_bias_error > 0 ? `+${metrics.mean_bias_error.toFixed(2)}` : metrics.mean_bias_error.toFixed(2)}
              </div>
              <div className="text-[10px] text-slate-400">Systematic bias tendency</div>
            </div>

            <div className="bg-navy-900/80 border border-slate-800 rounded-xl p-4 space-y-1 col-span-2 lg:col-span-1">
              <div className="text-[11px] text-slate-400 font-medium">Evaluation Samples</div>
              <div className="text-2xl sm:text-3xl font-black text-slate-200 font-mono">
                {metrics.val_samples}
              </div>
              <div className="text-[10px] text-cyan-400 font-mono">{metrics.spatial_validation_folds.length} Spatial Folds</div>
            </div>
          </div>

          {/* Baseline Comparison Card */}
          <div className="bg-navy-900/70 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Baseline Comparison: Spatial IDW vs AI Satellite Model
                </h3>
              </div>
              <span className={`text-xs font-mono px-2.5 py-1 rounded border ${
                metrics.baseline_comparison.ml_improvement_mae_pct >= 0
                  ? 'text-emerald-400 bg-emerald-950/60 border-emerald-800/40'
                  : 'text-amber-400 bg-amber-950/60 border-amber-800/40'
              }`}>
                {metrics.baseline_comparison.ml_improvement_mae_pct >= 0 ? '+' : ''}
                {metrics.baseline_comparison.ml_improvement_mae_pct}% {metrics.baseline_comparison.ml_improvement_mae_pct >= 0 ? 'MAE Reduction vs Baseline' : 'Higher Absolute Error vs Baseline'}
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              To defend the scientific utility of satellite column integration, the machine learning model is benchmarked 
              against standard Inverse Distance Weighting (IDW) from nearest ground monitors evaluated on identical held-out stations.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-850">
                <div className="text-[11px] text-slate-400">Nearest Station IDW Baseline</div>
                <div className="mt-2 space-y-1 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400">MAE:</span>
                    <span className="text-slate-200">{metrics.baseline_comparison.baseline_mae != null ? metrics.baseline_comparison.baseline_mae.toFixed(2) : 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">RMSE:</span>
                    <span className="text-slate-200">{metrics.baseline_comparison.baseline_rmse != null ? metrics.baseline_comparison.baseline_rmse.toFixed(2) : 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">R²:</span>
                    <span className="text-slate-200">{metrics.baseline_comparison.baseline_r2 != null ? metrics.baseline_comparison.baseline_r2.toFixed(3) : 'N/A'}</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-cyan-900/40">
                <div className="text-[11px] text-cyan-400 font-semibold">AeroSat AI Downscaler</div>
                <div className="mt-2 space-y-1 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400">MAE:</span>
                    <span className="text-cyan-300 font-bold">{metrics.mae != null ? metrics.mae.toFixed(2) : 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">RMSE:</span>
                    <span className="text-cyan-300 font-bold">{metrics.rmse != null ? metrics.rmse.toFixed(2) : 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">R²:</span>
                    <span className={`font-bold ${metrics.r2 >= 0 ? 'text-cyan-300' : 'text-amber-400'}`}>
                      {metrics.r2 != null ? metrics.r2.toFixed(3) : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 flex flex-col justify-center text-xs space-y-2">
                <div className="text-slate-400 text-[11px]">Scientific Comparison</div>
                <div className={`font-bold text-sm ${metrics.baseline_comparison.ml_improvement_mae_pct >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {metrics.baseline_comparison.ml_improvement_mae_pct >= 0
                    ? `${metrics.baseline_comparison.ml_improvement_mae_pct}% Lower Absolute Error vs IDW`
                    : `${Math.abs(metrics.baseline_comparison.ml_improvement_mae_pct)}% Higher Absolute Error vs IDW`}
                </div>
                <div className="text-slate-400 text-[10px]">
                  Evaluates whether spaceborne column integration captures localized pollution gradients compared to direct spatial distance interpolation on identical held-out stations.
                </div>
              </div>
            </div>
          </div>

          {/* Plots Grid: Observed vs Predicted & Residual Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Scatter Plot */}
            <div className="bg-navy-900/80 border border-slate-800 rounded-2xl p-5 space-y-3 shadow-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Observed vs Predicted Ground Concentrations
                  </h3>
                  <p className="text-[10px] text-slate-400">Held-out spatial station observations vs model predictions</p>
                </div>
                <span className="text-[10px] font-mono text-cyan-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                  1:1 Line of Perfect Agreement
                </span>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      type="number"
                      dataKey="observed"
                      name="Observed"
                      unit=""
                      stroke="#64748b"
                      fontSize={10}
                      label={{ value: 'Ground Observed Value', position: 'insideBottom', offset: -10, fill: '#94a3b8', fontSize: 10 }}
                    />
                    <YAxis
                      type="number"
                      dataKey="predicted"
                      name="Predicted"
                      unit=""
                      stroke="#64748b"
                      fontSize={10}
                      label={{ value: 'Model Estimated Value', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 10 }}
                    />
                    <Tooltip
                      cursor={{ strokeDasharray: '3 3' }}
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px', color: '#f8fafc' }}
                    />
                    <Scatter
                      name="Station Validation Pairs"
                      data={metrics.observed_vs_predicted}
                      fill="#06b6d4"
                      fillOpacity={0.65}
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Residuals Distribution Histogram */}
            <div className="bg-navy-900/80 border border-slate-800 rounded-2xl p-5 space-y-3 shadow-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Residual Error Distribution (y_pred - y_true)
                  </h3>
                  <p className="text-[10px] text-slate-400">Mean: {metrics.residual_distribution.mean_residual} | Std Dev: {metrics.residual_distribution.std_residual}</p>
                </div>
                <span className="text-[10px] font-mono text-teal-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                  Gaussian Centered Zero
                </span>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.residual_distribution.histogram} margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="bin_center"
                      stroke="#64748b"
                      fontSize={10}
                      label={{ value: 'Residual Error (y_pred - y_true)', position: 'insideBottom', offset: -10, fill: '#94a3b8', fontSize: 10 }}
                    />
                    <YAxis
                      stroke="#64748b"
                      fontSize={10}
                      label={{ value: 'Sample Count', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 10 }}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px', color: '#f8fafc' }}
                    />
                    <ReferenceLine x={0} stroke="#f43f5e" strokeDasharray="2 2" />
                    <Bar dataKey="count" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Spatial Cross-Validation Folds Table */}
          <div className="bg-navy-900/80 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Spatial GroupKFold Validation Matrix (Zero Spatial Leakage)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Entire monitoring stations are completely held out from training in each fold to test true spatial generalization.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Fold</th>
                    <th className="py-2.5 px-3">Held-Out Test Stations</th>
                    <th className="py-2.5 px-3 text-right">Train Obs</th>
                    <th className="py-2.5 px-3 text-right">Test Obs</th>
                    <th className="py-2.5 px-3 text-right">Fold MAE</th>
                    <th className="py-2.5 px-3 text-right">Fold RMSE</th>
                    <th className="py-2.5 px-3 text-right">Fold R²</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                  {metrics.spatial_validation_folds.map((fold) => (
                    <tr key={fold.fold} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-2.5 px-3 font-bold text-cyan-400">Fold #{fold.fold}</td>
                      <td className="py-2.5 px-3 text-slate-300 font-sans text-[11px]">
                        {fold.held_out_stations.join(', ')}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-400">{fold.train_count}</td>
                      <td className="py-2.5 px-3 text-right text-slate-200">{fold.val_count}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-200">{fold.mae.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right text-slate-300">{fold.rmse.toFixed(2)}</td>
                      <td className={`py-2.5 px-3 text-right font-bold ${fold.r2 >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {fold.r2.toFixed(3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Feature Importances */}
          <div className="bg-navy-900/80 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              <span>Model Feature Importance Ranking</span>
            </h3>
            <p className="text-xs text-slate-400">
              Gini impurity reduction weight showing the relative importance of spaceborne retrievals and atmospheric variables.
            </p>

            <div className="space-y-2.5 pt-2">
              {metrics.feature_importances.map((f) => (
                <div key={f.feature} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-mono text-slate-300">{f.feature}</span>
                    <span className="font-mono text-cyan-400 font-semibold">{(f.importance * 100).toFixed(1)}%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-850">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-teal-400 rounded-full transition-all"
                      style={{ width: `${Math.min(100, f.importance * 100 * 2.2)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* On-Demand Retraining Form */}
          <div className="bg-navy-900/90 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-white font-bold text-sm uppercase tracking-wider">
                <Play className="w-4 h-4 text-cyan-400" />
                <span>On-Demand Spatial Retraining & Hyperparameter Tuning</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">Target: {selectedPollutant}</span>
            </div>

            <form onSubmit={handleRetrain} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="space-y-1">
                <label className="text-slate-400 font-medium">Algorithm:</label>
                <select
                  aria-label="Algorithm"
                  value={trainAlgorithm}
                  onChange={(e) => setTrainAlgorithm(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="bayesian_ridge">Bayesian Ridge (Optimal for Sparse Observations)</option>
                  <option value="ridge">Ridge Regression (L2 Regularized)</option>
                  <option value="elastic_net">ElasticNet (L1+L2 Regularized)</option>
                  <option value="random_forest">Random Forest Regressor</option>
                  <option value="gradient_boosting">Histogram Gradient Boosting</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 font-medium">Tree Estimators:</label>
                <input
                  type="number"
                  min="20"
                  max="300"
                  value={trainTrees}
                  onChange={(e) => setTrainTrees(parseInt(e.target.value))}
                  disabled={trainAlgorithm !== 'random_forest' && trainAlgorithm !== 'gradient_boosting'}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-cyan-500 disabled:opacity-30 disabled:cursor-not-allowed"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 font-medium">Max Depth:</label>
                <input
                  type="number"
                  min="4"
                  max="25"
                  value={trainDepth}
                  onChange={(e) => setTrainDepth(parseInt(e.target.value))}
                  disabled={trainAlgorithm !== 'random_forest' && trainAlgorithm !== 'gradient_boosting'}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-cyan-500 disabled:opacity-30 disabled:cursor-not-allowed"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 font-medium">Spatial CV Folds:</label>
                <input
                  type="number"
                  min="2"
                  max="10"
                  value={trainFolds}
                  onChange={(e) => setTrainFolds(parseInt(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-4 pt-2">
                <button
                  type="submit"
                  disabled={retraining}
                  className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-cyan-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {retraining ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Executing GroupKFold Spatial Cross-Validation...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      <span>Retrain Spatial Model for {selectedPollutant}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : (
        <div className="bg-navy-900/60 border border-slate-800 rounded-2xl p-12 text-center space-y-3 shadow-xl animate-fadeIn">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="text-sm font-bold text-white">
            No Verified Spatial ML Model for {selectedPollutant} ({dataMode} Mode)
          </div>
          <p className="text-xs text-slate-400 max-w-xl mx-auto leading-relaxed">
            {dataMode === 'REAL'
              ? `AeroSat-AI enforces strict scientific integrity: spatial machine learning models require genuine ground station pairs across distinct spatial hubs for spatial GroupKFold validation. Currently, verified Sentinel-5P Level-2 granules are ingested for NO2 (TROPOMI orbit 32204). Ingest genuine CPCB ground observations for ${selectedPollutant} or switch to DEMO mode to explore synthetic scenarios.`
              : `No model has been trained for ${selectedPollutant} in demonstration mode yet. Select NO2 or PM2.5 to view active validated models.`}
          </p>
          {dataMode === 'REAL' && (
            <div className="inline-flex items-center gap-3 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 font-mono">
              <span className="text-slate-400">Verified P19 Satellite-Ground Pair:</span>
              <button
                onClick={() => setSelectedPollutant('NO2')}
                className="text-cyan-400 hover:text-cyan-300 font-bold underline cursor-pointer"
              >
                Switch to NO2 (GroupKFold Spatial Validation)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
