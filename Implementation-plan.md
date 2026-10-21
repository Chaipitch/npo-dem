# Implementation Plan — ABC Hope · Christmas Giving 2026

Platform: Salesforce Nonprofit Cloud · Experience Cloud **LWR** site "ABC Hope" · org `npo-demo`.
Constraints: see `decisions.md` (esp. D-02 no flows/VRs/custom objects/fields; D-04 simulated payment).

Legend: ⬜ todo · 🟨 in progress · ✅ done · ⛔ blocked/deferred

---

## Phase 0 — Setup ✅/🟨
- ✅ Inspect org (site, guest profile, NPC objects, agents, currency).
- ✅ Retrieve site baseline metadata into `force-app`.
- ✅ Project docs (this file, CLAUDE.md, Handover.md, decisions.md, testing-steps.md).
- ⛔ Push to GitHub — remote repo `Chaipitch/npo-demo` does not exist yet (see Handover).

## Phase 1 — Demo data (records only) ⬜
Script: `scripts/apex/seedChristmasGiving.apex` (idempotent, upsert by Name).
| Record | Object | Values |
|---|---|---|
| Christmas Giving 2026 | `Campaign` | Type Email, Status In Progress, Active, Start 2026‑11‑15, End 2026‑12‑31 |
| School Supplies | `GiftDesignation` | Active |
| (also offered) Learning Kits, Where Most Needed | `GiftDesignation` | Active — dropdown options |
| Campaign default | `GiftDefaultDesignation` | Parent = Campaign, School Supplies, 100% |
| Email – Christmas Appeal | `OutreachSourceCode` | SourceCode `XMAS26-EMAIL`, Campaign link |
| Maya Grande | existing Person Account `001g70000175AtRAAU` | reuse; add customer user in Phase 4 |

## Phase 2 — Guest donation journey (task sheet #1–#5) ⬜
**Wireframe (#1)**: mockup #3 is the approved wireframe; desktop + mobile.

**LWC** (`force-app/main/default/lwc`)
| Component | Purpose |
|---|---|
| `donationJourney` | Container: step state, nav, calls Apex. Exposed to LWR (`lightningCommunity__Page`, `lightningCommunity__Default`). Props: `campaignName`, `amountOptions` ("300,500,1000"), `currencyLabel` ("THB"), `heroImageUrl`. |
| `donationStepper` | 4-dot progress (Choose / Details / Review / Thank you) |
| `donationHero` | Step 1 "Make Christmas Brighter" hero + Donate Now CTA |
| `donationAmount` | One-time/Monthly toggle, amount tiles + Other, designation combobox |
| `donationDetails` | Individual/Organization toggle; First/Last name (or Org name + contact), email; client validation |
| `donationReview` | Summary card + "Submit Donation Details" + "Payment simulation only" |
| `donationThankYou` | Success state, amount + designation, "No payment collected" |

Dynamic visibility & validation (task #2, implemented in LWC since flows are deferred):
- Monthly shows "charged monthly from <date>" helper; Other shows numeric input (min 100, max 1,000,000).
- Organization shows Org name; Individual shows First/Last name.
- Email regex + required checks; Next disabled until valid; server re-validates.

**Apex** (`force-app/main/default/classes`)
| Class | Purpose |
|---|---|
| `DonationIntakeController` | `@AuraEnabled(cacheable=true) getOptions()` → active designations + campaign info; `@AuraEnabled submitDonation(String requestJson)` |
| `DonationIntakeService` | Validation, donor matching (#3), gift creation (#4), allocation (#5). `without sharing` (guest needs to match existing donors). |
| `DonationIntakeRequest` / `DonationIntakeResult` | DTOs |
| `DonationIntakeServiceTest`, `DonationIntakeControllerTest` | ≥ 85% coverage, positive/negative/bulk/guest (`System.runAs` guest user) |

Logic:
1. **Donor matching (#3)** — D-06.
2. **Gift creation (#4)** — one-time: `GiftTransaction` (Name `XMAS26-<donor>-<date>`, OriginalAmount, TransactionDate today, Status Unpaid, PaymentMethod Unknown, GiftType, DonorId, CampaignId, OutreachSourceCodeId). Monthly: `GiftCommitment` (DonorId, CampaignId, Status Active, ScheduleType Recurring, RecurrenceType OpenEnded, EffectiveStartDate) + `GiftCommitmentSchedule` (TransactionAmount, TransactionPeriod Monthly, TransactionInterval 1, StartDate, PaymentMethod Unknown, CampaignId, OutreachSourceCodeId). Existing org automation (`NGO_Coordinate_Gift_Commitment_Processing`) generates transactions.
3. **Allocation (#5)** — one-time: `GiftTransactionDesignation` 100% → chosen `GiftDesignation`. Monthly: `GiftDefaultDesignation` with ParentRecordId = GiftCommitment, 100%.

## Phase 3 — Site setup & guest security (task sheet #6–#7) ⬜ (needs user OK)
- New route/view `donate` (`/donate`) in `site/ABC_Hope1` with `c:donationJourney`; Home hero CTA → `/donate`.
- `sfdc_cms__site` `authenticationType`: `AUTHENTICATED` → `AUTHENTICATED_WITH_PUBLIC_ACCESS_ENABLED`; mark `donate` + `home` views public.
- Network status `UnderConstruction` → `Live`.
- Guest profile `ABC Hope Profile`: Apex class access `DonationIntakeController` only; review & strip any other perms; keep "Run Flows" off.
- Publish site.

## Phase 4 — Signed-in donor experience (mockup #2, steps 2–4) ⬜
- Login page branding; enable login for existing donors (Customer Community license profile + Network member profile). Create user for Maya Grande (`maya@email.com`) — **ask user** (creates a user/licence).
- `donationJourney` detects logged-in user → prefill, skip Details ("Welcome back, Maya Grande").
- `donorProfile` LWC: My Profile / Communication / Giving History tabs, edit name/email/phone/address (standard Person Account fields), Save Changes.
- `givingHistory` LWC: user's GiftTransactions (campaign, designation, amount, status).

## Phase 5 — Donor portal home (mockup #1) ⬜
- `donorHome` LWC: KPI cards (Total Contributions, Causes Supported, Supporter Since — from GiftTransaction aggregates), Shared Impact tiles (configurable props), Stories cards (CMS/Builder props), Impact Journey timeline (first gift date + designations by year).
- Left nav via LWR theme layout navigation menu.

## Phase 6 — Agent chat box (task sheet #10) ⬜
- Verify `Donor_Support_Agent` Embedded Service deployment (Messaging for Web) and its agent; add site to deployment, add site domain to CORS + Trusted URLs, add Embedded Messaging component / head markup to LWR site.
- Signed-in variant passes verified user context (hidden pre-chat fields) for "Ask About Your Journey".

## Phase 7 — Docs & demo (task sheet #8–#9) ⬜
- Technical mapping doc (#8): `docs/technical-mapping.md` — UI field → Apex DTO → Salesforce object.field (draft below).
- Demo recording (#9, optional): 3–5 min walkthrough following `testing-steps.md` §Demo script.

## Deferred (blocked by D-02 until user approves)
- ⛔ `Donor_Intake_Gift_Commitment_ScreenFlow` (task #2 as named).
- ⛔ Validation rules on GiftTransaction/GiftCommitment (e.g. amount > 0).
- ⛔ Any custom fields (e.g. `Is_Simulated_Payment__c`, `Donation_Channel__c`).

---

## Draft technical mapping (task #8)

| UI (step) | Field | Salesforce target |
|---|---|---|
| Choose · Frequency | One-time / Monthly | one-time → `GiftTransaction`; monthly → `GiftCommitment` + `GiftCommitmentSchedule.TransactionPeriod = Monthly` |
| Choose · Amount | 300/500/1,000/Other | `GiftTransaction.OriginalAmount` / `GiftCommitmentSchedule.TransactionAmount` |
| Choose · Support | designation | `GiftTransactionDesignation.GiftDesignationId` / `GiftDefaultDesignation.GiftDesignationId` (100%) |
| Details · Type | Individual / Organization | `GiftTransaction.GiftType`; Person Account vs Business Account |
| Details · Name | First / Last | `Account.FirstName` / `Account.LastName` (Person Account) |
| Details · Org name | Organization | `Account.Name` (Business) |
| Details · Email | email | `Account.PersonEmail` (match key) |
| URL `?src=` | source code | `OutreachSourceCode.SourceCode` → `GiftTransaction.OutreachSourceCodeId` |
| (implicit) | campaign | `Campaign` "Christmas Giving 2026" → `CampaignId` |
| (implicit) | payment | `PaymentMethod = Unknown`, `Status = Unpaid` (simulated) |
