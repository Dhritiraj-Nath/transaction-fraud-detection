import os
import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import google.generativeai as genai
from sqlalchemy import create_engine, Column, Integer, String, Float, JSON
from sqlalchemy.orm import declarative_base, sessionmaker
from dotenv import load_dotenv

# Load env variables (assuming .env is in the parent directory)
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'), override=True)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database Setup
engine = create_engine("sqlite:///./fraud_history.db", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class HistoryEntry(Base):
    __tablename__ = "history"
    id = Column(Integer, primary_key=True, index=True)
    upi_id = Column(String, index=True)
    amount = Column(Float)
    note = Column(String, nullable=True)
    analysis = Column(JSON)

Base.metadata.create_all(bind=engine)

# Removed Gemini setup to ensure no API keys are required
api_key = os.environ.get("GOOGLE_GENERATIVE_AI_API_KEY", "")
print(f"DEBUG - API KEY CONFIGURED: {bool(api_key)} (No longer needed, using local heuristic engine)")

class AnalysisRequest(BaseModel):
    upiId: str
    amount: float
    note: Optional[str] = None
    heuristicScore: float
    heuristicSignals: List[str]

@app.post("/api/analyze")
def analyze_payment(req: AnalysisRequest):
    try:
        # Local Heuristic Engine (Free & Keyless)
        risk_score = req.heuristicScore
        signals = req.heuristicSignals.copy()
        
        # Analyze Amount
        if req.amount > 50000:
            risk_score += 20
            signals.append("High value transaction")
        elif req.amount < 10:
            risk_score += 10
            signals.append("Suspiciously small transaction (possible probing)")
            
        # Analyze Note
        note = (req.note or "").lower()
        if any(word in note for word in ["kyc", "refund", "lottery", "cashback", "urgent", "otp"]):
            risk_score += 30
            signals.append("Note contains suspicious keywords")
            
        # Cap risk score
        risk_score = min(100, max(0, risk_score))
        
        # Determine Verdict
        if risk_score >= 70:
            verdict = "fraud"
            reasoning = f"Transaction exhibits multiple high-risk indicators including {', '.join(signals[:2])}."
            recommended_action = "Block transaction and alert user."
        elif risk_score >= 30:
            verdict = "review"
            reasoning = "Transaction shows some unusual patterns that require verification."
            recommended_action = "Hold for manual review or prompt for additional 2FA."
        else:
            verdict = "safe"
            reasoning = "Transaction appears normal and matches standard user behavior."
            recommended_action = "Proceed with transaction."
            
        analysis_data = {
            "riskScore": risk_score,
            "verdict": verdict,
            "confidence": 0.85,
            "signals": signals if signals else ["No suspicious signals detected"],
            "reasoning": reasoning,
            "recommendedAction": recommended_action
        }
        
        # Save to Database
        db = SessionLocal()
        entry = HistoryEntry(
            upi_id=req.upiId,
            amount=req.amount,
            note=req.note,
            analysis=analysis_data
        )
        db.add(entry)
        db.commit()
        db.refresh(entry)
        db.close()
        
        return {"analysis": analysis_data, "id": entry.id}
    except Exception as e:
        print(f"Error during analysis: {e}")
        return {"error": str(e), "analysis": None}

@app.get("/api/history")
def get_history():
    db = SessionLocal()
    history = db.query(HistoryEntry).order_by(HistoryEntry.id.desc()).limit(10).all()
    db.close()
    return [{"id": str(h.id), "upiId": h.upi_id, "amount": h.amount, "note": h.note, "analysis": h.analysis} for h in history]
