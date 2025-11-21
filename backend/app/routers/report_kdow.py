from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
import io
import base64
import datetime

router = APIRouter()

# ------------------------------
# DATA MODELS
# ------------------------------
class KDOWReportRequest(BaseModel):
    project_name: str
    pumping_rate_gpm: float
    wells: list
    boundaries: dict
    whp: dict
    analysis: dict
    map_image_base64: str | None = None
    step_plot_base64: str | None = None
    constant_plot_base64: str | None = None
    recovery_plot_base64: str | None = None


# ------------------------------
# ROUTE
# ------------------------------
@router.post("/report/kdow/export")
def export_kdow_report(req: KDOWReportRequest):

    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter

    # ------------------------------
    # COVER PAGE
    # ------------------------------
    pdf.setFont("Helvetica-Bold", 20)
    pdf.drawString(60, height - 50, "Kentucky Division of Water")
    pdf.drawString(60, height - 80, "Aquifer Analysis Report")

    pdf.setFont("Helvetica", 12)
    pdf.drawString(60, height - 130, f"Project: {req.project_name}")
    pdf.drawString(60, height - 150, f"Date: {datetime.date.today()}")
    pdf.drawString(60, height - 170, f"Pumping Rate: {req.pumping_rate_gpm} gpm")
    pdf.drawString(60, height - 190, f"Number of Wells: {len(req.wells)}")

    pdf.showPage()

    # ------------------------------
    # MAP PAGE
    # ------------------------------
    pdf.setFont("Helvetica-Bold", 16)
    pdf.drawString(60, height - 40, "Site Map")

    if req.map_image_base64:
        try:
            img_bytes = base64.b64decode(req.map_image_base64.split(",")[-1])
            img = ImageReader(io.BytesIO(img_bytes))
            pdf.drawImage(img, 60, 150, width=480, preserveAspectRatio=True)
        except:
            pdf.drawString(60, height - 70, "Error rendering map image.")

    pdf.showPage()

    # ------------------------------
    # WELL TABLE
    # ------------------------------
    pdf.setFont("Helvetica-Bold", 16)
    pdf.drawString(60, height - 40, "Well Metadata")

    pdf.setFont("Helvetica-Bold", 10)
    y = height - 70
    pdf.drawString(60, y, "Name")
    pdf.drawString(130, y, "Lat")
    pdf.drawString(200, y, "Lng")
    pdf.drawString(270, y, "Depth (ft)")
    pdf.drawString(350, y, "Screen (ft)")
    pdf.drawString(450, y, "Casing Dia (in)")

    y -= 20
    pdf.setFont("Helvetica", 10)

    for w in req.wells:
        pdf.drawString(60, y, w["name"])
        pdf.drawString(130, y, f"{w.get('lat', ''):.6f}")
        pdf.drawString(200, y, f"{w.get('lng', ''):.6f}")
        pdf.drawString(270, y, str(w.get("depth_ft", "")))
        pdf.drawString(
            350,
            y,
            f"{w.get('screen_top_ft','')} - {w.get('screen_bottom_ft','')}",
        )
        pdf.drawString(450, y, str(w.get("casing_diameter_in", "")))
        y -= 18

        if y < 100:
            pdf.showPage()
            y = height - 70

    pdf.showPage()

    # ------------------------------
    # PUMP TEST PLOTS
    # ------------------------------
    pdf.setFont("Helvetica-Bold", 16)
    pdf.drawString(60, height - 40, "Pump Test Figures")

    y_plot = height - 300

    def embed_plot(base64str, label, y_offset):
        if not base64str:
            return y_offset - 20

        pdf.setFont("Helvetica-Bold", 12)
        pdf.drawString(60, y_offset + 240, label)

        try:
            img_bytes = base64.b64decode(base64str.split(",")[-1])
            img = ImageReader(io.BytesIO(img_bytes))
            pdf.drawImage(img, 60, y_offset, width=480, preserveAspectRatio=True)
        except:
            pdf.drawString(60, y_offset + 240, f"Error rendering {label}")

        return y_offset - 280

    y_plot = embed_plot(req.step_plot_base64, "Step-Drawdown Test", y_plot)
    y_plot = embed_plot(req.constant_plot_base64, "Constant-Rate Test", y_plot)
    y_plot = embed_plot(req.recovery_plot_base64, "Recovery Test", y_plot)

    pdf.showPage()

    # ------------------------------
    # ANALYSIS SUMMARY
    # ------------------------------
    pdf.setFont("Helvetica-Bold", 16)
    pdf.drawString(60, height - 40, "Aquifer Parameter Analysis")

    pdf.setFont("Helvetica", 12)
    y = height - 80

    for key, value in req.analysis.items():
        pdf.drawString(60, y, f"{key}: {value}")
        y -= 18
        if y < 80:
            pdf.showPage()
            y = height - 80

    pdf.showPage()

    # ------------------------------
    # FINISH
    # ------------------------------
    pdf.save()
    buffer.seek(0)

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=KDOW_Aquifer_Report.pdf"},
    )
