from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase, Session
from app.core.config import settings

engine = create_engine(settings.database_url_fixed, pool_pre_ping=True,)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False,)

class Base(DeclarativeBase):
    pass

def get_db():
    db: Session = SessionLocal()

    try:
        yield db
    finally:
        db.close()
