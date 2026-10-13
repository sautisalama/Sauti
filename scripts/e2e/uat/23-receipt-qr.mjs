// Finance: a receipt photo with a KRA eTIMS QR code is read on its own and filed as tax.
//   node --env-file=.env.local scripts/e2e/uat/23-receipt-qr.mjs
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QRCodeSVG } from "qrcode.react";
import { BASE, check, launch, newPage, signIn, summary } from "../lib.mjs";

const link = "https://etims.kra.go.ke/common/link/etims/receipt/indexEtimsReceiptData?Data=P051234567ZBR000123";
const svg = renderToStaticMarkup(createElement(QRCodeSVG, { value: link, size: 360, marginSize: 4, level: "M" }));

const browser = await launch();
const page = await newPage(browser);
page.setDefaultTimeout(90000);
try {
	// Draw the code to a picture, as a phone photo of a receipt would be.
	const maker = await newPage(browser);
	await maker.setContent(`<body style="margin:0;background:#fff">${svg}</body>`);
	const png = await maker.locator("svg").screenshot({ type: "png" });
	await maker.close();

	await signIn(page, "admin");
	await page.goto(`${BASE}/dashboard/mjengo/finance`, { waitUntil: "domcontentloaded", timeout: 180000 });
	await page.getByRole("button", { name: /Add a receipt/ }).click();
	await page.locator('input[type="file"][accept="image/*,application/pdf"]').setInputFiles({ name: "kra-receipt.png", mimeType: "image/png", buffer: png });
	await page.getByText(/KRA receipt: filed as tax/).first().waitFor({ timeout: 30000 });
	check("A KRA QR in a photo is read and filed as tax", true);
	const cat = await page.getByPlaceholder("Travel, supplies").inputValue();
	check("The category is Tax", /Tax/.test(cat), cat);
	const note = await page.locator("textarea").first().inputValue();
	check("The link is kept in the note", note.includes("etims.kra.go.ke"), note.slice(0, 80));
	check("The seller PIN is shown", (await page.getByText(/P051234567Z/).count()) > 0);
} catch (e) {
	check("Receipt QR flow", false, String(e).slice(0, 280));
} finally {
	await browser.close();
	process.exitCode = summary() ? 1 : 0;
}
