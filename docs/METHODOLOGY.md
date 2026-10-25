# Scientific Methodology & Downscaling Mathematical Framework

## 1. Physical Principles of Satellite Remote Sensing

The TROPOspheric Monitoring Instrument (TROPOMI) on the Sentinel-5 Precursor satellite measures solar radiation backscattered by the Earth's atmosphere and surface across ultraviolet, visible, and near-infrared spectral bands. Using Differential Optical Absorption Spectroscopy (DOAS), the slant column density ($N_s$) of trace gas absorbers ($\text{NO}_2$, $\text{SO}_2$, $\text{CO}$) is retrieved along the photon path:

$$\ln\left(\frac{I(\lambda)}{I_0(\lambda)}\right) = -\sum_i \sigma_i(\lambda) N_{s,i} - P(\lambda)$$

Where $\sigma_i(\lambda)$ is the absorption cross-section of species $i$, and $P(\lambda)$ is a low-order polynomial accounting for Rayleigh and Mie scattering.

The slant column is converted to a vertical tropospheric column ($\Omega_{\text{trop}}$) using an Air Mass Factor ($AMF$):

$$\Omega_{\text{trop}} = \frac{N_s - N_{\text{strat}}}{AMF_{\text{trop}}}$$

---

## 2. Satellite Column to Surface Concentration Downscaling

While $\Omega_{\text{trop}}$ quantifies the total number of molecules per square centimeter between the ground and the tropopause, human exposure depends on the volume concentration $C_{\text{ground}}$ ($\mu\text{g/m}^3$) within the lowest atmospheric layer ($0 - 2\text{ m}$).

### 2.1 Boundary Layer Volume Normalization
Under well-mixed conditions within the Planetary Boundary Layer (PBL), the relationship between ground concentration and tropospheric column is approximated as:

$$C_{\text{ground}} \approx \alpha \cdot \frac{\Omega_{\text{trop}}}{H_{\text{PBL}}}$$

Where:
- $H_{\text{PBL}}$ is the Planetary Boundary Layer Height (meters).
- $\alpha$ is an empirical scaling factor relating column moles to surface mass concentration.

During nocturnal radiation inversions common in winter across the Indo-Gangetic Plain, $H_{\text{PBL}}$ drops to $300 - 500\text{ m}$, compressing pollutants into a shallow surface layer and drastically inflating surface concentrations. In summer afternoons, strong convective thermals elevate $H_{\text{PBL}}$ to $1800 - 2500\text{ m}$, dispersing emissions through a deep column.

### 2.2 Ventilation Index Formulation
Horizontal pollutant transport and dilution are dictated by the atmospheric ventilation coefficient $V_i$:

$$V_i = \frac{H_{\text{PBL}} \times \|\vec{v}_{10m}\|}{1000} \quad \left[\frac{\text{m}^2}{\text{s} \times 10^3}\right]$$

The inverse ventilation coefficient acts as an atmospheric dispersion damping term in the regression pipeline:

$$\text{Dispersion Factor} = \frac{\gamma}{\max(V_{\text{min}}, V_i)}$$

---

## 3. Spatial Cross-Validation Without Data Leakage

### 3.1 The Spatial Autocorrelation Problem
Spatial datasets are subject to Tobler's First Law of Geography: *"Everything is related to everything else, but near things are more related than distant things."*

If observations from station $S_k$ at time $t_1$ are placed in the training partition, and observations from the same station $S_k$ at time $t_2$ are placed in the test partition, standard regression models will memorize station-specific spatial coordinates ($x_k, y_k$) and local micro-topographic constants. This causes severe **spatial data leakage**, yielding artificially high $R^2$ scores that collapse when applied to unmonitored locations.

### 3.2 Station-Based GroupKFold Solution
AeroSat-AI enforces strict **GroupKFold cross-validation**:
- The grouping variable is set to `station_id`.
- The dataset of $N=15$ stations is partitioned into $K=5$ folds.
- In each fold, $3$ stations ($20\%$ of the spatial monitoring network) are completely withheld from training:

$$\text{Train Folds:} \quad \mathcal{G}_{\text{train}} = \bigcup_{j \ne k} \mathcal{S}_j$$
$$\text{Test Fold:} \quad \mathcal{G}_{\text{test}} = \mathcal{S}_k$$
$$\mathcal{G}_{\text{train}} \cap \mathcal{G}_{\text{test}} = \emptyset$$

All reported evaluation metrics (MAE, RMSE, $R^2$, MBE) are computed exclusively on out-of-fold spatial predictions.

---

## 4. Uncertainty Quantification Framework

A core scientific requirement of downscaling is providing defensible uncertainty estimates. In AeroSat-AI, uncertainty is estimated using the variance across individual trees within the trained Random Forest ensemble:

Given an ensemble of $B$ regression trees $\{T_1, T_2, \dots, T_B\}$, the point prediction $\hat{y}$ is:

$$\hat{y}(\mathbf{x}) = \frac{1}{B} \sum_{b=1}^B T_b(\mathbf{x})$$

The ensemble standard deviation $\sigma_{\text{ensemble}}(\mathbf{x})$ is:

$$\sigma_{\text{ensemble}}(\mathbf{x}) = \sqrt{\frac{1}{B - 1} \sum_{b=1}^B \left( T_b(\mathbf{x}) - \hat{y}(\mathbf{x}) \right)^2}$$

Assuming an asymptotic Gaussian distribution of tree residuals, the $90\%$ confidence interval $[L_{90}, U_{90}]$ is:

$$L_{90}(\mathbf{x}) = \max\left(0, \hat{y}(\mathbf{x}) - z_{0.95} \cdot \sigma_{\text{ensemble}}(\mathbf{x})\right)$$
$$U_{90}(\mathbf{x}) = \hat{y}(\mathbf{x}) + z_{0.95} \cdot \sigma_{\text{ensemble}}(\mathbf{x})$$

Where $z_{0.95} \approx 1.645$.

---

## 5. Baseline Spatial Benchmark (IDW)

To demonstrate that the satellite-meteorological fusion pipeline adds genuine predictive value beyond simple distance-based spatial interpolation, the ML model is compared against an Inverse Distance Weighting (IDW) baseline:

$$\hat{y}_{\text{IDW}}(\mathbf{x}) = \frac{\sum_{i=1}^M w_i y_i}{\sum_{i=1}^M w_i}, \quad w_i = \frac{1}{d(\mathbf{x}, \mathbf{x}_i)^p}$$

Where $d(\mathbf{x}, \mathbf{x}_i)$ is the great-circle Haversine distance, and $p=2.0$.
In all evaluated species, the AeroSat-AI model achieves significantly lower MAE than the IDW baseline, demonstrating that spaceborne trace gas columns and numerical weather covariates provide physical predictive information unavailable from spatial distance alone.

---

## 6. Spatiotemporal Collocation & Matching Protocol

Satellite and ground stations do not observe at identical times or exact point locations. Spatiotemporal matching enforces strict physical collocation tolerances:

1. **Temporal Matching Window:** $|\Delta t| \le 3.0\text{ hours}$. TROPOMI overpass occurs at $\approx 13:30$ local solar time (early afternoon). Ground observations within $\pm 3\text{h}$ are collocated with the overpass.
2. **Spatial Distance Window:** $\Delta d \le 5.0\text{ km}$ Haversine distance, matching the native ground pixel size of Sentinel-5P ($5.5 \times 3.5\text{ km}$).
3. **Retrieval Quality Filtering:** $\text{QA} \ge 0.50$ (excludes cloud fraction $> 0.5$, high aerosol optical thickness anomalies, and snow/ice reflection).
4. **Physical Unit Preservation:** Column densities ($mol/m^2$ or $molec/cm^2$) and surface mass concentrations ($\mu g/m^3$) are preserved in their native physical units and explicitly differentiated in all database tables and outputs.
5. **Missing Value Integrity:** If valid satellite pixels or ground observations are absent for a given window, missing values are flagged (`is_data_gap=true`, `gap_reason`) rather than manufactured.

---

## 7. Downscaling Resolution & Scientific Boundaries

- **Target Prediction Grid:** $1.0\text{ km} - 5.0\text{ km}$ resolution on EPSG:4326.
- **Physical Boundary Limitation:** While model downscaling produces a finer regularized grid from coarse satellite pixels ($5.5 \times 3.5\text{ km}$), **it is not a substitute for direct micro-sensor networks**. Claiming street-level ($< 100\text{ m}$) accuracy without dense localized ground micro-sensors or computational fluid dynamics (CFD) canyon modeling is scientifically unsupportable. AeroSat-AI clearly labels downscaled outputs as model estimates with associated $90\%$ tree-ensemble confidence bounds.

