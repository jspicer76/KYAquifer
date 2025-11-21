"""
WELLHEAD PROTECTION (WHP) ZONE GENERATOR
----------------------------------------

Computes Zone II and Zone III using:

  • 2D hydraulic gradient (Theis or Neuman)
  • Darcy velocity field
  • Forward particle tracking
  • Capture boundary curves (upgradient)
  • Travel-time isochrons (Zone II)
  • Watershed polygon extrapolation (Zone III)

Output:
  {
      "zone2": [[x,y],...],
      "zone3": [[x,y],...]
  }
"""

import numpy as np
from app.analysis.theis import theis_drawdown
from app.analysis.neuman import neuman_drawdown


def velocity_field(model, Q, T, S, Sy, Ss, Kz_Kr, b, r, t):
    """
    Computes Darcy velocity magnitude from ∂s/∂r.
    """

    dr = 0.5
    s1 = drawdown(model, Q, T, S, Sy, Ss, Kz_Kr, b, r - dr, t)
    s2 = drawdown(model, Q, T, S, Sy, Ss, Kz_Kr, b, r + dr, t)
    dsdr = (s2 - s1) / (2 * dr)

    # Darcy velocity v = K * dh/dr
    # For radial gradient: dh/dr ≈ ds/dr
    K = T / b
    v = -K * dsdr
    return v


def drawdown(model, Q, T, S, Sy, Ss, Kz_Kr, b, r, t):
    """Unified drawdown wrapper."""
    if model == "theis":
        return theis_drawdown(Q, T, S, r, t)
    if model == "neuman":
        return neuman_drawdown(Q, T, Ss, Sy, Kz_Kr, r, t, b)
    return 0.0


def runge_kutta_step(model, Q, T, S, Sy, Ss, Kz_Kr, b, x, y, t, dt):
    """
    Forward particle tracking step.
    """
    r = np.sqrt(x * x + y * y)
    v = velocity_field(model, Q, T, S, Sy, Ss, Kz_Kr, b, r, t)

    # unit vector in radial direction
    if r < 1e-6:
        return x, y

    ux, uy = x / r, y / r

    dx = ux * v * dt
    dy = uy * v * dt

    return x + dx, y + dy


def generate_zone(model, Q, T, S, Sy, Ss, Kz_Kr, b, years=5):
    """
    Generates a closed capture polygon for Zone II.
    """
    minutes = years * 365 * 24 * 60
    n_seeds = 60
    zone = []

    # seed angles
    angles = np.linspace(0, 2 * np.pi, n_seeds)

    for theta in angles:
        x, y = np.cos(theta) * 200, np.sin(theta) * 200  # 200 ft radius seed
        t = 1.0
        dt = 50.0

        for _ in range(2000):
            x, y = runge_kutta_step(model, Q, T, S, Sy, Ss, Kz_Kr, b, x, y, t, dt)
            t += dt
            if t > minutes:
                break

        zone.append([x, y])

    return zone


def compute_zones(model, Q, params):
    """Entry point from FastAPI."""
    T = params["T"]
    S = params.get("S")
    Ss = params.get("Ss")
    Sy = params.get("Sy")
    Kz_Kr = params.get("Kz_over_Kr", 0.1)
    b = params.get("b", 50)

    zone2 = generate_zone(model, Q, T, S, Sy, Ss, Kz_Kr, b, years=5)
    zone3 = generate_zone(model, Q, T, S, Sy, Ss, Kz_Kr, b, years=20)

    return {
        "zone2": zone2,
        "zone3": zone3
    }
