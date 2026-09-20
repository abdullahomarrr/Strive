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

## Supabase accounts and sync

Strive remains fully usable offline. To enable email accounts and notebook sync:

1. Create a Supabase project.
2. Run `supabase/migrations/202609190001_strive_notebook_sync.sql` in the Supabase SQL Editor or apply it with the Supabase CLI.
3. Copy `.env.example` to `.env` and set `SUPABASE_URL` plus the browser-safe `SUPABASE_PUBLISHABLE_KEY` from the project Connect dialog.
4. In Supabase Authentication, configure the Site URL and redirect URLs for the address where Strive runs.
5. Restart the FastAPI server.

Never put a Supabase secret or service-role key in `.env` for this browser integration. The migration enables RLS, grants access only to authenticated users, and restricts every notebook and preference row to its owner.

New accounts start with zero notebooks. Guest notebooks stay separate from account notebooks and are not imported during signup. Strive continues saving signed-in work locally first, queues changes while offline, merges notebooks by their client update timestamps, restores the current guest workspace after sign-out, and listens for changes from other signed-in devices.

Newly created accounts also receive a one-time animated introduction to the notebook, tools, tutor, and feedback model. Completion and optional study preferences are saved to the account, so the introduction does not repeat on another device.

## Workspace

- Create and rename notebooks, choose covers, and switch between open tabs.
- Add pages with plain, squared, ruled, or dotted paper.
- Use pen, highlighter, eraser, text, rectangular selection, and pan tools.
- Undo/redo up to 40 edits per page during the current session.
- Zoom with the controls, pinch, or Ctrl/Command + wheel. Hold Space to pan.
- Check the current page or selected region; get hints and copy LaTeX in the tutor panel.
- Review practice history and request an AI diagnostic per notebook.

Keyboard tools: P pen, H highlighter, E eraser, S selection, T text, V pan. Escape clears a selection or cancels text. Ctrl/Command + Enter places text. Ctrl/Command + Z undoes; Shift adds redo.

Signed-in notebooks always save to this browser's local storage first and sync securely to the account. Guest work is temporary: it is retained on that device for the current local calendar day and cleared the next day. Both guest mode and new accounts begin with zero notebooks. Clearing browser data removes offline copies, but signed-in notebooks can be restored from Supabase. Paper uses fixed 850 × 1100 logical coordinates; zoom does not alter saved drawing coordinates. Undo history resets on reload.

## Code

- `index.html`: semantic application shell.
- `static/app.css`: responsive notebook interface and SVG icon styling.
- `static/app.js`: local notebook storage, vector drawing, navigation, zoom, and tutor integration.
- `static/supabase-sync.js`: authentication, per-user local caches, conflict-aware cloud sync, and realtime updates.
- `static/onboarding.js` / `static/onboarding.css`: first-run account onboarding and preference capture.
- `main.py`: FastAPI server, Gemini prompts, `/tutor`, and `/analytics`.
- `supabase/migrations/`: database tables, grants, RLS policies, triggers, and realtime publication setup.

Model availability depends on the configured Gemini account. The existing backend fallback model list is retained. AI diagnostics are estimates, not formal mathematical verification.

## Checks

```powershell
node --check static/app.js
python -m unittest discover -s tests -v
```

The API checks use a mocked Gemini client and require `httpx` (`python -m pip install httpx`). They do not make paid model calls.

## Desktop app

Strive ships as a lightweight Tauri 2 desktop app. The notebook interface and
fonts are bundled into the installer, while tutor requests go to the hosted
FastAPI service. Account data continues to sync directly with Supabase.

Install the desktop toolchain, then build a signed Windows installer:

```powershell
npm install
$env:STRIVE_API_BASE_URL = "https://your-strive-api.example.com"
$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content -Raw "$env:USERPROFILE\.tauri\strive.key"
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = Get-Content -Raw "$env:USERPROFILE\.tauri\strive-password.txt"
npm run desktop:build -- --bundles nsis
```

The installer is written to
`src-tauri/target/release/bundle/nsis/`. Without `STRIVE_API_BASE_URL`, local
desktop builds use `http://127.0.0.1:8765`, which is convenient while running
the FastAPI service locally.

### Deploy and release

1. Deploy the included `render.yaml` Blueprint and provide `GEMINI_API_KEY`,
   `SUPABASE_URL`, and `SUPABASE_PUBLISHABLE_KEY` in Render.
2. Add the resulting origin, such as `https://strive-api.onrender.com`, as the
   GitHub Actions secret `STRIVE_API_BASE_URL`.
3. Apply the SQL file in `supabase/migrations/` once to the production Supabase
   project.
4. Keep the generated Tauri signing key and password backed up. GitHub already
   stores them as `TAURI_SIGNING_PRIVATE_KEY` and
   `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` repository secrets.
5. Update the matching version in `package.json` and
   `src-tauri/tauri.conf.json`, commit it, then push a tag such as
   `app-v0.1.1`.
6. The **Desktop release** workflow creates signed Windows, macOS, and Linux
   downloads as a draft GitHub Release. Publish that draft after testing it.

Published desktop builds check the latest GitHub Release at launch. When a
newer signed version exists, Strive downloads it, installs it, and restarts.
