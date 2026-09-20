import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "dist");
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(path.join(root, "static"), path.join(dist, "static"), {
  recursive: true,
});
const source = await readFile(path.join(root, "index.html"), "utf8");
await writeFile(
  path.join(dist, "index.html"),
  source.replaceAll('="/static/', '="./static/'),
);
const apiBase = (process.env.STRIVE_API_BASE_URL || "").replace(/\/$/, "");
await writeFile(
  path.join(dist, "static", "desktop-config.js"),
  `window.STRIVE_DESKTOP_API_BASE=${JSON.stringify(apiBase)};\n`,
);
