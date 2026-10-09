import { parseOtherEntries, toOptionValue, humanizeOption } from "../lib/other-option";
const eq = (a: unknown, b: unknown, m: string) => { if (JSON.stringify(a) !== JSON.stringify(b)) { console.error("FAIL", m, JSON.stringify(a), "!=", JSON.stringify(b)); process.exit(1); } };
eq(toOptionValue("Kikuyu"), "kikuyu", "simple");
eq(toOptionValue("  Forced marriage! "), "forced_marriage", "phrase");
eq(toOptionValue("Français"), "francais", "accents");
eq(parseOtherEntries("Kikuyu, Luo and Kalenjin"), ["kikuyu", "luo", "kalenjin"], "list");
eq(parseOtherEntries("other, , Luo; luo"), ["luo"], "dedupe + drop other");
eq(humanizeOption("forced_marriage"), "Forced marriage", "humanize");
console.log("other-option: all pass");
