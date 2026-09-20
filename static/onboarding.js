"use strict";
(() => {
  const steps = [
    { id: "context", kicker: "First, some context", title: "Where are you in your math journey?", description: "This helps Strive explain ideas at the right level." },
    { id: "subjects", kicker: "Your work", title: "What are you studying right now?", description: "Choose everything that belongs in your workspace." },
    { id: "friction", kicker: "Be honest", title: "Where do you usually get stuck?", description: "Pick up to three. Your tutor will pay closer attention to these moments." },
    { id: "tutoring", kicker: "Set the boundaries", title: "How should your tutor help?", description: "You can change this later. For now, choose what keeps you thinking." },
  ];
  const profile = { name: "", level: "", subjects: [], course: "", friction: [], help_style: "questions", primary_goal: "" };
  let overlay;
  let index = 0;
  let active = false;
  let finishing = false;
  let completeCallback;

  const option = (value, label, detail = "") =>
    `<button type="button" class="ob-option" data-value="${value}"><span class="ob-option-mark" aria-hidden="true"></span><span><b>${label}</b>${detail ? `<small>${detail}</small>` : ""}</span></button>`;

  function escapeHtml(value) {
    const node = document.createElement("span");
    node.textContent = value || "";
    return node.innerHTML;
  }

  function screen(step) {
    if (step.id === "context")
      return `<div class="ob-fields"><label class="ob-field"><span>What should we call you? <em>Optional</em></span><input id="obName" maxlength="40" autocomplete="given-name" placeholder="Your first name" value="${escapeHtml(profile.name)}"></label><fieldset><legend>Your current level</legend><div class="ob-options ob-options-two" data-single="level">${option("high_school", "High school")}${option("college", "College or university")}${option("independent", "Learning independently")}${option("other", "Something else")}</div></fieldset></div>`;
    if (step.id === "subjects")
      return `<div class="ob-fields"><fieldset><legend>Subjects <em>Select all that apply</em></legend><div class="ob-options ob-options-two" data-multi="subjects">${option("algebra", "Algebra")}${option("calculus", "Calculus")}${option("statistics", "Statistics")}${option("linear_algebra", "Linear algebra")}${option("proofs", "Proofs & discrete math")}${option("other", "Another subject")}</div></fieldset><label class="ob-field"><span>Course or topic <em>Optional</em></span><input id="obCourse" maxlength="80" placeholder="e.g. MAT137, integration by parts" value="${escapeHtml(profile.course)}"></label></div>`;
    if (step.id === "friction")
      return `<fieldset><legend class="sr-only">Where you get stuck</legend><div class="ob-options ob-options-stack" data-multi="friction" data-limit="3">${option("starting", "Starting a problem", "I understand the question but cannot find the first move.")}${option("method", "Choosing a method", "I know several rules but not which one fits.")}${option("small_errors", "Small algebra or notation errors", "My overall approach is right, but details cost me marks.")}${option("proofs", "Explaining why a step is valid", "I can do the work but struggle to justify it clearly.")}${option("stuck_midway", "Getting unstuck halfway through", "I make progress and then lose the direction.")}${option("checking", "Knowing whether I am actually done", "I want a reliable final check without seeing the answer early.")}</div><p class="ob-selection-count"><span>${profile.friction.length}</span>/3 selected</p></fieldset>`;
    return `<div class="ob-fields"><fieldset><legend>When I ask for a hint…</legend><div class="ob-options ob-options-stack" data-single="help_style">${option("questions", "Ask me a guiding question", "Make me connect the idea before explaining it.")}${option("nudge", "Give me the smallest useful nudge", "Point toward the rule or direction and stop there.")}${option("explain", "Explain the concept clearly", "Teach the missing idea, but leave the calculation to me.")}</div></fieldset><fieldset><legend>What matters most right now?</legend><div class="ob-options ob-options-two" data-single="primary_goal">${option("understanding", "Deep understanding")}${option("homework", "Finishing assignments")}${option("exams", "Preparing for exams")}${option("confidence", "Building confidence")}</div></fieldset></div>`;
  }

  function build() {
    overlay = document.createElement("section");
    overlay.id = "striveOnboarding";
    overlay.className = "ob-overlay";
    overlay.hidden = true;
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "obTitle");
    overlay.innerHTML = `<div class="ob-frame"><aside class="ob-rail"><div class="ob-brand">strive<span>.</span></div><div class="ob-rail-copy"><span>SET UP YOUR TUTOR</span><p>Four quick questions.<br>No personality quiz.</p></div><ol class="ob-progress"></ol><p class="ob-privacy">Your answers belong to your account and only shape your learning experience.</p></aside><section class="ob-panel"><header class="ob-mobile-header"><div class="ob-brand">strive<span>.</span></div><span class="ob-mobile-count"></span></header><main class="ob-main"><div class="ob-question"><span class="ob-kicker"></span><h1 id="obTitle"></h1><p class="ob-description"></p><div class="ob-screen"></div><p class="ob-error" role="alert"></p></div></main><footer class="ob-footer"><button class="ob-back" type="button">Back</button><span class="ob-key-hint">Press Enter to continue</span><button class="ob-next" type="button"><span>Continue</span><b aria-hidden="true">→</b></button></footer></section></div>`;
    document.body.append(overlay);
    overlay.querySelector(".ob-back").onclick = () => show(index - 1);
    overlay.querySelector(".ob-next").onclick = advance;
    overlay.addEventListener("click", handleChoice);
    overlay.addEventListener("input", handleInput);
    overlay.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && event.target.tagName !== "BUTTON") {
        event.preventDefault();
        advance();
      }
    });
  }

  function handleInput(event) {
    if (event.target.id === "obName") profile.name = event.target.value.trim();
    if (event.target.id === "obCourse") profile.course = event.target.value.trim();
  }

  function handleChoice(event) {
    const button = event.target.closest(".ob-option");
    if (!button) return;
    const group = button.closest("[data-single],[data-multi]");
    const value = button.dataset.value;
    if (group.dataset.single) {
      profile[group.dataset.single] = value;
      group.querySelectorAll(".ob-option").forEach((candidate) =>
        candidate.classList.toggle("selected", candidate === button),
      );
    } else {
      const key = group.dataset.multi;
      const values = profile[key];
      if (values.includes(value)) profile[key] = values.filter((item) => item !== value);
      else {
        const limit = Number(group.dataset.limit || 99);
        if (values.length >= limit) return showError(`Choose up to ${limit}.`);
        profile[key] = [...values, value];
      }
      button.classList.toggle("selected", profile[key].includes(value));
      const count = overlay.querySelector(".ob-selection-count span");
      if (count) count.textContent = profile[key].length;
    }
    showError("");
  }

  function restoreSelections() {
    overlay.querySelectorAll("[data-single]").forEach((group) => {
      group.querySelectorAll(".ob-option").forEach((button) =>
        button.classList.toggle("selected", profile[group.dataset.single] === button.dataset.value),
      );
    });
    overlay.querySelectorAll("[data-multi]").forEach((group) => {
      group.querySelectorAll(".ob-option").forEach((button) =>
        button.classList.toggle("selected", profile[group.dataset.multi].includes(button.dataset.value)),
      );
    });
  }

  function showError(message) {
    overlay.querySelector(".ob-error").textContent = message;
  }

  function validate() {
    const step = steps[index].id;
    if (step === "context" && !profile.level) return "Choose your current level.";
    if (step === "subjects" && !profile.subjects.length) return "Choose at least one subject.";
    if (step === "friction" && !profile.friction.length) return "Choose at least one place where you get stuck.";
    if (step === "tutoring" && !profile.primary_goal) return "Choose what matters most right now.";
    return "";
  }

  function show(nextIndex) {
    index = Math.max(0, Math.min(steps.length - 1, nextIndex));
    const step = steps[index];
    overlay.querySelector(".ob-kicker").textContent = step.kicker;
    overlay.querySelector("h1").textContent = step.title;
    overlay.querySelector(".ob-description").textContent = step.description;
    overlay.querySelector(".ob-screen").innerHTML = screen(step);
    overlay.querySelector(".ob-main").scrollTop = 0;
    restoreSelections();
    showError("");
    overlay.querySelector(".ob-back").disabled = index === 0;
    overlay.querySelector(".ob-next span").textContent = index === steps.length - 1 ? "Finish setup" : "Continue";
    overlay.querySelector(".ob-next b").textContent = index === steps.length - 1 ? "✓" : "→";
    overlay.querySelector(".ob-mobile-count").textContent = `${index + 1} of ${steps.length}`;
    const progress = overlay.querySelector(".ob-progress");
    progress.replaceChildren();
    steps.forEach((item, stepIndex) => {
      const row = document.createElement("li");
      row.className = stepIndex === index ? "active" : stepIndex < index ? "complete" : "";
      row.innerHTML = `<i>${stepIndex < index ? "✓" : stepIndex + 1}</i><span>${["About you", "Subjects", "Sticking points", "Tutor style"][stepIndex]}</span>`;
      progress.append(row);
    });
    const firstInput = overlay.querySelector("input");
    if (firstInput) setTimeout(() => firstInput.focus(), 80);
  }

  async function advance() {
    const error = validate();
    if (error) return showError(error);
    if (index < steps.length - 1) return show(index + 1);
    if (finishing) return;
    finishing = true;
    const button = overlay.querySelector(".ob-next");
    button.disabled = true;
    button.querySelector("span").textContent = "Saving…";
    try {
      await completeCallback?.({ ...profile, subjects: [...profile.subjects], friction: [...profile.friction] });
      overlay.classList.add("leaving");
      setTimeout(() => {
        overlay.hidden = true;
        overlay.classList.remove("entered", "leaving");
        document.documentElement.classList.remove("onboarding-open");
        active = false;
        finishing = false;
      }, 260);
    } catch (error) {
      showError(error.message || "Couldn’t save your setup. Try again.");
      button.disabled = false;
      button.querySelector("span").textContent = "Finish setup";
      finishing = false;
    }
  }

  function start({ complete, initial } = {}) {
    if (active) return;
    if (!overlay) build();
    active = true;
    finishing = false;
    completeCallback = complete;
    index = 0;
    Object.assign(profile, {
      name: initial?.name || "",
      level: initial?.level || "",
      subjects: Array.isArray(initial?.subjects) ? [...initial.subjects] : [],
      course: initial?.course || "",
      friction: Array.isArray(initial?.friction) ? [...initial.friction] : [],
      help_style: initial?.help_style || "questions",
      primary_goal: initial?.primary_goal || "",
    });
    document.documentElement.classList.add("onboarding-open");
    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add("entered"));
    show(0);
  }

  window.StriveOnboarding = { start, isActive: () => active };
  if (
    ["127.0.0.1", "localhost"].includes(location.hostname) &&
    new URLSearchParams(location.search).has("preview-onboarding")
  )
    window.addEventListener("load", () => start({ complete: async () => {} }));
})();
