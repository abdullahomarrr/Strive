"use strict";
(() => {
  const desktop = !!window.__TAURI_INTERNALS__;
  const configured = String(window.STRIVE_DESKTOP_API_BASE || "").replace(
    /\/$/,
    "",
  );
  const apiBase = desktop
    ? configured || "http://127.0.0.1:8765"
    : "";
  window.StriveRuntime = { desktop, apiBase };
  window.striveApiUrl = (path) =>
    `${apiBase}${path.startsWith("/") ? path : `/${path}`}`;
})();
