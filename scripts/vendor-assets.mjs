import { cp, mkdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const vendor = path.join(root, "static", "vendor");
await mkdir(path.join(vendor, "katex", "contrib"), { recursive: true });
await mkdir(path.join(vendor, "katex", "fonts"), { recursive: true });
await mkdir(path.join(vendor, "supabase"), { recursive: true });

for (const file of ["katex.min.css", "katex.min.js"]) {
  await cp(
    path.join(root, "node_modules", "katex", "dist", file),
    path.join(vendor, "katex", file),
  );
}
await cp(
  path.join(root, "node_modules", "katex", "dist", "contrib", "auto-render.min.js"),
  path.join(vendor, "katex", "contrib", "auto-render.min.js"),
);
await cp(
  path.join(root, "node_modules", "katex", "dist", "fonts"),
  path.join(vendor, "katex", "fonts"),
  { recursive: true },
);
await cp(
  path.join(root, "node_modules", "@supabase", "supabase-js", "dist", "umd", "supabase.js"),
  path.join(vendor, "supabase", "supabase.js"),
);
