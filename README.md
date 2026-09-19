# Strive — Calculus & Proofs Copilot

A notebook workspace for handwritten math, proofs, and Socratic AI feedback.

For product intent, design language, tutor behavior, and guidance for future changes, read [`STRIVE_DESIGN.md`](STRIVE_DESIGN.md).

## Run locally

```powershell
python -m pip install -r requirements.txt
# Optional: required only for tutor and progress analysis
$env:GEMINI_API_KEY = "your-key"
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Open http://127.0.0.1:8000. Writing, notebooks, pages, and zoom work without an API key. The backend also accepts a local `.env` file containing `GEMINI_API_KEY=...`.

## Workspace

- Create and rename notebooks, choose covers, and switch between open tabs.
- Add pages with plain, squared, ruled, or dotted paper.
- Use pen, highlighter, eraser, text, rectangular selection, and pan tools.
- Undo/redo up to 40 edits per page during the current session.
- Zoom with the controls, pinch, or Ctrl/Command + wheel. Hold Space to pan.
- Check the current page or selected region; get hints and copy LaTeX in the tutor panel.
- Review practice history and request an AI diagnostic per notebook.

Keyboard tools: P pen, H highlighter, E eraser, S selection, T text, V pan. Escape clears a selection or cancels text. Ctrl/Command + Enter places text. Ctrl/Command + Z undoes; Shift adds redo.

Notebooks save to this browser's local storage for the current origin. They are not cloud-synced, and clearing browser data removes them. Existing scratchpad practice history is migrated into the first notebook on first launch. Paper uses fixed 850 × 1100 logical coordinates; zoom does not alter saved drawing coordinates. Undo history resets on reload.

## Code

- `index.html`: semantic application shell.
- `static/app.css`: responsive notebook interface and SVG icon styling.
- `static/app.js`: local notebook storage, vector drawing, navigation, zoom, and tutor integration.
- `main.py`: FastAPI server, Gemini prompts, `/tutor`, and `/analytics`.

Model availability depends on the configured Gemini account. The existing backend fallback model list is retained. AI diagnostics are estimates, not formal mathematical verification.

## Checks

```powershell
node --check static/app.js
python -m unittest discover -s tests -v
```

The API checks use a mocked Gemini client and require `httpx` (`python -m pip install httpx`). They do not make paid model calls.
