import os
import traceback
from sqlalchemy import create_engine, text

DB_USER = os.getenv("DB_USER", "webportal")
DB_PASS = os.getenv("DB_PASS", "webportal_secret")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "webportal_db")

SQLALCHEMY_DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

engine = create_engine(SQLALCHEMY_DATABASE_URL)

try:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE users ADD COLUMN allowed_tabs VARCHAR DEFAULT 'files,photos,videos'"))
        conn.commit()
    print('Altered successfully')
except Exception as e:
    print('Error:', e)
    traceback.print_exc()
