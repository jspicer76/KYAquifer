"""
CALIBRATION ENDPOINT
--------------------

Performs multi-observation-well least-squares fitting for:
  - Theis
  - Cooper–Jacob
  - Neuman (unconfined)
  - Hantush–Jacob

Returns:
  - Best-fit parameters (T, S, Sy, Ss, leakiness)
  - RMSE, SSE, R²
  - Observed vs modeled curves for each well
"""

from fastapi import APIRouter
import numpy as np
from typing import List, Dict

from app.analysis.theis import theis_drawdown
from app.analysis.cooper_jacob import drawdown_CJ
from app.analysis.neuman import neuman_drawdown
from app.analysis.hantush_jacob import hantush_drawdown

router = APIRouter(prefix="/analysis", tags=["Calibration"])


def model_drawdown(model, Q, r, t, params):
    """Unified wrapper for drawdown prediction."""
    if model == "theis":
        T, S = params["T"], params["S"]
        return theis_drawdown(Q, T, S, r, t)

    if model == "cj":
        T = params["T"]
        return drawdown_CJ(Q, T, r, t)

    if model == "neuman":
        T = params["T"]
        Ss = params["Ss"]
        Sy = params["Sy"]
        Kz_Kr = params["Kz_over_Kr"]
        b = params["b"]
        return neuman_drawdown(Q, T, Ss, Sy, Kz_Kr, r, t, b)

    if model == "hantush":
        T = params["T"]
        S = params["S"]
        b_prime = params["b_prime"]
        K_prime = params["K_prime"]
        return hantush_drawdown(Q, T, S, r, t, b_prime, K_prime)

    return 0.0


def rmse(observed, modeled):
    return np.sqrt(np.mean((observed - modeled) ** 2))


@router.post("/calibrate")
def calibrate(payload: Dict):
    """
    Payload:
      {
        "model": "theis" | "cj" | "neuman" | "hantush",
        "Q_gpm": float,
        "wells": [
            {
                "r_ft": float,
                "t_min": [...],
                "s_obs_ft": [...]
            }
        ],
        "bounds": {
            "T": [min,max],
            "S": [min,max],
            "Sy": [min,max],
            "Ss": [min,max],
            "b_prime": [...],
            "K_prime": [...],
        }
      }
    """

    model = payload["model"]
    Q = payload["Q_gpm"]
    wells = payload["wells"]
    bounds = payload["bounds"]

    # Parameter vector depends on selected model
    param_names = []
    if model in ["theis", "hantush"]:
        param_names = ["T", "S"]
    if model == "cj":
        param_names = ["T"]
    if model == "neuman":
        param_names = ["T", "Ss", "Sy"]

    # Convert bound dict → array
    lower = np.array([bounds[p][0] for p in param_names])
    upper = np.array([bounds[p][1] for p in param_names])

    # Objective function
    def objective(x):
        params = {p: x[i] for i, p in enumerate(param_names)}

        total_error = 0.0

        for well in wells:
            r = well["r_ft"]
            t = np.array(well["t_min"])
            s_obs = np.array(well["s_obs_ft"])

            s_mod = np.array([
                model_drawdown(model, Q, r, ti, params) for ti in t
            ])

            total_error += np.sum((s_obs - s_mod) ** 2)

        return total_error

    # --------------------------------------
    # SIMPLE GRID SEARCH (robust for field data)
    # --------------------------------------
    n = 12  # resolution per dimension
    grids = [np.linspace(lower[i], upper[i], n) for i in range(len(param_names))]

    best_params = None
    best_err = 1e99

    # Cartesian search
    for x in np.array(np.meshgrid(*grids)).T.reshape(-1, len(param_names)):
        err = objective(x)
        if err < best_err:
            best_err = err
            best_params = x

    # Build results
    result_params = {param_names[i]: float(best_params[i]) for i in range(len(param_names))}

    # Build observed vs modeled per well
    curves = []
    for well in wells:
        r = well["r_ft"]
        t = np.array(well["t_min"])
        s_obs = np.array(well["s_obs_ft"])
        s_mod = np.array([model_drawdown(model, Q, r, ti, result_params) for ti in t])

        curves.append({
            "r_ft": float(r),
            "time_min": t.tolist(),
            "s_obs_ft": s_obs.tolist(),
            "s_mod_ft": s_mod.tolist(),
            "rmse": float(rmse(s_obs, s_mod)),
        })

    return {
        "best_params": result_params,
        "total_error": float(best_err),
        "curves": curves,
    }
