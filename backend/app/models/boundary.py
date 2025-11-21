from sqlalchemy import Column, Integer, Float, String
from app.db.database import Base

class BoundaryPoint(Base):
    __tablename__ = "boundary_points"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, index=True)
    boundary_type = Column(String, nullable=False)  # constantHead, noFlow, infinite
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
