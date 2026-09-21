# Strive: Product and Design Handoff

This document is the source of truth for Strive's product character, visual language, interaction model, and AI behavior. Read it before changing the interface, prompts, or data model.

## Product in one sentence

Strive is a calm, paper-first workspace where students work through university mathematics by hand and ask an AI tutor for a small nudge or a careful review without being handed the answer.

The product should feel closer to a premium notebook than a conventional education dashboard. The page and the student's thinking are the center of attention. AI stays available at the edge of the experience and enters only when invited.

## Core principles

### 1. The work owns the screen

The paper is the primary surface. Navigation, tools, feedback, and progress should support it without competing with it. Controls are compact, visually quiet, and grouped by purpose. The interface should recede once the student starts writing.

### 2. Calm is functional

The restrained palette, generous space, soft borders, and gentle motion reduce cognitive load. Avoid loud gradients, glass effects, glowing buttons, oversized metrics, excessive cards, and decorative copy that makes the product feel generated or gamified.

### 3. Physical metaphors should feel natural

Notebooks have covers. A notebook contains pages. The page sits on a desk. The toolbar feels like a small tray of instruments. Zoom changes how closely the student looks at the page. These metaphors make the workspace understandable without tutorial text.

### 4. Guidance should preserve agency

Strive helps students notice, recall, and reconsider. It does not solve the exercise for them. Tutor language should be concise, specific, and respectful. The student should always make the next mathematical move.

### 5. Feedback belongs beside the work

The side panel provides the full explanation and history, while numbered annotations point to the relevant place on the page. A student should not have to mentally map a generic error list back to their handwriting.

### 6. Progress is reflection, not performance theater

Progress uses recorded checks to reveal patterns and suggest practice. It should feel like a thoughtful learning review, not a competitive score screen. Mastery is an estimate and must never be presented as a formal grade.

## Experience architecture

Strive has three main layers:

1. **Notebook library** — the home view for creating and reopening notebooks. Covers use quiet colors and editorial typography. The writing invites the user back into their thinking.
2. **Notebook editor** — a tabbed document workspace with a page rail, centered paper, floating writing toolbar, zoom controls, and contextual tutor panel.
3. **Progress modal** — a focused, larger reflection view that summarizes practice without permanently shrinking the notebook.

The hierarchy should remain: library → notebook → page → mark. New features should attach to the smallest relevant level rather than adding global UI.

## Visual language

### Color

The main tokens live in `static/app.css`:

| Token               | Value     | Role                                                            |
| ------------------- | --------- | --------------------------------------------------------------- |
| `--nav`             | `#243c50` | Deep navy for structure, primary actions, and ink-like contrast |
| `--nav-light`       | `#344f64` | Secondary navy                                                  |
| `--ink`             | `#263b47` | Main text and drawing-adjacent UI                               |
| `--muted`           | `#85918f` | Secondary text                                                  |
| `--teal`            | `#357e75` | Guidance, active states, and affirmative accents                |
| `--line`            | `#e2e6e2` | Quiet separators and borders                                    |
| `--paper`           | `#fffefa` | Warm paper white                                                |
| `--bg`              | `#f7f8f4` | Warm workspace background                                       |
| `--notebook-accent` | dynamic   | Taken from the active notebook cover                            |

Warm whites prevent the clinical feel of pure white. Navy provides maturity and focus. Teal communicates assistance rather than urgency. Rust is reserved for feedback that needs another look. Color should carry meaning and remain low saturation.

### Typography

The system favors clean sans-serif type with an editorial touch:

- DM Sans/system sans is the body and control face.
- Manrope is used for display and product branding.
- Georgia appears selectively where an academic or paper-like voice helps.
- Uppercase eyebrow labels use generous tracking and small sizes.

Headings can be expressive, but controls and feedback must be immediately readable. Mathematical content must render through KaTeX. All model-produced expressions should use `$...$` or `$$...$$` delimiters.

This requirement applies to every AI surface without exception: hints, check-work summaries, correct-step recognition, inline annotations, guided walkthrough explanations, TA rubrics, mark comments, full-marks answers, regrade feedback, and progress analytics. The client also normalizes common bare equations, powers, and differentials before KaTeX rendering as a fallback when a model misses delimiters.

### Shape, border, and shadow

Surfaces use moderate radii, thin warm-gray borders, and soft diffuse shadows. The toolbar and feedback notes should feel placed above the desk, not illuminated from within it. Avoid stacking many rounded containers inside one another.

### Icons

The icon system is defined as inline SVG paths in `static/app.js`. Keep icons outline-based, optically consistent, and recognizable without labels in the toolbar. Do not mix emoji, filled clip art, or unrelated icon packs into the main interface.

### Motion

Motion should explain a spatial change: opening the library, entering a notebook, switching notebooks, revealing feedback, or opening progress. Transitions are short and use soft easing. Avoid continuous animation, bounce, or motion that delays writing.

## Key interaction decisions

### Notebook library

- Notebooks are objects, not rows in a database table.
- Cover color becomes the active notebook accent.
- The current copy is intentionally reflective and human rather than instructional.
- Creating and renaming use a focused modal with only necessary fields.

### Editor chrome

- The top document bar handles navigation and document-level actions.
- The left rail handles page-level actions and paper style.
- The floating toolbar handles mark-level actions.
- `Progress`, `Check work`, and `Get a hint` are distinct actions and must stay visually and behaviorally distinct.

### Drawing and navigation

- Paper coordinates are fixed at 850 × 1100 logical pixels.
- Zoom changes presentation, never saved drawing coordinates.
- Supported tools are pen, highlighter, eraser, text, rectangular selection, and hand/pan.
- Text entry is direct on the paper: selecting Text and clicking a line places a lightweight inline caret at that point. Typing happens in place, Enter adds a line, clicking away commits, and Escape cancels. Do not reintroduce a composer dialog or symbol tray.
- Pinch and Ctrl/Command + wheel zoom around the pointer. Space temporarily enables panning.
- Undo/redo is page scoped and currently retains up to 40 in-session states.

### Responsive behavior

On narrower screens, secondary chrome compresses before the paper becomes unusable. The toolbar can scroll or simplify. Panels may occupy more of the viewport. Touch targets must remain comfortable. The canvas interaction cannot depend on hover.

## AI behavior contract

There are two separate tutor modes. Do not combine them into a single generic assistant action.

### TA Markup

TA Markup is a separate, explicit submission-review mode. It first detects each question and its task type, then creates a different transparent rubric for every question based on command verbs, visible mark allocations, expected evidence, and mathematical domain. Proofs emphasize structure and justification; calculations emphasize method and execution; applied questions include modelling, units, and interpretation. It accepts alternative valid methods, preserves partial and follow-through credit, and never deducts repeatedly for one originating error.

The notebook shows anchored `+ / −` mark annotations on exact lines. The panel shows each question's score, rubric basis, criterion-level allocation, improvement summary, and a complete full-marks version. Scores remain estimates unless an instructor rubric is visible. **Regrade my revision** compares the new total with the previous attempt and reports marks recovered.

### Get a hint

Use when the student is stuck and has not submitted a finished solution.

- Infer the most useful immediate concept or direction.
- Ask one or two concise Socratic questions.
- Start faintly: recall a definition or relationship before naming a procedure.
- Do not grade, declare correctness, enumerate mistakes, calculate the next line, or reveal the answer.
- In the response schema, hint mode deliberately returns `is_correct_so_far: true` and `errors: []` because it is not an evaluation.
- Return `hint_location_x` and `hint_location_y` so the same nudge can appear in a teal annotation beside the exact work it addresses.

Example tone: “Which relationship connects the changing upper limit to the integrand?”

### Check work

Use when the student wants an evaluation of completed or substantially attempted work.

- Inspect every distinct problem and proof step on the current page or selection.
- Confirm sound work and identify each separate issue. Report important correct steps even when another part of the solution is wrong.
- For fully correct work, explain the meaningful sequence of valid steps and why each one works rather than returning a generic success message.
- Explain what operation, definition, sign, assumption, or justification to reconsider.
- Never provide the corrected line, completed proof, or final answer.
- Return approximate page coordinates for every issue so the client can place feedback beside the relevant work.

Each issue in the tutor panel has a **Recheck this** action. Rechecking sends a focused crop around the original issue rather than evaluating the whole page again. If corrected, its page marker turns into a quiet green check and fades; the panel retains a corrected record. If it still needs work, update the existing message rather than adding a duplicate marker.

Example tone: “Review which power rule applies to an antiderivative here.”

### Inline feedback

Each returned error appears in two places:

1. A numbered marker and compact note anchored near the error on the paper.
2. A complete entry in the tutor side panel.

The note chooses the right, left, or a stacked position according to visible room. After rendering, every new note checks the bounds of existing notes and tries alternate sides or progressively lower stacked positions until it has clear space; feedback cards must never overlap. Annotation UI counter-scales as the page zooms and receives an extra readability boost below 80% and 55% zoom. Render its math with KaTeX after insertion and show the complete message without truncation. Clicking the marker or note opens its matching tutor feedback. A dedicated × button dismisses the on-page annotation; the complete review remains available in the tutor panel.

Hints use the same placement and dismissal behavior with a teal sparkle marker. A hint stays visibly distinct from rust-colored check-work feedback and never implies that an error was found.

When a student requests a hint for a selected region, first ask what kind of help they need: starting, choosing the next step, understanding a rule, or checking their general direction. Pass that intent to the tutor prompt while preserving the non-grading, no-answer hint contract.

### Progress analysis

Only completed `Check work` calls become practice records. Hints must not affect accuracy or mastery. Analysis should ground strengths, weak points, pitfalls, and advice in actual recorded attempts. Low or mixed accuracy must produce a realistic mastery estimate.

### Guided walkthrough

After a student requests a hint, offer **Walk me through it** as an explicit last-resort escalation. A walkthrough may reveal the solution because the student deliberately requested it, but it must reveal one meaningful step at a time. Each step includes the written mathematical line plus its Goal, Why, and Check. Render the lines on a removable teal Tutor Ink layer so they remain visibly separate from student-authored work. Students can hide the layer, continue progressively, or clear it and retry. Guided sessions are stored separately and do not count as independent correct attempts in Progress.

## Changing the LLM

The model integration is isolated in `main.py`. Preserve the API contracts even if the provider or model changes:

- `POST /tutor` accepts a rendered page/selection image and `action_type`.
- `/tutor` returns `MathTutorResponse`, including status, transcription, hint text, correctness, and positioned errors.
- `POST /analytics` accepts chronological practice records and returns `AnalyticsResponse`.
- The frontend expects valid JSON matching these schemas.

The current prompts are `SYSTEM_CHECK_LOGIC`, `SYSTEM_GET_HINT`, and `SYSTEM_ANALYTICS`. When switching models:

1. Keep hint and checking instructions separate.
2. Use structured output or schema-constrained generation when the provider supports it.
3. Preserve normalized error coordinates in the range `0.05` to `0.95`.
4. Require LaTeX delimiters around every mathematical expression.
5. Test refusal to reveal answers, multi-error detection, handwriting transcription, blank/incomplete pages, and malformed provider output.
6. Keep provider errors human-readable while confirming that notebook data remains saved locally.

Model names currently live in `ACTIVE_MODELS`. The client wrapper and response parsing can change; the browser-facing schemas should remain stable unless frontend and tests are updated together.

## Data and privacy model

- Notebook content is stored in browser local storage under `folio_notebooks_v1` first, so writing remains available offline.
- That legacy key is intentionally retained after the Strive rename so existing users do not lose notebooks.
- When Supabase is configured, students can create an email/password account. Signed-in notebooks sync to owner-only rows protected by Postgres RLS.
- Guest mode and new accounts both begin with zero notebooks. Students always create their own notebooks.
- Guest notebooks remain available only for the current local calendar day and are cleared on the next day's visit. They stay separate from account notebooks and are never imported automatically during signup.
- Per-user device caches prevent one account's workspace from being shown to another account after switching users.
- Sync merges individual notebooks by their client update timestamp, queues edits while offline, and listens for authenticated realtime changes. The local copy remains the immediate source of truth for writing responsiveness.
- Signing out restores the anonymous device workspace. Clearing site data removes local copies, while cloud notebooks remain recoverable after sign-in.
- AI features send a rendered image of the current page or selection to the configured model provider.
- Practice history is stored with its notebook and is used for progress analysis.

## First-run onboarding

Onboarding is a short learner intake, not a product tour. After a brief welcome, it asks exactly one question per screen about the student's name, level, current subjects, course, common sticking points, preferred hint style, and immediate goal. Optional name and course fields add useful context without blocking setup. The experience fills the viewport and uses the same navy, paper-grid geometry, restrained teal, typography, and precise controls as the notebook. Progress stays secondary so the current question remains the clear focal point.

The resulting profile is stored in account metadata and accompanies tutor requests so wording, depth, and hint style reflect the learner's choices without weakening mathematical standards. Signed-in users can reopen the intake from **Edit learning profile** in the account dialog.

The experience should feel like opening a well-made notebook. It uses warm paper, restrained navy and teal, generous space, and small product demonstrations rather than generic feature illustrations. Motion explains the product: ink draws onto a page, tools settle into place, and tutor feedback arrives beside the relevant line. Transitions should remain calm and respect `prefers-reduced-motion`.

Completion and optional subject/goal choices are stored in Supabase auth metadata. Only accounts explicitly tagged as newly created are eligible, so existing students are never interrupted. The flow may be skipped, and skipping counts as completion. Onboarding must remain responsive, keyboard navigable, and readable on narrow screens.

Any future sync feature should make ownership, upload state, failure state, and privacy clear. Never silently change local-first behavior.

## Implementation map

| File                              | Responsibility                                                                                            |
| --------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `index.html`                      | Semantic shell, library, editor, tool controls, dialogs, tutor panel                                      |
| `static/app.css`                  | Core visual system, layout, responsive behavior, paper, toolbar, tutor and inline annotations             |
| `static/app.js`                   | SVG icons, state, local persistence, drawing engine, zoom, navigation, tutor calls and feedback placement |
| `static/paper-picker.js` / `.css` | Paper selection experience                                                                                |
| `static/selects.js`               | Custom select behavior                                                                                    |
| `static/analytics.js` / `.css`    | Progress dialog, history and reflective analytics presentation                                            |
| `static/onboarding.js` / `.css`   | Account-scoped first-run introduction, animation and preference capture                                   |
| `main.py`                         | FastAPI routes, model client, tutor prompts, analytics prompt and response schemas                        |
| `tests/test_workspace.py`         | Browser shell and mocked model/API behavior checks                                                        |

Some internal identifiers still say `Folio` or `folio`. They are implementation details from the earlier name and can remain where renaming would risk stored data or event compatibility. All user-visible branding should say **Strive**.

## Rules for extending the product

Before adding a feature, answer:

1. Does it help the student think, write, review, or navigate?
2. At what level does it belong: library, notebook, page, selection, or mark?
3. Can it remain hidden until relevant?
4. Does it preserve the distinction between guidance and evaluation?
5. Will it remain understandable with touch, zoom, and a narrow viewport?

Prefer editing the existing visual vocabulary over introducing a new component style. Prefer direct manipulation over configuration panels. Prefer one strong action over a row of equally loud buttons. Keep product copy short, calm, and specific.

## Things to avoid

- Generic AI dashboard layouts, neon gradients, glassmorphism, or excessive pills.
- Gamification, streak pressure, celebratory confetti, or fake precision in mastery.
- Chat-first tutor experiences that pull attention away from the page.
- Hint responses that quietly grade the work.
- Check responses that disclose the corrected answer.
- Raw `$...$` text in visible feedback; run KaTeX rendering.
- Fixed-size annotations that become unreadable when zoomed out.
- Destructive storage migrations during cosmetic renames.
- Adding controls to the top bar when they belong to the page or selection.

## Verification checklist

After meaningful changes:

```powershell
node --check static/app.js
node --check static/analytics.js
python -m unittest discover -s tests -v
git diff --check
```

Also verify manually at desktop and narrow widths:

- Create, rename, open, and switch notebooks.
- Add pages and change paper style.
- Draw, erase, add text, select, undo, redo, pan, pinch, zoom, and fit.
- Request a hint and confirm it does not grade or reveal the next line.
- Check deliberately incorrect work and confirm every issue has readable LaTeX feedback beside the work and in the panel.
- Open progress and confirm hints did not alter recorded accuracy.
- Reload and confirm notebook content persists.
