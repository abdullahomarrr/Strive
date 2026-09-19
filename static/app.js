"use strict";
(() => {
  const $ = (id) => document.getElementById(id);
  const paths = {
    brand:
      '<path d="M5 3h12a2 2 0 0 1 2 2v15H7a3 3 0 0 1-3-3V5a2 2 0 0 1 1-2Z"/><path d="M8 3v14M4 17h15M12 7h4M12 10h3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    chevronDown: '<path d="m7 10 5 5 5-5"/>',
    arrowRight: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
    device:
      '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M10 18h4"/>',
    sidebar:
      '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M5.5 8h1M5.5 11h1"/>',
    chart: '<path d="M4 4v16h17M8 15v-4M13 15V7M18 15v-7"/>',
    checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    spark:
      '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/><path d="M20 2v4m-2-2h4"/>',
    pen: '<path d="m14 4 6 6M4 20l3-8L17 2l5 5L12 17l-8 3ZM7 12l5 5M4 20l4-4"/>',
    highlighter:
      '<path d="m13 3 8 8-8 8-8-8 8-8ZM5 11l-2 5 5 5 5-2M3 21h5M11 5l8 8"/>',
    eraser:
      '<path d="m14 3 7 7a2 2 0 0 1 0 3l-7 8H8l-6-6a2 2 0 0 1 0-3l9-9a2 2 0 0 1 3 0ZM7 7l10 10M12 21h10"/>',
    select:
      '<path stroke-dasharray="3 3" d="M6 3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Z"/><path d="m10 9 7 4-4 1-1 4Z"/>',
    text: '<path d="M5 4h14v4M5 8V4M12 4v16M8 20h8"/>',
    hand: '<path d="M8 12V6a1.5 1.5 0 0 1 3 0v5-7a1.5 1.5 0 0 1 3 0v7-5a1.5 1.5 0 0 1 3 0v6-3a1.5 1.5 0 0 1 3 0v7a6 6 0 0 1-6 6h-1a6 6 0 0 1-4-2l-5-6a1.5 1.5 0 0 1 2-2l2 2"/>',
    undo: '<path d="m8 5-5 5 5 5M3 10h11a6 6 0 0 1 0 12" transform="translate(0 -2)"/>',
    redo: '<path d="m16 5 5 5-5 5M21 10H10a6 6 0 0 0 0 12" transform="translate(0 -2)"/>',
    trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
    fit: '<path d="M8 4H4v4m12-4h4v4M4 16v4h4m12-4v4h-4M8 12h8m-6-2-2 2 2 2m4-4 2 2-2 2"/>',
    copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  };
  const icon = (name) =>
    `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.brand}</svg>`;
  document
    .querySelectorAll("[data-icon]")
    .forEach((el) => (el.innerHTML = icon(el.dataset.icon)));
  const escapeHtml = (text) =>
    String(text ?? "").replace(
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
  const clearSelectionButton = document.createElement("button");
  clearSelectionButton.className = "clear-selection";
  clearSelectionButton.innerHTML = icon("close");
  clearSelectionButton.setAttribute("aria-label", "Clear selection");
  clearSelectionButton.title = "Clear selection";
  clearSelectionButton.onclick = () => {
    selection = null;
    showSelection();
  };
  const selectionActions = document.createElement("div");
  selectionActions.className = "selection-actions";
  const selectionCheck = document.createElement("button");
  selectionCheck.type = "button";
  selectionCheck.className = "selection-action primary-action";
  selectionCheck.textContent = "Check work";
  selectionCheck.onclick = () => callTutor("check_logic");
  const selectionHint = document.createElement("button");
  selectionHint.type = "button";
  selectionHint.className = "selection-action";
  selectionHint.textContent = "Get a hint";
  const selectionHintMenu = document.createElement("div");
  selectionHintMenu.className = "selection-hint-menu";
  selectionHintMenu.hidden = true;
  selectionHintMenu.innerHTML =
    '<span>WHAT ARE YOU STUCK ON?</span><button type="button" data-hint-focus="start">I don’t know how to start</button><button type="button" data-hint-focus="next_step">I’m stuck on the next step</button><button type="button" data-hint-focus="rule">I don’t understand this rule</button><button type="button" data-hint-focus="direction">I want to verify my direction</button>';
  selectionHint.onclick = () => {
    selectionHintMenu.hidden = !selectionHintMenu.hidden;
  };
  selectionHintMenu.querySelectorAll("button").forEach((button) => {
    button.onclick = () => {
      selectionHintMenu.hidden = true;
      callTutor("get_hint", { hintFocus: button.dataset.hintFocus });
    };
  });
  selectionActions.append(selectionCheck, selectionHint, selectionHintMenu);
  $("selection").append(clearSelectionButton, selectionActions);
  const id = () => crypto.randomUUID();
  const WIDTH = 850,
    HEIGHT = 1100,
    STORE = "folio_notebooks_v1";
  const coverColors = [
    "#476f66",
    "#49647d",
    "#a88065",
    "#8d8298",
    "#9c9b70",
    "#566367",
  ];
  function applyNotebookTheme(notebookColor) {
    const hasNotebook = coverColors.includes(notebookColor);
    document.documentElement.classList.toggle("notebook-open", hasNotebook);
    if (hasNotebook)
      document.documentElement.style.setProperty(
        "--notebook-accent",
        notebookColor,
      );
    else document.documentElement.style.removeProperty("--notebook-accent");
  }
  const inkColors = [
    ["#263b47", "Graphite"],
    ["#416eac", "Blue"],
    ["#ba6258", "Terracotta"],
    ["#478575", "Green"],
    ["#b59243", "Ochre"],
  ];
  const newPage = (paper) => ({ id: id(), paper: paper || "blank", items: [] });
  const newBook = (title, color, paper = "blank") => ({
    id: id(),
    title,
    color,
    pages: [newPage(paper)],
    history: [],
    updated: Date.now(),
    opened: Date.now(),
  });
  let books = [],
    tabs = [],
    activeId = null,
    pageIndex = 0,
    tool = "pen",
    color = inkColors[0][0],
    width = 2,
    penStyle = "fountain",
    penStabilization = 0.25,
    pressureResponse = 0.5,
    highlighterOpacity = 0.25,
    straightHighlighter = false,
    zoom = 1,
    selection = null,
    currentStroke = null,
    interaction = null,
    spaceHeld = false,
    dirty = false;
  let textPosition = null,
    editingId = null,
    dialogMode = "create",
    selectedCover = coverColors[0],
    requestController = null,
    requestVersion = 0,
    toastTimer;
  const undoStacks = new Map(),
    redoStacks = new Map();
  function notify(message) {
    $("toast").textContent = message;
    $("toast").hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ($("toast").hidden = true), 4000);
  }
  try {
    const raw = localStorage.getItem(STORE);
    if (raw) {
      const saved = JSON.parse(raw);
      if (
        !Array.isArray(saved.books) ||
        saved.books.some((b) => !Array.isArray(b.pages) || !b.pages.length)
      )
        throw Error("Invalid notebook data");
      books = saved.books;
      tabs = (saved.tabs || []).filter((t) => books.some((b) => b.id === t));
    }
  } catch (e) {
    notify(
      "Saved notebooks could not be loaded. Existing storage has not been overwritten.",
    );
    dirty = true;
  }
  if (!books.length && !dirty) {
    books = [
      newBook("Calculus I", coverColors[0], "grid"),
      newBook("Discrete mathematics", coverColors[1], "lined"),
      newBook("Room to think", coverColors[2]),
    ];
  }
  const book = () => books.find((b) => b.id === activeId),
    page = () => book()?.pages[pageIndex];
  window.getFolioAnalyticsContext = () => ({
    notebookName: book()?.title,
    records: book()?.history || [],
    onNavigate: (record) => {
      const index = book()?.pages.findIndex((p) => p.id === record.pageId);
      if (index >= 0) setPage(index);
    },
  });
  function persist() {
    try {
      localStorage.setItem(STORE, JSON.stringify({ books, tabs }));
      $("saveStatus").textContent = "Saved on this device";
      dirty = false;
      return true;
    } catch (e) {
      dirty = true;
      $("saveStatus").textContent = "Not saved — storage full";
      notify(
        "Device storage is full. Keep this tab open; your latest changes are not saved.",
      );
      return false;
    }
  }
  function changed() {
    if (!book()) return;
    book().updated = Date.now();
    persist();
    renderPages();
    updateUndo();
  }
  window.addEventListener("beforeunload", (event) => {
    if (dirty) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
  function renderTabs() {
    const el = $("notebookTabs");
    el.replaceChildren();
    tabs.forEach((tabId) => {
      const b = books.find((n) => n.id === tabId);
      if (!b) return;
      const tab = document.createElement("div");
      tab.className = "notebook-tab" + (activeId === b.id ? " active" : "");
      const open = document.createElement("button");
      open.textContent = b.title;
      open.setAttribute("role", "tab");
      open.setAttribute("aria-selected", String(activeId === b.id));
      open.onclick = () => openBook(b.id);
      const close = document.createElement("button");
      close.className = "tab-close";
      close.innerHTML = icon("close");
      close.title = "Close " + b.title;
      close.setAttribute("aria-label", close.title);
      close.onclick = () => {
        tabs = tabs.filter((t) => t !== b.id);
        if (activeId === b.id) showLibrary();
        renderTabs();
        persist();
      };
      tab.append(open, close);
      el.append(tab);
    });
  }
  function renderLibrary() {
    $("notebookCount").textContent = String(books.length);
    const grid = $("notebookGrid");
    grid.replaceChildren();
    [...books]
      .sort((a, b) => b.opened - a.opened)
      .forEach((b) => {
        const card = document.createElement("button");
        card.className = "notebook-card";
        card.setAttribute("aria-label", "Open " + b.title);
        card.innerHTML = `<div class="book-cover" style="--cover:${coverColors.includes(b.color) ? b.color : coverColors[0]}"><div class="cover-content"><span class="cover-kicker">STRIVE / NOTEBOOK</span><span class="cover-title">${escapeHtml(b.title)}</span><span class="cover-rule"></span><div class="cover-bottom"><span>ROOM FOR IDEAS</span>${icon("brand")}</div></div></div><div class="notebook-meta"><h3>${escapeHtml(b.title)}</h3><p>${b.pages.length} ${b.pages.length === 1 ? "page" : "pages"} <span> · </span> ${new Date(b.updated).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</p></div>`;
        card.onclick = () => openBook(b.id);
        grid.append(card);
      });
    const add = document.createElement("button");
    add.className = "new-book";
    add.innerHTML = `<span>${icon("plus")}</span>Start something new`;
    add.onclick = () => openNotebookDialog();
    grid.append(add);
  }
  function cancelRequest() {
    requestVersion++;
    requestController?.abort();
    requestController = null;
    setBusy(false);
  }
  function resetPageUI() {
    selection = null;
    currentStroke = null;
    interaction = null;
    cancelText();
    $("selection").hidden = true;
    $("errorPins").replaceChildren();
    emptyFeedback();
    updateCheckLabel();
  }
  function runAppTransition(kind, update) {
    const root = document.documentElement;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (kind === "switch") {
      update();
      if (!reducedMotion) {
        const editor = $("editor");
        editor.classList.remove("notebook-switch-settle");
        requestAnimationFrame(() =>
          editor.classList.add("notebook-switch-settle"),
        );
      }
      return;
    }
    if (!document.startViewTransition || reducedMotion) {
      update();
      const surface = $("library").hidden ? $("editor") : $("library");
      surface.classList.remove("surface-enter");
      requestAnimationFrame(() => surface.classList.add("surface-enter"));
      return;
    }
    root.dataset.transition = kind;
    const transition = document.startViewTransition(update);
    transition.finished.finally(() => {
      if (root.dataset.transition === kind) delete root.dataset.transition;
    });
  }
  function showLibrary() {
    finishDrawing();
    cancelRequest();
    runAppTransition("library", () => {
      activeId = null;
      applyNotebookTheme();
      $("editor").hidden = true;
      $("library").hidden = false;
      renderTabs();
      renderLibrary();
    });
  }
  function openBook(bookId) {
    finishDrawing();
    cancelRequest();
    $("toolSettingsPopover").hidden = true;
    const kind = activeId && activeId !== bookId ? "switch" : "open";
    runAppTransition(kind, () => {
      activeId = bookId;
      applyNotebookTheme(book().color);
      pageIndex = Math.min(book().lastPage || 0, book().pages.length - 1);
      book().opened = Date.now();
      if (!tabs.includes(bookId)) tabs.push(bookId);
      $("library").hidden = true;
      $("editor").hidden = false;
      $("documentTitle").textContent = book().title;
      resetPageUI();
      renderTabs();
      renderPages();
      draw();
      fitPage();
      persist();
      renderProgress();
    });
  }
  function setPage(index) {
    finishDrawing();
    cancelRequest();
    pageIndex = index;
    book().lastPage = index;
    resetPageUI();
    renderPages();
    draw();
    persist();
    $("viewport").scrollTop = 0;
  }
  function renderPages() {
    if (!page()) return;
    const list = $("pageList");
    list.replaceChildren();
    book().pages.forEach((p, index) => {
      const btn = document.createElement("button");
      btn.className = "page-thumb" + (index === pageIndex ? " active" : "");
      btn.setAttribute("aria-label", `Page ${index + 1}`);
      btn.setAttribute("aria-current", index === pageIndex ? "page" : "false");
      const sheet = document.createElement("span");
      sheet.className = "thumb-sheet";
      const c = document.createElement("canvas");
      c.width = 170;
      c.height = 220;
      renderPage(c, p);
      sheet.append(c);
      const label = document.createElement("span");
      label.textContent = String(index + 1).padStart(2, "0");
      btn.append(sheet, label);
      btn.onclick = () => setPage(index);
      list.append(btn);
    });
    $("pageCount").textContent = book().pages.length;
    $("pageIndicator").textContent =
      `PAGE ${pageIndex + 1} OF ${book().pages.length}`;
    $("paperStyle").value = page().paper;
    window.refreshPaperPicker?.();
    updateUndo();
  }
  function openNotebookDialog(rename = false) {
    dialogMode = rename ? "rename" : "create";
    selectedCover = rename
      ? book().color
      : coverColors[books.length % coverColors.length];
    $("dialogTitle").textContent = rename ? "Make it yours" : "A new notebook";
    $("notebookName").value = rename ? book().title : "";
    $("newPaper").value = rename ? page().paper : "blank";
    $("newPaper").disabled = rename;
    $("saveNotebook").innerHTML =
      (rename ? "Save changes" : "Create notebook") + icon("arrowRight");
    renderCoverColors();
    $("notebookDialog").showModal();
    $("notebookName").focus();
  }
  function renderCoverColors() {
    $("coverColors").innerHTML = "";
    coverColors.forEach((c, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cover-color" + (c === selectedCover ? " active" : "");
      btn.style.setProperty("--cover", c);
      btn.setAttribute(
        "aria-label",
        ["Sage", "Slate blue", "Clay", "Lavender", "Olive", "Graphite"][i],
      );
      btn.setAttribute("aria-pressed", String(c === selectedCover));
      btn.onclick = () => {
        selectedCover = c;
        renderCoverColors();
      };
      $("coverColors").append(btn);
    });
  }
  $("notebookForm").onsubmit = (e) => {
    e.preventDefault();
    const title = $("notebookName").value.trim();
    if (!title) {
      $("notebookName").focus();
      return;
    }
    if (dialogMode === "rename") {
      book().title = title;
      book().color = selectedCover;
      applyNotebookTheme(book().color);
      changed();
      $("documentTitle").textContent = title;
      renderTabs();
    } else {
      const b = newBook(title, selectedCover, $("newPaper").value);
      books.push(b);
      openBook(b.id);
    }
    $("notebookDialog").close();
  };
  ["newNotebook", "newNotebookTop"].forEach(
    (key) => ($(key).onclick = () => openNotebookDialog()),
  );
  $("homeButton").onclick = showLibrary;
  $("renameNotebook").onclick = () => openNotebookDialog(true);
  ["closeDialog", "cancelDialog"].forEach(
    (key) => ($(key).onclick = () => $("notebookDialog").close()),
  );
  $("addPage").onclick = () => {
    finishDrawing();
    book().pages.push(newPage(page().paper));
    setPage(book().pages.length - 1);
    changed();
  };
  function setPagesRailCollapsed(collapsed) {
    const rail = $("pagesRail");
    rail.classList.toggle("collapsed", collapsed);
    rail.inert = collapsed;
    rail.setAttribute("aria-hidden", String(collapsed));
    $("togglePages").classList.toggle("collapsed", collapsed);
    $("togglePages").setAttribute("aria-expanded", String(!collapsed));
  }
  $("togglePages").onclick = () => {
    setPagesRailCollapsed(!$("pagesRail").classList.contains("collapsed"));
  };
  const canvas = $("pageCanvas"),
    ctx = canvas.getContext("2d");
  canvas.width = WIDTH * 2;
  canvas.height = HEIGHT * 2;
  canvas.style.width = WIDTH + "px";
  canvas.style.height = HEIGHT + "px";
  function background(context, style) {
    context.fillStyle = "#fffefa";
    context.fillRect(0, 0, WIDTH, HEIGHT);
    context.lineWidth = 0.6;
    context.strokeStyle = style === "lined" ? "#dce5dd" : "#e3e8df";
    if (style === "grid" || style === "lined") {
      context.beginPath();
      for (
        let y = style === "lined" ? 72 : 28;
        y < HEIGHT;
        y += style === "lined" ? 34 : 28
      ) {
        context.moveTo(0, y);
        context.lineTo(WIDTH, y);
      }
      if (style === "grid")
        for (let x = 28; x < WIDTH; x += 28) {
          context.moveTo(x, 0);
          context.lineTo(x, HEIGHT);
        }
      context.stroke();
      if (style === "lined") {
        context.strokeStyle = "#e6c7bd";
        context.beginPath();
        context.moveTo(72, 0);
        context.lineTo(72, HEIGHT);
        context.stroke();
      }
    } else if (style === "dotted") {
      context.fillStyle = "#d5dfd2";
      for (let y = 28; y < HEIGHT; y += 28)
        for (let x = 28; x < WIDTH; x += 28) {
          context.beginPath();
          context.arc(x, y, 0.85, 0, Math.PI * 2);
          context.fill();
        }
    }
  }
  function textLines(context, text, maxWidth) {
    const lines = [];
    for (const line of text.split("\n")) {
      let current = "";
      for (const char of line) {
        if (context.measureText(current + char).width > maxWidth && current) {
          lines.push(current);
          current = char;
        } else current += char;
      }
      lines.push(current);
    }
    return lines;
  }
  function drawItem(context, item) {
    context.save();
    if (item.type === "text") {
      context.font = `${item.size}px Georgia,serif`;
      context.fillStyle = item.color;
      context.textBaseline = "top";
      textLines(context, item.text, Math.max(30, WIDTH - item.x - 25)).forEach(
        (line, i) =>
          context.fillText(line, item.x, item.y + i * item.size * 1.5),
      );
      context.restore();
      return;
    }
    context.globalCompositeOperation =
      item.type === "eraser" ? "destination-out" : "source-over";
    context.globalAlpha =
      item.opacity ?? (item.type === "highlighter" ? 0.25 : 1);
    context.strokeStyle = item.color;
    context.fillStyle = item.color;
    const averagePressure = item.points?.length
      ? item.points.reduce((sum, p) => sum + (p.pressure || 0.5), 0) /
        item.points.length
      : 0.5;
    const pressureScale =
      item.type === "pen"
        ? 1 + (averagePressure - 0.5) * 1.2 * (item.pressureResponse ?? 0)
        : 1;
    const styleScale = item.penStyle === "brush" ? 1.35 : 1;
    context.lineWidth = item.width * pressureScale * styleScale;
    context.lineCap = "round";
    context.lineJoin = "round";
    const points = item.points;
    if (points.length === 1) {
      context.beginPath();
      context.arc(points[0].x, points[0].y, item.width / 2, 0, Math.PI * 2);
      context.fill();
    } else if (points.length) {
      context.beginPath();
      context.moveTo(points[0].x, points[0].y);
      // Midpoint curves keep the tangent continuous between input samples.
      // Erasing remains exact; smoothing is only applied to writing tools.
      if (item.type === "eraser") {
        for (let i = 1; i < points.length; i++)
          context.lineTo(points[i].x, points[i].y);
      } else {
        for (let i = 1; i < points.length - 1; i++) {
          const p = points[i],
            next = points[i + 1];
          context.quadraticCurveTo(
            p.x,
            p.y,
            (p.x + next.x) / 2,
            (p.y + next.y) / 2,
          );
        }
        const last = points[points.length - 1];
        context.lineTo(last.x, last.y);
      }
      context.stroke();
    }
    context.restore();
  }
  const inkCanvas = document.createElement("canvas");
  inkCanvas.width = WIDTH * 2;
  inkCanvas.height = HEIGHT * 2;
  function renderPage(target, p, preview = null, region = null) {
    const context = target.getContext("2d");
    context.save();
    context.clearRect(0, 0, target.width, target.height);
    const r = region || { x: 0, y: 0, w: WIDTH, h: HEIGHT };
    context.scale(target.width / r.w, target.height / r.h);
    context.translate(-r.x, -r.y);
    background(context, p.paper);
    const ink = inkCanvas.getContext("2d");
    ink.setTransform(2, 0, 0, 2, 0, 0);
    ink.clearRect(0, 0, WIDTH, HEIGHT);
    p.items.forEach((item) => drawItem(ink, item));
    if (preview) drawItem(ink, preview);
    context.drawImage(inkCanvas, 0, 0, WIDTH, HEIGHT);
    context.restore();
  }
  function draw() {
    if (page()) renderPage(canvas, page(), currentStroke);
  }
  function snapshot() {
    if (!page()) return;
    const stack = undoStacks.get(page().id) || [];
    stack.push(JSON.stringify({ items: page().items, paper: page().paper }));
    if (stack.length > 40) stack.shift();
    undoStacks.set(page().id, stack);
    redoStacks.set(page().id, []);
  }
  function updateUndo() {
    $("undo").disabled = !undoStacks.get(page()?.id)?.length;
    $("redo").disabled = !redoStacks.get(page()?.id)?.length;
  }
  function undo(redo = false) {
    if (!page()) return;
    finishDrawing();
    const from = redo ? redoStacks : undoStacks,
      to = redo ? undoStacks : redoStacks;
    const stack = from.get(page().id) || [];
    if (!stack.length) return;
    const other = to.get(page().id) || [];
    other.push(JSON.stringify({ items: page().items, paper: page().paper }));
    to.set(page().id, other);
    Object.assign(page(), JSON.parse(stack.pop()));
    clearFeedbackPins();
    draw();
    changed();
  }
  $("undo").onclick = () => undo();
  $("redo").onclick = () => undo(true);
  $("paperStyle").onchange = () => {
    snapshot();
    page().paper = $("paperStyle").value;
    draw();
    changed();
  };
  $("clearPage").onclick = () => {
    if (!page().items.length) return;
    if (!confirm("Clear this page? You can undo this change.")) return;
    snapshot();
    page().items = [];
    resetPageUI();
    draw();
    changed();
  };
  function showToolSettings(next) {
    if (next !== "pen" && next !== "highlighter") {
      $("toolSettingsPopover").hidden = true;
      return;
    }
    const popover = $("toolSettingsPopover");
    popover.dataset.tool = next;
    $("toolSettingsTitle").textContent = next === "pen" ? "Pen" : "Highlighter";
    $("penSettings").hidden = next !== "pen";
    $("highlighterSettings").hidden = next !== "highlighter";
    popover.hidden = false;
    const anchor = document.querySelector(`[data-tool="${next}"]`);
    const deskRect = document
      .querySelector(".desk-column")
      .getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    const anchorX = anchorRect.left + anchorRect.width / 2 - deskRect.left;
    const left = Math.max(
      12,
      Math.min(anchorX - 28, deskRect.width - popover.offsetWidth - 12),
    );
    popover.style.setProperty("--tool-popover-left", left + "px");
    popover.style.setProperty(
      "--tool-popover-arrow-left",
      Math.max(20, Math.min(popover.offsetWidth - 20, anchorX - left)) + "px",
    );
  }
  function chooseTool(next, openSettings = false, allowToggle = true) {
    finishDrawing();
    const wasActive = tool === next;
    tool = next;
    document.querySelectorAll("[data-tool]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tool === tool);
      btn.setAttribute("aria-pressed", String(btn.dataset.tool === tool));
    });
    $("widthOptions").hidden = tool === "text";
    $("textSize").hidden = tool !== "text";
    canvas.style.cursor =
      tool === "hand"
        ? "grab"
        : tool === "text"
          ? "text"
          : tool === "eraser"
            ? "cell"
            : "crosshair";
    $("toolHint").textContent = {
      pen: "A blank page. A fresh perspective.",
      highlighter: "Bring the important things into focus.",
      eraser: "Make room for a different approach.",
      select: "Drag around the work you want your tutor to check.",
      text: "Click to write. Click existing text to edit.",
      hand: "Drag to explore. Pinch or Ctrl/⌘ scroll to zoom.",
    }[tool];
    const hasSettings = next === "pen" || next === "highlighter";
    if (
      wasActive &&
      hasSettings &&
      !$("toolSettingsPopover").hidden &&
      $("toolSettingsPopover").dataset.tool === next
    ) {
      $("toolSettingsPopover").hidden = true;
    } else if (openSettings || (allowToggle && wasActive && hasSettings)) {
      showToolSettings(next);
    } else if (!hasSettings) {
      $("toolSettingsPopover").hidden = true;
    }
  }
  document
    .querySelectorAll("[data-tool]")
    .forEach((btn) => (btn.onclick = () => chooseTool(btn.dataset.tool)));
  $("closeToolSettings").onclick = () =>
    ($("toolSettingsPopover").hidden = true);
  document.querySelectorAll("[data-pen-style]").forEach((btn) => {
    btn.onclick = () => {
      penStyle = btn.dataset.penStyle;
      document
        .querySelectorAll("[data-pen-style]")
        .forEach((item) => item.classList.toggle("active", item === btn));
    };
  });
  $("stabilizationSetting").oninput = (event) => {
    penStabilization = Number(event.target.value) / 100;
    $("stabilizationValue").textContent = event.target.value + "%";
  };
  $("pressureSetting").oninput = (event) => {
    pressureResponse = Number(event.target.value) / 100;
    $("pressureValue").textContent = event.target.value + "%";
  };
  $("opacitySetting").oninput = (event) => {
    highlighterOpacity = Number(event.target.value) / 100;
    $("opacityValue").textContent = event.target.value + "%";
    $("highlighterSettings").style.setProperty(
      "--highlighter-opacity",
      highlighterOpacity,
    );
  };
  $("straightHighlighter").onchange = (event) =>
    (straightHighlighter = event.target.checked);
  window.addEventListener("resize", () => {
    if (!$("toolSettingsPopover").hidden) showToolSettings(tool);
  });
  document.querySelectorAll("[data-width]").forEach(
    (btn) =>
      (btn.onclick = () => {
        width = Number(btn.dataset.width);
        document
          .querySelectorAll("[data-width]")
          .forEach((b) => b.classList.toggle("active", b === btn));
      }),
  );
  inkColors.forEach(([c, name]) => {
    const btn = document.createElement("button");
    btn.className = "ink-color" + (color === c ? " active" : "");
    btn.style.setProperty("--color", c);
    btn.title = name + " ink";
    btn.setAttribute("aria-label", btn.title);
    btn.setAttribute("aria-pressed", String(color === c));
    btn.onclick = () => {
      color = c;
      document.querySelectorAll(".ink-color").forEach((b) => {
        b.classList.toggle("active", b === btn);
        b.setAttribute("aria-pressed", String(b === btn));
      });
    };
    $("colorOptions").append(btn);
  });
  const viewport = $("viewport");
  let fitMode = true;
  function setZoom(value, anchor) {
    const rect = viewport.getBoundingClientRect();
    const a = anchor || {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    const before = $("paper").getBoundingClientRect();
    const logical = {
      x: (a.x - before.left) / zoom,
      y: (a.y - before.top) / zoom,
    };
    zoom = Math.min(2.5, Math.max(0.3, value));
    $("paper").style.transform = `scale(${zoom})`;
    const annotationBoost = zoom < 0.55 ? 1.24 : zoom < 0.8 ? 1.14 : 1;
    $("paper").style.setProperty(
      "--annotation-scale",
      String(annotationBoost / zoom),
    );
    $("pageStage").style.width = WIDTH * zoom + "px";
    $("pageStage").style.height = HEIGHT * zoom + "px";
    $("pageStage").style.marginLeft =
      WIDTH * zoom + 60 > viewport.clientWidth ? "30px" : "auto";
    $("pageStage").style.marginRight =
      WIDTH * zoom + 60 > viewport.clientWidth ? "30px" : "auto";
    $("zoomReset").textContent = Math.round(zoom * 100) + "%";
    const after = $("paper").getBoundingClientRect();
    viewport.scrollLeft += after.left + logical.x * zoom - a.x;
    viewport.scrollTop += after.top + logical.y * zoom - a.y;
  }
  function fitPage() {
    setZoom(Math.min(1, (viewport.clientWidth - 72) / WIDTH));
    fitMode = true;
    viewport.scrollTop = 0;
    viewport.scrollLeft = 0;
  }
  $("zoomIn").onclick = () => {
    fitMode = false;
    setZoom(zoom * 1.15);
  };
  $("zoomOut").onclick = () => {
    fitMode = false;
    setZoom(zoom / 1.15);
  };
  $("zoomReset").onclick = () => {
    fitMode = false;
    setZoom(1);
  };
  $("zoomFit").onclick = fitPage;
  new ResizeObserver(() => {
    if (activeId) {
      if (fitMode) {
        setZoom(Math.min(1, (viewport.clientWidth - 72) / WIDTH));
      } else setZoom(zoom);
    }
  }).observe(viewport);
  viewport.addEventListener(
    "wheel",
    (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        fitMode = false;
        setZoom(zoom * Math.exp(-e.deltaY * 0.008), {
          x: e.clientX,
          y: e.clientY,
        });
      }
    },
    { passive: false },
  );
  function point(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(WIDTH, (e.clientX - rect.left) / zoom)),
      y: Math.max(0, Math.min(HEIGHT, (e.clientY - rect.top) / zoom)),
      pressure: e.pressure || 0.5,
    };
  }
  function clearFeedbackPins() {
    $("errorPins").replaceChildren();
  }
  function placeAnnotationWithoutOverlap(annotation) {
    const note = annotation.querySelector(".error-note");
    const otherNotes = [
      ...$("errorPins").querySelectorAll(".error-note"),
    ].filter((candidate) => candidate !== note);
    if (!note || !otherNotes.length) return;
    const gap = 10;
    const overlaps = (a, b) =>
      a.left < b.right + gap &&
      a.right + gap > b.left &&
      a.top < b.bottom + gap &&
      a.bottom + gap > b.top;
    const isClear = () => {
      const rect = note.getBoundingClientRect();
      return !otherNotes.some((other) =>
        overlaps(rect, other.getBoundingClientRect()),
      );
    };
    const original = annotation.classList.contains("stacked")
      ? "stacked"
      : annotation.classList.contains("align-left")
        ? "left"
        : "right";
    const layouts = [original, "right", "left", "stacked"].filter(
      (layout, index, all) => all.indexOf(layout) === index,
    );
    const applyLayout = (layout) => {
      annotation.classList.toggle("align-left", layout === "left");
      annotation.classList.toggle("stacked", layout === "stacked");
      note.style.removeProperty("top");
      note.style.removeProperty("--connector-height");
    };
    for (const layout of layouts) {
      applyLayout(layout);
      if (isClear()) return;
    }
    applyLayout("stacked");
    const boost = zoom < 0.55 ? 1.24 : zoom < 0.8 ? 1.14 : 1;
    const noteStep = note.getBoundingClientRect().height / boost + 12;
    for (let step = 1; step <= otherNotes.length + 2; step += 1) {
      const top = 46 + step * noteStep;
      note.style.top = top + "px";
      note.style.setProperty(
        "--connector-height",
        Math.max(14, top - 32) + "px",
      );
      if (isClear()) return;
    }
  }
  function updateCheckLabel() {
    $("checkWork").querySelector("span").textContent = selection
      ? "Check selection"
      : "Check work";
  }
  function showSelection() {
    if (!selection) {
      $("selection").hidden = true;
      selectionHintMenu.hidden = true;
      updateCheckLabel();
      return;
    }
    const s = $("selection");
    s.hidden = false;
    s.style.left = selection.x + "px";
    s.style.top = selection.y + "px";
    s.style.width = selection.w + "px";
    s.style.height = selection.h + "px";
    s.classList.toggle(
      "actions-above",
      selection.y + selection.h > HEIGHT - 70,
    );
    updateCheckLabel();
  }
  function finishDrawing() {
    if (currentStroke && page()) {
      snapshot();
      page().items.push(currentStroke);
      currentStroke = null;
      changed();
      draw();
    }
    interaction = null;
  }
  const pointers = new Map();
  let pinch = null;
  viewport.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button,textarea,.text-editor")) return;
    if (e.pointerType === "mouse" && e.button !== 0 && e.button !== 1) return;
    viewport.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      currentStroke = null;
      interaction = null;
      draw();
      const [a, b] = [...pointers.values()];
      pinch = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom };
      return;
    }
    if (tool === "hand" || spaceHeld || e.button === 1 || e.target !== canvas) {
      interaction = {
        type: "pan",
        x: e.clientX,
        y: e.clientY,
        left: viewport.scrollLeft,
        top: viewport.scrollTop,
      };
      return;
    }
    const p = point(e);
    if (tool === "text") {
      e.preventDefault();
      const existing = findTextItem(p);
      openText(existing || p, existing);
      return;
    }
    if (tool === "select") {
      selection = null;
      showSelection();
      interaction = { type: "select", start: p };
      return;
    }
    if (!$("textEditor").hidden) commitText();
    clearFeedbackPins();
    currentStroke = {
      type: tool,
      color,
      penStyle,
      pressureResponse,
      stabilization: penStabilization,
      opacity: tool === "highlighter" ? highlighterOpacity : 1,
      straight: tool === "highlighter" && straightHighlighter,
      width:
        tool === "eraser"
          ? width * 5 + 15
          : tool === "highlighter"
            ? width * 3 + 13
            : width,
      points: [p],
    };
    interaction = { type: "draw" };
    draw();
  });
  viewport.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size >= 2) {
      fitMode = false;
      const [a, b] = [...pointers.values()];
      setZoom(
        (pinch.zoom * Math.hypot(a.x - b.x, a.y - b.y)) /
          Math.max(1, pinch.distance),
        { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      );
      return;
    }
    if (!interaction) return;
    if (interaction.type === "pan") {
      viewport.scrollLeft = interaction.left + interaction.x - e.clientX;
      viewport.scrollTop = interaction.top + interaction.y - e.clientY;
      return;
    }
    const p = point(e);
    if (interaction.type === "select") {
      const a = interaction.start;
      selection = {
        x: Math.min(a.x, p.x),
        y: Math.min(a.y, p.y),
        w: Math.abs(a.x - p.x),
        h: Math.abs(a.y - p.y),
      };
      showSelection();
    } else if (currentStroke) {
      const coalesced = e.getCoalescedEvents?.();
      const events = coalesced?.length ? coalesced : [e];
      for (const evt of events) {
        const next = point(evt);
        const previous = currentStroke.points[currentStroke.points.length - 1];
        if (currentStroke.straight) {
          currentStroke.points = [currentStroke.points[0], next];
          continue;
        }
        const distance = Math.hypot(next.x - previous.x, next.y - previous.y);
        if (distance < 0.4) continue;
        // A short, distance-adaptive stabilizer damps hand tremor without
        // dragging behind fast strokes or flattening small mathematical marks.
        let follow =
          currentStroke.type === "eraser"
            ? 1
            : Math.min(1, 0.45 + distance / 12);
        if (currentStroke.type === "pen")
          follow = Math.max(
            0.2,
            follow * (1 - currentStroke.stabilization * 0.65),
          );
        currentStroke.points.push({
          x: previous.x + (next.x - previous.x) * follow,
          y: previous.y + (next.y - previous.y) * follow,
          pressure: next.pressure,
        });
      }
      draw();
    }
  });
  function pointerEnd(e) {
    if (currentStroke && pointers.has(e.pointerId)) {
      const end = point(e);
      const last = currentStroke.points[currentStroke.points.length - 1];
      if (Math.hypot(end.x - last.x, end.y - last.y) > 0.4)
        currentStroke.points.push(end);
    }
    pointers.delete(e.pointerId);
    if (viewport.hasPointerCapture(e.pointerId))
      viewport.releasePointerCapture(e.pointerId);
    if (pinch) {
      if (pointers.size === 0) pinch = null;
      interaction = null;
      return;
    }
    if (
      interaction?.type === "select" &&
      selection &&
      (selection.w < 15 || selection.h < 15)
    ) {
      selection = null;
      showSelection();
    }
    finishDrawing();
  }
  viewport.addEventListener("pointerup", pointerEnd);
  viewport.addEventListener("pointercancel", (e) => {
    currentStroke = null;
    pointerEnd(e);
    draw();
  });
  function openText(p, item = null) {
    if (!$("textEditor").hidden) commitText();
    textPosition = {
      x: Math.min(p.x, WIDTH - 80),
      y: Math.min(p.y, HEIGHT - 60),
    };
    editingId = item?.id || null;
    if (item?.size) $("textSize").value = String(item.size);
    $("textInput").value = item?.text || "";
    $("textEditor").style.left = textPosition.x + "px";
    $("textEditor").style.top = textPosition.y + "px";
    $("textEditor").style.width =
      Math.max(120, Math.min(430, WIDTH - textPosition.x - 20)) + "px";
    $("textInput").style.fontSize = $("textSize").value + "px";
    $("textEditor").hidden = false;
    $("textInput").focus();
    $("textInput").setSelectionRange(
      $("textInput").value.length,
      $("textInput").value.length,
    );
    resizeInlineText();
  }
  function cancelText() {
    $("textEditor").hidden = true;
    textPosition = null;
    editingId = null;
  }
  function commitText() {
    const text = $("textInput").value.trim();
    if (!text || !textPosition) {
      cancelText();
      return;
    }
    snapshot();
    const previous = page().items.find((i) => i.id === editingId);
    if (previous) previous.text = text;
    else
      page().items.push({
        id: id(),
        type: "text",
        ...textPosition,
        text,
        color,
        size: Number($("textSize").value),
      });
    cancelText();
    clearFeedbackPins();
    draw();
    changed();
  }
  function resizeInlineText() {
    const input = $("textInput");
    input.style.height = "auto";
    input.style.height =
      Math.max(Number($("textSize").value) * 1.55, input.scrollHeight) + "px";
  }
  $("textSize").onchange = () => {
    $("textInput").style.fontSize = $("textSize").value + "px";
    resizeInlineText();
  };
  $("textInput").oninput = resizeInlineText;
  $("textInput").onblur = () => {
    if (!$("textEditor").hidden) commitText();
  };
  $("textInput").onkeydown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      commitText();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelText();
    }
  };
  function findTextItem(p) {
    return [...page().items].reverse().find((i) => {
      if (i.type !== "text") return false;
      ctx.save();
      ctx.font = `${i.size}px Georgia,serif`;
      const lines = textLines(ctx, i.text, Math.max(30, WIDTH - i.x - 25));
      const w = Math.max(...lines.map((l) => ctx.measureText(l).width));
      ctx.restore();
      return (
        p.x >= i.x &&
        p.x <= i.x + w + 10 &&
        p.y >= i.y &&
        p.y <= i.y + lines.length * i.size * 1.5
      );
    });
  }
  window.addEventListener("keydown", (e) => {
    if (e.target.closest("input,textarea,select") || $("notebookDialog").open)
      return;
    if (!activeId) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === "z") {
      e.preventDefault();
      undo(e.shiftKey);
      return;
    }
    if (mod) return;
    if (e.code === "Space") {
      e.preventDefault();
      spaceHeld = true;
      canvas.style.cursor = "grab";
    }
    const shortcuts = {
      p: "pen",
      h: "highlighter",
      e: "eraser",
      s: "select",
      t: "text",
      v: "hand",
    };
    if (shortcuts[e.key.toLowerCase()])
      chooseTool(shortcuts[e.key.toLowerCase()]);
    if (e.key === "Escape") {
      selection = null;
      showSelection();
      cancelText();
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "Space") {
      spaceHeld = false;
      canvas.style.cursor =
        tool === "hand" ? "grab" : tool === "text" ? "text" : "crosshair";
    }
  });
  window.addEventListener("blur", () => {
    spaceHeld = false;
    finishDrawing();
    pointers.clear();
    pinch = null;
  });
  function math(el) {
    if (window.renderMathInElement)
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
  function openPanel(view = "feedback") {
    $("tutorPanel").hidden = false;
    $("tutorPanel").classList.toggle("progress-mode", view === "progress");
    $("toggleTutor").setAttribute("aria-expanded", "true");
    $("panelEyebrow").textContent =
      view === "progress" ? "YOUR LEARNING, IN FOCUS" : "A SECOND PAIR OF EYES";
    $("panelTitle").textContent =
      view === "progress" ? "Your progress" : "Your tutor";
    document
      .querySelectorAll("[data-panel]")
      .forEach((btn) =>
        btn.classList.toggle("active", btn.dataset.panel === view),
      );
    $("feedbackView").hidden = view !== "feedback";
    $("progressView").hidden = view !== "progress";
    if (view === "progress") renderProgress();
  }
  function closePanel() {
    $("tutorPanel").hidden = true;
    $("toggleTutor").setAttribute("aria-expanded", "false");
  }
  $("toggleTutor").onclick = () => callTutor("get_hint");
  $("closeTutor").onclick = closePanel;
  $("openMastery").onclick = () => openPanel("progress");
  document
    .querySelectorAll("[data-panel]")
    .forEach((btn) => (btn.onclick = () => openPanel(btn.dataset.panel)));
  function emptyFeedback() {
    $("feedbackContent").innerHTML =
      `<div class="empty-tutor"><div class="tutor-glyph">${icon("spark")}</div><h3>A nudge in the<br>right direction.</h3><p>Work through a problem at your own pace. When you need a second look, I’m here to help you find your next step.</p><div class="tutor-tip">Check the whole page, or use the selection tool to focus on a particular part.</div></div>`;
  }
  function setBusy(busy) {
    $("checkWork").disabled = busy;
    $("toggleTutor").disabled = busy;
    $("getHint").disabled = busy;
    $("analyzeProgress").disabled = busy;
    selectionCheck.disabled = busy;
    selectionHint.disabled = busy;
    selectionHintMenu
      .querySelectorAll("button")
      .forEach((button) => (button.disabled = busy));
  }
  function feedbackError(message) {
    $("feedbackContent").innerHTML =
      '<div class="feedback-status error">Couldn’t reach your tutor</div>';
    const p = document.createElement("p");
    p.className = "feedback-summary";
    p.textContent = message;
    $("feedbackContent").append(p);
  }
  async function api(path, payload) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: requestController.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok)
      throw Error(
        typeof data.detail === "string"
          ? data.detail
          : `The tutor is unavailable (HTTP ${response.status}). Try again in a moment.`,
      );
    return data;
  }
  async function recheckIssue({
    annotation,
    item,
    title,
    message,
    noteLabel,
    noteMessage,
    pin,
    button,
    pageX,
    pageY,
    problemLabel,
  }) {
    const cropWidth = 380;
    const cropHeight = 260;
    const region = {
      x: Math.max(0, Math.min(WIDTH - cropWidth, pageX - cropWidth / 2)),
      y: Math.max(0, Math.min(HEIGHT - cropHeight, pageY - cropHeight / 2)),
      w: cropWidth,
      h: cropHeight,
    };
    const output = document.createElement("canvas");
    output.width = cropWidth;
    output.height = cropHeight;
    renderPage(output, page(), null, region);
    cancelRequest();
    requestController = new AbortController();
    setBusy(true);
    button.disabled = true;
    button.textContent = "Rechecking…";
    try {
      const data = await api("/tutor", {
        image_data: output.toDataURL("image/png").split(",")[1],
        action_type: "check_logic",
        is_selection: true,
      });
      if (data.is_correct_so_far && !(data.errors || []).length) {
        annotation.classList.add("resolved");
        pin.textContent = "✓";
        noteLabel.textContent = "Corrected";
        noteMessage.textContent = "This step now looks sound.";
        item.classList.add("resolved");
        title.textContent = `✓ ${problemLabel}`;
        message.textContent = "Your revision resolved this issue.";
        button.remove();
        const targetBook = book();
        targetBook.history = targetBook.history || [];
        targetBook.history.push({
          timestamp: new Date().toISOString(),
          is_correct: true,
          latex: data.current_latex || "",
          summary: `Corrected: ${problemLabel}`,
          error_clues: [],
          pageId: page().id,
        });
        changed();
        setTimeout(() => {
          annotation.classList.add("dismissed");
          annotation.addEventListener(
            "animationend",
            () => annotation.remove(),
            { once: true },
          );
        }, 1400);
      } else {
        const remaining = (data.errors || [])[0];
        const nextMessage =
          remaining?.correction_message ||
          data.status_message ||
          "This step still needs another look.";
        message.textContent = nextMessage;
        noteMessage.textContent = nextMessage;
        item.classList.remove("recheck-needed");
        void item.offsetWidth;
        item.classList.add("recheck-needed");
        button.textContent = "Recheck again";
        math(noteMessage);
      }
    } catch (error) {
      notify(error.message || "Couldn’t recheck this step.");
      button.textContent = "Recheck this";
    } finally {
      setBusy(false);
      if (button.isConnected) button.disabled = false;
    }
  }
  async function callTutor(action, options = {}) {
    finishDrawing();
    if (!$("textEditor").hidden) commitText();
    if (!page().items.length) {
      notify("Add some working to the page first.");
      return;
    }
    cancelRequest();
    const version = requestVersion;
    requestController = new AbortController();
    const targetBook = book(),
      targetPage = page(),
      scope = selection ? { ...selection } : null;
    openPanel();
    setBusy(true);
    $("feedbackContent").innerHTML =
      action === "get_hint"
        ? '<div class="feedback-status"><span class="loading-dot"></span>Finding a gentle nudge</div><p class="feedback-summary">Looking for the smallest idea that can help you move forward…</p>'
        : '<div class="feedback-status"><span class="loading-dot"></span>Taking a closer look</div><p class="feedback-summary">Checking your reasoning, one step at a time…</p>';
    clearFeedbackPins();
    const output = document.createElement("canvas");
    output.width = Math.ceil(scope?.w || WIDTH);
    output.height = Math.ceil(scope?.h || HEIGHT);
    renderPage(output, targetPage, null, scope);
    try {
      const data = await api("/tutor", {
        image_data: output.toDataURL("image/png").split(",")[1],
        action_type: action,
        is_selection: !!scope,
        hint_focus: options.hintFocus || null,
      });
      if (version !== requestVersion) return;
      const root = $("feedbackContent");
      root.replaceChildren();
      const status = document.createElement("div");
      status.className =
        "feedback-status" +
        (action === "check_logic" && !data.is_correct_so_far ? " error" : "");
      status.innerHTML = icon(action === "get_hint" ? "spark" : "checkCircle");
      status.append(
        document.createTextNode(
          action === "get_hint"
            ? "Something to think about"
            : data.is_correct_so_far
              ? "You’re on the right track"
              : "Let’s take another look",
        ),
      );
      root.append(status);
      const summary = document.createElement("p");
      summary.className = "feedback-summary";
      summary.textContent =
        action === "get_hint"
          ? data.faint_hint || data.status_message
          : data.status_message;
      root.append(summary);
      if (action === "get_hint") {
        const normalizeHintLocation = (value, fallback) => {
          const number = Number(value);
          if (!Number.isFinite(number)) return fallback;
          return Math.max(
            0.025,
            Math.min(0.975, number > 1 ? number / 100 : number),
          );
        };
        const x = normalizeHintLocation(data.hint_location_x, 0.5);
        const y = normalizeHintLocation(data.hint_location_y, 0.5);
        const pageX = (scope?.x || 0) + x * (scope?.w || WIDTH);
        const pageY = (scope?.y || 0) + y * (scope?.h || HEIGHT);
        const paperRect = $("paper").getBoundingClientRect();
        const viewportRect = viewport.getBoundingClientRect();
        const anchorScreenX = paperRect.left + pageX * zoom;
        const roomRight = viewportRect.right - anchorScreenX;
        const roomLeft = anchorScreenX - viewportRect.left;
        const annotationBoost = zoom < 0.55 ? 1.24 : zoom < 0.8 ? 1.14 : 1;
        const annotationFootprint = 332 * annotationBoost + 16;
        const placement =
          roomRight >= annotationFootprint
            ? ""
            : roomLeft >= annotationFootprint
              ? " align-left"
              : " stacked";
        const annotation = document.createElement("div");
        annotation.className = `error-annotation hint-annotation${placement}`;
        annotation.style.left = pageX + "px";
        annotation.style.top = pageY + "px";
        const pin = document.createElement("button");
        pin.className = "error-pin";
        pin.textContent = "✦";
        pin.setAttribute("aria-label", "Open this hint in the tutor panel");
        const note = document.createElement("div");
        note.className = "error-note";
        note.setAttribute("role", "button");
        note.tabIndex = 0;
        note.setAttribute("aria-label", "Open this hint in the tutor panel");
        const noteLabel = document.createElement("span");
        noteLabel.className = "error-note-label";
        noteLabel.textContent = "Something to think about";
        const noteMessage = document.createElement("span");
        noteMessage.className = "error-note-message";
        noteMessage.textContent = data.faint_hint || data.status_message;
        const closeAnnotation = document.createElement("button");
        closeAnnotation.className = "error-note-close";
        closeAnnotation.type = "button";
        closeAnnotation.textContent = "×";
        closeAnnotation.setAttribute("aria-label", "Dismiss hint annotation");
        note.append(noteLabel, noteMessage, closeAnnotation);
        const openHint = () => openPanel();
        const dismissHint = (event) => {
          event.stopPropagation();
          annotation.classList.add("dismissed");
          annotation.addEventListener(
            "animationend",
            () => annotation.remove(),
            { once: true },
          );
        };
        pin.onclick = openHint;
        note.onclick = openHint;
        note.onkeydown = (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openHint();
          }
        };
        closeAnnotation.onclick = dismissHint;
        annotation.append(pin, note);
        $("errorPins").append(annotation);
        math(noteMessage);
        placeAnnotationWithoutOverlap(annotation);
      }
      if (action === "check_logic") {
        (data.errors || []).forEach((err, index) => {
          const item = document.createElement("div");
          item.className = "feedback-error";
          item.id = "feedback-error-" + index;
          const title = document.createElement("div");
          title.className = "error-label";
          title.textContent = `${index + 1}. ${err.problem_label || "Review this step"}`;
          const message = document.createElement("p");
          message.textContent = err.correction_message;
          const recheckButton = document.createElement("button");
          recheckButton.type = "button";
          recheckButton.className = "recheck-issue";
          recheckButton.textContent = "Recheck this";
          item.append(title, message, recheckButton);
          root.append(item);
          const normalizeLocation = (value, fallback) => {
            const number = Number(value);
            if (!Number.isFinite(number)) return fallback;
            // Tolerate percentage-like model output while preserving the
            // normalized 0–1 coordinate contract.
            return Math.max(
              0.025,
              Math.min(0.975, number > 1 ? number / 100 : number),
            );
          };
          const x = normalizeLocation(err.error_location_x, 0.5);
          const y = normalizeLocation(err.error_location_y, 0.5);
          const pageX = (scope?.x || 0) + x * (scope?.w || WIDTH);
          const pageY = (scope?.y || 0) + y * (scope?.h || HEIGHT);
          const paperRect = $("paper").getBoundingClientRect();
          const viewportRect = viewport.getBoundingClientRect();
          const anchorScreenX = paperRect.left + pageX * zoom;
          const roomRight = viewportRect.right - anchorScreenX;
          const roomLeft = anchorScreenX - viewportRect.left;
          const annotationBoost = zoom < 0.55 ? 1.24 : zoom < 0.8 ? 1.14 : 1;
          const annotationFootprint = 332 * annotationBoost + 16;
          const placement =
            roomRight >= annotationFootprint
              ? ""
              : roomLeft >= annotationFootprint
                ? " align-left"
                : " stacked";
          const annotation = document.createElement("div");
          annotation.className = `error-annotation${placement}`;
          annotation.style.left = pageX + "px";
          annotation.style.top = pageY + "px";

          const pin = document.createElement("button");
          pin.className = "error-pin";
          pin.textContent = index + 1;
          pin.setAttribute(
            "aria-label",
            `Open feedback for ${err.problem_label || "error"}`,
          );
          const note = document.createElement("div");
          note.className = "error-note";
          note.setAttribute("role", "button");
          note.tabIndex = 0;
          note.setAttribute(
            "aria-label",
            `Open feedback for ${err.problem_label || `issue ${index + 1}`}`,
          );
          const noteLabel = document.createElement("span");
          noteLabel.className = "error-note-label";
          noteLabel.textContent = `${index + 1}. ${err.problem_label || "Review this step"}`;
          const noteMessage = document.createElement("span");
          noteMessage.className = "error-note-message";
          noteMessage.textContent = err.correction_message;
          const closeAnnotation = document.createElement("button");
          closeAnnotation.className = "error-note-close";
          closeAnnotation.type = "button";
          closeAnnotation.textContent = "×";
          closeAnnotation.setAttribute(
            "aria-label",
            `Dismiss ${err.problem_label || `issue ${index + 1}`} annotation`,
          );
          note.append(noteLabel, noteMessage, closeAnnotation);
          const openFeedback = () => {
            openPanel();
            item.scrollIntoView({ block: "nearest", behavior: "smooth" });
          };
          const dismissAnnotation = (event) => {
            event.stopPropagation();
            annotation.classList.add("dismissed");
            annotation.addEventListener(
              "animationend",
              () => annotation.remove(),
              {
                once: true,
              },
            );
          };
          pin.onclick = openFeedback;
          note.onclick = openFeedback;
          note.onkeydown = (event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openFeedback();
            }
          };
          closeAnnotation.onclick = dismissAnnotation;
          recheckButton.onclick = () =>
            recheckIssue({
              annotation,
              item,
              title,
              message,
              noteLabel,
              noteMessage,
              pin,
              button: recheckButton,
              pageX,
              pageY,
              problemLabel: err.problem_label || `Problem ${index + 1}`,
            });
          annotation.append(pin, note);
          $("errorPins").append(annotation);
          math(noteMessage);
          placeAnnotationWithoutOverlap(annotation);
        });
        targetBook.history = targetBook.history || [];
        targetBook.history.push({
          timestamp: new Date().toISOString(),
          is_correct: data.is_correct_so_far,
          latex: data.current_latex || "",
          summary: data.status_message || "",
          error_clues: (data.errors || []).map(
            (e) => `${e.problem_label}: ${e.correction_message}`,
          ),
          pageId: targetPage.id,
        });
        targetBook.diagnostic = null;
        persist();
      }
      math(root);
    } catch (error) {
      if (error.name !== "AbortError" && version === requestVersion)
        feedbackError(error.message);
    } finally {
      if (version === requestVersion) {
        setBusy(false);
        requestController = null;
      }
    }
  }
  $("checkWork").onclick = () => callTutor("check_logic");
  $("getHint").onclick = () => callTutor("get_hint");
  function renderProgress() {
    if (!book()) return;
    const history = book().history || [],
      total = history.length,
      correct = history.filter((h) => h.is_correct).length,
      accuracy = total ? Math.round((correct / total) * 100) : null;
    const root = $("progressContent");
    const data = book().diagnostic;
    const mastery = data
      ? Math.max(0, Math.min(100, Number(data.mastery_score) || 0))
      : accuracy;

    const intro = document.createElement("div");
    intro.className = "progress-intro";
    intro.innerHTML = `<span class="progress-kicker">${escapeHtml(book().title)}</span><h3>${total ? "Your thinking is taking shape." : "Every page begins somewhere."}</h3><p>${total ? "A quiet look at what’s clicking, what needs another pass, and where to go next." : "Check your work as you go. Your learning story will gather here, one attempt at a time."}</p>`;
    root.replaceChildren(intro);

    const overview = document.createElement("div");
    overview.className = "progress-overview";
    overview.innerHTML = `<div class="mastery-ring" style="--score:${mastery ?? 0}" aria-label="${mastery === null ? "Mastery not measured yet" : `Mastery ${mastery} out of 100`}"><div><strong>${mastery === null ? "—" : mastery}</strong><span>${mastery === null ? "NOT YET MEASURED" : "MASTERY"}</span></div></div><div class="progress-metrics"><div class="progress-metric"><span class="metric-icon">${icon("checkCircle")}</span><div><strong>${accuracy === null ? "—" : accuracy + "%"}</strong><span>On track</span></div></div><div class="progress-metric"><span class="metric-icon">${icon("chart")}</span><div><strong>${total}</strong><span>${total === 1 ? "Check made" : "Checks made"}</span></div></div></div>`;
    root.append(overview);

    if (data) {
      const section = document.createElement("div");
      section.className = "progress-section";
      const summaryCard = document.createElement("div");
      summaryCard.className = "progress-reflection";
      summaryCard.innerHTML = `<span>${icon("spark")}</span><div><small>A NOTE FROM YOUR TUTOR</small></div>`;
      const summary = document.createElement("p");
      summary.textContent = data.overall_summary;
      summaryCard.lastElementChild.append(summary);
      section.append(summaryCard);
      for (const [key, title, subtitle, tone] of [
        [
          "strong_points",
          "What’s clicking",
          "Ideas you’re handling with confidence",
          "strong",
        ],
        [
          "weak_points",
          "Worth another look",
          "Concepts that will reward another pass",
          "grow",
        ],
        [
          "frequent_pitfalls",
          "Patterns to notice",
          "Small habits showing up more than once",
          "notice",
        ],
        [
          "actionable_advice",
          "Try this next",
          "A few thoughtful ways forward",
          "next",
        ],
      ]) {
        if (!(data[key] || []).length) continue;
        const group = document.createElement("section");
        group.className = `insight-group ${tone}`;
        const heading = document.createElement("div");
        heading.className = "insight-heading";
        heading.innerHTML = `<span class="insight-mark"></span><div><h4>${title}</h4><p>${subtitle}</p></div>`;
        group.append(heading);
        const ul = document.createElement("ul");
        for (const value of data[key] || []) {
          const li = document.createElement("li");
          li.textContent = value;
          ul.append(li);
        }
        group.append(ul);
        section.append(group);
      }
      root.append(section);
      math(section);
    } else {
      const section = document.createElement("div");
      section.className = "progress-empty";
      section.innerHTML = `<span>${icon("spark")}</span><div><h4>${total ? "Ready for a closer look" : "Your story starts here"}</h4><p>${total ? "You have enough practice to uncover a few patterns. Ask for an analysis whenever you’re ready." : "Once you check some work, this space will reveal your strengths, recurring patterns, and best next step."}</p></div>`;
      root.append(section);
    }
    if (total) {
      const historySection = document.createElement("section");
      historySection.className = "practice-history";
      historySection.innerHTML = `<div class="practice-history-heading"><div><span>RECENT PRACTICE</span><h4>Your working trail</h4></div><small>${Math.min(total, 8)} of ${total}</small></div><div class="practice-timeline"></div>`;
      const timeline = historySection.lastElementChild;
      history
        .slice(-8)
        .reverse()
        .forEach((attempt) => {
          const row = document.createElement("div");
          row.className = `history-row ${attempt.is_correct ? "pass" : "review"}`;
          const dot = document.createElement("span");
          dot.className = "history-dot";
          dot.innerHTML = icon(attempt.is_correct ? "checkCircle" : "spark");
          const content = document.createElement("div");
          const date = document.createElement("time");
          const parsed = new Date(attempt.timestamp);
          date.textContent = Number.isNaN(parsed.getTime())
            ? attempt.timestamp
            : parsed.toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });
          const label = document.createElement("p");
          label.textContent = attempt.is_correct
            ? "On the right track"
            : "Something worth revisiting";
          const detail = document.createElement("small");
          detail.textContent =
            attempt.summary ||
            (attempt.is_correct
              ? "Your reasoning held together."
              : "A useful moment to learn from.");
          content.append(date, label, detail);
          row.append(dot, content);
          timeline.append(row);
        });
      root.append(historySection);
    }
    $("analyzeProgress").disabled = !total || !!requestController;
    $("analyzeProgress").innerHTML = data
      ? `${icon("spark")} Refresh my reflection`
      : `${icon("spark")} ${total ? "Reflect on my practice" : "Complete a check to begin"}`;
  }
  $("analyzeProgress").onclick = async () => {
    if (!book()?.history?.length) return;
    cancelRequest();
    const version = requestVersion;
    requestController = new AbortController();
    setBusy(true);
    const target = book();
    $("analyzeProgress").textContent = "Finding the patterns…";
    try {
      const data = await api("/analytics", { records: target.history });
      if (version !== requestVersion) return;
      target.diagnostic = data;
      persist();
      renderProgress();
    } catch (error) {
      if (error.name !== "AbortError") notify(error.message);
    } finally {
      if (version === requestVersion) {
        requestController = null;
        setBusy(false);
        if (book()) renderProgress();
      }
    }
  };
  // Preserve the previous scratchpad's history in the first notebook during migration.
  if (!localStorage.getItem(STORE) && books.length && !dirty) {
    try {
      const history = JSON.parse(
        localStorage.getItem("calculus_copilot_history_v1") || "[]",
      );
      if (Array.isArray(history)) books[0].history = history;
    } catch {}
    persist();
  }
  if (window.innerWidth <= 600) {
    setPagesRailCollapsed(true);
  }
  emptyFeedback();
  renderLibrary();
  renderTabs();
  chooseTool("pen", false, false);
})();
