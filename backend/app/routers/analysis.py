"""
UNIFIED AQUIFER ANALYSIS ENDPOINT
---------------------------------

This endpoint integrates all analytical models:

 • Theis (confined)
 • Cooper–Jacob
 • Step test (B & C)
 • Recovery
 • Neuman unconfined
 • Hantush–Jacob leaky
 • Superposition
 • Safe yield (KDOW-compliant)

Returns a complete dictionary of results suitable for:

 • KDOW 401 KAR 8:100 aquifer analysis
 • 10-State Standards
 • PER/SRF Source Approval
 • Full PDF reporting
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db

# Import analysis engines
from app.analysis.theis import theis_drawdown
from app.analysis.cooper_jacob import transmissivity, storativity, hydraulic_conductivity
from app.analysis.step_test import step_test_BC, predict_drawdown, well_efficiency
from app.analysis.recovery import fit_recovery_T, fit_recovery_S
from app.analysis.neuman import neuman_drawdown
from app.analysis.hantush_jacob import hantush_drawdown
from app.analysis.superposition import (
    superposition_theis,
    superposition_CJ,
    superposition_neuman,
    superposition_hantush,
)
from app.analysis.safe_yield import compute_safe_yield

import json
import numpy as np

router = APIRouter(prefix="/analysis", tags=["Aquifer Analysis"])


@router.post("/run")
def run_analysis(payload: dict, db: Session = Depends(get_db)):
    """
    Main analysis endpoint.

    Payload includes:
      - pump_test: {step, constant, recovery}
      - wells: pumping + observation wells
      - aquifer_params: {T,S,Ss,Sy,b_thickness}
      - model: "theis" | "cj" | "neuman" | "hantush"
      - leakage_params (optional for Hantush)
      - safe_yield_request: {rw, b, unconfined, interference}
      - time_series_request: list of time values
    """

    model = payload.get("model", "theis")
    Q = payload["Q_gpm"]
    r = payload["r_ft"]

    # --- OPTIONAL INPUT PARAMETERS ---
    T = payload.get("T")
    S = payload.get("S")
    Ss = payload.get("Ss")
    Sy = payload.get("Sy")
    b_thick = payload.get("b_thick_ft")

    # Leakiness parameters (optional)
    b_prime = payload.get("b_prime_ft")
    K_prime = payload.get("K_prime")

    # Time series (minutes) for drawdown curve generation
    t_list = payload.get("time_series_min", [])

    results = {
        "model_used": model,
    }

    # ----------------------------------
    # STEP TEST ANALYSIS (B & C)
    # ----------------------------------
    step_data = payload.get("pump_test", {}).get("step")
    if step_data:
        q_list = [row["rate_gpm"] for row in step_data]
        s_list = [row["drawdown_ft"] for row in step_data]
        B, C = step_test_BC(q_list, s_list)
        results["step_test"] = {
            "B": B,
            "C": C,
            "drawdown_at_Q": predict_drawdown(B, C, Q),
            "efficiency": well_efficiency(B, C, Q),
        }

    # ----------------------------------
    # CONSTANT RATE TEST (CJ & Theis)
    # ----------------------------------
    constant_data = payload.get("pump_test", {}).get("constant")
    if constant_data:
        # slope Δs: difference over log cycles
        times = np.array([row["time_min"] for row in constant_data])
        s_vals = np.array([row["drawdown_ft"] for row in constant_data])

        logt = np.log10(times + 1e-30)
        slope, intercept = np.polyfit(logt, s_vals, 1)

        T_CJ = transmissivity(Q, slope)
        results["constant_rate"] = {
            "T_from_CJ": T_CJ,
            "slope": slope,
            "intercept": intercept,
        }

    # ----------------------------------
    # RECOVERY T & S
    # ----------------------------------
    recovery_data = payload.get("pump_test", {}).get("recovery")
    if recovery_data:
        t_after = [row["time_min"] for row in recovery_data]
        s_prime = [row["residual_drawdown_ft"] for row in recovery_data]

        # We need t_before (end of pumping)
        t_before = payload.get("t_before_min", 1440)  # default 1 day

        T_recov = fit_recovery_T(Q, r, t_before, t_after, s_prime)

        if T:
            S_recov = fit_recovery_S(T, r, min(t_after))
        else:
            S_recov = None

        results["recovery"] = {
            "T_from_recovery": T_recov,
            "S_from_recovery": S_recov,
        }

    # ----------------------------------
    # MAIN MODEL DRAWNDOWN
    # ----------------------------------
    series = []
    for t in t_list:
        if model == "theis":
            series.append(theis_drawdown(Q, T, S, r, t))

        elif model == "cj":
            from app.analysis.cooper_jacob import drawdown_CJ
            series.append(drawdown_CJ(Q, T, r, t))

        elif model == "neuman":
            series.append(
                neuman_drawdown(Q, T, Ss, Sy, payload["Kz_over_Kr"], r, t, b_thick)
            )

        elif model == "hantush":
            series.append(
                hantush_drawdown(Q, T, S, r, t, b_prime, K_prime)
            )

    results["drawdown_series"] = {
        "time_min": t_list,
        "drawdown_ft": series,
    }

    # ----------------------------------
    # SAFE YIELD
    # ----------------------------------
    sy_req = payload.get("safe_yield_request")
    if sy_req:
        Qsafe = compute_safe_yield(
            T=T,
            S=S,
            Sy=Sy,
            b_ft=b_thick,
            rw_ft=sy_req["rw_ft"],
            t_days=sy_req.get("time_horizon_days", 365 * 20),
            unconfined=sy_req.get("unconfined", False),
            interference_drawdown_ft=sy_req.get("interference_drawdown_ft", 0.0),
        )

        results["safe_yield"] = {
            "Qsafe_gpm": Qsafe
        }

    return results
