// UAT-COM: direct messages, communities/groups, isolation between users, and the AI assistant.
import { BASE, accounts, check, launch, newPage, signIn, summary } from "../lib.mjs";
import { acc, apiAs, db, poll, sleep } from "../helpers.mjs";

const browser = await launch();
const pro = await newPage(browser);
const survivor = await newPage(browser);
await signIn(pro, "professional");
await signIn(survivor, "survivor");
const stamp = Date.now();
const NAME = `E2E Community ${stamp}`;

// ═════ A. Direct messages ═════
await pro.goto(`${BASE}/dashboard/chat`, { waitUntil: "networkidle", timeout: 120000 });
await survivor.goto(`${BASE}/dashboard/chat`, { waitUntil: "networkidle", timeout: 120000 });
check("COM-01 each party sees the other's real name in their chat list", (await survivor.getByText("E2E Lawyer").count()) >= 1 && (await pro.getByText("E2E Learner").count()) >= 1 && (await survivor.getByText("Unknown User").count()) === 0);
await survivor.getByText("E2E Lawyer").first().click();
const dm = `e2e direct message ${stamp}`;
await survivor.getByPlaceholder("Type a message...").fill(dm);
await survivor.keyboard.press("Enter");
await survivor.getByText(dm).first().waitFor({ timeout: 20000 });
await pro.getByText("E2E Learner").first().click();
await pro.getByText(dm).first().waitFor({ timeout: 25000 });
check("COM-02 a direct message arrives in real time and is stored once", (await db.from("messages").select("id").eq("content", dm)).data?.length === 1);

// ═════ B. Communities ═════
await pro.getByText("Communities", { exact: true }).first().click();
await pro.getByRole("button", { name: /Create Community/i }).click();
await pro.getByPlaceholder("Give your community a name").fill(NAME);
await pro.getByPlaceholder("What's this community about?").fill("A safe space created by the e2e suite.");
await pro.getByRole("dialog").getByRole("button", { name: /^Create$/ }).click();
const community = await poll(async () => (await db.from("communities").select("*").eq("name", NAME).maybeSingle()).data);
check("COM-03 a professional can create a community", !!community, community?.id);
check("COM-04 a new community starts with exactly one member (the creator)", community?.member_count === 1, `member_count=${community?.member_count}`);
const chat = await poll(async () => {
	const c = (await db.from("communities").select("chat_id").eq("id", community.id).single()).data;
	return c?.chat_id ? (await db.from("chats").select("id, type, metadata").eq("id", c.chat_id).single()).data : null;
});
check("COM-05 every community has its own real group chat", chat?.type === "community" && chat?.metadata?.community_id === community.id);
const creatorIn = (await db.from("chat_participants").select("user_id").eq("chat_id", chat.id)).data ?? [];
check("COM-06 the creator is automatically a participant", creatorIn.some((p) => p.user_id === acc("professional").id));

// survivor discovers, joins and posts
await survivor.getByText("Communities", { exact: true }).first().click();
await survivor.getByText(NAME).first().waitFor({ timeout: 30000 });
check("COM-07 a public community is discoverable by other users", true);
await survivor.getByText(NAME).first().click();
await survivor.getByPlaceholder("Type a message...").waitFor({ timeout: 30000 });
const joined = await poll(async () => (await db.from("community_members").select("role").eq("community_id", community.id).eq("user_id", acc("survivor").id).maybeSingle()).data);
check("COM-08 opening a public community joins it as a member", joined?.role === "member", JSON.stringify(joined));
const count = (await db.from("communities").select("member_count").eq("id", community.id).single()).data;
check("COM-09 the member count updates (2)", count?.member_count === 2, `member_count=${count?.member_count}`);
const post = `hello community ${stamp}`;
await survivor.getByPlaceholder("Type a message...").fill(post);
await survivor.keyboard.press("Enter");
await survivor.getByText(post).first().waitFor({ timeout: 20000 });
const stored = await poll(async () => (await db.from("messages").select("chat_id, sender_id").eq("content", post)).data?.[0]);
check("COM-10 a member's message is stored in the community chat", stored?.chat_id === chat.id && stored?.sender_id === acc("survivor").id);

await pro.getByText(NAME).first().click();
await pro.getByText(post).first().waitFor({ timeout: 25000 }).catch(() => undefined);
check("COM-11 other members see the message", (await pro.getByText(post).count()) >= 1);

// ═════ C. Isolation (attacks through the API) ═════
const outsider = await apiAs("survivor2");
let r = await outsider.from("messages").select("id").eq("chat_id", chat.id);
check("COM-12 a non-member cannot read a community's messages", (r.data?.length ?? 0) === 0);
r = await outsider.from("chat_participants").insert({ chat_id: chat.id, user_id: acc("survivor2").id });
check("COM-13 nobody can add themselves to a community chat directly", !!r.error, r.error?.message ?? "no error");
r = await outsider.from("chat_participants").insert({ chat_id: accounts.chatId, user_id: acc("survivor2").id });
check("COM-14 nobody can add themselves to a private conversation", !!r.error, r.error?.message ?? "no error");
r = await outsider.from("messages").select("id").eq("chat_id", accounts.chatId);
check("COM-15 a private conversation between two people stays private", (r.data?.length ?? 0) === 0);
r = await outsider.from("messages").insert({ chat_id: chat.id, sender_id: acc("survivor2").id, content: "spam", type: "text" });
check("COM-16 a non-member cannot post into a community", !!r.error, r.error?.message ?? "no error");

// a private (invite-only) community is invisible and cannot be joined
const { data: priv } = await db.from("communities").insert({ name: `E2E Private ${stamp}`, creator_id: acc("professional").id, is_public: false, member_count: 0 }).select("id").single();
r = await outsider.from("communities").select("id").eq("id", priv.id);
check("COM-17 a private community is invisible to non-members", (r.data?.length ?? 0) === 0);
r = await outsider.from("community_members").insert({ community_id: priv.id, user_id: acc("survivor2").id, role: "member" });
check("COM-18 a private community cannot be joined without an invitation", !!r.error, r.error?.message ?? "no error");
r = await outsider.from("community_members").insert({ community_id: community.id, user_id: acc("survivor2").id, role: "admin" });
check("COM-19 joining a community can never grant yourself admin", !!r.error, r.error?.message ?? "no error");

// leaving removes access
const surAPI = await apiAs("survivor");
r = await surAPI.from("community_members").delete().eq("community_id", community.id).eq("user_id", acc("survivor").id);
const still = (await db.from("chat_participants").select("user_id").eq("chat_id", chat.id).eq("user_id", acc("survivor").id)).data ?? [];
check("COM-20 leaving a community also removes access to its chat", !r.error && still.length === 0, r.error?.message ?? `participants=${still.length}`);
r = await surAPI.from("messages").select("id").eq("chat_id", chat.id);
check("COM-21 …so former members can no longer read it", (r.data?.length ?? 0) === 0);
const after = (await db.from("communities").select("member_count").eq("id", community.id).single()).data;
check("COM-22 the member count drops back (1)", after?.member_count === 1, `member_count=${after?.member_count}`);

// ═════ D. AI assistant ═════
await survivor.goto(`${BASE}/dashboard/chat`, { waitUntil: "networkidle", timeout: 120000 });
await survivor.getByText("Salama AI").first().click();
await survivor.getByText(/I'm Salama, an AI assistant/).waitFor({ timeout: 20000 });
check("COM-23 the AI assistant greets with emergency numbers", (await survivor.getByText(/1195/).count()) >= 1);
await survivor.getByPlaceholder("Type a message...").fill("What is the free GBV helpline number in Kenya?");
await survivor.keyboard.press("Enter");
let answer = "";
for (let i = 0; i < 40 && !answer; i++) {
	await sleep(1500);
	const texts = await survivor.locator("[class*=whitespace-pre-wrap], p").allInnerTexts();
	answer = texts.filter((t) => /1195/.test(t) && !/I'm Salama, an AI assistant/.test(t) && !/What is the free GBV/.test(t)).join(" ");
}
check("COM-24 the AI assistant answers a safety question correctly", !!answer, answer.slice(0, 100));
const anonCall = await (await browser.newContext()).request.post(`${BASE}/api/assistant`, { data: { messages: [{ role: "user", content: "hi" }] } });
check("COM-25 the AI endpoint refuses callers who are not signed in", anonCall.status() === 401);

// cleanup
await db.from("communities").delete().like("name", "E2E %");
await browser.close();
process.exit(summary() ? 1 : 0);
