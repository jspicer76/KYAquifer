from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.well import Well

router = APIRouter(prefix="/wells", tags=["Wells"])

@router.post("/")
def add_well(project_id: int, lat: float, lng: float, type: str, name: str = "", db: Session = Depends(get_db)):
    w = Well(
        project_id=project_id,
        lat=lat,
        lng=lng,
        type=type,
        name=name,
    )
    db.add(w)
    db.commit()
    db.refresh(w)
    return w

@router.get("/{project_id}")
def list_wells(project_id: int, db: Session = Depends(get_db)):
    return db.query(Well).filter(Well.project_id == project_id).all()
