# UAT run results

Run: 2026-10-07T22:55:43.098Z · Target: dev project · App: http://localhost:3000

**257/258 automated checks passed** across 9 suites — 1 suite(s) need attention.

| Suite | Result | Time |
|---|---|---|
| Public site (SEO, access control, anonymous reporting) | ✅ 35/35 | 21s |
| Security / row-level security attacks | ❌ 35/36 | 20s |
| UAT-VER  Admin verification of professionals, NGOs and services | ✅ 19/19 | 102s |
| UAT-RPT  Reporting and matching | ✅ 31/31 | 162s |
| UAT-CAS  Case delivery end to end | ✅ 18/18 | 297s |
| UAT-COM  Messages, communities, AI assistant | ✅ 25/25 | 67s |
| UAT-SCH  Booking and availability | ✅ 25/25 | 15s |
| UAT-MON  24h escalation monitoring | ✅ 15/15 | 7s |
| UAT-PUB/LRN  Publications, courses, learner progress | ✅ 54/54 | 165s |

## Failures

**Security / row-level security attacks**
- FAIL  SEC-26 a user cannot read other people's private profile rows  — rows=1

