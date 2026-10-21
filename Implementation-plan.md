# Implementation Plan — ABC Hope · Christmas Giving 2026

Platform: Salesforce Nonprofit Cloud · Experience Cloud **LWR** site "ABC Hope" · org `npo-demo`.
Constraints: `decisions.md` — D-02 (no flows/VRs/custom objects/fields; one approved flow, D-16) and
D-04 (simulated payment).

Legend: ⬜ todo · 🟨 in progress · ✅ done · ⛔ deferred

---

## Task sheet (image #4) → where it landed

| #   | Task                      | Status | Where                                                                                      |
| --- | ------------------------- | ------ | ------------------------------------------------------------------------------------------ |
| 1   | Wireframe (steps 1–5)     | ✅     | Mockup #3 used as the wireframe; built as `abcHopeHero` + `donationJourney`                |
| 2   | Intake "screen flow"      | ✅     | Built as LWC + Apex instead (D-03, user decision) with dynamic visibility + validation     |
| 3   | Donor matching            | ✅     | `DonationIntakeService.matchOrCreateDonor` (D-06)                                          |
| 4   | Gift creation             | ✅     | One-time → `GiftTransaction`; monthly → `GiftCommitment` + schedule                        |
| 5   | Allocation mapping        | ✅     | Campaign + designation + outreach source code (D-07)                                       |
| 6   | Experience Cloud setup    | ✅     | Public LWR pages, theme layouts, publish                                                   |
| 7   | Guest user security       | ✅     | Guest profile → one Apex class; server-side validation (D-08)                              |
| 8   | Technical mapping doc     | ✅     | Table at the bottom of this file                                                           |
| 9   | Demo recording (optional) | ⬜     | Script in `testing-steps.md` → Demo script                                                 |
| 10  | Agent chat box            | 🟨     | Agent, routing, channel, deployment done; Embedded Messaging component placement is manual |

## Phase 0 — Setup ✅

- Org inspection, site baseline retrieved, project docs, GitHub (`Chaipitch/npo-dem`).

## Phase 1 — Demo data (records only) ✅

| Script                     | Creates                                                                                                                                                                                       |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `seedChristmasGiving.apex` | Campaign _Christmas Giving 2026_; designations School Supplies, Learning Kits, Where Most Needed; campaign default designation; outreach source code `XMAS26-EMAIL`                           |
| `seedCampaigns.apex`       | Goals (`ExpectedRevenue`), dates and descriptions for 4 campaigns; adds Clean Water for Rural Schools, Girls' Education Scholarships, Green Communities Tree Planting with their designations |
| `seedMayaHistory.apex`     | Maya Grande's 2023–2025 paid gifts (General Fund, Food Insecurity Fund, Job Training Fund)                                                                                                    |

## Phase 2 — Donation journey ✅

- `donationJourney` LWC: Choose (one-time/monthly, THB 300/500/1,000/Other, designation) → Details
  (Individual/Organization; skipped for signed-in donors) → Review ("Payment simulation only") → Thank you.
- `?campaign=<name>` selects the campaign (its own designations + Where Most Needed); `?src=` sets the
  outreach source code.
- Apex `DonationIntakeController` / `DonationIntakeService`: `getOptions`, `getCampaigns`, `submitDonation`;
  donor matching, gift creation, allocation, double-submit guard.

## Phase 3 — Site setup & guest security ✅

- Public access on, Network Live; Home + Donate public; portal pages require login.
- Theme layouts: `abcPublicLayout` (header/footer) and `abcPortalLayout` (sidebar/top bar) — D-10.
- Guest profile → `DonationIntakeController` only. CSP Trusted Site for Unsplash images (D-17).

## Phase 4 — Signed-in donor experience ✅

- Maya Grande portal user (Customer Community Login) + permission set `ABC_Hope_Donor_Portal`.
- Journey recognises the signed-in donor ("Welcome back"); `donorProfile` edits contact details.
- Login sends donors to `/dashboard`.

## Phase 5 — Donor portal home ✅

- `donorDashboard` (view=home): banner, KPI cards, **Campaigns You Can Support** (card → donate for that
  campaign), shared impact, stories, causes, impact journey, agent panel. View=giving on `/my-giving`.

## Phase 6 — Agentforce ✅ / 🟨

- ✅ Agent Script agent _ABC Hope Donor Assistant_ (D-15): campaign FAQ, my giving, monthly gifts
  (pause/resume/change/cancel via NPC standard actions), contact details.
- ✅ Routing flow `ABC_Hope_Chat_Routing` (D-16), channel + deployment `ABC_Hope_Chat`.
- 🟨 Place the Embedded Messaging component in Builder (Handover → Manual step).

## Phase 7 — Demo ⬜

- Optional 3–5 minute recording following `testing-steps.md` → Demo script.

## Deferred

- ⛔ `Donor_Intake_Gift_Commitment_ScreenFlow` — superseded by D-03.
- ⛔ Validation rules and custom fields (e.g. `Is_Simulated_Payment__c`) — D-02.
- ⬜ Real images for non-Christmas campaign cards and story cards.

---

## Technical mapping (task #8)

| UI (step)                  | Field                     | Salesforce target                                                                                               |
| -------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Dashboard · campaign card  | campaign                  | `Campaign` (active, not ended, has `GiftDefaultDesignation`) → `/donate?campaign=<Name>`                        |
| Choose · Frequency         | One-time / Monthly        | one-time → `GiftTransaction`; monthly → `GiftCommitment` + `GiftCommitmentSchedule.TransactionPeriod = Monthly` |
| Choose · Amount            | 300/500/1,000/Other       | `GiftTransaction.OriginalAmount` / `GiftCommitmentSchedule.TransactionAmount`                                   |
| Choose · Support           | designation               | `GiftTransactionDesignation.GiftDesignationId` / `GiftDefaultDesignation.GiftDesignationId` (100%)              |
| Details · Type             | Individual / Organization | `GiftTransaction.GiftType`; Person Account vs Business Account                                                  |
| Details · Name             | First / Last              | `Account.FirstName` / `Account.LastName` (Person Account)                                                       |
| Details · Org name         | Organization              | `Account.Name` (Business)                                                                                       |
| Details · Email            | email                     | `Account.PersonEmail` (match key)                                                                               |
| URL `?src=`                | source code               | `OutreachSourceCode.SourceCode` → `GiftTransaction.OutreachSourceCodeId`                                        |
| URL `?campaign=` / default | campaign                  | `Campaign.Name` → `CampaignId`                                                                                  |
| (implicit)                 | payment                   | `PaymentMethod = Unknown`, `Status = Unpaid` (simulated)                                                        |
| Card progress              | raised / goal             | `SUM(GiftTransaction.OriginalAmount)` per campaign / `Campaign.ExpectedRevenue`                                 |
