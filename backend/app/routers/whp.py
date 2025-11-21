from fastapi import APIRouter
from pydantic import BaseModel
from app.analysis.whp_zone_math import compute_zone1, compute_zone2, compute_zone3

router = APIRouter(prefix="/whp", tags=["Wellhead Protection"])

class WHPRequest(BaseModel):
    Q_gpm: float
    T: float
    Sy: float
    b_ft: float
    well_lat: float
    well_lng: float
    pumping_radius_ft: float = 0.5

@router.post("/compute")
def compute_whp(req: WHPRequest):
    """
    Computes WHP zones I, II, III.
    Returns polygons in feet (local coordinate system) and NOT lat/lng—
    frontend converts to map coordinates.
    """
    zone1_radius = compute_zone1(req.pumping_radius_ft)
    zone2_poly = compute_zone2(req.Q_gpm, req.T, req.Sy)
    zone3_poly = compute_zone3(req.Q_gpm, req.T, req.Sy, req.b_ft)

    return {
        "zone1_ft": zone1_radius,
        "zone2_polygon_ft": zone2_poly,
        "zone3_polygon_ft": zone3_poly,
        "well_lat": req.well_lat,
        "well_lng": req.well_lng
    }
