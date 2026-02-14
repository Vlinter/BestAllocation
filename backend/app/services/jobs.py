import uuid
from datetime import datetime
from typing import Dict, Any, Optional

class JobManager:
    _instance = None
    
    def __init__(self):
        # In-memory job store
        # job_id -> { "status": str, "progress": int, "message": str, "result": dict, "error": str, "created_at": datetime }
        self.jobs: Dict[str, Any] = {}
        self.JOB_TTL_SECONDS = 3600  # 1 hour TTL
        
    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def create_job(self) -> str:
        """Create a new job and return its ID."""
        self.cleanup_expired_jobs()
        job_id = str(uuid.uuid4())
        self.jobs[job_id] = {
            "status": "queued",
            "progress": 0,
            "message": "Initializing...",
            "result": None,
            "error": None,
            "created_at": datetime.now()
        }
        return job_id

    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        return self.jobs.get(job_id)

    def update_job(self, job_id: str, progress: int, message: str, status: Optional[str] = None, result: Optional[Any] = None, error: Optional[str] = None):
        if job_id in self.jobs:
            self.jobs[job_id]["progress"] = progress
            self.jobs[job_id]["message"] = message
            if status:
                self.jobs[job_id]["status"] = status
            if result:
                self.jobs[job_id]["result"] = result
            if error:
                self.jobs[job_id]["error"] = error

    def cleanup_expired_jobs(self):
        """Remove jobs older than JOB_TTL_SECONDS."""
        now = datetime.now()
        expired = [
            job_id for job_id, job in self.jobs.items()
            if job.get("status") in ("completed", "failed") 
            and (now - job.get("created_at", now)).total_seconds() > self.JOB_TTL_SECONDS
        ]
        for job_id in expired:
            del self.jobs[job_id]

# Global instance for app usage
job_manager = JobManager.get_instance()
