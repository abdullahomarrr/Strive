(() => {
  "use strict";
  const sanitizeLatex = (str) => {
    let s = String(str ?? "");
    // Fix broken escapes where backslash was eaten or malformed
    s = s.replace(/extstyle/g, "\\textstyle ")
         .replace(/displaystyle/g, "\\displaystyle ")
         .replace(/igintsss/g, "\\int ")
         .replace(/igint/g, "\\int ")
         .replace(/[\u2191\u25b2]rac/g, "\\frac") // arrow unicode artifacts + rac -> \frac
         .replace(/[\u25a1\u25af\u25fb\u25fc]rac/g, "\\frac") // box unicode artifacts + rac -> \frac
         .replace(/([^a-zA-Z\\])rac\{/g, "$1\\frac{")
         .replace(/^rac\{/g, "\\frac{")
         .replace(/([^a-zA-Z\\])ext\{/g, "$1\\text{")
         .replace(/^ext\{/g, "\\text{");
    return s;
  };
  const esc = (value) =>
    sanitizeLatex(value).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  let panel,
    records = [],
    diagnostic = null,
    navigate = null,
    previousFocus,
    controller,
    generation = 0;
  const getLegacyHistory = () => {
    try {
      const value = JSON.parse(
        localStorage.getItem("calculus_copilot_history_v1") || "[]",
      );
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  };
  function mount() {
    if (panel) return;
    panel = document.createElement("dialog");
    panel.className = "fa-console";
    panel.hidden = true;
    panel.setAttribute("aria-labelledby", "fa-title");
    panel.innerHTML = `<header class="fa-head"><div class="fa-brand"><span class="fa-brand-mark">▱</span><span>strive<span>.</span></span></div><button class="fa-back" id="fa-back">← Back to notebook</button></header><div class="fa-hero"><div><span class="fa-eyebrow">A QUIET LOOK AT YOUR LEARNING</span><h1 id="fa-title">Your progress</h1><p class="fa-muted" id="fa-scope">All practice · Saved on this device</p></div><p class="fa-hero-note">Small steps become understanding.<br>Here’s what your work is beginning to show.</p></div><nav class="fa-nav" aria-label="Analytics views"><div class="fa-tabs" role="tablist"><button class="fa-tab" role="tab" aria-selected="true" aria-controls="fa-overview" id="fa-overview-tab" data-view="overview">Overview</button><button class="fa-tab" role="tab" aria-selected="false" aria-controls="fa-history" id="fa-history-tab" data-view="history">Practice history</button></div><div class="fa-actions"><span class="fa-muted" id="fa-updated">Reflection not generated</span><button id="fa-analyze">Reflect on my practice</button></div></nav><div id="fa-notice" role="status" aria-live="polite"></div><section id="fa-overview" role="tabpanel" aria-labelledby="fa-overview-tab"><div class="fa-metrics" id="fa-metrics"></div><div class="fa-grid"><section class="fa-insights"><div class="fa-section-heading"><span class="fa-eyebrow">YOUR LEARNING, IN FOCUS</span><h2>What your work is showing</h2></div><div id="fa-summary"></div><div class="fa-sections" id="fa-sections"></div></section><section class="fa-recent-card"><div class="fa-history-head"><div><span class="fa-eyebrow">RECENT PRACTICE</span><h2>Your working trail</h2></div><button id="fa-all-history">View all</button></div><div id="fa-recent"></div></section></div></section><section id="fa-history" role="tabpanel" aria-labelledby="fa-history-tab" hidden><div class="fa-history-head fa-history-page-head"><div><span class="fa-eyebrow">EVERY STEP COUNTS</span><h2>Practice history</h2></div><span class="fa-muted" id="fa-history-count"></span></div><div id="fa-all"></div></section><section id="fa-details" class="fa-details" hidden tabindex="-1"></section><footer class="fa-foot"><span>Think on paper. Find your own way.</span><span>Accuracy reflects recorded checks. Mastery is an AI estimate based on your practice history.</span></footer>`;
    document.body.append(panel);
    panel.querySelector("#fa-back").onclick = close;
    panel.addEventListener("cancel", (event) => {
      event.preventDefault();
      close();
    });
    panel
      .querySelectorAll("[data-view]")
      .forEach((b) => (b.onclick = () => setView(b.dataset.view)));
    panel.querySelector(".fa-tabs").onkeydown = (event) => {
      if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        const view =
          event.key === "Home"
            ? "overview"
            : event.key === "End"
              ? "history"
              : panel
                    .querySelector('[data-view="overview"]')
                    .getAttribute("aria-selected") === "true"
                ? "history"
                : "overview";
        setView(view);
        panel.querySelector(`[data-view="${view}"]`).focus();
      }
    };
    panel.querySelector("#fa-all-history").onclick = () => setView("history");
    panel.querySelector("#fa-analyze").onclick = analyze;
    panel.addEventListener("click", (event) => {
      const row = event.target.closest("[data-attempt]");
      if (row) showAttempt(Number(row.dataset.attempt));
    });
    panel.addEventListener("keydown", (event) => {
      event.stopPropagation();
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
      if (event.key === "Tab") {
        const focusable = [
          ...panel.querySelectorAll('button:not(:disabled),[tabindex="0"]'),
        ].filter((e) => e.getClientRects().length);
        const first = focusable[0],
          last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    });
  }
  function setView(view) {
    panel.querySelector("#fa-overview").hidden = view !== "overview";
    panel.querySelector("#fa-history").hidden = view !== "history";
    panel.querySelector("#fa-details").hidden = true;
    panel.querySelectorAll("[data-view]").forEach((b) => {
      b.setAttribute("aria-selected", String(b.dataset.view === view));
      b.tabIndex = b.dataset.view === view ? 0 : -1;
    });
  }
  function table(items) {
    if (!items.length)
      return '<p class="fa-empty">No practice recorded yet. Check your work in a notebook to start building a history.</p>';
    return `<div class="fa-table-wrap"><table><thead><tr><th class="fa-num">Attempt</th><th>Work / time</th><th>Result</th></tr></thead><tbody>${items.map(({ r, i }) => `<tr><td class="fa-num">${String(i + 1).padStart(2, "0")}</td><td><button class="fa-row-button" data-attempt="${i}">${esc((r.summary || r.latex || "View attempt").slice(0, 110))}</button><br><span class="fa-muted">${esc(r.timestamp || "Time unavailable")}</span></td><td><span class="fa-badge ${r.is_correct ? "" : "review"}">${r.is_correct ? "Correct" : "Review"}</span></td></tr>`).join("")}</tbody></table></div>`;
  }
  function render() {
    const total = records.length,
      correct = records.filter((r) => r.is_correct).length;
    const accuracy = total ? Math.round((correct / total) * 100) : null;
    const mastery = diagnostic
      ? Math.max(0, Math.min(100, Number(diagnostic.mastery_score) || 0))
      : null;
    panel.querySelector("#fa-metrics").innerHTML =
      `<div class="fa-mastery-card"><div class="fa-ring" style="--score:${mastery || 0}" aria-label="${mastery === null ? "Mastery not measured yet" : `Mastery ${mastery} out of 100`}"><div><strong>${mastery === null ? "—" : mastery}</strong><span>MASTERY</span></div></div><div class="fa-mastery-copy"><span class="fa-eyebrow">YOUR CURRENT PICTURE</span><h2>${mastery === null ? "Ready when you are." : mastery >= 80 ? "You’re finding your stride." : mastery >= 60 ? "Your foundation is growing." : "This is where growth begins."}</h2><p>${mastery === null ? "Complete a few checks, then reflect on your practice to reveal the patterns in your work." : "An evolving estimate based on the reasoning and patterns in this notebook."}</p></div></div><div class="fa-card"><span class="fa-metric-icon">✓</span><div><span class="fa-label">Checks on track</span><strong class="fa-value">${accuracy === null ? "—" : accuracy + "%"}</strong><span class="fa-muted">${total ? `${correct} of ${total} attempts` : "No checks yet"}</span></div></div><div class="fa-card"><span class="fa-metric-icon">↗</span><div><span class="fa-label">Practice checks</span><strong class="fa-value">${total}</strong><span class="fa-muted">${total === 1 ? "Recorded attempt" : "Recorded attempts"}</span></div></div>`;
    panel.querySelector("#fa-summary").innerHTML = diagnostic
      ? `<div class="fa-summary"><span class="fa-summary-spark">✦</span><div><span class="fa-eyebrow">A NOTE FROM YOUR TUTOR</span><p>${esc(diagnostic.overall_summary)}</p></div></div>`
      : `<div class="fa-empty-state"><span>✦</span><div><h3>${total ? "There’s something to learn here." : "Your story starts with a check."}</h3><p>${total ? "Your practice history is ready. Reflect on it to uncover what’s clicking and where to focus next." : "Once you check some work, this page will begin to reveal your strengths, habits, and next useful step."}</p></div></div>`;
    panel.querySelector("#fa-sections").innerHTML = [
      [
        "What’s clicking",
        "strong_points",
        "Ideas you’re handling with confidence",
        "strong",
      ],
      [
        "Worth another look",
        "weak_points",
        "Concepts that will reward another pass",
        "grow",
      ],
      [
        "Patterns to notice",
        "frequent_pitfalls",
        "Small habits appearing more than once",
        "notice",
      ],
      [
        "Try this next",
        "actionable_advice",
        "A few thoughtful ways forward",
        "next",
      ],
    ]
      .map(
        ([label, key, note, tone]) =>
          `<section class="fa-section ${tone}"><div class="fa-section-title"><span></span><div><h3>${label}</h3><p>${note}</p></div></div>${diagnostic && diagnostic[key]?.length ? `<ul>${diagnostic[key].map((v) => `<li>${esc(v)}</li>`).join("")}</ul>` : `<p class="fa-empty">${diagnostic ? "Nothing identified here yet." : "Waiting for your first reflection."}</p>`}</section>`,
      )
      .join("");
    const items = records.map((r, i) => ({ r, i })).reverse();
    panel.querySelector("#fa-recent").innerHTML = table(items.slice(0, 5));
    panel.querySelector("#fa-all").innerHTML = table(items);
    panel.querySelector("#fa-history-count").textContent =
      `${total} recorded ${total === 1 ? "attempt" : "attempts"}`;
    panel.querySelector("#fa-analyze").disabled = !total;
    panel.querySelector("#fa-analyze").textContent = diagnostic
      ? "Refresh my reflection"
      : total
        ? "Reflect on my practice"
        : "Complete a check to begin";
    math(panel.querySelector("#fa-summary"));
    math(panel.querySelector("#fa-sections"));
    math(panel.querySelector("#fa-recent"));
    math(panel.querySelector("#fa-all"));
  }
  function math(el) {
    if (typeof window.StriveNormalizeMath === "function") {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach((node) => {
        if (!node.parentElement?.closest(".katex"))
          node.nodeValue = window.StriveNormalizeMath(node.nodeValue);
      });
    }
    if (typeof window.renderMathInElement === "function")
      window.renderMathInElement(el, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "$", right: "$", display: false },
          { left: "\\(", right: "\\)", display: false },
          { left: "\\[", right: "\\]", display: true },
        ],
        throwOnError: false,
        trust: false,
      });
  }
  function showAttempt(index) {
    const r = records[index];
    if (!r) return;
    const detail = panel.querySelector("#fa-details");
    detail.hidden = false;
    detail.innerHTML = `<div class="fa-details-head"><h3>Attempt ${index + 1} <span class="fa-muted"> / ${esc(r.timestamp)}</span></h3><button id="fa-close-detail" aria-label="Close attempt details">Close</button></div><p>${esc(r.summary || "No summary recorded.")}</p>${r.error_clues?.length ? `<ul>${r.error_clues.map((v) => `<li><p>${esc(v)}</p></li>`).join("")}</ul>` : ""}${r.latex ? `<h4 class="fa-label">Recorded work</h4><pre>${esc(r.latex)}</pre>` : ""}${navigate && r.pageId ? '<button id="fa-go-page">Go to page ↗</button>' : ""}`;
    detail.querySelector("#fa-close-detail").onclick = () => {
      detail.hidden = true;
      panel.querySelector(`[data-attempt="${index}"]`)?.focus();
    };
    const go = detail.querySelector("#fa-go-page");
    if (go)
      go.onclick = () => {
        close();
        navigate(r);
      };
    math(detail);
    detail.focus();
    detail.scrollIntoView({ block: "nearest", behavior: "auto" });
  }
  async function analyze() {
    if (!records.length || controller) return;
    const button = panel.querySelector("#fa-analyze"),
      notice = panel.querySelector("#fa-notice"),
      version = generation;
    controller = new AbortController();
    button.disabled = true;
    button.textContent = "Finding the patterns…";
    notice.className = "fa-muted";
    notice.textContent = "Reading across your recorded attempts…";
    panel
      .querySelectorAll(".fa-card,.fa-mastery-card")
      .forEach((e) => e.classList.add("fa-loading"));
    try {
      const res = await fetch(window.striveApiUrl("/analytics"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          records: records.map((r) => ({
            timestamp: String(r.timestamp || ""),
            is_correct: !!r.is_correct,
            latex: r.latex || "",
            summary: r.summary || "",
            error_clues: r.error_clues || [],
          })),
        }),
      });
      if (!res.ok)
        throw new Error(
          "Analysis is unavailable right now. Your practice history is safe. Please try again.",
        );
      const data = await res.json();
      if (version !== generation) return;
      if (
        !Number.isFinite(data.mastery_score) ||
        ![
          "strong_points",
          "weak_points",
          "frequent_pitfalls",
          "actionable_advice",
        ].every((k) => Array.isArray(data[k]))
      )
        throw new Error("The analysis could not be read. Please try again.");
      diagnostic = data;
      render();
      notice.textContent = "";
      panel.querySelector("#fa-updated").textContent =
        `Reflected ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    } catch (error) {
      if (error.name !== "AbortError" && version === generation) {
        notice.className = "fa-error";
        notice.textContent =
          error.message || "Unable to connect. Please try again.";
      }
    } finally {
      if (version === generation) {
        controller = null;
        button.disabled = !records.length;
        button.textContent = diagnostic
          ? "Refresh my reflection"
          : "Reflect on my practice";
        panel
          .querySelectorAll(".fa-card,.fa-mastery-card")
          .forEach((e) => e.classList.remove("fa-loading"));
      }
    }
  }
  function open(options = {}) {
    mount();
    controller?.abort();
    controller = null;
    generation++;
    previousFocus = document.activeElement;
    records = Array.isArray(options.records)
      ? options.records
      : getLegacyHistory();
    diagnostic = null;
    navigate =
      typeof options.onNavigate === "function" ? options.onNavigate : null;
    panel.querySelector("#fa-scope").textContent =
      `${options.notebookName || "All practice"} · Saved on this device`;
    panel.querySelector("#fa-updated").textContent = "Reflection not generated";
    panel.querySelector("#fa-notice").textContent = "";
    panel.querySelector("#fa-analyze").textContent = "Reflect on my practice";
    setView("overview");
    render();
    panel.hidden = false;
    if (!panel.open) panel.showModal();
    panel.scrollTop = 0;
    document.getElementById("app")?.setAttribute("inert", "");
    panel.querySelector("#fa-back").focus();
  }
  function close() {
    controller?.abort();
    controller = null;
    generation++;
    if (panel?.open) panel.close();
    panel.hidden = true;
    document.getElementById("app")?.removeAttribute("inert");
    previousFocus?.focus();
  }
  window.FolioAnalytics = { open, close };
  // A notebook implementation can supply its scoped records without coupling this module to editor state.
  document.addEventListener("folio:open-analytics", (event) =>
    open(event.detail || {}),
  );
  document.addEventListener(
    "click",
    (event) => {
      if (event.target.closest('#openMastery,[data-panel="progress"]')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const options =
          typeof window.getFolioAnalyticsContext === "function"
            ? window.getFolioAnalyticsContext()
            : {};
        open(options);
      }
    },
    true,
  );
})();
