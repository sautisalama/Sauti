# UAT — Survivors

Use a phone-sized browser window (the majority of users). Sign in as `survivor`, or test the anonymous flow signed out.

| ID | P | Steps | Expected |
|---|---|---|---|
| SUR-01 | M | Signed out, open the home page → report abuse. Pick two services. | Both appear as chips; a sticky **Done — 2 selected** button closes the list; the next field is not covered. |
| SUR-02 | M | Submit the report (anonymous). | A private anonymous account is created; you land on your dashboard. No real identity is stored. |
| SUR-03 | M | Record a voice note (allow the microphone). | Recording continues past a few seconds; you can play it back before sending; it is saved. |
| SUR-04 | S | Browser autofill. | Name/email/phone suggest earlier values; password managers work on sign-in/sign-up. |
| SUR-05 | M | After submitting. | Your report appears with its number of matches. Verified providers for your need are matched; an unverified one never is. |
| SUR-06 | M | Withhold consent for lawyers. | No lawyer is matched. |
| SUR-07 | M | Record-only report. | Not matched until you choose **Escalate**; escalating twice never duplicates matches. |
| SUR-08 | M | Provider accepts. | You are notified; the chat shows their greeting; you can reply. |
| SUR-09 | M | Before acceptance. | Providers cannot read your story. After acceptance, only the accepted provider can. |
| SUR-10 | M | Open another user's case link. | Not found. |
| SUR-11 | M | Voice note privacy: open the old public audio URL in a private window. | Not downloadable. The app plays it through a short-lived signed link. |
| SUR-12 | M | **Chat** list. | Real names, never "Unknown User". |
| SUR-13 | S | Open **Communities**, join a public one, post. | You see others' messages live. Leaving removes access. A private community is invisible. |
| SUR-14 | S | Open **Salama AI** and ask for the GBV helpline. | Greeting shows 1195 and emergency numbers; the answer mentions 1195. |
| SUR-15 | M | Visit `/schedule/<professional id>` signed out. | Name, title and services are shown — never email or phone. |
| SUR-16 | M | Request an appointment. | Saved as **requested**; the professional is notified; booking the same time again is refused; a past time or invalid email is refused. |
| SUR-17 | S | Request using a service provider's email. | Refused with a message to use another address. |
| SUR-18 | S | Courses: sign in, enrol, finish lessons. | Progress is saved and shown on **Learning**. |
| SUR-19 | M | Open an accepted case. Choose **My support is complete**, give 4 stars and a note. | Saved; the professional is notified; the case closes once they confirm too. |
| SUR-20 | S | The professional already closed the case. | You can still **Rate your support** once; the prompt disappears afterwards. |
| SUR-21 | M | As an unrelated survivor, try to read another user's profile or email via the app. | Nothing is returned. |
