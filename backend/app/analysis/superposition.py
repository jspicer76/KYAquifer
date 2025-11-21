"""
SUPERPOSITION ENGINE FOR MULTI-WELL INTERFERENCE
------------------------------------------------

Supports superposition for:
 - Theis (confined)
 - Cooper–Jacob (CJ)
 - Neuman (unconfined delayed yield)
 - Hantush–Jacob (leaky)

References:
 - Theis (1935)
 - Jacob (1946)
 - Neuman (1972–1979)
 - Hantush & Jacob (1955)
 - USGS C09-002
 - Todd (2005)
 - KDOW 401 KAR 8:100 – multiple-well interaction effects

Superposition:
    s_total = Σ s_i

Each well has:
    Q_i   — pumping rate (gpm)
    r_i   — distance to observation point (ft)
    params — T, S, Ss, Sy, B, K′, etc. depending on model
"""

from app.analysis.theis import theis_drawdown
from app.analysis.cooper_jacob import drawdown_CJ
from app.analysis.neuman import neuman_drawdown
from app.analysis.hantush_jacob import hantush_drawdown


def superposition_theis(Q_list, r_list, T, S, t_min):
    """Simple superposition for Theis."""
    total = 0.0
    for Q, r in zip(Q_list, r_list):
        total += theis_drawdown(Q, T, S, r, t_min)
    return total


def superposition_CJ(Q_list, r_list, T, S, t_min):
    """Superposition for Cooper–Jacob."""
    total = 0.0
    for Q, r in zip(Q_list, r_list):
        total += drawdown_CJ(Q, T, r, t_min)
    return total


def superposition_neuman(
    Q_list,
    r_list,
    T,
    Ss,
    Sy,
    Kz_over_Kr,
    t_min,
    b_ft,
    d_pump_ft=None,
):
    """Superposition for Neuman unconfined aquifer."""
    total = 0.0
    for Q, r in zip(Q_list, r_list):
        total += neuman_drawdown(Q, T, Ss, Sy, Kz_over_Kr, r, t_min, b_ft, d_pump_ft)
    return total


def superposition_hantush(
    Q_list,
    r_list,
    T,
    S,
    t_min,
    b_prime_ft,
    K_prime,
):
    """Superposition for Hantush–Jacob leaky aquifer."""
    total = 0.0
    for Q, r in zip(Q_list, r_list):
        total += hantush_drawdown(Q, T, S, r, t_min, b_prime_ft, K_prime)
    return total
