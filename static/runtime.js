"use strict";
(() => {
  const desktop = !!window.__TAURI_INTERNALS__;
  if (desktop) document.documentElement.classList.add("desktop-auth-pending");
  const configured = String(window.STRIVE_DESKTOP_API_BASE || "").replace(
    /\/$/,
    "",
  );
  const apiBase = configured || (desktop ? "http://127.0.0.1:8765" : "");
  window.StriveRuntime = { desktop, apiBase };
  window.striveApiUrl = (path) =>
    `${apiBase}${path.startsWith("/") ? path : `/${path}`}`;
})();
