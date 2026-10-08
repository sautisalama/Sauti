# UAT — Publishing and Learning

## Publications (admin)

| ID | P | Steps | Expected |
|---|---|---|---|
| ADM-P1 | M | **Admin → Publications → New**. Type a title and body; apply bold, a link, a table. | A `javascript:` link is rejected; other links work. |
| ADM-P2 | M | Save draft. | Saved as draft; summary and read time are computed. |
| ADM-P3 | M | View as signed-out visitor. | Draft is invisible. |
| ADM-P4 | M | Open the secret preview link. | The draft shows with a "preview" banner; a wrong token shows nothing. |
| ADM-P5 | M | Upload a Word file (`scripts/e2e/samples/e2e-sample.docx`). | Title and body fill; list and link survive; saved as draft with the original attached. |
| ADM-P6 | M | Upload a PDF. | Same, with a warning that PDF layout cannot be reproduced. |
| ADM-P7 | S | Upload a `.txt`. | Clear message: Word (.docx) or PDF only. |
| ADM-P8 | M | Publish. | Public page works; links open safely; **Other sources** lists attachments. |
| ADM-P9 | M | Check the publications inbox. | One email to `publications@sautisalama.org` with PDF and Word copies. |
| ADM-P10 | M | Home page and `/publications`, sitemap. | Newest first; the new article is listed in all three. |
| ADM-P11 | M | Unpublish. | Public page disappears. |
| ADM-P12 | M | As non-admin open admin publications. | Turned away. |

## Courses

| ID | P | Steps | Expected |
|---|---|---|---|
| ADM-C1 | M | **Admin → Courses → New**, add a module and two lessons, reorder. | Order persists. |
| ADM-C2 | M | Draft course. | Not in the public catalogue. Publish → appears. |
| LRN-01 | M | Signed out, open the course. | Outline visible; asked to sign in; lesson content redirects to sign-in and returns afterwards. |
| LRN-02 | M | Sign in, **Start**. | Enrolled; lesson 1 opens. |
| LRN-03 | M | **Complete & continue** through the lessons. | Moves to the next lesson; finishing shows **Course completed**. |
| LRN-04 | M | **Dashboard → Learning**. | Course at 100%. |
| ADM-C3 | M | **Admin → Courses → Progress**. | Learner shown with 2/2 and 100%. |
| ADM-C4 | S | In the course builder choose a feature photo. | It shows on the catalogue, the course page and My learning. A course with no photo still gets one |
