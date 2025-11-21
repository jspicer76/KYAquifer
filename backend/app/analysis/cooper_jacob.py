"""
COOPER–JACOB (1946) STRAIGHT-LINE METHOD
----------------------------------------

References:
 - Cooper, H.H. & Jacob, C.E. (1946). USGS Publication.
 - Todd (2005) Groundwater Hydrology.
 - USGS C09-002.
 - KDOW 401 KAR 8:100 Pumping Test Requirements.
 - Ten-State Standards, Water Wells.

US Units:
 - Q: gpm
 - t: minutes
 - r: ft
 - s: ft
 - T: ft²/day
 - S: dimensionless
 - K: ft/day

This module provides:
 1. Transmissivity T from slope Δs per log cycle
 2. Storativity S from t0 intercept
 3. Hydraulic conductivity K = T / b  (optional)
 4. Predict drawdown using CJ approximation
 5. Compute radius of influence (KDOW/USGS)
"""

import math

GPM_TO_FT3_PER_DAY = 192.0


def transmissivity(Q_gpm, delta_s):
    """
    Cooper–Jacob transmissivity:
        T = (2.3 * Q) / (4π Δs)

    Q: pumping rate (gpm)
    Δs: change in drawdown per log cycle
    """
    Q = Q_gpm * GPM_TO_FT3_PER_DAY
    return (2.3 * Q) / (4 * math.pi * delta_s)


def storativity(T, r_ft, t0_min):
    """
    Cooper–Jacob storativity:
        S = (2.25 T t0) / r²

    t0 = time (minutes) at zero drawdown extrapolated intercept
    """
    t0_days = t0_min / 1440.0
    return (2.25 * T * t0_days) / (r_ft**2)


def drawdown_CJ(Q_gpm, T, r_ft, t_min):
    """
    CJ drawdown:
        s = (2.3 Q / (4πT)) log10(2.25 T t / (r² S))

    We compute only the slope part here; full drawdown requires S.
    """
    Q = Q_gpm * GPM_TO_FT3_PER_DAY
    t_days = t_min / 1440.0

    if t_days <= 0:
        return 0

    return (2.3 * Q / (4 * math.pi * T)) * math.log10(t_days)


def radius_of_influence(T, S, t_min):
    """
    USGS / KDOW approximation:
        R = 2 * sqrt(T * t / S)

    t = pumping duration (minutes)

    Returns radius in ft.
    """
    t_days = t_min / 1440.0
    return 2 * math.sqrt(T * t_days / S)


def hydraulic_conductivity(T, b_ft):
    """
    K = T / b
    """
    return T / b_ft
