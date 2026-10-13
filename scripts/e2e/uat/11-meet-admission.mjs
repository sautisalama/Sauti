// Two browsers in one call: the host (signed in) and a guest with only the link. The guest waits, the host
// admits them, they can talk in the call, and the host sees when the guest turns the camera off.
//   node --env-file=.env.local scripts/e2e/uat/11-meet-admission.mjs
import { createClient } from "@supabase/supabase-js";
import { BASE, accounts, check, launch, newPage, signIn, summary } from "../lib.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY;
const db = createClient(url, key, { auth: { persistSession: false } });

const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
const pick = (n) => Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
const code = `${pick(3)}-${pick(4)}-${pick(3)}`;

const { error } = await db.from("mjengo_meetings").insert({ code, mode: "video", title: "E2E admission", created_by: accounts.accounts.admin.id });
if (error) { console.error("Could not create the test meeting:", error.message); process.exit(1); }

const browser = await launch();
const host = await newPage(browser);
const guest = await newPage(browser);
try {
	await signIn(host, "admin");
	await host.goto(`${BASE}/meet/${code}`, { waitUntil: "domcontentloaded" });
	const hostName = host.getByLabel("Your name").or(host.getByPlaceholder("How should people see you?"));
	await hostName.fill("Host Tester");
	await host.getByRole("button", { name: /^Join now$/ }).click();
	await host.getByRole("button", { name: "Leave call" }).waitFor({ timeout: 30000 });
	check("Host joins straight away", true);

	await guest.goto(`${BASE}/meet/${code}`, { waitUntil: "domcontentloaded" });
	await guest.getByPlaceholder("How should people see you?").fill("Guest Tester");
	await guest.getByRole("button", { name: /^Join now$/ }).click();
	await guest.getByText("Asking to join").waitFor({ timeout: 20000 });
	check("A guest with only the link waits", true);

	await host.getByText(/wants to join|want to join/).waitFor({ timeout: 20000 });
	check("The host is told someone is waiting", true);
	await host.getByRole("button", { name: "Admit", exact: true }).click();

	await guest.getByRole("button", { name: "Leave call" }).waitFor({ timeout: 30000 });
	check("The guest is let in after being admitted", true);

	// Messages in the call.
	await guest.keyboard.press("t");
	await guest.getByLabel("Message", { exact: true }).fill("Hello from the guest");
	await guest.keyboard.press("Enter");
	await host.keyboard.press("t");
	await host.getByText("Hello from the guest").waitFor({ timeout: 20000 });
	check("Messages reach everyone in the call", true);

	// The guest turns the camera off: the host sees it.
	await guest.getByRole("button", { name: "Turn off camera" }).click();
	await host.getByText("Camera off").first().waitFor({ timeout: 20000 });
	check("The host sees that the guest's camera is off", true);

	// Polls: a question asked by the guest reaches the host.
	await guest.getByRole("button", { name: "Polls" }).click();
	await guest.getByLabel("Poll question").fill("Lunch?");
	await guest.getByLabel("Option 1").fill("Yes");
	await guest.getByLabel("Option 2").fill("No");
	await guest.getByRole("button", { name: "Start poll" }).click();
	await host.getByText("Lunch?").waitFor({ timeout: 20000 });
	check("A poll reaches everyone", true);

	// Host controls: mute everyone is offered.
	await host.getByRole("button", { name: "People" }).first().click();
	check("Host controls are shown", (await host.getByText("Mute everyone").count()) > 0);
	await host.getByRole("button", { name: "Mute everyone" }).click();
	await guest.getByRole("button", { name: "Turn on microphone" }).first().waitFor({ timeout: 20000 });
	check("The host's mute reaches the guest (the host is verified by the server)", true);
} catch (e) {
	check("Admission flow", false, String(e).slice(0, 200));
} finally {
	await db.from("mjengo_meetings").delete().eq("code", code);
	await db.from("mjengo_meeting_knocks").delete().eq("code", code);
	await browser.close();
	process.exitCode = summary() ? 1 : 0;
}
