import numpy as np

# Import solver components
from .theis import theis_drawdown
from .cooper_jacob import transmissivity, hydraulic_conductivity
from .cooper_jacob import drawdown_CJ
from .step_test import step_test_BC, predict_drawdown, well_efficiency
from .recovery import fit_recovery_T, fit_recovery_S
from .neuman import neuman_drawdown
from .hantush_jacob import hantush_drawdown
from .superposition import (
    superposition_theis,
    superposition_CJ,
    superposition_neuman,
    superposition_hantush,
)
from .safe_yield import compute_safe_yield

def run_analysis_logic(payload: dict):

    model = payload.get("model", "theis")

    Q = payload["Q_gpm"]
    r = payload["r_ft"]

    T = payload.get("T")
    S = payload.get("S")
    Sy = payload.get("Sy")
    Ss = payload.get("Ss")
    b_thick = payload.get("b_thick_ft")
    KzKr = payload.get("Kz_over_Kr")

    b_prime = payload.get("b_prime_ft")
    K_prime = payload.get("K_prime")

    t_list = payload.get("time_series_min", [])

    results = {"model_used": model}

    # ----------------------------------
    # STEP TEST
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
    # CONSTANT RATE: CJ STRAIGHT LINE
    # ----------------------------------
    const_data = payload.get("pump_test", {}).get("constant")
    if const_data:
        times = np.array([row["time_hr"] * 60 for row in const_data])  # convert hr→min
        s_vals = np.array([row["drawdown_ft"] for row in const_data])

        logt = np.log10(times + 1e-25)
        slope, intercept = np.polyfit(logt, s_vals, 1)

        T_CJ = transmissivity(Q, slope)

        results["constant_rate"] = {
            "CJ_slope": slope,
            "CJ_intercept": intercept,
            "T_from_CJ": T_CJ,
        }

    # ----------------------------------
    # RECOVERY TEST
    # ----------------------------------
    rec_data = payload.get("pump_test", {}).get("recovery")
    if rec_data:
        t_after = [row["time_min"] for row in rec_data]
        s_prime = [row["residual_drawdown_ft"] for row in rec_data]

        t_before = payload.get("t_before_min", 1440)

        T_rec = fit_recovery_T(Q, r, t_before, t_after, s_prime)

        if T:
            S_rec = fit_recovery_S(T, r, min(t_after))
        else:
            S_rec = None

        results["recovery"] = {
            "T_from_recovery": T_rec,
            "S_from_recovery": S_rec,
        }

    # ----------------------------------
    # MODEL DRAWDOWN CURVE
    # ----------------------------------
    dd = []
    for t in t_list:
        if model == "theis":
            dd.append(theis_drawdown(Q, T, S, r, t))

        elif model == "cj":
            dd.append(drawdown_CJ(Q, T, r, t))

        elif model == "neuman":
            dd.append(neuman_drawdown(Q, T, Ss, Sy, KzKr, r, t, b_thick))

        elif model == "hantush":
            dd.append(hantush_drawdown(Q, T, S, r, t, b_prime, K_prime))

    results["drawdown_series"] = {
        "time_min": t_list,
        "drawdown_ft": dd,
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
            t_days=sy_req["time_horizon_days"],
            unconfined=sy_req["unconfined"],
            interference_drawdown_ft=sy_req["interference_drawdown_ft"],
        )
        results["safe_yield_gpm"] = Qsafe

    observation_sets = payload.get("observation_wells")
    if observation_sets:
        results["observation_wells"] = observation_sets

    submitted_tests = payload.get("pump_test")
    if submitted_tests:
        results["submitted_pump_test"] = submitted_tests

    return results
