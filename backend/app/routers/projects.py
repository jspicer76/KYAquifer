from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.project import Project

router = APIRouter(prefix="/projects", tags=["Projects"])

@router.post("/")
def create_project(name: str, description: str = "", db: Session = Depends(get_db)):
    proj = Project(name=name, description=description)
    db.add(proj)
    db.commit()
    db.refresh(proj)
    return proj

@router.get("/")
def list_projects(db: Session = Depends(get_db)):
    return db.query(Project).all()
