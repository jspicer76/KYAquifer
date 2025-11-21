from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
import os

from app.db.database import get_db
from app.models.project import Project
from app.pdf.report import generate_kdow_report

router = APIRouter(prefix="/report", tags=["Report"])


@router.get("/kdow/{project_id}")
def kdow_report(project_id: int, db: Session = Depends(get_db)):
    """
    Generates and returns the KDOW aquifer analysis PDF.
    """

    # Load project metadata
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        return {"error": "Project not found"}

    # Path for the PDF
    output_path = f"kdow_report_{project_id}.pdf"

    # For now, mock analysis results
    # In final version, this will query the analysis table
    analysis_results = {
        "model_used": "theis",
        "step_test": {},
        "constant_rate": {},
        "recovery": {},
        "drawdown_series": {"time_min": [], "drawdown_ft": []},
        "whp": {
            "zone1": 150,
            "zone2": [],
            "zone3": []
        },
        "safe_yield": {"Qsafe_gpm": 0}
    }

    # Generate PDF
    generate_kdow_report(
        project={"name": project.name, "description": project.description},
        analysis_results=analysis_results,
        output_path=output_path
    )

    return FileResponse(output_path, media_type="application/pdf", filename=os.path.basename(output_path))
