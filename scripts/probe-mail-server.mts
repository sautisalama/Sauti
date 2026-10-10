// Probes a mail server with a deliberately wrong password: proves TLS, protocol handshake and error text work.
import { testImap, testPop3, verifySmtp, explain } from "../lib/mail/client";
const host = process.argv[2] || "mail.sautisalama.org";
const user = "probe-nobody@" + host.replace(/^mail\./, "");
const row = { imap_host: host, imap_port: 993, imap_secure: true, smtp_host: host, smtp_port: 465, smtp_secure: true, username: user };
const run = async (name: string, fn: () => Promise<unknown>) => {
	try { await fn(); console.log(name, "-> unexpectedly succeeded"); }
	catch (e) { console.log(name, "->", explain(e)); }
};
await run("IMAP 993", () => testImap(row, { pass: "wrong-password" }));
await run("POP3 995", () => testPop3({ ...row, imap_port: 995 }, "wrong-password"));
await run("SMTP 465", () => verifySmtp(row, { pass: "wrong-password" }));
