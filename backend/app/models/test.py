from sqlalchemy import Column, Integer, String, Float
from app.db.database import Base

class PumpTest(Base):
    __tablename__ = "pump_tests"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, index=True)
    
    test_type = Column(String)  # step, constant, recovery
    csv_data = Column(String)   # raw CSV stored as JSON string
    
    # stats computed later (optional)
    transmissivity = Column(Float, nullable=True)
    storativity = Column(Float, nullable=True)
    hydraulic_conductivity = Column(Float, nullable=True)
