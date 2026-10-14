// Run: node --experimental-strip-types scripts/test-meeting-detect.mts
import { detectMeetingsAndDeadlines as d } from "../lib/mail/meeting-detect.ts";
let bad = 0;
const ok = (n: string, c: unknown) => { console.log(c ? "ok  " : "FAIL", n); if (!c) bad++; };
const sent = "2026-10-14T08:00:00Z"; // Wednesday

let r = d({ subject: "Catch-up", text: "Join: https://meet.google.com/abc-defg-hij\nWhen: Thursday 15 October 2026 at 3:30 pm", sent });
ok("meet", r.meetings[0]?.provider === "meet" && r.meetings[0].start === "2026-10-15T12:30:00.000Z");
r = d({ subject: "Sync", text: "Link https://us02web.zoom.us/j/123456789?pwd=abc tomorrow at 10:00", sent });
ok("zoom + tomorrow", r.meetings[0]?.provider === "zoom" && r.meetings[0].start === "2026-10-15T07:00:00.000Z");
r = d({ subject: "Board", html: '<a href="https://teams.microsoft.com/l/meetup-join/19%3ameeting_x/0">Join</a>', sent });
ok("teams (html href)", r.meetings[0]?.provider === "teams");
r = d({ subject: "Call", text: "https://app.sautisalama.org/meet/abcd-efgh meeting on 2026-11-02 14:00", sent });
ok("sauti", r.meetings[0]?.provider === "sauti" && r.meetings[0].code === "abcd-efgh" && r.meetings[0].start === "2026-11-02T11:00:00.000Z");
r = d({ subject: "Webinar", text: "https://acme.webex.com/meet/jane", sent });
ok("webex, no time", r.meetings[0]?.provider === "webex" && !r.meetings[0].start);
r = d({ subject: "x", text: "BEGIN:VEVENT\nSUMMARY:Review\nDTSTART:20261020T070000Z\nDTEND:20261020T080000Z\nEND:VEVENT", sent });
ok("ics", r.meetings[0]?.provider === "ics" && r.meetings[0].start === "2026-10-20T07:00:00.000Z" && r.meetings[0].title === "Review");
r = d({ subject: "Report", text: "Please send the report by Friday.", sent });
ok("by Friday", r.deadlines[0]?.date === "2026-10-16");
r = d({ subject: "Grant", text: "Deadline: 30 October 2026", sent });
ok("30 October 2026", r.deadlines[0]?.date === "2026-10-30");
r = d({ subject: "Grant", text: "applications are due on October 30", sent });
ok("due on October 30", r.deadlines[0]?.date === "2026-10-30");
r = d({ subject: "Hi", text: "No later than 1 Nov 2026 please.", sent });
ok("no later than", r.deadlines[0]?.date === "2026-11-01");
r = d({ subject: "Lunch?", text: "Hello, hope you are well. Check https://example.com/meet/page and https://zoom.us/pricing", sent });
ok("no meeting", r.meetings.length === 0 && r.deadlines.length === 0);
r = d({ subject: "Newsletter", text: "Sold by Acme. Before you go, read this. By the way, until later.", sent });
ok("no false deadline", r.deadlines.length === 0);
r = d({ subject: "Old", text: "due on 1 January 2020", sent });
ok("past ignored", r.deadlines.length === 0);
process.exit(bad ? 1 : 0);
