from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.test import PumpTest
import json

router = APIRouter(prefix="/tests", tags=["Pump Tests"])

@router.post("/")
def upload_test(project_id: int, test_type: str, csv_json: str, db: Session = Depends(get_db)):
    t = PumpTest(
        project_id=project_id,
        test_type=test_type,
        csv_data=csv_json
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return t

@router.get("/{project_id}")
def list_tests(project_id: int, db: Session = Depends(get_db)):
    return db.query(PumpTest).filter(PumpTest.project_id == project_id).all()
