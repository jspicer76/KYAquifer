"""
HANTUSH–JACOB (1955) LEAKY AQUIFER SOLUTION
-------------------------------------------

References:
 - Hantush & Jacob (1955) Papers on leaky aquifers.
 - USGS C09-002.
 - Todd (2005) Groundwater Hydrology.
 - KDOW 401 KAR 8:100 for semi-confined aquifer scenarios.

Equation:
    s = (Q / 4πT) * W(u, r/B)

Where:
    u = r² S / (4 T t)
    B = sqrt( T b' / K' )

b' : aquitard thickness (ft)
K' : vertical leakage (ft/day)

This module implements:
 1. Hantush leakage factor B
 2. W(u, r/B) via numerical approximation
 3. Drawdown solution
"""

import math
from app.analysis.theis import GPM_TO_FT3_PER_DAY


def leakage_factor(T, b_prime_ft, K_prime):
    """
    Leakage factor:
        B = sqrt(T b' / K')
    """
    return math.sqrt(T * b_prime_ft / K_prime)


def W_leaky(u, r_over_B):
    """
    Hantush well function for leaky aquifer:

    W(u, r/B) = ∫[u -> ∞] (e^{-y} dy / (y + r/B))

    Use numerical quadrature:
       - adaptive steps
       - cutoff at y = 50
    """
    if u <= 0:
        u = 1e-12

    upper = 50.0
    N = 2000
    dy = (upper - u) / N

    total = 0.0
    y = u
    for _ in range(N):
        total += math.exp(-y) / (y + r_over_B)
        y += dy

    return total * dy


def hantush_drawdown(Q_gpm, T, S, r_ft, t_min, b_prime_ft, K_prime):
    """
    Leaky aquifer drawdown:
        s = (Q / (4πT)) * W(u, r/B)
    """
    if t_min <= 0:
        return 0.0

    Q = Q_gpm * GPM_TO_FT3_PER_DAY
    t_days = t_min / 1440.0

    u = (r_ft**2 * S) / (4 * T * t_days)

    B = leakage_factor(T, b_prime_ft, K_prime)
    ratio = r_ft / B

    W = W_leaky(u, ratio)

    return (Q / (4 * math.pi * T)) * W
