"""
THEIS (1935) CONFINED AQUIFER SOLUTION
--------------------------------------

References:
 - Theis, C.V. (1935) USGS Circular.
 - Todd, D.K. (2005) "Groundwater Hydrology".
 - USGS C09-002 "Groundwater Hydraulics".
 - KDOW 401 KAR 8:100 – Aquifer testing requirements.
 - 10-State Standards, Water Wells.

Units:
 - Q: gpm (converted internally to ft³/day)
 - T: ft²/day
 - S: dimensionless
 - r: ft
 - t: minutes (converted to days)

This module provides:
 1. Theis well function W(u)
 2. Drawdown s(r,t)
 3. Recovery s'
 4. Cooper–Jacob approximation
 5. Multi-well superposition
"""

import math


# Convert gpm to ft³/day
GPM_TO_FT3_PER_DAY = 192.0  # exact: 1 gallon = 0.133681 ft³; 1440 min/day


def theis_W(u):
    """
    Theis well function W(u):
    W(u) = -Ei(-u)

    Implemented using:
      - Series expansion for small u (u < 0.01)
      - Asymptotic for large u (u > 5)
      - General numerical approximation otherwise
    """

    if u < 1e-8:
        # Avoid singularity
        return -math.log(u) - 0.5772156649  # Euler-Mascheroni
    elif u < 0.01:
        # Series expansion (Todd, 2005)
        return -0.5772156649 - math.log(u) + u - (u**2) / 4 + (u**3) / 18
    elif u > 5:
        # Asymptotic expansion
        return math.exp(-u) / u
    else:
        # Numerical Ei approximation
        # Ei(-u) ≈ γ + ln(u) + Σ_{k=1..∞} (-u)^k / (k * k!)
        # Truncated series
        gamma = 0.5772156649
        Ei = gamma + math.log(u)
        term = -u
        k = 1
        while abs(term) > 1e-10 and k < 50:
            Ei += term / (k * math.factorial(k))
            k += 1
            term *= -u
        return -Ei


def theis_drawdown(Q_gpm, T, S, r_ft, t_min):
    """
    Theis drawdown:
    s = (Q / (4πT)) * W(u)

    where:
      u = r² S / (4 T t)
    """
    if t_min <= 0:
        return 0.0

    # Convert Q to ft³/day
    Q = Q_gpm * 192.0

    t_days = t_min / 1440.0
    u = (r_ft**2 * S) / (4 * T * t_days)

    W = theis_W(u)
    return (Q / (4 * math.pi * T)) * W


def cooper_jacob(Q_gpm, T, r_ft, t_min):
    """
    Cooper-Jacob straight line approximation:
      s = (2.3 Q / (4πT)) log10(2.25 T t / (r² S))

    This version returns only the *slope* part, T-estimation done elsewhere.
    """

    if t_min <= 0:
        return 0.0

    Q = Q_gpm * GPM_TO_FT3_PER_DAY
    t_days = t_min / 1440

    return (2.3 * Q) / (4 * math.pi * T) * math.log10(t_days)


def theis_recovery(Q_gpm, T, S, r_ft, t_before_min, t_after_min):
    """
    Theis recovery:
    s' = (Q / 4πT) * [ W(u_after) - W(u_before) ]

    Where t_before = time since pumping started when pumping stopped
          t_after = elapsed time since shutdown
    """
    if t_after_min <= 0:
        return 0.0

    Q = Q_gpm * 192.0
    tb = t_before_min / 1440
    ta = t_after_min / 1440

    u1 = (r_ft**2 * S) / (4 * T * (tb + ta))
    u0 = (r_ft**2 * S) / (4 * T * tb)

    W1 = theis_W(u1)
    W0 = theis_W(u0)

    return (Q / (4 * math.pi * T)) * (W1 - W0)


def theis_superposition(Q_list, r_list, T, S, t_min):
    """
    Superposition for multiple pumping wells:
        s_total = Σ s_i

    Each well has:
      Q_i, r_i
    """
    total = 0.0
    for Q, r in zip(Q_list, r_list):
        total += theis_drawdown(Q, T, S, r, t_min)
    return total
