import os
from urllib.parse import quote_plus
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

_db_host = os.environ.get("DB_HOST")
if _db_host:
    _user = quote_plus(os.environ.get("DB_USER", ""))
    _pass = quote_plus(os.environ.get("DB_PASS", ""))
    _host = os.environ.get("DB_HOST", "")
    _port = os.environ.get("DB_PORT", "5432")
    _name = os.environ.get("DB_NAME", "postgres")
    DATABASE_URL = f"postgresql://{_user}:{_pass}@{_host}:{_port}/{_name}?sslmode=require"
else:
    DATABASE_URL = "sqlite:///./mtg_tracker.db"

# SQLite needs an extra option; PostgreSQL does not
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
