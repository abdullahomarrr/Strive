"use strict";
(() => {
  const steps = [
    {
      eyebrow: "WELCOME TO STRIVE",
      title: "Your thinking has a home.",
      copy: "A quiet notebook for working things out, making mistakes, and finding your own way through mathematics.",
      scene: "paper",
    },
    {
      eyebrow: "THINK ON PAPER",
      title: "Write naturally. Stay in the flow.",
      copy: "Use the page the way you already think—draw, type, highlight, rearrange, zoom, and keep every course in its own notebook.",
      scene: "tools",
    },
    {
      eyebrow: "A SECOND PAIR OF EYES",
      title: "Guidance that meets you where you are.",
      copy: "Ask for a nudge when you are stuck, check completed reasoning, or get precise TA-style feedback beside the exact line that needs attention.",
      scene: "guidance",
    },
    {
      eyebrow: "MAKE IT YOURS",
      title: "What are you working toward?",
      copy: "Choose what fits right now. Strive will use this to make your empty workspace feel more personal.",
      scene: "personalize",
    },
  ];
  let overlay = null;
  let index = 0;
  let active = false;
  let finishing = false;
  let completeCallback = null;
  const preferences = { subjects: [], goal: "understand" };

  const sceneMarkup = (scene) => {
    if (scene === "paper")
      return `<div class="ob-paper-scene"><div class="ob-shadow-page"></div><div class="ob-page"><span class="ob-page-kicker">A LITTLE ROOM TO THINK</span><div class="ob-equation">\\(\\int x^2\\,dx\\)</div><svg viewBox="0 0 340 150" aria-hidden="true"><path d="M20 42C66 26 94 51 138 35S213 22 252 42"/><path d="M30 82c42-13 67 18 111 0s76-14 130 4"/><path d="M48 121c38-9 81 14 137-3"/></svg><span class="ob-caret"></span></div><div class="ob-float-note"><b>Calculus I</b><span>Saved. Ready when you are.</span></div></div>`;
    if (scene === "tools")
      return `<div class="ob-tools-scene"><div class="ob-mini-toolbar"><span class="active">⌁</span><span>▱</span><span>◇</span><span>T</span><i></i><b></b><b></b><b></b></div><div class="ob-work-page"><div class="ob-hand-line one">\\(f'(x)=3x^2\\)</div><div class="ob-hand-line two">\\(\\int 3x^2\\,dx=x^3+C\\)</div><div class="ob-highlight"></div><div class="ob-pen-path"></div></div><div class="ob-tool-label">Your page stays the main event.</div></div>`;
    if (scene === "guidance")
      return `<div class="ob-guidance-scene"><div class="ob-guidance-page"><div class="ob-problem-line">\\(u=x^2+4\\)</div><span class="ob-pin">1</span><div class="ob-inline-note"><small>ANOTHER LOOK</small><p>Where should the differential appear after choosing \\(u\\)?</p></div></div><div class="ob-tutor-card"><span>A SECOND PAIR OF EYES</span><h3>Your tutor</h3><div><i>✓</i><p><b>What’s working</b><small>Your substitution identifies the inner expression.</small></p></div><div><i>✦</i><p><b>Your next move</b><small>Connect the derivative to the remaining factor.</small></p></div></div></div>`;
    return `<div class="ob-personalize"><div class="ob-choice-group"><span>WHAT ARE YOU STUDYING?</span><div class="ob-chip-grid" data-choice="subjects"><button>Calculus</button><button>Algebra</button><button>Proofs</button><button>Linear algebra</button><button>Statistics</button><button>Something else</button></div></div><div class="ob-choice-group"><span>WHAT DO YOU WANT MOST?</span><div class="ob-goal-grid" data-choice="goal"><button data-value="understand" class="selected"><b>Understand deeply</b><small>Learn the reasoning behind every step.</small></button><button data-value="practice"><b>Practice confidently</b><small>Build consistency through active work.</small></button><button data-value="prepare"><b>Prepare for assessments</b><small>Know what earns full marks.</small></button></div></div></div>`;
  };

  function build() {
    overlay = document.createElement("section");
    overlay.id = "striveOnboarding";
    overlay.className = "ob-overlay";
    overlay.hidden = true;
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "obTitle");
    overlay.innerHTML = `<div class="ob-ambient one"></div><div class="ob-ambient two"></div><div class="ob-shell"><header class="ob-header"><div class="ob-brand">strive<span>.</span></div><div class="ob-step-label"></div><button class="ob-skip" type="button" aria-label="Skip onboarding">×</button></header><div class="ob-stage"><div class="ob-scene"></div></div><main class="ob-copy"><span class="ob-eyebrow"></span><h1 id="obTitle"></h1><p></p></main><footer class="ob-footer"><button class="ob-back" type="button">← Back</button><div class="ob-dots" aria-label="Onboarding progress"></div><button class="ob-next" type="button"><span>Continue</span><b>→</b></button></footer><p class="ob-error" role="status"></p></div>`;
    document.body.append(overlay);
    overlay.querySelector(".ob-skip").onclick = finish;
    overlay.querySelector(".ob-back").onclick = () => show(index - 1, -1);
    overlay.querySelector(".ob-next").onclick = () =>
      index === steps.length - 1 ? finish() : show(index + 1, 1);
    overlay.addEventListener("click", (event) => {
      const subject = event.target.closest('[data-choice="subjects"] button');
      if (subject) {
        subject.classList.toggle("selected");
        const name = subject.textContent.trim();
        preferences.subjects = subject.classList.contains("selected")
          ? [...new Set([...preferences.subjects, name])]
          : preferences.subjects.filter((value) => value !== name);
      }
      const goal = event.target.closest('[data-choice="goal"] button');
      if (goal) {
        overlay
          .querySelectorAll('[data-choice="goal"] button')
          .forEach((button) =>
            button.classList.toggle("selected", button === goal),
          );
        preferences.goal = goal.dataset.value;
      }
    });
    overlay.addEventListener("keydown", (event) => {
      if (event.key === "Escape") finish();
      if (event.key === "ArrowRight" && index < steps.length - 1)
        show(index + 1, 1);
      if (event.key === "ArrowLeft" && index > 0) show(index - 1, -1);
    });
  }

  function show(nextIndex, direction = 1) {
    index = Math.max(0, Math.min(steps.length - 1, nextIndex));
    const step = steps[index];
    const shell = overlay.querySelector(".ob-shell");
    shell.classList.remove("moving-forward", "moving-back");
    void shell.offsetWidth;
    shell.classList.add(direction < 0 ? "moving-back" : "moving-forward");
    overlay.querySelector(".ob-scene").innerHTML = sceneMarkup(step.scene);
    if (window.renderMathInElement)
      window.renderMathInElement(overlay.querySelector(".ob-scene"), {
        delimiters: [
          { left: "\\(", right: "\\)", display: false },
          { left: "\\[", right: "\\]", display: true },
        ],
        throwOnError: false,
      });
    if (step.scene === "personalize") {
      overlay
        .querySelectorAll('[data-choice="subjects"] button')
        .forEach((button) =>
          button.classList.toggle(
            "selected",
            preferences.subjects.includes(button.textContent.trim()),
          ),
        );
      overlay
        .querySelectorAll('[data-choice="goal"] button')
        .forEach((button) =>
          button.classList.toggle(
            "selected",
            button.dataset.value === preferences.goal,
          ),
        );
    }
    overlay.querySelector(".ob-eyebrow").textContent = step.eyebrow;
    overlay.querySelector("h1").textContent = step.title;
    overlay.querySelector(".ob-copy > p").textContent = step.copy;
    overlay.querySelector(".ob-step-label").textContent =
      `${String(index + 1).padStart(2, "0")} / ${String(steps.length).padStart(2, "0")}`;
    overlay.querySelector(".ob-back").disabled = index === 0;
    overlay.querySelector(".ob-next span").textContent =
      index === steps.length - 1 ? "Enter your workspace" : "Continue";
    overlay.querySelector(".ob-next b").textContent =
      index === steps.length - 1 ? "✓" : "→";
    const dots = overlay.querySelector(".ob-dots");
    dots.replaceChildren();
    steps.forEach((_, dotIndex) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = dotIndex === index ? "active" : "";
      dot.setAttribute("aria-label", `Go to step ${dotIndex + 1}`);
      dot.onclick = () => show(dotIndex, dotIndex > index ? 1 : -1);
      dots.append(dot);
    });
  }

  async function finish() {
    if (finishing) return;
    finishing = true;
    const next = overlay.querySelector(".ob-next");
    const error = overlay.querySelector(".ob-error");
    next.disabled = true;
    error.textContent = "";
    try {
      await completeCallback?.(preferences);
      overlay.classList.add("leaving");
      setTimeout(() => {
        overlay.hidden = true;
        overlay.classList.remove("leaving");
        document.documentElement.classList.remove("onboarding-open");
        active = false;
        finishing = false;
      }, 520);
    } catch (exception) {
      error.textContent =
        exception.message || "Couldn’t save your preferences. Try again.";
      finishing = false;
      next.disabled = false;
    }
  }

  function start({ complete } = {}) {
    if (active) return;
    if (!overlay) build();
    active = true;
    finishing = false;
    completeCallback = complete;
    index = 0;
    preferences.subjects = [];
    preferences.goal = "understand";
    document.documentElement.classList.add("onboarding-open");
    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add("entered"));
    show(0, 1);
    overlay.querySelector(".ob-next").focus();
  }

  window.StriveOnboarding = { start, isActive: () => active };
})();
