// The call end to end with two browsers: pre-join screen, background choices that are remembered, transcription and
// recording notices at the top for everyone, the link shared in chat, and Companion mode.
//   node --env-file=.env.local scripts/e2e/uat/40-meet-suite.mjs
import { createClient } from "@supabase/supabase-js";
import { BASE, accounts, check, launch, newPage, signIn, summary } from "../lib.mjs";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
const pick = (n) => Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
const code = `${pick(3)}-${pick(4)}-${pick(3)}`;
const { error } = await db.from("mjengo_meetings").insert({ code, mode: "video", title: "E2E suite", created_by: accounts.accounts.admin.id });
if (error) { console.error("Could not create the test meeting:", error.message); process.exit(1); }

// A real picture for the upload.
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC", "base64");

const browser = await launch();
const host = await newPage(browser);
const guest = await newPage(browser);
const phone = await newPage(browser);
try {
	await signIn(host, "admin");
	await host.goto(`${BASE}/meet/${code}`, { waitUntil: "domcontentloaded" });
	await host.getByPlaceholder("How should people see you?").fill("Host Tester");

	// Pre-join: no wall of notes, a short ready check and a collapsed "Good to know".
	check("Pre-join shows a ready check, not the long list", (await host.getByLabel("Ready check").count()) === 1 && (await host.getByLabel("Before you join").count()) === 0);
	check("Notes about recording are tucked into Good to know", (await host.getByText("Good to know").count()) === 1);

	// Background: Photo is the first choice; blur has one option with a gear and an amount.
	const tiles = host.locator("button", { hasText: /^(Photo|Blur|Colour|None)$/ });
	await tiles.first().waitFor({ timeout: 30000 });
	check("Photo is the first background choice", /Photo/.test(await tiles.first().innerText()));
	await host.getByRole("button", { name: "Blur settings" }).click();
	const slider = host.getByLabel("Amount of blur");
	await slider.waitFor();
	check("Blur has a single option with an amount", (await host.getByText("More blur").count()) === 0);
	await host.getByRole("button", { name: /^Blur$/ }).click();
	await slider.fill("80");
	await host.getByRole("button", { name: "Colour settings" }).click();
	await host.getByRole("button", { name: "Single colour" }).click();
	await host.getByRole("button", { name: "Gradient", exact: true }).click();
	check("Colour offers single or gradient", (await host.getByLabel("Second colour").count()) === 1);
	await host.getByRole("button", { name: "Photo settings" }).click();
	await host.locator('input[type=file]').first().setInputFiles({ name: "bg.png", mimeType: "image/png", buffer: png });
	await host.getByRole("button", { name: "Photo 1", exact: true }).waitFor({ timeout: 20000 });
	check("An uploaded photo joins the grid", true);
	const stored = await host.evaluate(() => JSON.parse(localStorage.getItem("ss_meet_bg_v2") || "null"));
	check("Photo is saved, shrunk, as a JPEG", !!stored && stored.photos.length === 1 && stored.photos[0].startsWith("data:image/jpeg"));
	check("The choices are remembered (mode, blur, colour)", stored?.mode?.kind === "image" && stored.blur === 80 && stored.color.gradient === true);

	// Back next time: reload and the picture is still the choice.
	await host.reload({ waitUntil: "domcontentloaded" });
	await host.getByPlaceholder("How should people see you?").fill("Host Tester");
	await host.getByRole("button", { name: "Photo settings" }).click();
	await host.getByRole("button", { name: "Photo 1", exact: true }).waitFor({ timeout: 20000 });
	check("Saved photo is there after a reload", true);

	await host.getByRole("button", { name: /^Join now$/ }).click();
	await host.getByRole("button", { name: "Leave call" }).waitFor({ timeout: 30000 });
	check("Host joins with the saved background", true);

	await guest.goto(`${BASE}/meet/${code}`, { waitUntil: "domcontentloaded" });
	await guest.getByPlaceholder("How should people see you?").fill("Guest Tester");
	await guest.getByRole("button", { name: /^Join now$/ }).click();
	await host.getByRole("button", { name: "Admit", exact: true }).waitFor({ timeout: 30000 });
	await host.getByRole("button", { name: "Admit", exact: true }).click();
	await guest.getByRole("button", { name: "Leave call" }).waitFor({ timeout: 30000 });
	check("Guest admitted", true);

	// Transcription: a bar at the top for the person doing it and for everyone else.
	await host.getByRole("button", { name: "Turn on captions" }).click();
	await host.getByText(/Transcribing · You/).waitFor({ timeout: 15000 });
	check("Host sees the transcribing bar", true);
	await guest.getByText(/Transcribing · Host Tester/).waitFor({ timeout: 20000 });
	check("Others see who is transcribing", true);
	await guest.getByText(/turned on transcription/).waitFor({ timeout: 10000 });
	check("Others are told once when it starts", true);

	// Sharing the link while the call is going.
	await guest.keyboard.press("t");
	await guest.getByRole("button", { name: /Share the meeting link here/ }).click();
	await host.keyboard.press("t");
	await host.getByText(new RegExp(`/meet/${code}`)).first().waitFor({ timeout: 20000 });
	check("The link shared in chat reaches everyone", true);

	// Recording notice (a late joiner is told too).
	const rec = host.getByRole("button", { name: "Record the meeting" });
	if (await rec.count()) {
		await rec.first().click();
		await host.getByText(/Recording \d\d:\d\d/).waitFor({ timeout: 15000 });
		await guest.getByText(/Host Tester is recording/).first().waitFor({ timeout: 20000 });
		check("Others are told the call is being recorded", true);
		await guest.getByText(/started recording this meeting/).waitFor({ timeout: 10000 });
		check("They get a one-time announcement as well", true);
	} else check("Recording button available for the host", false, "not shown");

	// Companion mode: the same account on a second device, with no sound of its own.
	await signIn(phone, "admin");
	await phone.goto(`${BASE}/meet/${code}`, { waitUntil: "domcontentloaded" });
	await phone.getByPlaceholder("How should people see you?").fill("Host Tester");
	await phone.getByRole("button", { name: "Use Companion mode" }).click();
	check("Companion join is labelled", (await phone.getByRole("button", { name: /^Join as companion$/ }).count()) === 1);
	await phone.getByRole("button", { name: /^Join as companion$/ }).click();
	await phone.getByRole("button", { name: "Leave call" }).waitFor({ timeout: 30000 });
	await phone.getByText(/Companion: sound stays on your main device/).waitFor({ timeout: 15000 });
	check("Companion is told its sound stays on the main device", true);
	await phone.getByRole("button", { name: /microphone/i }).first().click();
	await phone.getByText(/Companion mode keeps your microphone and speaker off/).waitFor({ timeout: 10000 });
	check("A companion cannot turn its microphone on", true);
	await host.getByText(/Your companion device is connected/).waitFor({ timeout: 25000 });
	check("The main device sees the companion is connected", true);
	// The companion does not appear as a second person in the grid.
	check("Companion is not counted as another face", (await guest.getByText("Host Tester (companion)").count()) === 0);
} catch (e) {
	check("Meeting suite", false, String(e).slice(0, 300));
} finally {
	for (const [n, p] of [["host", host], ["guest", guest], ["phone", phone]]) if (p.errors.length) console.log(n, "page errors:", p.errors.slice(0, 3));
	await db.from("mjengo_meetings").delete().eq("code", code);
	await db.from("mjengo_meeting_knocks").delete().eq("code", code);
	await browser.close();
	process.exitCode = summary() ? 1 : 0;
}
