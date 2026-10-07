import { launch, newPage, signIn } from "./lib.mjs";
import { submitReport, matchesFor } from "./helpers.mjs";
const b = await launch(); const p = await newPage(b); await signIn(p, "survivor");
const id = await submitReport(p, { first_name: "E2E-Explore", required_services: ["legal", "medical"], urgency: "high" });
await new Promise((r) => setTimeout(r, 4000));
console.log("report", id, "matches", (await matchesFor(id)).length);
await b.close();
