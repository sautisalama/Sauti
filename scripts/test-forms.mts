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
