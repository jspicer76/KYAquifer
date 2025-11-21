import math
import numpy as np

def compute_zone1(rw_ft: float):
    """
    WHP Zone I = 400 ft standard for KY unless sanitary survey says otherwise.
    """
    return 400.0

def compute_zone2(Q_gpm: float, T: float, Sy: float):
    """
    Simplified 5-year time-of-travel polygon using groundwater velocity:
    v = (T / Sy) / b (approx simplified)
    We produce a simple 8-point teardrop polygon in local feet.
    """
    # Horizontal groundwater velocity in ft/day
    v = (T / Sy) / 10.0  # approximate b = 10 ft for unconfined
    travel_distance_ft = v * (5 * 365)  # 5-year TOT

    # Build a simple teardrop shape
    angles = np.linspace(0, 2 * math.pi, 16)
    poly = [
        [travel_distance_ft * math.cos(a), travel_distance_ft * math.sin(a)]
        for a in angles
    ]
    return poly

def compute_zone3(Q_gpm: float, T: float, Sy: float, b_ft: float):
    """
    Outer recharge boundary Zone III:
    d ≈ 40 * Zone II radius (common WHP assumption for large recharge area)
    """
    # using same v as zone 2
    v = (T / Sy) / b_ft
    r2 = v * (5 * 365)

    r3 = r2 * 40.0  # conservative
    angles = np.linspace(0, 2 * math.pi, 32)

    poly = [
        [r3 * math.cos(a), r3 * math.sin(a)]
        for a in angles
    ]
    return poly
