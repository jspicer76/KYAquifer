from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.boundary import BoundaryPoint

router = APIRouter(prefix="/boundaries", tags=["Boundaries"])

@router.post("/")
def add_boundary_point(project_id: int, boundary_type: str, lat: float, lng: float, db: Session = Depends(get_db)):
    p = BoundaryPoint(
        project_id=project_id,
        boundary_type=boundary_type,
        lat=lat,
        lng=lng
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p

@router.get("/{project_id}")
def list_boundaries(project_id: int, db: Session = Depends(get_db)):
    return db.query(BoundaryPoint).filter(BoundaryPoint.project_id == project_id).all()
