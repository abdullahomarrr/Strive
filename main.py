"""
Calculus Copilot — FastAPI Backend
Stateless 2-tier backend that receives a Base64 PNG of handwritten or typed math & proofs,
sends it to Gemini with a Socratic system instruction, and returns
structured JSON (validated by Pydantic) back to the frontend with LaTeX formatting,
simultaneous multi-problem error pins, discrete proof verification, and AI Learning Diagnostics.
"""

import base64
import json
import os
import traceback
from typing import Literal, Optional, List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from google import genai
from pydantic import BaseModel

# ──────────────────────────────────────────────────────────
# Configuration & API Key Discovery
# ──────────────────────────────────────────────────────────
def get_api_key() -> str:
    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if key and key.strip():
        return key.strip()
    
    env_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    if os.path.exists(env_file):
        try:
            with open(env_file, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("GEMINI_API_KEY="):
                        val = line.split("=", 1)[1].strip().strip('"').strip("'")
                        if val:
                            return val
        except Exception:
            pass

    raise RuntimeError("GEMINI_API_KEY not found in environment or .env file.")


# ──────────────────────────────────────────────────────────
# Pydantic Models
# ──────────────────────────────────────────────────────────

class ErrorItem(BaseModel):
    problem_label: str = "Problem"  # e.g., "Problem 1", "Induction Step", "Base Case", "Equation 2"
    error_type: str = "logical"     # "syntax", "arithmetic", "logical"
    correction_message: str         # Socratic clue describing what step to review without giving answer
    error_location_x: float         # Normalized 0.05 to 0.95 (X position on image)
    error_location_y: float         # Normalized 0.05 to 0.95 (Y position on image)


class FrontendRequest(BaseModel):
    image_data: str
    action_type: Literal["check_logic", "get_hint"]
    is_selection: bool = False


class MathTutorResponse(BaseModel):
    is_correct_so_far: bool
    status_message: str
    errors: List[ErrorItem] = []  # List of EVERY error found on the canvas (empty if completely correct)
    faint_hint: Optional[str] = None
    current_latex: str


# Analytics Diagnostic Models
class HistoryRecord(BaseModel):
    timestamp: str
    is_correct: bool
    latex: str = ""
    summary: str = ""
    error_clues: List[str] = []


class AnalyticsRequest(BaseModel):
    records: List[HistoryRecord]


class AnalyticsResponse(BaseModel):
    overall_summary: str
    mastery_score: int  # 0 to 100
    strong_points: List[str]
    weak_points: List[str]
    frequent_pitfalls: List[str]
    actionable_advice: List[str]


# ──────────────────────────────────────────────────────────
# System Instructions
# ──────────────────────────────────────────────────────────

SYSTEM_CHECK_LOGIC = (
    "You are an expert, strict, pedagogical university mathematics Teaching Assistant specializing in Calculus, Discrete Math Proofs (Induction, Contradiction, Direct Proofs, Set Theory, Predicate Logic), and Linear Algebra.\n\n"
    "INPUT SCOPE:\n"
    "- The student has submitted work that may contain handwritten math, typed proofs, typed equations, or a combination of both.\n"
    "- Scan and evaluate EVERY distinct problem, proof step, and derivation on the canvas from top to bottom.\n\n"
    "PROOF & LOGIC VERIFICATION:\n"
    "- For Calculus: Check differentiation, integration, limit evaluations, substitutions, and algebraic manipulations.\n"
    "- For Proofs: Check whether definitions are correctly applied, base cases are properly verified, the inductive hypothesis is soundly assumed, and the inductive step/justifications are logically rigorous without fallacies.\n"
    "- If there are MULTIPLE mistakes, add a separate entry into 'errors' for EACH mistake with approximate coordinates (error_location_x, error_location_y from 0.05 to 0.95) and label ('problem_label', e.g. 'Base Case', 'Inductive Step', 'Problem 1').\n"
    "- If all solutions/proof steps are sound so far, set 'is_correct_so_far' to true and 'errors' to [].\n\n"
    "CRITICAL RULE — STRICTLY NO SPOILERS / NEVER GIVE THE ANSWER:\n"
    "- NEVER write out the solution, complete the proof step, or state the correct numerical/algebraic result!\n"
    "- ONLY pinpoint the mistake and identify WHAT logic/operation to check (e.g., 'Check the inductive step assumption when multiplying by $k+1$', 'Review the sign when distributing').\n"
    "- The student must do all reasoning and corrections themselves.\n\n"
    "FORMATTING REQUIREMENT:\n"
    "- ALWAYS format all mathematical variables, formulas, expressions, sets, and equations using LaTeX notation enclosed in $...$ (inline) or $$...$$ (display).\n\n"
    "SUMMARY:\n"
    "- In 'status_message', provide a clear summary of all evaluated problems/proofs.\n"
    "- In 'current_latex', provide a clean, complete LaTeX transcription of the math and proofs.\n"
    "Return JSON conforming strictly to the response schema."
)

SYSTEM_GET_HINT = (
    "You are a fast, patient, Socratic university math Teaching Assistant specializing in Calculus, Discrete Proofs, and Linear Algebra.\n"
    "A student is stuck on a math problem or proof.\n\n"
    "CRITICAL RULE — STRICTLY NO SPOILERS / NEVER GIVE THE ANSWER:\n"
    "- NEVER calculate the next step, evaluate the formula, or complete the proof argument.\n"
    "- Provide only a concise, conceptual Socratic question pointing to the relevant theorem, definition, or strategy.\n\n"
    "FORMATTING REQUIREMENT:\n"
    "- ALWAYS format all mathematical terms, formulas, rules, and expressions using LaTeX notation enclosed in $...$ (inline) or $$...$$ (display).\n\n"
    "YOUR TASKS:\n"
    "1. Read their work carefully.\n"
    "2. Identify the conceptual insight or lemma needed for their NEXT step.\n"
    "3. In 'faint_hint', provide a FAINT, Socratic question that prompts them to remember the right concept.\n"
    "4. In 'current_latex', provide a clean LaTeX transcription.\n"
    "Return JSON conforming strictly to the response schema."
)

SYSTEM_ANALYTICS = (
    "You are an expert Mathematics Professor and Learning Scientist specializing in university-level Calculus, Real Analysis, Discrete Proofs, and Linear Algebra.\n"
    "You are conducting a strict, thorough, and highly accurate diagnostic analysis of a student's accumulated problem-solving history.\n\n"
    "INPUT DATA:\n"
    "- You are given the student's chronological history of math attempts, including whether each attempt PASSED or FLAGGED ERRORS, the LaTeX math attempted, summaries, and specific error clues/descriptions.\n\n"
    "DIAGNOSTIC GUIDELINES:\n"
    "1. ACCURATE ASSESSMENT OF ERRORS (CRITICAL):\n"
    "   - If the student made errors (e.g. in Integration, Differentiation, Series, Proofs, or Algebra), you MUST explicitly identify those exact topics as their WEAK POINTS and FREQUENT PITFALLS.\n"
    "   - NEVER claim the student has 'no weak points' or 'ready for advanced mastery' if their history contains mistakes, incorrect integration steps, failed proofs, or arithmetic errors.\n"
    "   - Analyze the exact mathematical topics in the failed problems (e.g. $u$-substitution, integration by parts, chain rule, power rule, distributed minus signs, induction base cases, limit theorems).\n\n"
    "2. COMPUTING MASTERY SCORE (0 - 100):\n"
    "   - If the student failed all or most problems (e.g., getting all integration questions wrong), the mastery score MUST reflect that realistically (e.g., 20 - 50 out of 100).\n"
    "   - If they have mixed results, score proportionally (e.g. 50 - 75).\n"
    "   - Only award 85 - 100 if the student demonstrates consistent correctness across diverse problems.\n\n"
    "3. DIAGNOSTIC FIELDS:\n"
    "   - 'overall_summary': 2-3 sentences clearly stating their current performance level, pointing directly to where they are struggling (e.g., 'Your recent attempts indicate significant conceptual difficulty with indefinite integration and antiderivative rules...').\n"
    "   - 'strong_points': List 2-3 specific techniques or concepts they actually executed cleanly or demonstrated familiarity with (e.g., 'Writing structured proof outlines', 'Linear polynomial differentiation'). If almost everything was wrong, note their foundational setup attempts.\n"
    "   - 'weak_points': List 3-5 specific math areas and theorems where they made errors (e.g., 'Indefinite integration: forgetting constant of integration $+ C$', 'Reversing power rule vs derivative power rule', '$u$-substitution differential matching $du$', 'Handling negative coefficients during integration').\n"
    "   - 'frequent_pitfalls': List 2-4 concrete habits or recurring calculation traps seen in their work (e.g., 'Treating $\\int \\frac{1}{x} dx$ as $\\frac{x^0}{0}$ instead of $\\ln|x|$', 'Incorrectly distributing $-1$ across polynomial terms', 'Assuming equality without justifying base case').\n"
    "   - 'actionable_advice': List 3-4 specific, high-yield practice drills to fix their gaps (e.g., 'Drill 10 standard antiderivative substitution problems with linear arguments $\\int (ax+b)^n dx$', 'Review the Fundamental Theorem of Calculus Part 1', 'Practice verifying integration answers by differentiating the result').\n\n"
    "4. FORMATTING:\n"
    "   - ALWAYS format every math expression, rule, formula, or variable using LaTeX enclosed in $...$ (inline) or $$...$$ (display).\n"
    "Return JSON conforming strictly to the AnalyticsResponse schema."
)

# ──────────────────────────────────────────────────────────
# FastAPI App
# ──────────────────────────────────────────────────────────

app = FastAPI(title="Calculus Copilot API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_client = None

def get_client() -> genai.Client:
    global _client
    if _client is None:
        key = get_api_key()
        _client = genai.Client(api_key=key)
    return _client


# ──────────────────────────────────────────────────────────
# JSON Parser Helper
# ──────────────────────────────────────────────────────────

def clean_and_parse_json(text: str) -> dict:
    text = text.strip()
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    text = text.strip()

    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1:
        text = text[start:end + 1]

    return json.loads(text)


# ──────────────────────────────────────────────────────────
# Serve Frontend
# ──────────────────────────────────────────────────────────

@app.get("/")
async def serve_frontend():
    """Serve index.html from the same directory as main.py."""
    index_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "index.html")
    return FileResponse(index_path, media_type="text/html")


# ──────────────────────────────────────────────────────────
# Core Tutor Endpoint with Multi-Model Fallback
# ──────────────────────────────────────────────────────────

ACTIVE_MODELS = [
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.7-flash",
]

@app.post("/tutor", response_model=MathTutorResponse)
async def tutor(request: FrontendRequest):
    """
    Accept a Base64 PNG of the student's handwritten or typed math/proofs and an action type.
    Send it to Gemini and return structured JSON feedback with LaTeX formatting
    and in-place error coordinates for all problems.
    """
    if request.action_type == "check_logic":
        system_instruction = SYSTEM_CHECK_LOGIC
    else:
        system_instruction = SYSTEM_GET_HINT

    # Decode base64 image data
    try:
        clean_b64 = request.image_data
        if "base64," in clean_b64:
            clean_b64 = clean_b64.split("base64,")[1]
        image_bytes = base64.b64decode(clean_b64)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid base64 image data: {e}")

    prompt_text = (
        "Please evaluate the specific highlighted math problem or proof in this cropped image."
        if request.is_selection
        else "Please evaluate ALL handwritten and typed math problems/proofs visible on this canvas from top to bottom. If there are multiple errors, return an ErrorItem for each one in 'errors'."
    )

    last_error = None
    client = get_client()

    for model_name in ACTIVE_MODELS:
        try:
            print(f"[TUTOR] Calling {model_name} for {request.action_type} (selection={request.is_selection})...", flush=True)

            response = client.models.generate_content(
                model=model_name,
                contents=[
                    genai.types.Part.from_bytes(data=image_bytes, mime_type="image/png"),
                    prompt_text,
                ],
                config=genai.types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    temperature=0.2,
                    response_mime_type="application/json",
                    response_schema=MathTutorResponse,
                ),
            )

            raw_json = response.text or ""
            print(f"[TUTOR] {model_name} response: {raw_json[:200]}", flush=True)
            result_dict = clean_and_parse_json(raw_json)
            return MathTutorResponse(**result_dict)

        except Exception as exc:
            last_error = exc
            print(f"[TUTOR WARN] Model {model_name} error: {exc}. Retrying fallback...", flush=True)
            continue

    traceback.print_exc()
    raise HTTPException(
        status_code=500,
        detail=f"Gemini API error across all models: {str(last_error)}",
    )


# ──────────────────────────────────────────────────────────
# AI Mastery & Progress Diagnostic Endpoint
# ──────────────────────────────────────────────────────────

@app.post("/analytics", response_model=AnalyticsResponse)
async def generate_analytics(request: AnalyticsRequest):
    """
    Analyze the student's accumulated practice history and return
    a diagnostic report on their strong points, weak points, and recurring pitfalls.
    """
    if not request.records:
        return AnalyticsResponse(
            overall_summary="No math checks recorded yet. Start solving problems on the scratchpad and your diagnostic profile will build automatically!",
            mastery_score=100,
            strong_points=["Ready to start practice"],
            weak_points=[],
            frequent_pitfalls=[],
            actionable_advice=["Draw or type your first calculus equation or proof to begin tracking mastery."]
        )

    # Summarize history into context
    history_summary = []
    for idx, r in enumerate(request.records):
        status = "PASSED (Correct)" if r.is_correct else "FLAGGED ERRORS"
        errors_str = "; ".join(r.error_clues) if r.error_clues else "None"
        history_summary.append(
            f"Attempt #{idx+1} [{r.timestamp}]: Status: {status} | Math: {r.latex} | Summary: {r.summary} | Errors: {errors_str}"
        )
    
    prompt = "Here is the student's complete session history of mathematical work:\n\n" + "\n".join(history_summary) + "\n\nProvide a comprehensive diagnostic analysis."

    client = get_client()
    last_error = None

    for model_name in ACTIVE_MODELS:
        try:
            print(f"[ANALYTICS] Calling {model_name} for student diagnostic...", flush=True)
            response = client.models.generate_content(
                model=model_name,
                contents=[prompt],
                config=genai.types.GenerateContentConfig(
                    system_instruction=SYSTEM_ANALYTICS,
                    temperature=0.3,
                    response_mime_type="application/json",
                    response_schema=AnalyticsResponse,
                ),
            )

            raw_json = response.text or ""
            result_dict = clean_and_parse_json(raw_json)
            return AnalyticsResponse(**result_dict)

        except Exception as exc:
            last_error = exc
            print(f"[ANALYTICS WARN] Model {model_name} error: {exc}. Retrying fallback...", flush=True)
            continue

    raise HTTPException(
        status_code=500,
        detail=f"Analytics generation error: {str(last_error)}",
    )
