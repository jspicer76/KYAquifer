from fastapi import APIRouter
from .run_analysis import run_analysis_logic

router = APIRouter(prefix="/analysis", tags=["Aquifer Analysis"])

@router.post("/run")
def run_analysis(payload: dict):
    """Unified aquifer analysis endpoint."""
    return run_analysis_logic(payload)
