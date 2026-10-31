import fs from "node:fs";
const r = JSON.parse(fs.readFileSync(process.env.TEMP + "/sauti-audit/contrast/contrast.json", "utf8"));
const agg = { light: new Map(), text: new Map(), border: new Map() };
for (const [pg, v] of Object.entries(r)) for (const k of ["light", "text", "border"]) for (const o of v[k]) { const e = agg[k].get(o.cls) ?? { n: 0, pages: new Set(), extra: o.extra, sample: o.sample }; e.n += o.n; e.pages.add(pg.split(" ")[1]); agg[k].set(o.cls, e); }
for (const k of ["light", "text", "border"]) { console.log("== " + k); [...agg[k].entries()].sort((a, b) => b[1].pages.size - a[1].pages.size || b[1].n - a[1].n).slice(0, 12).forEach(([c, e]) => console.log(e.pages.size + "p " + e.n + "x | " + c.slice(0, 90) + " | " + e.extra + " | " + e.sample.replace(/\n/g, " ").slice(0, 30))); }
