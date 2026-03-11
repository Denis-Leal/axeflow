from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

engine = create_engine(settings.database_url_fixed)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# todas tabalas no schema do SaaS
Base.metadata.schema = settings.database_schema
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
