from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, Union
from pydantic import BaseModel
import sqlite3
import json
import os

app = FastAPI(title="Sleep Tracker API")

# CORS: อนุญาต frontend ท้องถิ่น
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = "sleep_data.db"

def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS sleep_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            timestamp INTEGER,
            data_type TEXT,
            payload TEXT
        )
    """)
    conn.commit()
    conn.close()

init_db()

class SleepData(BaseModel):
    type: str
    timestamp: int
    snoreEnergy: Optional[Union[int, float]] = None
    avgVolume: Optional[Union[int, float]] = None
    rms: Optional[Union[int, float]] = None
    x: Optional[Union[int, float]] = None
    y: Optional[Union[int, float]] = None
    z: Optional[Union[int, float]] = None

@app.get("/")
def read_root():
    return {"message": "Sleep Tracker API is running!"}

@app.post("/api/sleep-data")
async def receive_sleep_data(data: SleepData, session_id: str = "demo"):
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.execute(
            "INSERT INTO sleep_sessions (session_id, timestamp, data_type, payload) VALUES (?, ?, ?, ?)",
            (session_id, data.timestamp, data.type, data.json())
        )
        conn.commit()
        conn.close()
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/sleep-report/{session_id}")
async def get_sleep_report(session_id: str):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        "SELECT payload FROM sleep_sessions WHERE session_id = ? AND data_type = 'audio'",
        (session_id,)
    )
    rows = cur.fetchall()
    conn.close()

    snore_count = sum(1 for r in rows if json.loads(r[0]).get("snoreEnergy", 0) > 5000)
    return {
        "session_id": session_id,
        "snore_minutes": (snore_count * 5) // 60,
        "total_audio_samples": len(rows)
    }