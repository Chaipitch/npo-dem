# Testing Steps — ABC Hope · Christmas Giving 2026

Org alias `npo-demo`. Site: **https://te1791557923677.my.site.com/** (LWR at the domain root).
Public: `/`, `/donate`. Portal (login required): `/dashboard`, `/my-giving`, `/my-profile`.

## 0. Pre-checks

```bash
sf data query -o npo-demo -q "SELECT Name, ExpectedRevenue, EndDate FROM Campaign WHERE Name IN ('Christmas Giving 2026','Clean Water for Rural Schools','Girls'' Education Scholarships','Green Communities Tree Planting')"
sf data query -o npo-demo -q "SELECT Id, SourceCode FROM OutreachSourceCode WHERE SourceCode = 'XMAS26-EMAIL'"
```

All four campaigns and the source code exist (re-run the `scripts/apex/seed*.apex` scripts if not).
`/donate` opens in a private window without login.

## 1. Automated tests

```bash
sf apex run test -o npo-demo -n TSAbcHopeDonationIntakeServiceTest,TSAbcHopeDonationIntakeControllerTest,TSAbcHopeDonorPortalControllerTest,TSAbcHopeAgentActionsTest -c -r human -w 15
npm run test:unit
```

Pass criteria: 55 Apex test methods (add `TSAbcHopeDonorAgentControllerTest` to the run) and 33 Jest tests pass.

## 2. Public journey (private window, desktop then 375 px)

| #   | Scenario          | Steps                                                         | Expected                                                                                                                                                                                                                                       |
| --- | ----------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1  | Discover          | Open `/?src=XMAS26-EMAIL`                                     | Header (logo, nav, Donate), photo hero "Make Christmas Brighter", benefits strip                                                                                                                                                               |
| T1b | Campaign carousel | Wait 10 s; use ‹ › and the dots; hover; press ❚❚              | Moves to the next open campaign every 10 s (one slide per campaign card); arrows/dots move it; hover or pause stops it; each Donate Now opens `/donate?campaign=<name>&src=…`                                                                  |
| T1c | Our Work / About  | Header **Our Work**, then **About**                           | `/our-work`: active programs, funded ones first, with "Give through" campaign links (`/donate?campaign=…`) and cause chips; others say "No open campaign". `/about`: placeholder copy, facts, Donate / See our work, "Payment simulation only" |
| T2  | Defaults          | Click Donate Now                                              | `/donate?src=XMAS26-EMAIL`; step 1; One-time; USD 1,000; School Supplies; eyebrow Christmas Giving 2026                                                                                                                                        |
| T3  | Other amount      | Other → 50, then 2500                                         | 50 → inline error, cannot continue; 2500 → OK                                                                                                                                                                                                  |
| T4  | Recurring         | Select Recurring, then Weekly / Monthly / Yearly              | Period row appears, Monthly preselected; hint "…every week/month/year"; Review shows "Recurring · Weekly"                                                                                                                                      |
| T5  | Validation        | Next with empty name / `ann@`                                 | Field errors                                                                                                                                                                                                                                   |
| T6  | Organization      | Switch to Organization                                        | Org name shown, first/last hidden                                                                                                                                                                                                              |
| T7  | Back              | Review → Back twice                                           | Values kept                                                                                                                                                                                                                                    |
| T8  | Submit            | Ann Demo / ann@example.com / 1,000 → Submit                   | "Your details have been received", USD 1,000 School Supplies, "No payment collected in this demo"                                                                                                                                              |
| T9  | Other campaign    | Open `/donate?campaign=Clean%20Water%20for%20Rural%20Schools` | Eyebrow + description for Clean Water; Support = Clean Water (+ Where Most Needed)                                                                                                                                                             |
| T10 | Unknown campaign  | `/donate?campaign=Nope`                                       | "This campaign is not accepting donations right now."                                                                                                                                                                                          |

## 3. Back-office verification

```bash
sf data query -o npo-demo -q "SELECT Name, Donor.Name, OriginalAmount, Status, PaymentMethod, GiftType, Campaign.Name, OutreachSourceCode.SourceCode FROM GiftTransaction WHERE CreatedDate = TODAY ORDER BY CreatedDate DESC LIMIT 5"
sf data query -o npo-demo -q "SELECT GiftTransaction.Name, GiftDesignation.Name, Percent FROM GiftTransactionDesignation WHERE CreatedDate = TODAY"
sf data query -o npo-demo -q "SELECT Name, Donor.Name, Status, Campaign.Name FROM GiftCommitment WHERE CreatedDate = TODAY"
```

Expected: Status `Paid` (simulated payment recorded as received, D-27), PaymentMethod `Unknown`, correct campaign and source code, designation 100%,
one Ann Demo account only. Name = **Campaign - Cause - Donor - date time** (D-38), e.g. "Christmas Giving 2026 - School Supplies - Ann
Demo - 2026-10-27 09:15", the same text as the thank-you step's Reference; a recurring gift's commitment has the same name. Time = org time zone (D-39). A gift created in Salesforce
(any name typed) is re-named to the same format once its cause is saved.

## 4. Guest security

- Private window: `/dashboard` redirects to login; `/donate` works.
- Guest profile has Apex access to `TSAbcHopeDonationIntakeController` only; Run Flows off.
- Tampered `designationId` or campaign name is rejected server-side.

## 5. Signed-in donor (Maya)

Sign in (Handover → How to sign in as Maya) → lands on `/dashboard`.

| #   | Check                       | Expected                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | Layout                      | Sidebar (Home, My Giving, Campaigns, Causes I Support, My Journey, Stories, Ask Our AI, My Profile), sprout photo, top bar with avatar                                                                                                                                                                                                                                                                                                                                                                                                                              |
| P2  | KPIs                        | USD 2,250+ total, 3+ causes, "Since 2023"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| P3  | Campaign cards              | Christmas Giving 2026, Clean Water, Girls' Education, Green Communities (+ any other active campaign with a default designation); progress bar, days left                                                                                                                                                                                                                                                                                                                                                                                                           |
| P4  | Card → donate               | Click Clean Water card → `/donate?campaign=…`; "Welcome back, Maya Grande" on step 2; submit → gift on Maya's account with Clean Water campaign                                                                                                                                                                                                                                                                                                                                                                                                                     |
| P4e | Impact (Maya)               | Shared impact tiles = sums of People Reached / Communities / Volunteers Engaged on active Programs, plus the active Program count (17,172 · 2,415 · 10 · 1,093 on 2026‑10‑26); edit a Program's numbers → tiles follow after a refresh. **Your Impact Journey**: one card per year, oldest first; each shows "USD … · N gifts", a "Joined" badge on the first year, and the year's causes with program and amount, largest first ("New" = first year for that cause); the year totals add up to Total Contributions                                                 |
| P4d | Programs (guest)            | `/our-work`: each program name links to `/program?name=…`; cards show live figures, e.g. Child Wellbeing "USD … raised · 60 people served · 60 … delivered". `/program?name=Family Support`: photo, "Impact so far" (50 people served, 396 holiday meals, 100 grocery vouchers), "Campaigns funding this program" with Donate →, causes, "Raised for this program" and Donate now; `/program?name=Nope` → "Program not found". After a Paid gift to a program's cause, its raised amount goes up. Campaign page: program names link to their program page           |
| P4f | Pick a campaign             | Header **Get Involved** or **Donate** → `/donate`: step 1 shows a **Campaign** list of all open campaigns with Christmas Giving 2026 selected; pick Christmas Toy Drive 2026 → photo, name and description change, Support lists Toys & Gifts, Warm Clothes, Books for Kids and Where Most Needed, hint "Funds our Child Wellbeing program."; Next → the gift goes to the picked campaign                                                                                                                                                                           |
| P4g | Paused status (back office) | Open a recurring gift whose pause covers today: Status **Paused**, Next Transaction Date = first gift after the pause (monthly: day 1). Gift with an upcoming pause: Status Active, next date already past the pause. Resume on My Giving: Status Active, next date = next gift from today. Pause starts or ends by date: the hourly job (:15) switches it at about 00:15 Bangkok time (D-40, D-42). Full manual pause test: see the Claude doc, "Manual test — pausing a recurring gift"                                                                           |
| P4c | Christmas campaigns         | Cards for **Christmas Toy Drive 2026** (presents photo, funds Child Wellbeing, Education Access · Toys & Gifts, Warm Clothes, Books for Kids) and **Christmas Meals for Families 2026** (table photo, Family Support · Holiday Meals, Grocery Vouchers, keeps the old Non Profit Event's gifts); a click anywhere on a card opens its detail page; `/donate?campaign=Christmas Toy Drive 2026` offers its three causes plus Where Most Needed, Toys & Gifts pre-selected; no "Non Profit Event" card; "USD 2,750 raised of USD 100,000" has a space before "raised" |
| P4b | Card links                  | Each card shows **Donate now** and **View more**; View more → `/campaign?name=…` with photo, progress, dates, "What your gift funds", "Causes you can choose" and Donate now; `/campaign?name=Nope` → "Campaign not found"; signed out → login, then back to the campaign                                                                                                                                                                                                                                                                                           |
| P5  | My Giving                   | `/my-giving` table shows the new gift                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| P6  | Profile                     | `/my-profile` → change phone → Save → "Your changes have been saved"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| P7  | Log out                     | Avatar menu → Log out → back to the public site                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

## 6. Agent (CLI preview — no chat widget needed)

```bash
sf agent preview start -o npo-demo --authoring-bundle ABC_Hope_Donor_Assistant --use-live-actions
sf agent preview send -o npo-demo --authoring-bundle ABC_Hope_Donor_Assistant --session-id <id> -u "What does the Christmas campaign fund?"
```

- Campaign questions → answer from org data + donate link + "no payment collected".
- "How many campaigns are there?" / "Are there any other campaigns?" → lists every open campaign (same set as
  the dashboard cards, P3) with progress and a `/donate?campaign=…` link each (D-20).
- "Tell me about clean water" → describes Clean Water for Rural Schools (partial name match) with its own causes.
- "How much have I given?" / "Pause my monthly gift" → politely asks to sign in (preview has no verified user).

## 7. No chat window (D-28)

- No chat button on any page; the assistant is only in the dashboard's Ask panel (§ agent panel steps).

### Former chat window steps (kept for reference)

- `/dashboard` has no chat window (the Ask panel is the chat there).

- Guest: chat opens; campaign FAQ works; personal requests → "please sign in".
- Maya signed in: "How much have I given?" → her totals and causes; "Pause gift 2 for 2 months"
  → paused in the same turn (no separate "yes", D-29), the schedule shows a pause; "Change my email to …" →
  Account updated. No console CORS/CSP errors.

## 8. E2E: monthly gift → pause → resume → change amount → cancel (Maya, on the site)

A donor starts a monthly gift on the site, then changes their mind over the following weeks, using
**My Giving → Recurring Gifts** (D-22, D-24). This adds a real (closed) monthly gift to Maya's history — fine for the demo.
Back-office expectations come from a rolled-back dry run in the org on 2026‑10‑22.

Back-office queries (replace `<gc>` with the commitment Id from E4):

```bash
sf data query -o npo-demo -q "SELECT Id, Name, Status, Campaign.Name, CreatedDate FROM GiftCommitment WHERE Donor.Name = 'Maya Grande' ORDER BY CreatedDate DESC LIMIT 3"
sf data query -o npo-demo -q "SELECT Type, StartDate, EndDate, TransactionAmount, TransactionPeriod FROM GiftCommitmentSchedule WHERE GiftCommitmentId = '<gc>' ORDER BY CreatedDate"
sf data query -o npo-demo -q "SELECT Name, Status, TransactionDueDate, OriginalAmount FROM GiftTransaction WHERE GiftCommitmentId = '<gc>' ORDER BY TransactionDueDate"
sf data query -o npo-demo -q "SELECT GiftDesignation.Name, GiftDesignation.NGOTV_Program__r.Name, AllocatedPercentage FROM GiftDefaultDesignation WHERE ParentRecordId = '<gc>'"
```

| #   | Step                                                                                            | Expected                                                                                                                                                                                                                                                                                                                            |
| --- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1  | Sign in as Maya → `/dashboard`                                                                  | Note the monthly line under the KPIs ("N active recurring gifts (Monthly)", absent when none) — the baseline. Campaign and story cards show photos, no drawings                                                                                                                                                                     |
| E2  | Christmas Giving 2026 card                                                                      | Card shows **Funds Education Access** above the designation chip (D-21). Click it                                                                                                                                                                                                                                                   |
| E3  | `/donate`: Recurring · Monthly → USD 500 → Support **School Supplies** → Next → Review → Submit | Hint "Funds our Education Access program."; step 2 "Welcome back, Maya Grande"; Review shows the campaign photo, Monthly · USD 500 · School Supplies; thank-you step shows the same photo and "Taking you to your dashboard in 5 seconds… Go now", then opens `/dashboard` (guests stay on the thank-you step, D-31)                |
| E4  | Back office                                                                                     | New commitment **Active**, campaign Christmas Giving 2026; one `CreateTransactions` schedule from today, no end, USD 500 Monthly; default designation School Supplies 100% (program Education Access); plus one **Paid** gift transaction today for USD 500, linked to the commitment (its first payment); later instalments Unpaid |
| E5  | `/dashboard` → **Manage** (next to the monthly line)                                            | Opens `/my-giving#monthly`; the line shows N + 1 active                                                                                                                                                                                                                                                                             |
| E6  | Recurring Gifts card for the new gift                                                           | "Recurring (Monthly)", "USD 500 / month", "School Supplies · Education Access program · Christmas Giving 2026", status **Active**, buttons Pause / Change amount / Cancel gift                                                                                                                                                      |
| E7  | **Pause** → 2 months → **Confirm pause**                                                        | Green notice "Paused from <today> to <today + 2 months − 1 day>…"; status "Paused <start> – <end>"; only Resume now / Cancel gift remain                                                                                                                                                                                            |
| E8  | Back office                                                                                     | Commitment **Paused** at once (D-40, D-43). Schedules: original ends yesterday (or is replaced if it started today); `PauseTransactions` today → pause end; new open `CreateTransactions` after it. One **Unpaid** transaction due after the pause                                                                                  |
| E9  | `/dashboard`                                                                                    | Recurring line: "N active recurring gifts · 1 paused until <end>" — the paused gift is no longer counted as active                                                                                                                                                                                                                  |
| E10 | My Giving → **Resume now**                                                                      | Notice "The recurring gift has been resumed."; status Active; the Unpaid transaction moves back to the next payment date                                                                                                                                                                                                            |
| E11 | **Change amount** → 50 → Save; then 800 → Save                                                  | 50 → inline error "between USD 100 and USD 1,000,000", nothing sent; 800 → "The amount is now USD 800 per month, starting <tomorrow>."; card shows USD 800 / month                                                                                                                                                                  |
| E12 | **Cancel gift** → **Keep my gift**; then **Cancel gift** → **Yes, cancel gift**                 | First time nothing changes; second time notice "The recurring gift has been cancelled…" and the card disappears                                                                                                                                                                                                                     |
| E13 | Back office                                                                                     | Commitment **Closed**. **Check** the upcoming Unpaid transaction: expected **Canceled** (not confirmed — see G3); the campaign's raised total on its card must not include it                                                                                                                                                       |
| E14 | `/dashboard`                                                                                    | Monthly line back to the baseline; past gifts and causes stay in My Giving → Giving History                                                                                                                                                                                                                                         |
| E15 | Security: private window → `/my-giving`                                                         | Redirects to login. (Server side, a gift Id that is not the signed-in donor's is rejected — covered by `TSAbcHopeDonorPortalControllerTest`)                                                                                                                                                                                        |

Notes:

- Fixed by D-22: paused gifts are shown and no longer counted as active; donors can pause/cancel on the portal.
- **G3** In the dry run, cancelling in the same database transaction as a pause/resume failed with a record-lock
  error on the upcoming transaction, so the cancelled transaction's final status is unconfirmed. Each button click
  runs in its own transaction; E13 is the real check.

## 9. Dashboard agent panel (Maya)

| #   | Ask in "Ask About Your Journey"                                       | Expected (today, `USE_AGENT_API = false`)                                                                                                             |
| --- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | "How much have I given?"                                              | The Donor Assistant answers with her own total, gift count, since year and causes (Agent API, verified); link "See my giving history" under the reply |
| A2  | Chips: Explore my causes / View giving history / Show next milestones | Answers from the assistant with links to Causes, My Giving, My Journey                                                                                |
| A3  | "Can I pause my monthly gift?"                                        | Assistant lists "Recurring (Monthly): USD … per month to …" and offers pause/resume/change/cancel; link "Manage recurring gifts"                      |
| A4  | "Which campaigns are open?" then "Tell me about clean water"          | Answers from the Donor Assistant ("Assistant is typing…"); the follow-up keeps the context                                                            |
| A4b | "Pause gift 2 for 1 month", then "Please resume it again"             | Each runs in one turn, no "yes" step (D-29), same NPC action as My Giving; My Giving shows Paused …, then active again                                |
| A5  | Long conversation                                                     | Panel stays within the screen height; the conversation scrolls; newest message in view                                                                |

| A6 | Header box on `/my-giving`: type "How much have I given?" → Enter | Goes to `/dashboard#agent`, the panel answers; `?ask=` disappears from the URL |
| A7 | Header box on `/dashboard`; then sidebar **Ask Our AI** | Answers in the panel without reloading; Ask Our AI scrolls to the panel and focuses its input |

After D-23 is finished (`USE_AGENT_API = true`), A1 and A3 come from the agent itself using Maya's verified account.

## Demo script (3–5 min)

1. Marketing email (screenshot) → link `/?src=XMAS26-EMAIL`.
2. Guest journey T2 → T8.
3. Salesforce: the new Gift Transaction — campaign, designation, source code, status.
4. Maya signs in → dashboard → Clean Water card → donates → My Giving shows it.
5. Ask the agent about her giving; pause her monthly gift.
6. Campaign record → raised vs goal.
