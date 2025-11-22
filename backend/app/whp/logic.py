from app.analysis.whp import compute_zones

def compute_whp_zones(payload: dict):
    """
    Wrapper so WHP logic is cleanly exposed as /whp/compute.
    compute_zones() lives in backend/app/analysis/whp.py
    """
    return compute_zones(payload)
