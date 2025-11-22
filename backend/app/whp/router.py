from fastapi import APIRouter
from .logic import compute_whp_zones

router = APIRouter(prefix="/whp", tags=["WHP Zones"])

@router.post("/compute")
def whp_compute(payload: dict):
    """
    WHP Zone generation endpoint.
    Frontend calls POST /whp/compute
    """
    return compute_whp_zones(payload)
