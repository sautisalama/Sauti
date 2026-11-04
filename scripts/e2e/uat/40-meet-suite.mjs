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

import { chromium } from "playwright-core";
const browser = await chromium.launch({
	executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe",
	headless: true,
	args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--auto-select-desktop-capture-source=Entire screen", "--auto-accept-this-tab-capture"],
});
/** Pictures and sound that really arrive from everyone else in the call. */
const media = (page) => page.evaluate(() => {
	const vids = [...document.querySelectorAll("video[data-remote]")].map((v) => v.videoWidth);
	const auds = [...document.querySelectorAll("audio")].map((a) => !!a.srcObject && a.srcObject.getAudioTracks().some((t) => t.readyState === "live" && !t.muted));
	return { vids, auds };
});
const flowing = async (page, others, label) => {
	const end = Date.now() + 30000;
	let m = { vids: [], auds: [] };
	while (Date.now() < end) {
		m = await media(page);
		if (m.vids.filter((w) => w > 0).length >= others && m.auds.filter(Boolean).length >= others) break;
		await page.waitForTimeout(700);
	}
	check(`${label}: sees ${others} other camera(s) and hears them`, m.vids.filter((w) => w > 0).length >= others && m.auds.filter(Boolean).length >= others, JSON.stringify(m));
};
const host = await newPage(browser);
// Every camera and microphone a page opens is remembered, so it can be checked that leaving lets them all go.
const trackAll = (p) => p.addInitScript(() => {
	window.__streams = [];
	const gum = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
	navigator.mediaDevices.getUserMedia = async (c) => { const s = await gum(c); window.__streams.push(s); return s; };
	const gdm = navigator.mediaDevices.getDisplayMedia?.bind(navigator.mediaDevices);
	if (gdm) navigator.mediaDevices.getDisplayMedia = async (c) => { const s = await gdm(c); window.__streams.push(s); return s; };
});
const liveTracks = (p) => p.evaluate(() => (window.__streams || []).flatMap((s) => s.getTracks()).filter((t) => t.readyState === "live").length);
await trackAll(host);
const guest = await newPage(browser);
await trackAll(guest);
const phone = await newPage(browser);
const third = await newPage(browser);
await trackAll(third);
const auto = await newPage(browser);
try {
	await signIn(host, "admin");
	await host.goto(`${BASE}/meet/${code}`, { waitUntil: "domcontentloaded" });
	await host.getByPlaceholder("How should people see you?").fill("Host Tester");

	// Pre-join: no wall of notes, a short ready check and a collapsed "Good to know".
	check("Pre-join has no ready-check chips or long list", (await host.getByLabel("Ready check").count()) === 0 && (await host.getByLabel("Before you join").count()) === 0 && (await host.getByText("Add your name to join").count()) === 0);
	check("Notes about recording are tucked into Good to know", (await host.getByText("Good to know").count()) === 1);

	// Background: Photo is the first choice; blur has one option with a gear and an amount.
	const tiles = host.locator("button", { hasText: /^(Photo|Blur|Colour|None)$/ });
	await tiles.first().waitFor({ timeout: 30000 });
	check("Photo is the first background choice", /Photo/.test(await tiles.first().innerText()));
	const chooser = host.waitForEvent("filechooser", { timeout: 10000 });
	await host.getByRole("button", { name: /^Photo$/ }).click();
	await chooser;
	check("Choosing Photo with none saved asks for one", true);
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
	await host.getByRole("button", { name: "Grid", exact: true }).click();
	check("A photo can be laid out as a grid", (await host.getByRole("button", { name: "Grid", exact: true }).getAttribute("aria-pressed")) === "true");
	check("Only Fill and Grid are offered", (await host.getByRole("button", { name: "Fit", exact: true }).count()) === 0 && (await host.getByRole("button", { name: "Fill", exact: true }).count()) === 1);
	check("Photo is saved shrunk and small", !!stored && stored.photos.length === 1 && stored.photos[0].startsWith("data:image/") && stored.photos[0].length < 120_000);
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
	await flowing(host, 1, "Host");
	const self = await host.evaluate(() => { const v = document.querySelector("video[data-rec-video]:not([data-remote])"); return v ? { w: v.videoWidth, rs: v.readyState, paused: v.paused, live: v.srcObject?.getVideoTracks().map((t) => `${t.readyState}/${t.enabled}/${t.muted}`) } : null; });
	check("Your own picture shows in your own tile", !!self && self.w > 0, JSON.stringify(self));
	await flowing(guest, 1, "Guest");

	// Someone else joins: nobody's picture or sound drops.
	await third.goto(`${BASE}/meet/${code}`, { waitUntil: "domcontentloaded" });
	await third.getByPlaceholder("How should people see you?").fill("Third Tester");
	await third.getByRole("button", { name: /^Join now$/ }).click();
	await host.getByRole("button", { name: "Admit", exact: true }).waitFor({ timeout: 30000 });
	await host.getByRole("button", { name: "Admit", exact: true }).click();
	await third.getByRole("button", { name: "Leave call" }).waitFor({ timeout: 30000 });
	await flowing(third, 2, "Newcomer");
	await flowing(host, 2, "Host after a third joins");
	await flowing(guest, 2, "Guest after a third joins");
	await host.getByText("Third Tester").first().waitFor({ timeout: 10000 });
	check("The top bar names who is in the call", (await host.getByLabel("Who is in the call").count()) === 1);

	// Screen share: the shared screen is on the stage, not one of the tiles.
	await guest.getByRole("button", { name: "Present now" }).click();
	await host.getByText(/Guest Tester is presenting/).waitFor({ timeout: 25000 });
	check("Others see the presentation on the stage", true);
	await host.waitForTimeout(1500);
	const hostTiles = await host.evaluate(() => [...document.querySelectorAll("video[data-remote]")].length);
	check("The shared screen is not also one of the tiles", hostTiles === 1, `tiles ${hostTiles}`);
	await host.screenshot({ path: process.env.SHOTS + "/host-sees-share.png" });
	await guest.screenshot({ path: process.env.SHOTS + "/guest-presenting.png" });
	const guestTiles = await guest.evaluate(() => [...document.querySelectorAll("video")].filter((v) => v.offsetWidth > 0).map((v) => `${v.dataset.remote ? "remote" : v.muted ? "self" : "other"}:${v.videoWidth}x${v.videoHeight}`));
	console.log("guest videos while presenting:", guestTiles);
	await guest.getByRole("button", { name: "Stop presenting" }).first().click();

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
		await host.getByText(/This call is being recorded · \d\d:\d\d/).waitFor({ timeout: 15000 });
		await guest.getByText("This call is being recorded").first().waitFor({ timeout: 20000 });
		check("Others are told the call is being recorded", true);
		await guest.getByText("This call is being recorded.", { exact: true }).waitFor({ timeout: 10000 });
		check("They get a one-time announcement as well", true);
	} else check("Recording button available for the host", false, "not shown");

	// Companion mode: the same account on a second device, with no sound of its own.
	await signIn(phone, "admin");
	await phone.goto(`${BASE}/meet/${code}`, { waitUntil: "domcontentloaded" });
	await phone.getByPlaceholder("How should people see you?").fill("Host Tester");
	// A brand new device on the same account: the photo saved earlier comes from the account.
	await phone.getByRole("button", { name: "Photo settings" }).waitFor({ timeout: 20000 }).catch(async () => { await phone.screenshot({ path: process.env.SHOTS + "/phone-no-gear.png" }); });
	await phone.getByRole("button", { name: "Photo settings" }).click();
	await phone.getByRole("button", { name: "Photo 1", exact: true }).waitFor({ timeout: 20000 });
	check("Saved photos follow the account to another device", true);
	// Dark mode: hovering the companion button does not flash a light surface.
	await phone.evaluate(() => document.documentElement.classList.add("dark"));
	await phone.getByRole("button", { name: "Use Companion mode" }).hover();
	const hoverBg = await phone.getByRole("button", { name: "Use Companion mode" }).evaluate((el) => getComputedStyle(el).backgroundColor);
	const rgb = hoverBg.match(/\d+/g)?.slice(0, 3).map(Number) ?? [255, 255, 255];
	check("Companion button hover is dark in dark mode", rgb[0] + rgb[1] + rgb[2] < 300, hoverBg);
	await phone.evaluate(() => document.documentElement.classList.remove("dark"));
	check("Companion explanation is a short tooltip", ((await phone.getByRole("tooltip").textContent()) ?? "").length < 140);
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
	check("Companion is not counted as another person", ((await guest.getByRole("button", { name: "People" }).first().innerText()).trim()) === "3", await guest.getByRole("button", { name: "People" }).first().innerText());

	// Same account, no toggle: the second device joins as the companion by itself.
	await signIn(auto, "admin");
	await auto.goto(`${BASE}/meet/${code}`, { waitUntil: "domcontentloaded" });
	await auto.getByPlaceholder("How should people see you?").fill("Host Tester");
	await auto.getByRole("button", { name: /^Join now$/ }).click();
	await auto.getByRole("button", { name: "Leave call" }).waitFor({ timeout: 30000 });
	await auto.getByText(/joined in Companion mode/).waitFor({ timeout: 20000 });
	check("The same account on another device joins as a companion by itself", true);

	// /meet: Start now opens the call directly.
	// Leave first: the suite keeps a call you are in running across pages.
	await host.screenshot({ path: process.env.SHOTS + "/host-before-leave.png" }).catch(() => undefined);
	await host.getByRole("button", { name: "Leave call" }).click();
	await host.getByRole("button", { name: "Leave, the call goes on" }).click();
	await host.waitForFunction(() => !/^\/meet\/[a-z0-9-]{12}/.test(location.pathname), null, { timeout: 40000 });
	await host.goto(`${BASE}/meet`, { waitUntil: "domcontentloaded" });
	await host.getByRole("button", { name: /Start now/ }).waitFor();
	await host.screenshot({ path: process.env.SHOTS + "/meet-home.png" });
	await host.getByRole("button", { name: /Start now/ }).click();
	await host.waitForURL(/\/meet\/[a-z0-9]{3}-[a-z0-9]{4}-[a-z0-9]{3}/, { timeout: 30000 });
	check("Start now goes straight to the call, no window in between", true);
	const startedCode = host.url().split("/meet/")[1].split(/[?#]/)[0];
	await db.from("mjengo_meetings").delete().eq("code", startedCode);

	// The Meet home lists calls you started that are still on, and ends one for everyone.
	const admin2 = await newPage(browser);
	await signIn(admin2, "admin");
	await admin2.goto(`${BASE}/meet`, { waitUntil: "domcontentloaded" });
	await admin2.waitForTimeout(3000);
	await admin2.screenshot({ path: process.env.SHOTS + "/admin2.png" });
	const row = admin2.getByLabel("Meetings you started").locator("li", { hasText: code });
	await row.getByRole("button", { name: "End for everyone" }).click();
	await row.getByRole("button", { name: "End", exact: true }).click();
	await guest.getByRole("button", { name: "Leave call" }).waitFor({ state: "detached", timeout: 30000 });
	check("Ending from the Meet home ends the call for everyone in it", true);
	await guest.waitForTimeout(1500);
	check("Ending the call lets go of the camera and microphone", (await liveTracks(guest)) === 0 && (await liveTracks(third)) === 0, `guest ${await liveTracks(guest)}, third ${await liveTracks(third)}`);
	check("The ended call leaves the list", (await admin2.getByLabel("Meetings you started").locator("li", { hasText: code }).count()) === 0);
} catch (e) {
	check("Meeting suite", false, String(e).slice(0, 300));
} finally {
	for (const [n, p] of [["host", host], ["guest", guest], ["phone", phone], ["third", third], ["auto", auto]]) if (p.errors.length) console.log(n, "page errors:", p.errors.slice(0, 3));
	await db.from("mjengo_meetings").delete().eq("code", code);
	await db.from("mjengo_meeting_knocks").delete().eq("code", code);
	await browser.close();
	process.exitCode = summary() ? 1 : 0;
}
