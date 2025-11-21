"""
WELLHEAD PROTECTION (WHP) ZONE DELINEATION ENGINE
-------------------------------------------------

Zones:
 • Zone I  – Fixed radius around well (100–400 ft typical)
 • Zone II – Time-of-Travel (TOT) Capture Zone (5-year, 10-year)
 • Zone III – Contributing recharge area

References:
 • KDOW Wellhead Protection Program Guidance
 • EPA Groundwater Protection Strategy
 • USGS C09-002 (capture zone derivations)
 • Todd (2005)
 • Freeze & Cherry (1979)

All units are US customary.
"""

import math
import numpy as np


# -----------------------------
# ZONE I – FIXED RADIUS
# -----------------------------
def zone1_radius(user_radius_ft=150):
    """
    Zone I radius – KDOW sometimes specifies 100–150 ft.

    Returns fixed radius in ft.
    """
    return user_radius_ft


# -----------------------------
# ZONE II – TIME-OF-TRAVEL (TOT)
# -----------------------------
def zone2_radius(T, Sy, tot_years):
    """
    Compute maximum TOT distance using analytical formula:

        r = sqrt( 2 T t / Sy )

    T: ft²/day
    Sy: dimensionless
    tot_years: travel time (years)
    """
    t_days = tot_years * 365.0
    return math.sqrt((2 * T * t_days) / (Sy + 1e-12))


def zone2_capture_polygon(Q_gpm, T, Sy, tot_years, num_points=200):
    """
    Construct an elliptical analytical capture zone.

    Parametric equations from USGS approximation:
        x(t) = (Q / 2πT) t
        y(t) = sqrt(4 T Sy t - x(t)^2)

    Q_gpm converted to ft³/day.

    Returns list of (x, y) points (ft from well).
    """
    Q = Q_gpm * 192.0  # ft³/day
    t_days = tot_years * 365.0

    times = np.linspace(0, t_days, num_points)

    poly = []
    for t in times:
        x = (Q / (2 * math.pi * T)) * t
        under = max(4 * T * Sy * t - x * x, 0)
        y = math.sqrt(under)
        poly.append((x, y))
    for t in reversed(times):
        x = (Q / (2 * math.pi * T)) * t
        under = max(4 * T * Sy * t - x * x, 0)
        y = -math.sqrt(under)
        poly.append((x, y))

    return poly


# -----------------------------
# ZONE III – CONTRIBUTING AREA
# -----------------------------
def zone3_contributing_area(Q_gpm, recharge_in_per_year=15):
    """
    Compute a simple rectangular contributing area.

    Recharge R (in/yr) converted to ft/day:

        R_ft_day = recharge_in_per_year / 12 / 365

    Area A = Q / R

    Returns area in ft².
    """
    Q = Q_gpm * 192.0  # ft³/day
    R_ft_day = (recharge_in_per_year / 12.0) / 365.0
    A = Q / (R_ft_day + 1e-12)
    return A


def zone3_polygon(Q_gpm, recharge_in_per_year=15, width_factor=0.25):
    """
    Create a polygon representing Zone III.

    Width proportional to sqrt(A).
    Length proportional to A.
    """
    A = zone3_contributing_area(Q_gpm, recharge_in_per_year)
    width = math.sqrt(A) * width_factor
    length = math.sqrt(A)

    return [
        (0, 0),
        (-width, -length),
        (width, -length),
        (0, 0),
    ]
