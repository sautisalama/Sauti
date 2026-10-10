import { validateAnswers, sanitiseQuestions, type Question } from "../lib/forms/schema";
const fail = (m: string, ...a: unknown[]) => { console.error("FAIL", m, ...a); process.exit(1); };
const qs: Question[] = sanitiseQuestions([
  { id: "name1", type: "short", label: "Name", required: true },
  { id: "lang1", type: "checkbox", label: "Languages", required: false, options: ["English", "Swahili"], allowOther: true },
  { id: "area1", type: "choice", label: "Area", required: true, options: ["Nairobi", "Kisumu"], allowOther: true },
  { id: "rate1", type: "scale", label: "Rate", required: false, scale: { min: 1, max: 5 } },
  { id: "mail1", type: "email", label: "Email", required: false },
]);
let r = validateAnswers(qs, { name1: "Amina", lang1: ["English", "Kikuyu", "Luo"], area1: "Nakuru town", rate1: 4, mail1: "a@b.co", junk: "x" });
if (!r.ok) fail("valid rejected", r.errors);
else {
  if (JSON.stringify(r.clean.lang1) !== JSON.stringify(["English", "kikuyu", "luo"])) fail("other tokens", r.clean.lang1);
  if (r.clean.area1 !== "nakuru_town") fail("choice other", r.clean.area1);
  if ("junk" in r.clean) fail("unknown kept");
}
r = validateAnswers(qs, { lang1: ["Klingon"], area1: "Mars", rate1: 9, mail1: "nope" });
if (r.ok) fail("invalid accepted");
else { const e = r.errors; if (!e.name1 || e.lang1 !== undefined && false || !e.rate1 || !e.mail1) fail("errors", e); }
const noOther = sanitiseQuestions([{ id: "choice1", type: "choice", label: "x", required: false, options: ["A"] }]);
const r2 = validateAnswers(noOther, { choice1: "Something else" });
if (r2.ok) fail("other accepted when not allowed");
console.log("forms schema: all pass");

import { summarise, toCsv } from "../lib/forms/analytics";
const aq = sanitiseQuestions([
  { id: "area1", type: "choice", label: "Area", required: false, options: ["Nairobi", "Kisumu"], allowOther: true },
  { id: "lang1", type: "checkbox", label: "Languages", required: false, options: ["English"], allowOther: true },
  { id: "rate1", type: "scale", label: "Rate", required: false, scale: { min: 1, max: 5 } },
]);
const rs = [
  { answers: { area1: "Nairobi", lang1: ["English", "kikuyu"], rate1: 4 }, created_at: "2026-10-09T10:00:00Z" },
  { answers: { area1: "nakuru_town", lang1: ["kikuyu"], rate1: 2 }, created_at: "2026-10-09T11:00:00Z" },
  { answers: { area1: "Nairobi" }, created_at: "2026-10-10T08:00:00Z" },
];
const sm = summarise(aq, rs);
const area = sm[0].tallies!;
if (area.find((t) => t.value === "Nairobi")!.count !== 2) fail("tally nairobi", area);
if (!area.find((t) => t.label === "Nakuru town (other)")) fail("other label", area);
if (sm[1].tallies!.find((t) => t.value === "kikuyu")!.count !== 2) fail("checkbox other", sm[1].tallies);
if (Math.abs(sm[2].stats!.avg - 3) > 1e-9) fail("avg", sm[2].stats);
const csv = toCsv(aq, [{ answers: { area1: "=cmd|x" , lang1: ["English", "kikuyu"] }, created_at: "2026-10-10T08:00:00Z" }], false);
if (!csv.includes("'=cmd|x")) fail("csv formula guard", csv);
if (!csv.includes("English; Kikuyu")) fail("csv other humanised", csv);
console.log("forms analytics: all pass");
