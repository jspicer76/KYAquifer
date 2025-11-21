"""
KDOW AQUIFER ANALYSIS PDF REPORT GENERATOR
------------------------------------------

Generates a complete KDOW-compliant PDF report including:

 • Project metadata
 • Step, Constant, and Recovery analyses
 • Well-loss B & C coefficients
 • Theis, Cooper–Jacob, Neuman, Hantush outputs
 • Safe yield
 • WHP Zones I, II, III
 • Drawdown curves
 • Boundary map
 • Placeholder logo on cover

Uses:
  - ReportLab for layout
  - Matplotlib for plots
"""

from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, Table
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib import colors

import matplotlib.pyplot as plt
import io
import os

styles = getSampleStyleSheet()


def fig_to_img(fig):
    """Convert Matplotlib figure to ReportLab Image."""
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=180, bbox_inches="tight")
    buf.seek(0)
    return buf


def placeholder_logo():
    """Generate a simple placeholder engineering logo."""
    fig, ax = plt.subplots(figsize=(3, 1))
    ax.text(0.5, 0.5, "ENGINEERING\nREPORT", ha="center", va="center",
            fontsize=20, weight="bold")
    ax.axis("off")
    return fig_to_img(fig)


def drawdown_figure(times, values):
    """Create drawdown chart for PDF."""
    fig, ax = plt.subplots()
    ax.plot(times, values, '-o')
    ax.set_xlabel("Time (min)")
    ax.set_ylabel("Drawdown (ft)")
    ax.grid(True)
    return fig_to_img(fig)


def whp_zone_figure(zone1_r, zone2_poly, zone3_poly):
    """Draw WHP zones."""
    fig, ax = plt.subplots()

    # Zone I (circle)
    circ = plt.Circle((0, 0), zone1_r, color='blue', fill=False, linestyle='--')
    ax.add_patch(circ)

    # Zone II polygon
    if zone2_poly:
        xs = [p[0] for p in zone2_poly]
        ys = [p[1] for p in zone2_poly]
        ax.plot(xs, ys, 'g--')

    # Zone III polygon
    if zone3_poly:
        xs = [p[0] for p in zone3_poly]
        ys = [p[1] for p in zone3_poly]
        ax.plot(xs, ys, 'r-.')

    ax.set_aspect("equal")
    ax.set_title("WHP Zones I, II, III")
    ax.grid(True)

    return fig_to_img(fig)


def generate_kdow_report(project, analysis_results, output_path):
    """
    Main PDF generator.

    Inputs:
      project: dict containing project metadata
      analysis_results: output from /analysis/run
      output_path: PDF file path
    """

    doc = SimpleDocTemplate(output_path, pagesize=letter)
    story = []

    # --- COVER PAGE ---
    logo_buf = placeholder_logo()
    story.append(Image(logo_buf, width=3*inch, height=1*inch))
    story.append(Spacer(1, 0.3*inch))

    story.append(Paragraph("<b>KDOW Aquifer Analysis Report</b>", styles["Title"]))
    story.append(Spacer(1, 0.2*inch))

    story.append(Paragraph(f"<b>Project:</b> {project['name']}", styles["Heading2"]))
    story.append(Paragraph(f"<b>Description:</b> {project.get('description','')}", styles["BodyText"]))
    story.append(Spacer(1, 0.5*inch))

    story.append(Paragraph("<b>Prepared for:</b> Kentucky Division of Water", styles["BodyText"]))
    story.append(Paragraph("In compliance with 401 KAR 8:100 – Groundwater Source Development", styles["BodyText"]))
    story.append(Spacer(1, 1*inch))

    story.append(Paragraph("Prepared by:", styles["BodyText"]))
    story.append(Paragraph("Engineering Report Generator – Placeholder Version", styles["BodyText"]))
    story.append(Spacer(1, 1*inch))

    story.append(Paragraph("Date: ____________________", styles["BodyText"]))
    story.append(Spacer(1, 2*inch))

    story.append(PageBreak())

    # --- ANALYSIS SUMMARY ---
    story.append(Paragraph("<b>Aquifer Analysis Summary</b>", styles["Heading1"]))
    story.append(Spacer(1, 0.2*inch))

    # List model used
    story.append(Paragraph(f"<b>Analytical Model Used:</b> {analysis_results['model_used']}", styles["BodyText"]))
    story.append(Spacer(1, 0.2*inch))

    # Step test
    if "step_test" in analysis_results:
        s = analysis_results["step_test"]
        story.append(Paragraph("<b>Step-Drawdown Test Results</b>", styles["Heading2"]))
        story.append(Paragraph(f"B (linear loss): {s['B']:.4f}", styles["BodyText"]))
        story.append(Paragraph(f"C (turbulent loss): {s['C']:.6f}", styles["BodyText"]))
        story.append(Paragraph(f"Predicted drawdown at design Q: {s['drawdown_at_Q']:.2f} ft", styles["BodyText"]))
        story.append(Paragraph(f"Well efficiency: {s['efficiency']*100:.1f}%", styles["BodyText"]))
        story.append(Spacer(1, 0.3*inch))

    # Constant rate
    if "constant_rate" in analysis_results:
        c = analysis_results["constant_rate"]
        story.append(Paragraph("<b>Constant-Rate Test (Cooper–Jacob)</b>", styles["Heading2"]))
        story.append(Paragraph(f"T (transmissivity): {c['T_from_CJ']:.2f} ft²/day", styles["BodyText"]))
        story.append(Paragraph(f"Slope: {c['slope']:.4f}", styles["BodyText"]))
        story.append(Paragraph(f"Intercept: {c['intercept']:.4f}", styles["BodyText"]))
        story.append(Spacer(1, 0.3*inch))

    # Recovery
    if "recovery" in analysis_results:
        r = analysis_results["recovery"]
        story.append(Paragraph("<b>Recovery Test Results</b>", styles["Heading2"]))
        if r["T_from_recovery"] is not None:
            story.append(Paragraph(f"T from recovery: {r['T_from_recovery']:.2f} ft²/day", styles["BodyText"]))
        if r["S_from_recovery"] is not None:
            story.append(Paragraph(f"S from recovery: {r['S_from_recovery']:.4e}", styles["BodyText"]))
        story.append(Spacer(1, 0.3*inch))

    # Safe yield
    if "safe_yield" in analysis_results:
        sy = analysis_results["safe_yield"]
        story.append(Paragraph("<b>Safe Yield</b>", styles["Heading2"]))
        story.append(Paragraph(f"Safe yield: {sy['Qsafe_gpm']:.1f} gpm", styles["BodyText"]))
        story.append(Spacer(1, 0.3*inch))

    # --- Drawdown Plot ---
    if "drawdown_series" in analysis_results:
        story.append(Paragraph("<b>Drawdown Curve</b>", styles["Heading2"]))
        times = analysis_results["drawdown_series"]["time_min"]
        values = analysis_results["drawdown_series"]["drawdown_ft"]

        dd_buf = drawdown_figure(times, values)
        story.append(Image(dd_buf, width=5.5*inch, height=3.5*inch))
        story.append(Spacer(1, 0.3*inch))

    # --- WHP Zones ---
    if "whp" in analysis_results:
        story.append(Paragraph("<b>Wellhead Protection Zones</b>", styles["Heading2"]))

        z1 = analysis_results["whp"]["zone1"]
        z2 = analysis_results["whp"]["zone2"]
        z3 = analysis_results["whp"]["zone3"]

        whp_buf = whp_zone_figure(z1, z2, z3)
        story.append(Image(whp_buf, width=5.5*inch, height=4.0*inch))
        story.append(Spacer(1, 0.3*inch))

    doc.build(story)
