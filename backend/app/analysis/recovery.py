"""
RECOVERY ANALYSIS — THEIS RECOVERY METHOD
-----------------------------------------

References:
 - Theis (1935) USGS Circular.
 - Jacob (1944, 1947).
 - Todd (2005) Groundwater Hydrology.
 - USGS C09-002.
 - KDOW 401 KAR 8:100 Recovery Requirements.

Theis Recovery:
  s' = (Q / (4πT)) * [ W(u_after) - W(u_before) ]

In practice, recovery is plotted as:
    s' vs log(t / t')

Where:
    t = elapsed time since pumping began
    t' = time since pumping stopped

The recovery line is parallel to Cooper–Jacob line.
"""

import math
import numpy as np
from app.analysis.theis import theis_W, GPM_TO_FT3_PER_DAY


def recovery_drawdown(Q_gpm, T, S, r_ft, t_before_min, t_after_min):
    """
    Compute recovery drawdown s' using Theis formula:

    s' = (Q / 4πT) * [ W(u1) - W(u0) ]
    """
    if t_after_min <= 0:
        return 0.0

    Q = Q_gpm * GPM_TO_FT3_PER_DAY
    tb = t_before_min / 1440.0
    ta = t_after_min / 1440.0

    u1 = (r_ft**2 * S) / (4 * T * (tb + ta))
    u0 = (r_ft**2 * S) / (4 * T * tb)

    W1 = theis_W(u1)
    W0 = theis_W(u0)

    return (Q / (4 * math.pi * T)) * (W1 - W0)


def fit_recovery_T(q_gpm, r_ft, t_before_min, t_after_list, s_prime_list):
    """
    Fit transmissivity T from recovery data using Cooper–Jacob recovery method.

    Using straight-line approximation:
       s' = (2.3 Q / (4πT)) * log10(t/t')

    Slope m = (2.3 Q) / (4πT)

    Therefore:
       T = (2.3 Q) / (4π m)

    Inputs:
       q_gpm: pumping rate (gpm)
       r_ft: distance to observation well (ft)
       t_before_min: time pumping occurred before shutdown
       t_after_list: list of t' (minutes after pumping stopped)
       s_prime_list: drawdown recovery values (ft)

    Returns:
       T (ft²/day)
    """

    Q = q_gpm * GPM_TO_FT3_PER_DAY

    # log10(t/t')
    t_list = []
    for t_after in t_after_list:
        if t_after <= 0:
            t_list.append(0)
        else:
            t_total = (t_before_min + t_after)
            t_list.append(math.log10(t_total / t_after))

    x = np.array(t_list)
    y = np.array(s_prime_list)

    # Fit y = m x + b
    A = np.vstack([x, np.ones_like(x)]).T
    m, b = np.linalg.lstsq(A, y, rcond=None)[0]

    # T from slope
    T = (2.3 * Q) / (4 * math.pi * m)

    return T


def fit_recovery_S(T, r_ft, t0_min):
    """
    Storativity from recovery intercept:

       S = (2.25 T t0) / r²
    """
    return (2.25 * T * (t0_min / 1440.0)) / (r_ft**2)
