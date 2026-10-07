// Generates the Word + PDF fixtures used by uat/07-content.mjs:  npx tsx scripts/e2e/make-samples.mts
import fs from "node:fs";
import { renderDocx, renderPdf } from "../../lib/content/export.ts";

const html = `<h1>E2E Imported Report</h1>
<p>Quarterly community response summary prepared for the e2e suite.</p>
<h2>Highlights</h2>
<ul><li>Cases supported within 24 hours</li><li>Training delivered to community paralegals</li></ul>
<p>Read the <a href="https://www.who.int/health-topics/violence-against-women">WHO guidance</a> for background.</p>`;
const meta = { title: "E2E Imported Report", author: "Sauti Salama", publishedAt: "2026-01-15" };
const dir = new URL("./samples/", import.meta.url);
fs.writeFileSync(new URL("e2e-sample.docx", dir), await renderDocx(html, meta));
fs.writeFileSync(new URL("e2e-sample.pdf", dir), renderPdf(html, meta));
console.log("samples written");
