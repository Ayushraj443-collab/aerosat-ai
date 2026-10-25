import numpy as np
from typing import Dict, Any, List, Tuple
from sklearn.metrics import mean_absolute_error, root_mean_squared_error, r2_score

def compute_metrics(
    y_true: np.ndarray,
    y_pred: np.ndarray
) -> Dict[str, float]:
    """Compute standard statistical and atmospheric model evaluation metrics."""
    if len(y_true) == 0:
        return {"mae": 0.0, "rmse": 0.0, "r2": 0.0, "mbe": 0.0, "nrmse_pct": 0.0}
    
    mae = float(mean_absolute_error(y_true, y_pred))
    rmse = float(root_mean_squared_error(y_true, y_pred))
    r2 = float(r2_score(y_true, y_pred))
    
    # Mean Bias Error (MBE): positive indicates overestimation, negative indicates underestimation
    mbe = float(np.mean(y_pred - y_true))
    
    mean_obs = float(np.mean(y_true))
    nrmse_pct = float((rmse / mean_obs * 100.0) if mean_obs > 0 else 0.0)
    
    return {
        "mae": round(mae, 2),
        "rmse": round(rmse, 2),
        "r2": round(r2, 4),
        "mbe": round(mbe, 2),
        "nrmse_pct": round(nrmse_pct, 1)
    }

def compute_residual_distribution(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    bins: int = 12
) -> Dict[str, Any]:
    """Compute histogram of model residuals (y_pred - y_true)."""
    residuals = y_pred - y_true
    counts, bin_edges = np.histogram(residuals, bins=bins)
    
    hist_data = []
    for i in range(len(counts)):
        midpoint = (bin_edges[i] + bin_edges[i+1]) / 2.0
        hist_data.append({
            "bin_range": f"{bin_edges[i]:.1f} to {bin_edges[i+1]:.1f}",
            "bin_center": round(midpoint, 1),
            "count": int(counts[i])
        })
        
    return {
        "mean_residual": round(float(np.mean(residuals)), 2),
        "std_residual": round(float(np.std(residuals)), 2),
        "histogram": hist_data
    }

def format_observed_vs_predicted_sample(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    dates: List[str],
    station_names: List[str],
    max_samples: int = 150
) -> List[Dict[str, Any]]:
    """Format paired scatter plot samples for the frontend Recharts component."""
    n = len(y_true)
    if n == 0:
        return []
    
    # Uniform subsample if dataset is large to keep response fast and clean
    indices = np.linspace(0, n - 1, min(n, max_samples), dtype=int)
    
    samples = []
    for idx in indices:
        samples.append({
            "index": int(idx),
            "observed": round(float(y_true[idx]), 2),
            "predicted": round(float(y_pred[idx]), 2),
            "error": round(float(y_pred[idx] - y_true[idx]), 2),
            "date": dates[idx] if idx < len(dates) else "2024-01-01",
            "station": station_names[idx] if idx < len(station_names) else "Station"
        })
    return samples
