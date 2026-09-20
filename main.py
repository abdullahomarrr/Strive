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
from fastapi.staticfiles import StaticFiles
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


def get_public_setting(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if value:
        return value
    env_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    if os.path.exists(env_file):
        try:
            with open(env_file, "r", encoding="utf-8") as file:
                for line in file:
                    key, separator, raw_value = line.strip().partition("=")
                    if separator and key == name:
                        return raw_value.strip().strip('"').strip("'")
        except OSError:
            pass
    return ""


# ──────────────────────────────────────────────────────────
# Pydantic Models
# ──────────────────────────────────────────────────────────

class ErrorItem(BaseModel):
    problem_label: str = "Problem"  # e.g., "Problem 1", "Induction Step", "Base Case", "Equation 2"
    error_type: str = "logical"     # "syntax", "arithmetic", "logical"
    correction_message: str         # Socratic clue describing what step to review without giving answer
    error_location_x: float         # Normalized 0.05 to 0.95 (X position on image)
    error_location_y: float         # Normalized 0.05 to 0.95 (Y position on image)


class CorrectStep(BaseModel):
    step_label: str = "Correct step"
    explanation: str  # Specific description of what the student did correctly and why it is valid


class FrontendRequest(BaseModel):
    image_data: str
    action_type: Literal["check_logic", "get_hint"]
    is_selection: bool = False
    hint_focus: Optional[Literal["start", "next_step", "rule", "direction"]] = None
    learner_profile: Optional[dict] = None


class MathTutorResponse(BaseModel):
    is_correct_so_far: bool
    status_message: str
    correct_steps: List[CorrectStep] = []
    errors: List[ErrorItem] = []  # List of EVERY error found on the canvas (empty if completely correct)
    faint_hint: Optional[str] = None
    hint_location_x: Optional[float] = None  # Normalized position of the work the hint addresses
    hint_location_y: Optional[float] = None
    current_latex: str


class WalkthroughStep(BaseModel):
    latex: str
    goal: str
    reason: str
    check: str
    placement_x: float
    placement_y: float


class WalkthroughResponse(BaseModel):
    problem_summary: str
    steps: List[WalkthroughStep]


class MarkingCriterion(BaseModel):
    criterion: str
    expectation: str
    marks_available: float
    marks_awarded: float


class MarkAnnotation(BaseModel):
    label: str
    message: str
    marks_delta: float
    annotation_type: Literal["earned", "lost", "presentation"]
    location_x: float
    location_y: float


class QuestionMarking(BaseModel):
    question_label: str
    question_type: str
    task_intent: str
    rubric_basis: str
    marks_awarded: float
    marks_available: float
    criteria: List[MarkingCriterion]
    annotations: List[MarkAnnotation]
    improvement_summary: str
    full_marks_latex: str


class MarkingResponse(BaseModel):
    questions: List[QuestionMarking]
    total_awarded: float
    total_available: float
    overall_feedback: str
    confidence_note: str


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
    "CORRECT REASONING RECOGNITION:\n"
    "- In 'correct_steps', identify every mathematically important step the student completed correctly, even when a later or earlier step is wrong.\n"
    "- Be specific about WHY each recognized step is valid: correct theorem choice, setup, substitution, algebraic transformation, base case, hypothesis, justification, or verification.\n"
    "- If the entire solution is correct, provide a concise step-by-step breakdown of the important reasoning rather than only saying it is correct.\n"
    "- Do not praise superficial details such as merely copying the question. Do not invent a correct step when none is demonstrated.\n"
    "- Recognizing a correct step must not reveal how to repair a different incorrect step or disclose a missing final answer.\n\n"
    "CRITICAL RULE — STRICTLY NO SPOILERS / NEVER GIVE THE ANSWER:\n"
    "- NEVER write out the solution, complete the proof step, or state the correct numerical/algebraic result!\n"
    "- ONLY pinpoint the mistake and identify WHAT logic/operation to check (e.g., 'Check the inductive step assumption when multiplying by $k+1$', 'Review the sign when distributing').\n"
    "- The student must do all reasoning and corrections themselves.\n\n"
    "FORMATTING REQUIREMENT:\n"
    "- ALWAYS format all mathematical variables, formulas, expressions, sets, and equations using LaTeX notation enclosed in $...$ (inline) or $$...$$ (display).\n\n"
    "- NEVER emit raw math such as u = x^2 + 4, dx, x^n, or + C in any prose field. Write them as $u=x^2+4$, $dx$, $x^n$, and $+C$. This applies to status_message, correct_steps, errors, labels, and every other visible string.\n\n"
    "SUMMARY:\n"
    "- In 'status_message', provide a clear summary of all evaluated problems/proofs.\n"
    "- In 'current_latex', provide a clean, complete LaTeX transcription of the math and proofs.\n"
    "Return JSON conforming strictly to the response schema."
)

SYSTEM_GET_HINT = (
    "You are a fast, patient, Socratic university math Teaching Assistant specializing in Calculus, Discrete Proofs, and Linear Algebra.\n"
    "A student is currently stuck while working through a math problem or proof. They want direction, not evaluation.\n\n"
    "HINT MODE IS DISTINCT FROM CHECKING WORK:\n"
    "- Do NOT grade the work, declare it correct or incorrect, list mistakes, or provide a full evaluation.\n"
    "- Do NOT identify every issue on the page. Focus only on the most useful idea for the student's immediate next move.\n"
    "- Treat incomplete work as an attempt in progress, not as a submitted solution.\n\n"
    "CRITICAL RULE — STRICTLY NO SPOILERS / NEVER GIVE THE ANSWER:\n"
    "- NEVER calculate the next step, evaluate the formula, or complete the proof argument.\n"
    "- NEVER reveal the final answer or write an expression that is effectively the missing next line.\n"
    "- Provide one or two concise Socratic questions pointing toward a relevant definition, theorem, representation, or strategy.\n"
    "- Start faintly. Prefer recalling a concept or asking what relationship applies before naming a procedure.\n\n"
    "FORMATTING REQUIREMENT:\n"
    "- ALWAYS format all mathematical terms, formulas, rules, and expressions using LaTeX notation enclosed in $...$ (inline) or $$...$$ (display).\n\n"
    "- NEVER emit bare variables, powers, differentials, equations, or set notation in any prose field. Every mathematical fragment must be inside LaTeX delimiters.\n\n"
    "YOUR TASKS:\n"
    "1. Read their work carefully.\n"
    "2. Infer where they are currently stuck and identify the conceptual insight needed for their NEXT step.\n"
    "3. In 'faint_hint', provide the short, non-spoiling Socratic nudge.\n"
    "4. In 'hint_location_x' and 'hint_location_y', provide the approximate normalized coordinates (0.05 to 0.95) of the exact work or problem the hint addresses.\n"
    "5. Set 'is_correct_so_far' to true, 'errors' to [], and 'correct_steps' to [] because hint mode does not grade the attempt.\n"
    "6. In 'status_message', briefly and neutrally say which part of the attempt the hint is addressing without judging correctness.\n"
    "7. In 'current_latex', provide a clean LaTeX transcription.\n"
    "Return JSON conforming strictly to the response schema."
)

SYSTEM_WALKTHROUGH = (
    "You are a patient university mathematics instructor creating a guided worked example after a student explicitly requested a full walkthrough.\n"
    "The student has already attempted the problem and used hints but remains stuck. Unlike hint mode, you may now complete the solution.\n\n"
    "TEACHING STRUCTURE:\n"
    "- Continue naturally from the student's visible work, correcting an invalid direction when necessary.\n"
    "- Break the remaining solution into 2 to 6 meaningful steps. Never collapse the reasoning into one jump.\n"
    "- For every step provide: 'latex' (the exact line to write), 'goal' (what the step is trying to accomplish), 'reason' (the rule or theorem that justifies it), and 'check' (a quick way the student can verify it).\n"
    "- The final step may contain the final answer because the student explicitly requested the walkthrough.\n"
    "- Keep explanations concise and instructional. Explain decisions, not merely algebraic narration.\n"
    "- Use LaTeX enclosed in $...$ or $$...$$ in every explanatory field when math appears. The 'latex' field itself should contain valid LaTeX without dollar delimiters.\n"
    "- Never place raw variables, equations, powers, or differentials in goal, reason, check, or problem_summary. Every mathematical fragment in those prose fields requires delimiters.\n"
    "- Give each step approximate normalized placement coordinates from 0.05 to 0.95. Place the first step near open space following the student's last visible line, then arrange later steps downward with separation.\n"
    "Return JSON conforming strictly to WalkthroughResponse."
)

SYSTEM_MARKING = (
    "You are an experienced university mathematics professor and teaching assistant marking a completed handwritten submission.\n"
    "Create a separate marking scheme for EACH visible question before awarding marks. Never apply one generic rubric to all questions.\n\n"
    "QUESTION-SPECIFIC RUBRICS:\n"
    "- Classify every question by its actual task: proof, algebra, calculus, linear algebra, applied modelling, explanation, verification, diagram, or another precise category.\n"
    "- Read command verbs such as prove, calculate, explain, derive, verify, interpret, sketch, compare, or use induction. They determine the required evidence.\n"
    "- If marks or a rubric are visible, follow them exactly. Otherwise create a transparent estimated rubric whose criteria sum to marks_available and say so in rubric_basis.\n"
    "- Proofs must prioritize logical structure, definitions, justified implications, required cases, and conclusion. Calculations must prioritize method, valid transformations, execution, checks, and interpretation. Applied work must include modelling, units, and contextual conclusions when relevant.\n"
    "- Accept alternative valid methods. Award method and follow-through marks when later reasoning correctly follows an earlier arithmetic error. Do not deduct repeatedly for one originating error.\n"
    "- Grade each subpart independently while respecting dependencies between parts.\n\n"
    "LINE-LEVEL MARKUP:\n"
    "- Return annotations for the exact lines that earn marks, lose marks, or weaken mathematical presentation.\n"
    "- marks_delta is positive for earned marks and negative for lost marks. Use annotation_type presentation for notation, rigor, clarity, units, or form.\n"
    "- location_x and location_y are normalized coordinates from 0.05 to 0.95 on the supplied image.\n"
    "- Explain what the marker expected and the smallest change that would earn the mark.\n\n"
    "FULL-MARKS VERSION:\n"
    "- For every question provide full_marks_latex: a complete, submission-ready answer that would earn full credit under that question's rubric. Preserve the student's valid approach where possible.\n"
    "- Include the necessary reasoning, definitions, intermediate steps, notation, units, and conclusion. Unlike Check Work, this explicit marking mode may show the full answer.\n"
    "- All mathematical content in prose must use $...$ or $$...$$. full_marks_latex must be valid LaTeX without outer dollar delimiters.\n"
    "- This is absolute: never output raw forms such as u = x^2 + 4, du, dx, x^n, or + C in task_intent, rubric_basis, criteria, annotations, summaries, or confidence text. Delimit every mathematical fragment.\n"
    "Return JSON conforming strictly to MarkingResponse."
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
    "4. LATEX SYNTAX & ENCLOSURE RULES (CRITICAL):\n"
    "   - NEVER write raw LaTeX commands in plain prose outside dollar signs (e.g. never write extstyle or rac{d}{dx} in plain text).\n"
    "   - EVERY math symbol, formula, derivative, integral, and fraction MUST be cleanly enclosed inside $...$ dollar delimiters (e.g. $\\frac{d}{dx}[x^2] = 2x$, $\\int x^n dx = \\frac{x^{n+1}}{n+1} + C$).\n"
    "   - In JSON strings, properly escape backslashes for standard LaTeX commands (e.g. $\\\\frac{...}{...}$, $\\\\int$, $\\\\sin(x)$, $\\\\lim$).\n"
    "   - NEVER return bare mathematical variables or expressions in any analytics field. Delimit every mathematical fragment, without exception.\n"
    "Return JSON conforming strictly to the AnalyticsResponse schema."
)

# ──────────────────────────────────────────────────────────
# FastAPI App
# ──────────────────────────────────────────────────────────

app = FastAPI(title="Calculus Copilot API")
app.mount("/static", StaticFiles(directory=os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")), name="static")

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
        try:
            key = get_api_key()
        except RuntimeError:
            raise HTTPException(
                status_code=503,
                detail="Your notebook is saved. To enable the tutor, configure GEMINI_API_KEY on the server and restart it.",
            )
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


@app.get("/config")
async def public_config():
    """Expose only browser-safe Supabase project configuration."""
    url = get_public_setting("SUPABASE_URL")
    publishable_key = get_public_setting("SUPABASE_PUBLISHABLE_KEY") or get_public_setting("SUPABASE_ANON_KEY")
    return {
        "supabase_url": url,
        "supabase_publishable_key": publishable_key,
        "supabase_enabled": bool(url and publishable_key),
    }


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

    if request.action_type == "get_hint":
        hint_focus = {
            "start": "The student does not know how to start. Orient them toward the first relevant definition, representation, or question without performing the first step.",
            "next_step": "The student has started but is stuck on the next step. Ask a question that helps them choose what to do next without writing that step for them.",
            "rule": "The student does not understand which rule or theorem is relevant. Help them recall and recognize the applicable idea without applying it for them.",
            "direction": "The student wants to know whether their general direction is productive. Respond without grading individual steps or confirming the final answer.",
        }.get(request.hint_focus, "")
        prompt_text = (
            "The student selected this region because they are stuck here. Give the faintest useful conceptual nudge for their next move without grading the work or revealing the next line."
            if request.is_selection
            else "The student is stuck on the work shown. Infer their current stopping point and give the faintest useful conceptual nudge for what to consider next. Do not grade the page or reveal the solution."
        )
        if hint_focus:
            prompt_text += " " + hint_focus
    else:
        prompt_text = (
            "Please evaluate the specific highlighted math problem or proof in this cropped image."
            if request.is_selection
            else "Please evaluate ALL handwritten and typed math problems/proofs visible on this canvas from top to bottom. If there are multiple errors, return an ErrorItem for each one in 'errors'."
        )

    if request.learner_profile:
        profile = json.dumps(request.learner_profile, ensure_ascii=True)[:1500]
        prompt_text += (
            " Adapt the vocabulary, depth, and hint phrasing to this learner profile, "
            "while preserving mathematical rigor and all answer-withholding rules: "
            f"{profile}"
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


@app.post("/walkthrough", response_model=WalkthroughResponse)
async def walkthrough(request: FrontendRequest):
    """Generate a progressive, explicitly requested worked solution."""
    try:
        clean_b64 = request.image_data.split("base64,")[-1]
        image_bytes = base64.b64decode(clean_b64)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid base64 image data: {exc}")

    prompt_text = (
        "Create a guided walkthrough for the selected problem region. Continue from what the student has written."
        if request.is_selection
        else "Identify the incomplete or stuck problem in the work and create a guided walkthrough that continues from the student's last meaningful step."
    )
    last_error = None
    client = get_client()
    for model_name in ACTIVE_MODELS:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=[
                    genai.types.Part.from_bytes(data=image_bytes, mime_type="image/png"),
                    prompt_text,
                ],
                config=genai.types.GenerateContentConfig(
                    system_instruction=SYSTEM_WALKTHROUGH,
                    temperature=0.2,
                    response_mime_type="application/json",
                    response_schema=WalkthroughResponse,
                ),
            )
            return WalkthroughResponse(**clean_and_parse_json(response.text or ""))
        except Exception as exc:
            last_error = exc
            print(f"[WALKTHROUGH WARN] {model_name}: {exc}", flush=True)
    raise HTTPException(
        status_code=500,
        detail=f"Walkthrough generation failed across all models: {str(last_error)}",
    )


@app.post("/marking", response_model=MarkingResponse)
async def mark_submission(request: FrontendRequest):
    """Mark each visible question with a task-specific rubric and anchored feedback."""
    try:
        image_bytes = base64.b64decode(request.image_data.split("base64,")[-1])
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid base64 image data: {exc}")

    prompt_text = (
        "Mark the selected question or subpart. Infer its task-specific rubric, award partial credit, and provide a full-marks version."
        if request.is_selection
        else "Detect and separately mark every complete question visible on this page. Give each question its own task-specific rubric and full-marks version."
    )
    last_error = None
    client = get_client()
    for model_name in ACTIVE_MODELS:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=[
                    genai.types.Part.from_bytes(data=image_bytes, mime_type="image/png"),
                    prompt_text,
                ],
                config=genai.types.GenerateContentConfig(
                    system_instruction=SYSTEM_MARKING,
                    temperature=0.15,
                    response_mime_type="application/json",
                    response_schema=MarkingResponse,
                ),
            )
            return MarkingResponse(**clean_and_parse_json(response.text or ""))
        except Exception as exc:
            last_error = exc
            print(f"[MARKING WARN] {model_name}: {exc}", flush=True)
    raise HTTPException(
        status_code=500,
        detail=f"Marking failed across all models: {str(last_error)}",
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
