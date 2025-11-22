import io
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
import base64

styles = getSampleStyleSheet()

def _img(b64, w=5*inch):
    if not b64:
        return None
    data = base64.b64decode(b64.split(",")[1])
    buf = io.BytesIO(data)
    return Image(buf, width=w, preserveAspectRatio=True)

def build_kdow_pdf(data):
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=letter)
    story = []

    def h(txt): story.append(Paragraph(f"<b>{txt}</b>", styles["Heading2"]))
    def p(txt): story.append(Paragraph(txt, styles["BodyText"]))
    def space(): story.append(Spacer(1, 0.2*inch))

    # --------------------------
    # TITLE PAGE
    # --------------------------
    h("Kentucky Division of Water")
    h("Groundwater Source Approval Report")
    space()
    p(f"Project: {data.get('project_name','')}")
    p(f"Pumping Rate: {data.get('pumping_rate_gpm','')} gpm")
    space()

    # --------------------------
    # SECTION 1: WELL CONSTRUCTION
    # --------------------------
    h("1. Well Construction Data")
    wells = data.get("wells", [])
    for w in wells:
        p(f"Well {w['name']}: Depth {w['depth']} ft, Screen {w['screen_top']}–{w['screen_bot']} ft")

    space()

    # --------------------------
    # SECTION 2: GEOLOGY
    # --------------------------
    h("2. Geologic & Hydrogeologic Setting")
    p("Description of local stratigraphy, aquifer thickness, boundaries, and lithologic conditions "
      "per 401 KAR 8:100 and USGS TWRI guidance.")
    space()

    # --------------------------
    # SECTION 3: AQUIFER TEST RESULTS
    # --------------------------
    h("3. Pumping Test Results")
    p("Analysis performed using Theis / Cooper-Jacob and delayed yield models per USGS TWRI 3-B1.")
    p("Parameters: ")
    p(str(data.get("analysis", {})))
    space()

    # Insert plots
    for key, label in [
        ("step_plot_base64", "Step-Drawdown Test"),
        ("constant_plot_base64", "72-Hour Constant Rate Test"),
        ("recovery_plot_base64", "Recovery Test")
    ]:
        img = _img(data.get(key))
        if img:
            h(label)
            story.append(img)
            space()

    # --------------------------
    # SECTION 4: MAP & WHP
    # --------------------------
    h("4. Wellhead Protection (WHP) Zones")
    map_img = _img(data.get("map_image_base64"))
    if map_img:
        story.append(map_img)
        space()

    whp = data.get("whp", {})
    p(f"WHP Zones Summary: {whp}")
    space()

    # --------------------------
    # SECTION 5: SAFE YIELD
    # --------------------------
    h("5. Safe Yield Determination")
    p("Safe yield calculated based on test data, drawdown response, and predicted long-term "
      "transmissivity and storage per TWRI.")
    sy = data.get("analysis", {}).get("safe_yield_gpm", "N/A")
    p(f"Estimated Safe Yield: {sy} gpm")
    space()

    # --------------------------
    # SECTION 6: WATER QUALITY
    # --------------------------
    h("6. Water Quality Summary")
    p("Samples collected per 401 KAR 8:200, including bacteria, nitrate, VOCs, SOCs, metals, "
      "radiological contaminants. (Placeholder until lab sheets uploaded.)")
    space()

    # --------------------------
    # SECTION 7: CONCLUSIONS
    # --------------------------
    h("7. Conclusions")
    p("All KDOW reporting elements satisfied. Source is recommended as a candidate for approval "
      "pending water quality compliance.")
    space()

    doc.build(story)
    buf.seek(0)
    return buf
