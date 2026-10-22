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
sf apex run test -o npo-demo -n DonationIntakeServiceTest,DonationIntakeControllerTest,DonorPortalControllerTest,AbcHopeAgentActionsTest -c -r human -w 15
npm run test:unit
```

Pass criteria: 41 Apex test methods and 12 Jest tests pass.

## 2. Public journey (private window, desktop then 375 px)

| #   | Scenario         | Steps                                                         | Expected                                                                                                |
| --- | ---------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| T1  | Discover         | Open `/?src=XMAS26-EMAIL`                                     | Header (logo, nav, Donate), photo hero "Make Christmas Brighter", benefits strip                        |
| T2  | Defaults         | Click Donate Now                                              | `/donate?src=XMAS26-EMAIL`; step 1; One-time; THB 1,000; School Supplies; eyebrow Christmas Giving 2026 |
| T3  | Other amount     | Other → 50, then 2500                                         | 50 → inline error, cannot continue; 2500 → OK                                                           |
| T4  | Monthly          | Select Monthly                                                | Monthly hint; Review shows Monthly                                                                      |
| T5  | Validation       | Next with empty name / `ann@`                                 | Field errors                                                                                            |
| T6  | Organization     | Switch to Organization                                        | Org name shown, first/last hidden                                                                       |
| T7  | Back             | Review → Back twice                                           | Values kept                                                                                             |
| T8  | Submit           | Ann Demo / ann@example.com / 1,000 → Submit                   | "Your details have been received", THB 1,000 School Supplies, "No payment collected in this demo"       |
| T9  | Other campaign   | Open `/donate?campaign=Clean%20Water%20for%20Rural%20Schools` | Eyebrow + description for Clean Water; Support = Clean Water (+ Where Most Needed)                      |
| T10 | Unknown campaign | `/donate?campaign=Nope`                                       | "This campaign is not accepting donations right now."                                                   |

## 3. Back-office verification

```bash
sf data query -o npo-demo -q "SELECT Name, Donor.Name, OriginalAmount, Status, PaymentMethod, GiftType, Campaign.Name, OutreachSourceCode.SourceCode FROM GiftTransaction WHERE CreatedDate = TODAY ORDER BY CreatedDate DESC LIMIT 5"
sf data query -o npo-demo -q "SELECT GiftTransaction.Name, GiftDesignation.Name, Percent FROM GiftTransactionDesignation WHERE CreatedDate = TODAY"
sf data query -o npo-demo -q "SELECT Name, Donor.Name, Status, Campaign.Name FROM GiftCommitment WHERE CreatedDate = TODAY"
```

Expected: Status `Unpaid`, PaymentMethod `Unknown`, correct campaign and source code, designation 100%,
one Ann Demo account only.

## 4. Guest security

- Private window: `/dashboard` redirects to login; `/donate` works.
- Guest profile has Apex access to `DonationIntakeController` only; Run Flows off.
- Tampered `designationId` or campaign name is rejected server-side.

## 5. Signed-in donor (Maya)

Sign in (Handover → How to sign in as Maya) → lands on `/dashboard`.

| #   | Check          | Expected                                                                                                                                                  |
| --- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | Layout         | Sidebar (Home, My Giving, Campaigns, Causes I Support, My Journey, Stories, Ask Our AI, My Profile), sprout photo, top bar with avatar                    |
| P2  | KPIs           | THB 2,250+ total, 3+ causes, "Since 2023"                                                                                                                 |
| P3  | Campaign cards | Christmas Giving 2026, Clean Water, Girls' Education, Green Communities (+ any other active campaign with a default designation); progress bar, days left |
| P4  | Card → donate  | Click Clean Water card → `/donate?campaign=…`; "Welcome back, Maya Grande" on step 2; submit → gift on Maya's account with Clean Water campaign           |
| P5  | My Giving      | `/my-giving` table shows the new gift                                                                                                                     |
| P6  | Profile        | `/my-profile` → change phone → Save → "Your changes have been saved"                                                                                      |
| P7  | Log out        | Avatar menu → Log out → back to the public site                                                                                                           |

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

## 7. Agent on the site (after the Embedded Messaging component is placed)

- Guest: chat opens; campaign FAQ works; personal requests → "please sign in".
- Maya signed in: "How much have I given?" → her totals and causes; "Pause my monthly gift for 2 months"
  → agent restates and asks to confirm → after "yes", the schedule shows a pause; "Change my email to …" →
  confirm → Account updated. No console CORS/CSP errors.

## 8. E2E: monthly gift → pause → resume → change amount → cancel (Maya)

A donor starts a monthly gift on the site, then changes their mind over the following weeks. Steps
E6–E14 need the chat widget on the site (Handover → Manual step: chat widget); until it is placed, run
E1–E5 and E15 only. This adds a real (closed) monthly gift to Maya's history — that is fine for the demo.
Expected results for E4, E8, E10 and E13 come from a rolled-back dry run in the org on 2026‑10‑22.

Back-office queries used below (replace `<gc>` with the commitment Id from E4):

```bash
sf data query -o npo-demo -q "SELECT Id, Name, Status, Campaign.Name, CreatedDate FROM GiftCommitment WHERE Donor.Name = 'Maya Grande' ORDER BY CreatedDate DESC LIMIT 3"
sf data query -o npo-demo -q "SELECT Type, StartDate, EndDate, TransactionAmount, TransactionPeriod FROM GiftCommitmentSchedule WHERE GiftCommitmentId = '<gc>' ORDER BY CreatedDate"
sf data query -o npo-demo -q "SELECT Name, Status, TransactionDueDate, OriginalAmount FROM GiftTransaction WHERE GiftCommitmentId = '<gc>' ORDER BY TransactionDueDate"
sf data query -o npo-demo -q "SELECT GiftDesignation.Name, GiftDesignation.NGOTV_Program__r.Name, AllocatedPercentage FROM GiftDefaultDesignation WHERE ParentRecordId = '<gc>'"
```

| #   | Step                                                                                    | Expected                                                                                                                                                                                                                                                                                                                       |
| --- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| E1  | Sign in as Maya → `/dashboard`                                                          | Note the "N active monthly gifts" line under the KPIs (absent when N = 0) — this is the baseline                                                                                                                                                                                                                               |
| E2  | Christmas Giving 2026 card                                                              | Card shows **Funds Education Access** above the designation chip (D-21). Click it                                                                                                                                                                                                                                              |
| E3  | `/donate`: Monthly → THB 500 → Support **School Supplies** → Next → Review → Submit     | Hint "Funds our Education Access program." under Support; step 2 says "Welcome back, Maya Grande"; Review shows Monthly · THB 500 · School Supplies; thank-you step                                                                                                                                                            |
| E4  | Back office (queries above)                                                             | New commitment **Active**, campaign Christmas Giving 2026; one `CreateTransactions` schedule, start today, no end, THB 500 Monthly; default designation School Supplies 100% (program Education Access); no transactions yet                                                                                                   |
| E5  | Back to `/dashboard`                                                                    | Monthly line shows N + 1                                                                                                                                                                                                                                                                                                       |
| E6  | Chat: "Show my monthly gifts"                                                           | Numbered list includes "THB 500 per month to School Supplies (Christmas Giving 2026)"                                                                                                                                                                                                                                          |
| E7  | "Pause it for 2 months" (pick the number if asked)                                      | Agent restates and asks to confirm; after "yes": "Paused from <tomorrow> to <tomorrow + 2 months − 1 day>. Gifts restart automatically after that."                                                                                                                                                                            |
| E8  | Back office                                                                             | Commitment **still Active** (NPC does not use the Paused status for this). Schedules: original ends today; `PauseTransactions` tomorrow → pause end; new open `CreateTransactions` from the day after. One **Unpaid** transaction, due on the first payment date after the pause (e.g. 2027‑01‑01 for a pause starting 22 Oct) |
| E9  | Chat: "Show my monthly gifts"; then `/dashboard`                                        | Agent shows "— paused <start> to <end>". Dashboard still counts it as active (gap G1)                                                                                                                                                                                                                                          |
| E10 | "Resume my monthly gift" → yes                                                          | "The monthly gift has been resumed." Pause schedule becomes `CreateTransactions`; the Unpaid transaction moves back to the next payment date (e.g. 2026‑11‑01)                                                                                                                                                                 |
| E11 | "Change it to THB 800" → yes                                                            | "The monthly amount is now THB 800, starting <tomorrow>." Open schedule shows 800                                                                                                                                                                                                                                              |
| E12 | "Cancel my monthly gift" → yes                                                          | Agent confirms first; then "The monthly gift has been cancelled. No further gifts will be scheduled."                                                                                                                                                                                                                          |
| E13 | Back office                                                                             | Commitment **Closed**. **Check** the upcoming Unpaid transaction: expected **Canceled** (not confirmed — see G3). Christmas Giving 2026 "raised" on the dashboard card must not include it                                                                                                                                     |
| E14 | Chat: "Show my monthly gifts"; then `/dashboard`                                        | Cancelled gift no longer listed; monthly line back to N. Past gifts and causes stay in My Giving                                                                                                                                                                                                                               |
| E15 | Guards: guest chat "Pause my monthly gift"; Maya: "pause for 13 months"; "change to 50" | Guest → asked to sign in; 13 months → asked for 1–12; 50 → asked for THB 100–1,000,000. Nothing changes in the back office                                                                                                                                                                                                     |

Known gaps this scenario exposes (not fixed yet):

- **G1** Paused gifts: NPC keeps the commitment Active, so the dashboard counts it as active and shows no pause.
- **G2** No self-service pause/cancel on the portal pages — only through the agent (needs the chat widget).
- **G3** In the dry run, cancelling in the same database transaction as a pause/resume failed with a record-lock
  error on the upcoming transaction, so the cancelled transaction's final status is unconfirmed. Agent requests
  run in separate transactions; E13 is the real check.

## Demo script (3–5 min)

1. Marketing email (screenshot) → link `/?src=XMAS26-EMAIL`.
2. Guest journey T2 → T8.
3. Salesforce: the new Gift Transaction — campaign, designation, source code, status.
4. Maya signs in → dashboard → Clean Water card → donates → My Giving shows it.
5. Ask the agent about her giving; pause her monthly gift.
6. Campaign record → raised vs goal.
