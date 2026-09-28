import sqlite3
import uuid
from .config import DATA_DIR

DB = DATA_DIR / "jobs.sqlite3"

def init_db():
    with sqlite3.connect(DB) as con:
        con.execute("""
        create table if not exists jobs (
            id text primary key,
            status text not null,
            payload text,
            result_path text,
            error text
        )
        """)
        con.commit()

def create_job(payload: str) -> str:
    job_id = uuid.uuid4().hex
    with sqlite3.connect(DB) as con:
        con.execute(
            "insert into jobs(id,status,payload) values(?,?,?)",
            (job_id, "queued", payload),
        )
        con.commit()
    return job_id

def next_job():
    with sqlite3.connect(DB) as con:
        row = con.execute(
            "select id,payload from jobs where status='queued' order by rowid limit 1"
        ).fetchone()
        if row:
            con.execute(
                "update jobs set status='running' where id=?", (row[0],)
            )
            con.commit()
        return row

def update_job(job_id, status, result_path=None, error=None):
    with sqlite3.connect(DB) as con:
        con.execute(
            "update jobs set status=?, result_path=?, error=? where id=?",
            (status, result_path, error, job_id),
        )
        con.commit()

def cancel_job(job_id: str):
    with sqlite3.connect(DB) as con:
        con.execute(
            "update jobs set status='cancelled', error='Cancelled by user' where id=?",
            (job_id,),
        )
        con.commit()


def delete_jobs_for_persona(persona_id: str, image_path: str = None):
    with sqlite3.connect(DB) as con:
        rows = con.execute("select id, payload, result_path from jobs").fetchall()
        for row in rows:
            jid, payload, result_path = row
            match = False
            if payload:
                if persona_id in payload or (image_path and image_path in payload):
                    match = True
            if match:
                if result_path and Path(result_path).exists():
                    try:
                        Path(result_path).unlink(missing_ok=True)
                    except Exception:
                        pass
                con.execute("delete from jobs where id=?", (jid,))
        con.commit()


def get_job(job_id):
    with sqlite3.connect(DB) as con:
        row = con.execute(
            "select id,status,result_path,error from jobs where id=?",
            (job_id,),
        ).fetchone()
    if not row:
        return None
    return {
        "id": row[0],
        "status": row[1],
        "result_path": row[2],
        "error": row[3],
    }

