"""
STEP TEST ANALYSIS — JACOB WELL-LOSS METHOD (1947)
-------------------------------------------------

References:
 - Jacob, C.E. (1947). Drawdown Test to Determine Well Performance.
 - Todd (2005) Groundwater Hydrology.
 - USGS C09-002.
 - KDOW 401 KAR 8:100 Step-Drawdown Requirements.
 - 10 State Standards.

Equation:
    s = B Q + C Q²

Where:
    B = linear (formation) loss coefficient
    C = non-linear (turbulent well-loss) coefficient

Given step test data:
   q_i = flow rate for step i (gpm)
   s_i = stabilized drawdown for step i (ft)

We perform linear regression on:
   s_i / Q_i  versus  Q_i

Slope  = C
Intercept = B

Returns:
  - B (ft/gpm)
  - C (ft/gpm²)
  - predicted drawdown at design Q
  - well efficiency
"""

import numpy as np


def step_test_BC(q_list, s_list):
    """
    Computes B and C from step-test data.

    Inputs:
      q_list: list of flow rates (gpm)
      s_list: list of drawdowns (ft)

    Returns:
      B, C
    """
    q_arr = np.array(q_list, dtype=float)
    s_arr = np.array(s_list, dtype=float)

    # y = s/Q
    y = s_arr / q_arr

    # x = Q
    x = q_arr

    # Fit y = B + C Q  (linear regression)
    A = np.vstack([np.ones_like(x), x]).T
    coeff, *_ = np.linalg.lstsq(A, y, rcond=None)

    B = coeff[0]
    C = coeff[1]

    return B, C


def predict_drawdown(B, C, Q):
    """
    s = BQ + CQ²
    """
    return B * Q + C * Q**2


def well_efficiency(B, C, Q):
    """
    Well efficiency:
        E = (BQ) / (BQ + CQ²)
    """
    s_total = predict_drawdown(B, C, Q)
    s_formation = B * Q
    return s_formation / s_total
