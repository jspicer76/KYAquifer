from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from .pdf_engine import build_kdow_pdf

router = APIRouter(prefix="/report/kdow", tags=["KDOW Report"])

@router.post("/export")
async def export_kdow_report(payload: dict):
    pdf_bytes = build_kdow_pdf(payload)
    return StreamingResponse(
        pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=KDOW_Aquifer_Report.pdf"}
    )
