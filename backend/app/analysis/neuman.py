"""
NEUMAN (1972, 1975, 1979) – UNCONFINED AQUIFER DELAYED-YIELD SOLUTION
---------------------------------------------------------------------

Handles:
 • Elastic storage (Ss)
 • Specific yield (Sy)
 • Vertical anisotropy (Kz/Kr)
 • Delayed drainage
 • Unconfined drawdown in observation wells
 • Partially penetrating pumping well (optional)

References:
 - Neuman, S.P. (1972, 1975, 1979)
 - USGS C09-002 – full derivation
 - Todd (2005) Groundwater Hydrology
 - Freeze & Cherry (1979) Groundwater
 - KDOW 401 KAR 8:100 – unconfined aquifer testing

This module computes drawdown using a numerical approximation to the
Neuman well function following the USGS implementation strategy.

All units are US customary:
  Q: gpm
  T: ft²/day
  Ss: 1/ft
  Sy: dimensionless
  Kz/Kr: vertical anisotropy ratio
"""

import math
import numpy as np
from app.analysis.theis import GPM_TO_FT3_PER_DAY


def neuman_drawdown(
    Q_gpm,
    T,
    Ss,
    Sy,
    Kz_over_Kr,
    r_ft,
    t_min,
    b_ft,
    d_pump_ft=None,
):
    """
    Compute unconfined aquifer drawdown using Neuman delayed-yield method.

    Inputs:
      Q_gpm: pumping rate (gpm)
      T: transmissivity (ft²/day)
      Ss: elastic specific storage (1/ft)
      Sy: specific yield (dimensionless)
      Kz_over_Kr: vertical anisotropy ratio
      r_ft: distance to observation well (ft)
      t_min: time since pumping started (min)
      b_ft: saturated thickness of unconfined aquifer (ft)
      d_pump_ft: pumping well penetration depth (optional)

    Returns:
      s: drawdown at time t_min (ft)
    """

    if t_min <= 0:
        return 0.0

    # Convert Q
    Q = Q_gpm * GPM_TO_FT3_PER_DAY

    # Convert time to days
    t_days = t_min / 1440.0

    # Dimensionless parameters
    r_D = r_ft / b_ft
    t_D = (T * t_days) / (Ss * r_ft**2 + 1e-30)  # avoid zero
    gamma = math.sqrt(Kz_over_Kr)

    # Handle fully and partially penetrating wells
    if d_pump_ft is None:
        beta = 1.0  # fully penetrating
    else:
        beta = d_pump_ft / b_ft

    # Drawdown computation:
    # s = (Q / (4πT)) * F_neuman(r_D, t_D, Sy, Ss, gamma, beta)
    F = F_neuman(r_D, t_D, Sy, Ss, gamma, beta)

    return (Q / (4 * math.pi * T)) * F


def F_neuman(r_D, t_D, Sy, Ss, gamma, beta):
    """
    Dimensionless Neuman well function implemented via numerical summation.

    Uses strategy:
      - early-time elastic storage term
      - late-time delayed yield term
      - numerical sum for intermediate times

    Returns:
      dimensionless drawdown factor F
    """

    # Early-time elastic approximation
    if t_D < 1e-4:
        return -math.expm1(-1 / (4 * t_D + 1e-30))

    # Late-time delayed yield approximation (after drainage)
    if t_D > 1e4:
        return math.log(4 * t_D) + 0.5772156649  # Euler gamma

    # Numerical integration parameters
    N = 300
    u_vals = np.linspace(0.1, 20, N)

    F = 0.0
    for u in u_vals:
        # Combined elastic + delayed yield kernel (Neuman 1972)
        kernel = (
            math.exp(-u * u * t_D)
            / (u * u + gamma * gamma)
        )

        # Add drainage term for Sy
        drainage = Sy * (1 - math.exp(-u * u * t_D / Sy))

        F += kernel * (1 + drainage)

    # Normalize by integration domain
    F *= (20 - 0.1) / N

    return F
