from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Import routers
from app.routers.analysis import router as analysis_router
from app.routers.whp import router as whp_router

app = FastAPI(
    title="Kentucky Aquifer Analysis API",
    description="Unified aquifer test + WHP computation backend",
    version="1.0.0"
)

# CORS for frontend (Codespaces URL allowed)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],        # You may restrict later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(analysis_router)
app.include_router(whp_router)

@app.get("/")
def root():
    return {"message": "Aquifer API running successfully"}
