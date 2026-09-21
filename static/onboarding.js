"use strict";
(() => {
  const steps = [
    { id: "welcome", eyebrow: "WELCOME TO STRIVE", title: "A tutor that learns how you learn.", description: "Answer a few short questions so hints, feedback, and explanations feel useful from the first page." },
    { id: "name", eyebrow: "ABOUT YOU", title: "What should we call you?", description: "Optional — you can leave this blank." },
    { id: "level", eyebrow: "YOUR LEVEL", title: "Where are you in your math journey?", description: "We’ll match the language and depth of explanations to you." },
    { id: "subjects", eyebrow: "YOUR SUBJECTS", title: "What are you studying right now?", description: "Choose all that apply." },
    { id: "course", eyebrow: "YOUR COURSE", title: "Is there a course or topic you’re focused on?", description: "Optional — a course code or a topic is enough." },
    { id: "friction", eyebrow: "YOUR WORK", title: "Where do you usually get stuck?", description: "Choose up to three." },
    { id: "help", eyebrow: "YOUR TUTOR", title: "How should your tutor help?", description: "Choose the kind of first response you want when you ask for a hint." },
    { id: "goal", eyebrow: "YOUR GOAL", title: "What matters most right now?", description: "This helps Strive focus its feedback." },
  ];
  const profile = { name: "", level: "", subjects: [], course: "", friction: [], help_style: "questions", primary_goal: "" };
  let overlay, index = 0, active = false, finishing = false, completeCallback;
  const option = (value, label, detail = "") => `<button type="button" class="ob-option" data-value="${value}"><span class="ob-option-copy"><b>${label}</b>${detail ? `<small>${detail}</small>` : ""}</span><span class="ob-option-mark" aria-hidden="true"></span></button>`;
  function escapeHtml(value) { const node = document.createElement("span"); node.textContent = value || ""; return node.innerHTML; }
  function screen(step) {
    if (step.id === "welcome") return `<div class="ob-welcome-rule"></div>`;
    if (step.id === "name") return `<label class="ob-field"><span class="sr-only">Your first name</span><input id="obName" maxlength="40" autocomplete="given-name" placeholder="Your first name" value="${escapeHtml(profile.name)}"></label>`;
    if (step.id === "level") return `<div class="ob-options ob-options-grid" data-single="level">${option("high_school", "High school")}${option("college", "College or university")}${option("independent", "Learning independently")}${option("other", "Something else")}</div>`;
    if (step.id === "subjects") return `<div class="ob-options ob-options-grid" data-multi="subjects">${option("algebra", "Algebra")}${option("calculus", "Calculus")}${option("statistics", "Statistics")}${option("linear_algebra", "Linear algebra")}${option("proofs", "Proofs & discrete math")}${option("other", "Another subject")}</div>`;
    if (step.id === "course") return `<label class="ob-field"><span class="sr-only">Course or topic</span><input id="obCourse" maxlength="80" placeholder="e.g. MAT137 or integration by parts" value="${escapeHtml(profile.course)}"></label>`;
    if (step.id === "friction") return `<div class="ob-options ob-options-list" data-multi="friction" data-limit="3">${option("starting", "Starting a problem", "I cannot find the first move.")}${option("method", "Choosing a method", "I know the rules, but not which one fits.")}${option("small_errors", "Small algebra or notation errors", "The approach is right, but details cost me marks.")}${option("proofs", "Explaining why a step is valid", "I can do the work but struggle to justify it.")}${option("stuck_midway", "Getting unstuck halfway through", "I make progress and then lose the direction.")}${option("checking", "Knowing whether I am done", "I want a reliable final check.")}</div><p class="ob-selection-count"><span>${profile.friction.length}</span> of 3 selected</p>`;
    if (step.id === "help") return `<div class="ob-options ob-options-list" data-single="help_style">${option("questions", "Ask me a guiding question", "Help me make the connection myself.")}${option("nudge", "Give me the smallest useful nudge", "Point me toward the rule or direction.")}${option("explain", "Explain the missing concept", "Teach the idea, then leave the calculation to me.")}</div>`;
    return `<div class="ob-options ob-options-grid" data-single="primary_goal">${option("understanding", "Deep understanding")}${option("homework", "Finishing assignments")}${option("exams", "Preparing for exams")}${option("confidence", "Building confidence")}</div>`;
  }
  function build() {
    overlay = document.createElement("section");
    overlay.id = "striveOnboarding"; overlay.className = "ob-overlay"; overlay.hidden = true;
    overlay.setAttribute("role", "dialog"); overlay.setAttribute("aria-modal", "true"); overlay.setAttribute("aria-labelledby", "obTitle");
    overlay.innerHTML = `<div class="ob-shell"><header class="ob-header"><div class="ob-brand">strive<span>.</span></div><div class="ob-step-count"></div></header><main class="ob-main"><div class="ob-question"><p class="ob-eyebrow"></p><h1 id="obTitle"></h1><p class="ob-description"></p><div class="ob-screen"></div><p class="ob-error" role="alert"></p></div></main><footer class="ob-footer"><button class="ob-back" type="button">Back</button><div class="ob-progress" aria-hidden="true"><span></span></div><button class="ob-next" type="button"><span>Continue</span><b aria-hidden="true">→</b></button></footer></div>`;
    document.body.append(overlay);
    overlay.querySelector(".ob-back").onclick = () => show(index - 1);
    overlay.querySelector(".ob-next").onclick = advance;
    overlay.addEventListener("click", handleChoice); overlay.addEventListener("input", handleInput);
    overlay.addEventListener("keydown", (event) => { if (event.key === "Enter" && event.target.tagName !== "BUTTON") { event.preventDefault(); advance(); } });
  }
  function handleInput(event) { if (event.target.id === "obName") profile.name = event.target.value.trim(); if (event.target.id === "obCourse") profile.course = event.target.value.trim(); }
  function handleChoice(event) {
    const button = event.target.closest(".ob-option"); if (!button) return;
    const group = button.closest("[data-single],[data-multi]"); const value = button.dataset.value;
    if (group.dataset.single) { profile[group.dataset.single] = value; group.querySelectorAll(".ob-option").forEach((candidate) => candidate.classList.toggle("selected", candidate === button)); }
    else { const key = group.dataset.multi; const values = profile[key]; if (values.includes(value)) profile[key] = values.filter((item) => item !== value); else { const limit = Number(group.dataset.limit || 99); if (values.length >= limit) return showError(`Choose up to ${limit}.`); profile[key] = [...values, value]; } button.classList.toggle("selected", profile[key].includes(value)); const count = overlay.querySelector(".ob-selection-count span"); if (count) count.textContent = profile[key].length; }
    showError("");
  }
  function restoreSelections() { overlay.querySelectorAll("[data-single]").forEach((group) => group.querySelectorAll(".ob-option").forEach((button) => button.classList.toggle("selected", profile[group.dataset.single] === button.dataset.value))); overlay.querySelectorAll("[data-multi]").forEach((group) => group.querySelectorAll(".ob-option").forEach((button) => button.classList.toggle("selected", profile[group.dataset.multi].includes(button.dataset.value)))); }
  function showError(message) { overlay.querySelector(".ob-error").textContent = message; }
  function validate() { const step = steps[index].id; if (step === "level" && !profile.level) return "Choose your current level."; if (step === "subjects" && !profile.subjects.length) return "Choose at least one subject."; if (step === "friction" && !profile.friction.length) return "Choose at least one place where you get stuck."; if (step === "goal" && !profile.primary_goal) return "Choose what matters most right now."; return ""; }
  function show(nextIndex) {
    index = Math.max(0, Math.min(steps.length - 1, nextIndex)); const step = steps[index]; const question = overlay.querySelector(".ob-question"); question.classList.remove("animate");
    overlay.querySelector(".ob-eyebrow").textContent = step.eyebrow; overlay.querySelector("h1").textContent = step.title; overlay.querySelector(".ob-description").textContent = step.description; overlay.querySelector(".ob-screen").innerHTML = screen(step); overlay.querySelector(".ob-main").scrollTop = 0;
    restoreSelections(); showError(""); overlay.querySelector(".ob-back").disabled = index === 0;
    overlay.querySelector(".ob-next span").textContent = index === 0 ? "Get started" : index === steps.length - 1 ? "Finish setup" : "Continue"; overlay.querySelector(".ob-next b").textContent = index === steps.length - 1 ? "✓" : "→";
    overlay.querySelector(".ob-step-count").textContent = index === 0 ? "" : `${String(index).padStart(2, "0")} / ${String(steps.length - 1).padStart(2, "0")}`; overlay.querySelector(".ob-progress span").style.width = `${index / (steps.length - 1) * 100}%`; overlay.classList.toggle("ob-is-welcome", index === 0);
    requestAnimationFrame(() => question.classList.add("animate")); const firstInput = overlay.querySelector("input"); if (firstInput) setTimeout(() => firstInput.focus(), 100);
  }
  async function advance() {
    const error = validate(); if (error) return showError(error); if (index < steps.length - 1) return show(index + 1); if (finishing) return;
    finishing = true; const button = overlay.querySelector(".ob-next"); button.disabled = true; button.querySelector("span").textContent = "Saving…";
    try { await completeCallback?.({ ...profile, subjects: [...profile.subjects], friction: [...profile.friction] }); overlay.classList.add("leaving"); setTimeout(() => { overlay.hidden = true; overlay.classList.remove("entered", "leaving"); document.documentElement.classList.remove("onboarding-open"); active = false; finishing = false; }, 260); }
    catch (error) { showError(error.message || "Couldn’t save your setup. Try again."); button.disabled = false; button.querySelector("span").textContent = "Finish setup"; finishing = false; }
  }
  function start({ complete, initial } = {}) { if (active) return; if (!overlay) build(); active = true; finishing = false; completeCallback = complete; index = 0; Object.assign(profile, { name: initial?.name || "", level: initial?.level || "", subjects: Array.isArray(initial?.subjects) ? [...initial.subjects] : [], course: initial?.course || "", friction: Array.isArray(initial?.friction) ? [...initial.friction] : [], help_style: initial?.help_style || "questions", primary_goal: initial?.primary_goal || "" }); document.documentElement.classList.add("onboarding-open"); overlay.hidden = false; requestAnimationFrame(() => overlay.classList.add("entered")); show(0); }
  window.StriveOnboarding = { start, isActive: () => active };
  if (["127.0.0.1", "localhost"].includes(location.hostname) && new URLSearchParams(location.search).has("preview-onboarding")) window.addEventListener("load", () => start({ complete: async () => {} }));
})();
