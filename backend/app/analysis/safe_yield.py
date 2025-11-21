"""
SAFE YIELD ENGINE – KDOW + 10 STATE STANDARDS
---------------------------------------------

Computes long-term sustainable pumping rate based on:

 - Theis/Cooper–Jacob confined methods
 - Neuman unconfined delayed yield (optional modifier)
 - Drawdown limits (b/2)
 - Radius of Influence (ROI)
 - Well radius
 - Multi-well interference (optional)
 - Regulatory constraints

References:
 • KDOW 401 KAR 8:100
 • Ten-State Standards – Water Wells (2012, 2024)
 • Todd (2005) Groundwater Hydrology
 • USGS C09-002
"""

import math


def radius_of_influence(T, S, t_days):
    """
    USGS/KDOW approximation:
        R = 2 * sqrt(T * t / S)
    Returns radius (ft).
    """
    return 2 * math.sqrt((T * t_days) / S)


def safe_yield_confined(T, S, b_ft, rw_ft, t_days):
    """
    Confined-aquifer safe yield (Theis/CJ):

        Qsafe = (4πT Δh) / ln(R/rw)

    Where Δh = allowable drawdown = b/2
    """
    delta_h = b_ft / 2  # KDOW standard max drawdown

    R = radius_of_influence(T, S, t_days)

    if R <= rw_ft:
        return 0.0

    return (4 * math.pi * T * delta_h) / math.log(R / rw_ft)


def safe_yield_unconfined(T, Sy, b_ft, rw_ft, t_days):
    """
    Unconfined safe yield using modified Neuman principles.

    Replace S with effective Sy for long-term drainage.
    """
    delta_h = b_ft / 2  # KDOW allowed max drawdown
    S_eff = max(Sy, 1e-6)

    R = radius_of_influence(T, S_eff, t_days)

    if R <= rw_ft:
        return 0.0

    return (4 * math.pi * T * delta_h) / math.log(R / rw_ft)


def safe_yield_interference(Qsafe, interference_ft, allowable_ft):
    """
    Adjust safe yield based on interference:

      New allowable drawdown = allowable_ft - interference_ft

    """
    if interference_ft >= allowable_ft:
        return 0.0

    reduction_factor = (allowable_ft - interference_ft) / allowable_ft
    return Qsafe * reduction_factor


def compute_safe_yield(
    T,
    S,
    Sy,
    b_ft,
    rw_ft,
    t_days=365 * 20,  # 20-year horizon (KDOW / PER standard)
    unconfined=False,
    interference_drawdown_ft=0.0,
):
    """
    Wrapper for KDOW safe yield logic.

    Inputs:
      T: transmissivity (ft²/day)
      S: storativity (confined)
      Sy: specific yield (unconfined)
      b_ft: saturated thickness (ft)
      rw_ft: well radius (ft)
      t_days: time period for ROI (default 20 years)
      unconfined: bool – use Neuman drainage
      interference_drawdown_ft: drawdown from other wells

    Returns:
      Qsafe (gpm)
    """

    allowable_dd = b_ft / 2  # KDOW limit

    # Confined or unconfined logic
    if unconfined:
        Qsafe = safe_yield_unconfined(T, Sy, b_ft, rw_ft, t_days)
    else:
        Qsafe = safe_yield_confined(T, S, b_ft, rw_ft, t_days)

    # Interference reduction
    if interference_drawdown_ft > 0:
        Qsafe = safe_yield_interference(Qsafe, interference_drawdown_ft, allowable_dd)

    # Convert ft³/day to gpm
    FT3DAY_TO_GPM = 1 / 192.0
    return Qsafe * FT3DAY_TO_GPM
